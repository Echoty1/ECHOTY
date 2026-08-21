// src/components/VideoChat/VideoCallModal.jsx
// ECHO video call – dual-path signaling (both users can read under their own calls/{uid}/…)
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { db } from '../../services/firebase';
import { ref, set, onValue, off, update, remove, get } from 'firebase/database';
import Avatar from '../common/Avatar';
import ringtoneSound from '../../utils/assets/ringtone.mp3';
import './VideoCallModal.css';

const VideoCallModal = ({
  targetUser,
  currentUser,
  isCaller,
  isReceiver,
  onClose,
}) => {
  const [callStatus, setCallStatus] = useState(isCaller ? 'Ringing…' : 'Connecting…');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(true);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(true);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [callEnded, setCallEnded] = useState(false);
  const [callDeclined, setCallDeclined] = useState(false);
  const [endedByName, setEndedByName] = useState('');
  const [connected, setConnected] = useState(false);
  const [myPeerId, setMyPeerId] = useState(null);

  const [partnerProfile, setPartnerProfile] = useState({
    name: targetUser?.name || 'User',
    avatar: targetUser?.avatar || '',
  });
  const [myProfile, setMyProfile] = useState({
    name: currentUser?.name || 'You',
    avatar: currentUser?.avatar || '',
  });

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const pendingCallRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const isMounted = useRef(true);
  const unsubsRef = useRef([]);
  const answeredRef = useRef(false);
  const handleAcceptRef = useRef(null);
  const facingModeRef = useRef('user');
  const myUid = currentUser?.uid;
  const theirUid = targetUser?.uid;

  // invite: calls/{recipient}/{caller} – banner for recipient
  // signals: calls/{readerUid}/signals/{otherUid} – each user reads under their own uid
  const invitePath =
    myUid && theirUid
      ? isCaller
        ? `calls/${theirUid}/${myUid}`
        : `calls/${myUid}/${theirUid}`
      : null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Partner profile from DB
  useEffect(() => {
    if (!theirUid) return;
    const pRef = ref(db, `profiles/${theirUid}`);
    onValue(pRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.val();
      setPartnerProfile({
        name: d.name || targetUser?.name || 'User',
        avatar: d.avatar || '',
      });
    });
    return () => off(pRef);
  }, [theirUid, targetUser?.name]);

  // My profile from DB (for PiP when camera off)
  useEffect(() => {
    if (!myUid) return;
    const pRef = ref(db, `profiles/${myUid}`);
    onValue(pRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.val();
      setMyProfile({
        name: d.name || currentUser?.name || 'You',
        avatar: d.avatar || currentUser?.avatar || '',
      });
    });
    return () => off(pRef);
  }, [myUid, currentUser?.name, currentUser?.avatar]);

  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const cleanupSignals = useCallback(() => {
    if (!myUid || !theirUid) return;
    if (invitePath) remove(ref(db, invitePath)).catch(() => {});
    remove(ref(db, `calls/${myUid}/signals/${theirUid}`)).catch(() => {});
    remove(ref(db, `calls/${theirUid}/signals/${myUid}`)).catch(() => {});
  }, [myUid, theirUid, invitePath]);

  const endEverything = useCallback(
    (reason = 'ended', byName = '') => {
      if (!isMounted.current) return;
      stopRingtone();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (reason === 'declined') {
        if (isCaller) {
          setCallDeclined(true);
          setCallStatus('Declined');
          // Delay cleanup so declined status stays readable; then close
          setTimeout(() => {
            cleanupSignals();
            if (isMounted.current) onClose();
          }, 2500);
        } else {
          cleanupSignals();
          onClose();
        }
        return;
      }

      cleanupSignals();
      setEndedByName(byName || partnerProfile.name || 'User');
      setCallEnded(true);
      setCallStatus('Call Ended');
      setTimeout(() => {
        if (isMounted.current) onClose();
      }, 2000);
    },
    [onClose, stopRingtone, isCaller, cleanupSignals, partnerProfile.name]
  );

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Write MY media where THEY can read it: calls/{theirUid}/signals/{myUid}/media
  const publishMediaState = useCallback(
    (muted, videoOff) => {
      if (!myUid || !theirUid) return;
      set(ref(db, `calls/${theirUid}/signals/${myUid}/media`), {
        muted: !!muted,
        videoOff: !!videoOff,
        updatedAt: Date.now(),
      }).catch((e) => console.warn('[Call] media publish failed', e));
    },
    [myUid, theirUid]
  );

  // Status on both signal nodes so either side can read under their own uid
  const publishStatus = useCallback(
    async (status, extra = {}) => {
      if (!myUid || !theirUid) return;
      const payload = { status, updatedAt: Date.now(), by: myUid, ...extra };
      if (invitePath) update(ref(db, invitePath), payload).catch(() => {});
      update(ref(db, `calls/${myUid}/signals/${theirUid}`), payload).catch(() => {});
      update(ref(db, `calls/${theirUid}/signals/${myUid}`), payload).catch(() => {});
    },
    [myUid, theirUid, invitePath]
  );

  const setupCallEvents = useCallback(
    (call) => {
      call.on('stream', (stream) => {
        if (!isMounted.current) return;
        console.log('[Call] Remote stream received');
        setRemoteStream(stream);
        setConnected(true);
        setCallStatus('Connected');
        stopRingtone();
        if (timerRef.current) clearInterval(timerRef.current);
        let seconds = 0;
        timerRef.current = setInterval(() => {
          seconds += 1;
          if (isMounted.current) setCallDuration(seconds);
        }, 1000);
      });
      call.on('close', () => {
        if (isMounted.current) endEverything('ended', partnerProfile.name);
      });
      call.on('error', (err) => console.error('[Call] MediaConnection error:', err));
    },
    [endEverything, stopRingtone, partnerProfile.name]
  );

  // Peer setup
  useEffect(() => {
    if (!myUid) return;
    isMounted.current = true;
    answeredRef.current = false;

    const peer = new Peer(null, {
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });
    peerRef.current = peer;

    peer.on('call', (incomingCall) => {
      console.log('[Call] PeerJS incoming call');
      if (answeredRef.current) return;
      if (isCaller && localStreamRef.current) {
        answeredRef.current = true;
        callRef.current = incomingCall;
        incomingCall.answer(localStreamRef.current);
        setupCallEvents(incomingCall);
        return;
      }
      if (!callRef.current) {
        pendingCallRef.current = incomingCall;
        callRef.current = incomingCall;
      }
    });

    peer.on('open', (id) => {
      if (!isMounted.current) return;
      setMyPeerId(id);
      set(ref(db, `peerIds/${myUid}`), id).catch(() => {});
      console.log('[Call] Peer ready:', id);
    });

    peer.on('error', (err) => console.error('[Call] Peer error:', err?.type || err));
    peer.on('disconnected', () => {
      if (isMounted.current && !callEnded && !callDeclined) {
        try { peer.reconnect(); } catch (_) {}
      }
    });

    return () => {
      isMounted.current = false;
      unsubsRef.current.forEach((fn) => { try { fn(); } catch (_) {} });
      unsubsRef.current = [];
      if (peerRef.current) {
        try { peerRef.current.destroy(); } catch (_) {}
        peerRef.current = null;
      }
    };
  }, [myUid]);

  // Listen for THEIR media under MY tree
  useEffect(() => {
    if (!myUid || !theirUid) return;
    const mediaRef = ref(db, `calls/${myUid}/signals/${theirUid}/media`);
    onValue(mediaRef, (snap) => {
      if (!snap.exists()) return;
      const m = snap.val();
      setRemoteMuted(!!m.muted);
      setRemoteVideoOff(m.videoOff !== false); // default true if missing
    });
    return () => off(mediaRef);
  }, [myUid, theirUid]);

  // Listen for status under MY signal path
  useEffect(() => {
    if (!myUid || !theirUid) return;
    const sigRef = ref(db, `calls/${myUid}/signals/${theirUid}`);
    onValue(sigRef, (snap) => {
      if (!snap.exists() || !isMounted.current) return;
      const data = snap.val();
      if (data.status === 'declined') {
        console.log('[Call] Received declined status');
        stopRingtone();
        endEverything('declined');
      } else if (data.status === 'busy') {
        stopRingtone();
        if (!answeredRef.current) {
          setCallStatus('On another call right now');
        }
      } else if (data.status === 'ended') {
        const name =
          data.endedByName ||
          (data.by === theirUid ? partnerProfile.name : partnerProfile.name);
        endEverything('ended', name);
      } else if (data.status === 'connecting') {
        setCallStatus('Connecting…');
        stopRingtone();
      } else if (data.status === 'connected') {
        setCallStatus('Connected');
        stopRingtone();
      }
    });
    return () => off(sigRef);
  }, [myUid, theirUid, endEverything, stopRingtone, partnerProfile.name]);



  // Caller backup: also listen on the invite node under recipient's tree
  useEffect(() => {
    if (!isCaller || !myUid || !theirUid) return;
    const inviteRef = ref(db, `calls/${theirUid}/${myUid}`);
    const unsub = onValue(inviteRef, (snap) => {
      if (!snap.exists() || !isMounted.current) return;
      const data = snap.val();
      if (data.status === 'declined') {
        console.log('[Call] Invite path declined');
        stopRingtone();
        endEverything('declined');
      } else if (data.status === 'busy') {
        stopRingtone();
        if (!answeredRef.current) {
          setCallStatus('On another call right now');
        }
      } else if (data.status === 'ended') {
        endEverything('ended', data.endedByName || partnerProfile.name);
      }
    });
    return () => off(inviteRef);
  }, [isCaller, myUid, theirUid, endEverything, stopRingtone, partnerProfile.name]);

  // Caller: if they go offline before we connect, end the call
  useEffect(() => {
    if (!isCaller || !theirUid || connected) return;
    let seenOnline = false;
    const pRef = ref(db, `presence/online/${theirUid}`);
    const unsub = onValue(pRef, (snap) => {
      if (!isMounted.current || connected) return;
      const val = snap.val();
      if (val === true) {
        seenOnline = true;
        return;
      }
      // false / null → offline. Only cut after we know they were online or after a short grace.
      if (val === false || val === null) {
        if (!seenOnline) {
          // Give a moment for presence to load
          return;
        }
        stopRingtone();
        setCallStatus(`${partnerProfile.name || 'User'} went offline`);
        setTimeout(() => {
          if (isMounted.current && !connected) {
            endEverything('ended', `${partnerProfile.name || 'User'} went offline`);
          }
        }, 1800);
      }
    });
    return () => off(pRef);
  }, [isCaller, theirUid, connected, endEverything, stopRingtone, partnerProfile.name]);

  // One-time busy check at call start only (NOT continuous – accepting marks busy too)
  useEffect(() => {
    if (!isCaller || !theirUid) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await get(ref(db, `busy/${theirUid}`));
        if (cancelled || !isMounted.current) return;
        // Only if already busy BEFORE our invite is answered
        if (snap.exists() && snap.val() === true) {
          // Re-check after 1.5s: if they accepted us, status will move past ringing
          setTimeout(async () => {
            if (cancelled || !isMounted.current || connected || answeredRef.current) return;
            const again = await get(ref(db, `busy/${theirUid}`));
            // Still busy and we never got connecting/connected → treat as other call
            if (again.exists() && again.val() === true && callStatus === 'Ringing…') {
              setCallStatus('On another call right now');
            }
          }, 1500);
        }
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [isCaller, theirUid]); // intentionally not callStatus/connected

  // Mark ourselves busy only while connected (not while still ringing as caller)
  useEffect(() => {
    if (!myUid) return;
    if (isCaller && !connected) return; // callers: don't mark busy until connected
    set(ref(db, `busy/${myUid}`), true).catch(() => {});
    return () => {
      remove(ref(db, `busy/${myUid}`)).catch(() => {});
    };
  }, [myUid, isCaller, connected]);

  // Start media + signaling
  useEffect(() => {
    if (!myPeerId || !myUid || !theirUid) return;
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingModeRef.current || 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
        if (cancelled || !isMounted.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack) vTrack.enabled = false;

        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsVideoOff(true);

        if (isCaller) {
          // Resolve our real name + avatar from profiles before writing invite
          let callerName = myProfile.name || currentUser?.name || 'User';
          let callerAvatar = myProfile.avatar || currentUser?.avatar || '';
          try {
            const meSnap = await get(ref(db, `profiles/${myUid}`));
            if (meSnap.exists()) {
              const p = meSnap.val() || {};
              if (p.name) callerName = p.name;
              if (p.avatar) callerAvatar = p.avatar;
            }
          } catch (_) {}

          await set(ref(db, invitePath), {
            callerId: myUid,
            callerPeerId: myPeerId,
            name: callerName,
            avatar: callerAvatar,
            status: 'ringing',
            timestamp: Date.now(),
          });
          await publishStatus('ringing', { callerPeerId: myPeerId });
          publishMediaState(false, true);

          const peerIdRef = ref(db, `peerIds/${theirUid}`);
          let hasCalled = false;
          const tryCall = (recipientPeerId) => {
            if (hasCalled || !recipientPeerId || recipientPeerId === myPeerId) return;
            if (!peerRef.current || callRef.current) return;
            hasCalled = true;
            console.log('[Call] Dialing', recipientPeerId);
            const call = peerRef.current.call(recipientPeerId, stream);
            callRef.current = call;
            setupCallEvents(call);
          };
          get(peerIdRef).then((s) => { if (s.exists()) tryCall(s.val()); });
          onValue(peerIdRef, (s) => { if (s.exists()) tryCall(s.val()); });
          unsubsRef.current.push(() => off(peerIdRef));
        }

        if (isReceiver) {
          publishMediaState(false, true);
          await publishStatus('connecting');
        }
      } catch (err) {
        const msg = String(err?.message || err || '');
        console.error('[Call] start failed:', err);
        if (msg.includes('PERMISSION_DENIED') || msg.includes('Permission denied')) {
          alert('Could not start the call (database permission). Check Firebase rules for calls.');
        } else {
          alert('Please allow camera and microphone to make a call.');
        }
        onClose();
      }
    };

    start();
    return () => {
      cancelled = true;
      stopRingtone();
    };
  }, [myPeerId, isCaller, isReceiver, myUid, theirUid]);

  const answerCall = useCallback(
    (call, stream) => {
      if (answeredRef.current) return;
      answeredRef.current = true;
      callRef.current = call;
      call.answer(stream);
      setupCallEvents(call);
      setConnected(true);
      setCallStatus('Connected');
      stopRingtone();
      publishStatus('connected');
      publishMediaState(isMuted, isVideoOff);
    },
    [setupCallEvents, stopRingtone, publishStatus, publishMediaState, isMuted, isVideoOff]
  );

  const handleAccept = async () => {
    stopRingtone();
    setCallStatus('Connecting…');
    const stream = localStreamRef.current;
    if (!stream) {
      setCallStatus('Camera not ready…');
      return;
    }

    const existing = callRef.current || pendingCallRef.current;
    if (existing) {
      answerCall(existing, stream);
      return;
    }

    const waited = await new Promise((resolve) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const c = callRef.current || pendingCallRef.current;
        if (c) {
          clearInterval(iv);
          resolve(c);
        } else if (Date.now() - t0 > 4000) {
          clearInterval(iv);
          resolve(null);
        }
      }, 200);
    });
    if (waited) {
      answerCall(waited, stream);
      return;
    }

    try {
      let callerPeerId = null;
      if (invitePath) {
        const inviteSnap = await get(ref(db, invitePath));
        if (inviteSnap.exists()) callerPeerId = inviteSnap.val().callerPeerId || null;
      }
      if (!callerPeerId) {
        const pidSnap = await get(ref(db, `peerIds/${theirUid}`));
        if (pidSnap.exists()) callerPeerId = pidSnap.val();
      }
      if (!callerPeerId || !peerRef.current) {
        setCallStatus('Could not connect. Try again.');
        return;
      }
      const call = peerRef.current.call(callerPeerId, stream);
      answerCall(call, stream);
    } catch (err) {
      console.error('[Call] Reverse-call failed:', err);
      setCallStatus('Connection failed');
    }
  };

  handleAcceptRef.current = handleAccept;

  useEffect(() => {
    if (!isReceiver || connected || answeredRef.current) return;
    if (!myPeerId || !localStream) return;
    const t = setTimeout(() => handleAcceptRef.current?.(), 300);
    return () => clearTimeout(t);
  }, [isReceiver, connected, myPeerId, localStream]);

  const handleEndCall = () => {
    stopRingtone();
    publishStatus('ended', {
      endedByName: myProfile.name || 'User',
      by: myUid,
    });
    if (callRef.current) {
      try { callRef.current.close(); } catch (_) {}
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (peerRef.current) {
      try { peerRef.current.destroy(); } catch (_) {}
    }
    // Clean up immediately so the other side does not see a ghost re-ring
    cleanupSignals();
    onClose();
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const muted = !track.enabled;
    setIsMuted(muted);
    publishMediaState(muted, isVideoOff);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const videoOff = !track.enabled;
    setIsVideoOff(videoOff);
    publishMediaState(isMuted, videoOff);
    if (!videoOff && localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
  };


  const switchCamera = async () => {
    const next = facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = next;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: next }, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      const oldStream = localStreamRef.current;
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      // Keep mute / video-off state
      const oldAudio = oldStream?.getAudioTracks()[0];
      const newAudio = newStream.getAudioTracks()[0];
      if (newAudio && oldAudio) newAudio.enabled = oldAudio.enabled;
      if (isVideoOff) newVideoTrack.enabled = false;

      // Replace track on PeerJS media connection if possible
      const call = callRef.current;
      if (call && call.peerConnection) {
        const sender = call.peerConnection.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      // Stop old video track only
      if (oldStream) {
        oldStream.getVideoTracks().forEach((t) => t.stop());
        // Keep old stream, replace video track in local stream
        const cloned = new MediaStream([
          newVideoTrack,
          ...(oldStream.getAudioTracks().length
            ? oldStream.getAudioTracks()
            : newStream.getAudioTracks()),
        ]);
        localStreamRef.current = cloned;
        setLocalStream(cloned);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = cloned;
        }
      } else {
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      }

      // Stop unused audio from newStream if we kept old audio
      if (oldStream?.getAudioTracks().length) {
        newStream.getAudioTracks().forEach((t) => t.stop());
      }
    } catch (err) {
      console.warn('[Call] switchCamera failed', err);
      // revert ref on failure
      facingModeRef.current = next === 'user' ? 'environment' : 'user';
    }
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (callDeclined && isCaller) {
    return (
      <div className="echo-call">
        <div className="echo-call-result">
          <div className="echo-call-result-icon declined">📵</div>
          <h2 style={{ color: '#f87171' }}>Call Declined</h2>
          <p>{partnerProfile.name || 'This person'} declined your call.</p>
          <button className="echo-call-result-btn" onClick={onClose}>
            Back to ECHO
          </button>
        </div>
      </div>
    );
  }

  if (callEnded) {
    return (
      <div className="echo-call">
        <div className="echo-call-result">
          <div className="echo-call-result-icon ended">📡</div>
          <h2>Call Ended</h2>
          <p>
            {endedByName && String(endedByName).toLowerCase().includes('offline')
              ? endedByName
              : `${endedByName || partnerProfile.name} ended the call.`}
          </p>
          <button className="echo-call-result-btn" onClick={onClose}>
            Back to ECHO
          </button>
        </div>
      </div>
    );
  }

  const showPlaceholder = !remoteStream || remoteVideoOff;
  const showRings = isCaller && !connected && !remoteStream;

  return (
    <div className="echo-call">
      <audio ref={audioRef} src={ringtoneSound} preload="auto" loop />
      <div className="echo-call-brand">ECHO</div>

      <div className="echo-call-stage">
        {remoteStream && (
          <video
            ref={remoteVideoRef}
            className="echo-call-remote-video"
            autoPlay
            playsInline
            style={{
              opacity: remoteVideoOff ? 0 : 1,
              position: remoteVideoOff ? 'absolute' : 'relative',
            }}
          />
        )}

        {showPlaceholder && (
          <div className="echo-call-placeholder">
            {showRings && (
              <div className="echo-call-rings" aria-hidden>
                <div className="echo-call-ring" />
                <div className="echo-call-ring" />
                <div className="echo-call-ring" />
              </div>
            )}
            <div className="echo-call-avatar-wrap">
              <Avatar
                src={partnerProfile.avatar}
                name={partnerProfile.name}
                size={isMobile ? 100 : 128}
              />
            </div>
            <div className="echo-call-name">{partnerProfile.name}</div>
            <div className="echo-call-status">
              <span className={`echo-call-status-dot ${connected ? 'live' : ''}`} />
              {connected ? 'Connected' : callStatus}
            </div>
            {!connected && (
              <div className="echo-call-sub">
                {isCaller ? 'Waiting for them to join…' : 'Connecting…'}
              </div>
            )}
          </div>
        )}

        {remoteStream && !remoteVideoOff && (
          <div className="echo-call-live-chip">
            <Avatar src={partnerProfile.avatar} name={partnerProfile.name} size={26} />
            <span>{partnerProfile.name}</span>
            {connected && (
              <span className="duration">{formatDuration(callDuration)}</span>
            )}
          </div>
        )}

        {connected && remoteMuted && (
          <div className="echo-call-remote-mute-float">
            <i className="fas fa-microphone-slash" /> Mic muted
          </div>
        )}
      </div>

      <div className="echo-call-pip">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          style={{
            opacity: isVideoOff ? 0 : 1,
            position: isVideoOff ? 'absolute' : 'relative',
          }}
        />
        {isVideoOff && (
          <div className="echo-call-pip-avatar">
            <Avatar
              src={myProfile.avatar}
              name={myProfile.name}
              size={isMobile ? 48 : 56}
            />
          </div>
        )}
        <div className="echo-call-pip-label">You</div>
      </div>

      <div className="echo-call-controls">
        <button
          className={`echo-call-btn ${isMuted ? 'muted' : ''}`}
          onClick={toggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          <i className={`fas ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`} />
        </button>
        {isMobile && (
          <button
            className="echo-call-btn"
            onClick={switchCamera}
            title="Flip camera"
          >
            <i className="fas fa-sync-alt" />
          </button>
        )}
        <button
          className={`echo-call-btn ${isVideoOff ? 'video-off' : ''}`}
          onClick={toggleVideo}
          title={isVideoOff ? 'Camera on' : 'Camera off'}
        >
          <i className={`fas ${isVideoOff ? 'fa-video-slash' : 'fa-video'}`} />
        </button>
        <button className="echo-call-btn end" onClick={handleEndCall} title="End call">
          <i className="fas fa-phone-slash" />
        </button>
      </div>
    </div>
  );
};

export default VideoCallModal;
