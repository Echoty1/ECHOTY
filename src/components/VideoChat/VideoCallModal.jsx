// src/components/VideoChat/VideoCallModal.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { db } from '../../services/firebase';
import { ref, set, onValue, off, update, remove, get } from 'firebase/database';
import Avatar from '../common/Avatar';
import ringtoneSound from '../../utils/assets/ringtone.mp3';
import connectSound from '../../utils/assets/splash.mp3';
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
  const [isVideoOff, setIsVideoOff] = useState(true); // local camera starts off
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteVideoOff, setRemoteVideoOff] = useState(true); // assume off until signal says on
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
  const ringAudioRef = useRef(null);
  const connectAudioRef = useRef(null);
  const timerRef = useRef(null);
  const isMounted = useRef(true);
  const answeredRef = useRef(false);
  const handleAcceptRef = useRef(null);
  const facingModeRef = useRef('user');
  const connectedRef = useRef(false);
  const connectSoundPlayedRef = useRef(false);
  const isCallerRef = useRef(isCaller);
  const isMutedRef = useRef(false);
  const isVideoOffRef = useRef(true);

  // Stable callback refs so Peer is NOT destroyed/recreated
  const setupCallEventsRef = useRef(null);
  const endEverythingRef = useRef(null);
  const publishStatusRef = useRef(null);
  const publishMediaRef = useRef(null);
  const stopRingtoneRef = useRef(null);

  const myUid = currentUser?.uid;
  const theirUid = targetUser?.uid;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const invitePath =
    myUid && theirUid
      ? isCaller
        ? `calls/${theirUid}/${myUid}`
        : `calls/${myUid}/${theirUid}`
      : null;

  useEffect(() => {
    isCallerRef.current = isCaller;
  }, [isCaller]);

  // Profiles
  useEffect(() => {
    if (!theirUid) return;
    const r = ref(db, `profiles/${theirUid}`);
    const unsub = onValue(r, (snap) => {
      if (snap.exists()) {
        const d = snap.val() || {};
        setPartnerProfile({
          name: d.name || targetUser?.name || 'User',
          avatar: d.avatar || targetUser?.avatar || '',
        });
      }
    });
    return () => off(r);
  }, [theirUid, targetUser?.name, targetUser?.avatar]);

  useEffect(() => {
    if (!myUid) return;
    const r = ref(db, `profiles/${myUid}`);
    const unsub = onValue(r, (snap) => {
      if (snap.exists()) {
        const d = snap.val() || {};
        setMyProfile({
          name: d.name || currentUser?.name || 'You',
          avatar: d.avatar || currentUser?.avatar || '',
        });
      }
    });
    return () => off(r);
  }, [myUid, currentUser?.name, currentUser?.avatar]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.volume = 1;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const stopRingtone = useCallback(() => {
    if (ringAudioRef.current) {
      try {
        ringAudioRef.current.pause();
        ringAudioRef.current.currentTime = 0;
      } catch (_) {}
    }
  }, []);
  stopRingtoneRef.current = stopRingtone;

  const playConnectSound = useCallback(() => {
    if (connectSoundPlayedRef.current) return;
    connectSoundPlayedRef.current = true;
    try {
      if (!connectAudioRef.current) {
        connectAudioRef.current = new Audio(connectSound);
      }
      const a = connectAudioRef.current;
      a.currentTime = 0;
      a.volume = 0.7;
      a.play().catch(() => {});
    } catch (_) {}
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
        if (isCallerRef.current) {
          setCallDeclined(true);
          setCallStatus('Declined');
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
      setEndedByName(byName || 'User');
      setCallEnded(true);
      setCallStatus('Call Ended');
      setTimeout(() => {
        if (isMounted.current) onClose();
      }, 2000);
    },
    [onClose, stopRingtone, cleanupSignals]
  );
  endEverythingRef.current = endEverything;

  /**
   * Publish MY media state only where the OTHER person reads it.
   * Do NOT write to calls/{myUid}/signals/{theirUid}/media — that path is THEIR state.
   */
  const publishMediaState = useCallback(
    (muted, videoOff) => {
      if (!myUid || !theirUid) return;
      const payload = {
        muted: !!muted,
        videoOff: !!videoOff,
        updatedAt: Date.now(),
      };
      // Other person listens at: calls/{theirUid}/signals/{myUid}/media
      update(ref(db, `calls/${theirUid}/signals/${myUid}/media`), payload).catch(() => {});
    },
    [myUid, theirUid]
  );
  publishMediaRef.current = publishMediaState;

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
  publishStatusRef.current = publishStatus;

  const onRemoteStream = useCallback((stream) => {
    if (!isMounted.current) return;
    console.log('[Call] Remote stream received', {
      audio: stream.getAudioTracks().map((t) => ({ id: t.id, enabled: t.enabled, muted: t.muted })),
      video: stream.getVideoTracks().map((t) => ({ id: t.id, enabled: t.enabled })),
    });

    // Ensure remote tracks are enabled on our side for playback
    stream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });

    setRemoteStream(stream);
    setConnected(true);
    connectedRef.current = true;
    setCallStatus('Connected');
    stopRingtoneRef.current?.();
    playConnectSound();

    // If we have no media signal yet, infer video-off from track
    const vt = stream.getVideoTracks()[0];
    if (vt) {
      // don't force remoteVideoOff here if signal already set it; only soft default
      setRemoteVideoOff((prev) => {
        // keep signal value; this is just initial if still default
        return prev;
      });
    }

    if (timerRef.current) clearInterval(timerRef.current);
    let seconds = 0;
    timerRef.current = setInterval(() => {
      seconds += 1;
      if (isMounted.current) setCallDuration(seconds);
    }, 1000);

    publishStatusRef.current?.('connected');
  }, [playConnectSound]);

  const setupCallEvents = useCallback(
    (call) => {
      call.on('stream', onRemoteStream);
      call.on('close', () => {
        if (isMounted.current && connectedRef.current) {
          endEverythingRef.current?.('ended');
        }
      });
      call.on('error', (err) => console.error('[Call] MediaConnection error:', err));
    },
    [onRemoteStream]
  );
  setupCallEventsRef.current = setupCallEvents;

  // ─── Peer: create ONCE per mount (stable deps) ─────────────────
  useEffect(() => {
    if (!myUid) return;
    isMounted.current = true;
    answeredRef.current = false;
    connectedRef.current = false;
    connectSoundPlayedRef.current = false;

    const peer = new Peer(null, {
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });
    peerRef.current = peer;

    peer.on('open', (id) => {
      if (!isMounted.current) return;
      console.log('[Call] Peer ready:', id);
      setMyPeerId(id);
      set(ref(db, `peerIds/${myUid}`), id).catch(() => {});
    });

    peer.on('call', (incomingCall) => {
      console.log('[Call] PeerJS incoming call from', incomingCall.peer);
      if (answeredRef.current) {
        try {
          incomingCall.close();
        } catch (_) {}
        return;
      }
      // Caller answers when receiver dials
      if (isCallerRef.current) {
        const stream = localStreamRef.current;
        if (stream) {
          answeredRef.current = true;
          callRef.current = incomingCall;
          incomingCall.answer(stream);
          setupCallEventsRef.current?.(incomingCall);
          stopRingtoneRef.current?.();
          setCallStatus('Connecting…');
        } else {
          pendingCallRef.current = incomingCall;
          callRef.current = incomingCall;
        }
        return;
      }
      pendingCallRef.current = incomingCall;
      callRef.current = incomingCall;
    });

    peer.on('error', (err) => {
      console.error('[Call] Peer error:', err?.type || err);
      if (err?.type === 'peer-unavailable' && isMounted.current) {
        setCallStatus('Could not reach the other person. Try again.');
      }
    });

    peer.on('disconnected', () => {
      if (isMounted.current && !connectedRef.current) {
        try {
          peer.reconnect();
        } catch (_) {}
      }
    });

    return () => {
      isMounted.current = false;
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (_) {}
        peerRef.current = null;
      }
    };
  }, [myUid]); // ONLY myUid — do not recreate peer when callbacks change

  // Listen for THEIR media state only
  useEffect(() => {
    if (!myUid || !theirUid) return;
    // They publish to: calls/{myUid}/signals/{theirUid}/media
    const mediaRef = ref(db, `calls/${myUid}/signals/${theirUid}/media`);
    const unsub = onValue(mediaRef, (snap) => {
      if (!isMounted.current) return;
      if (!snap.exists()) return;
      const d = snap.val() || {};
      if (typeof d.muted === 'boolean') setRemoteMuted(d.muted);
      if (typeof d.videoOff === 'boolean') setRemoteVideoOff(d.videoOff);
    });
    return () => off(mediaRef);
  }, [myUid, theirUid]);

  // Status under our signals path
  useEffect(() => {
    if (!myUid || !theirUid) return;
    const statusRef = ref(db, `calls/${myUid}/signals/${theirUid}`);
    const unsub = onValue(statusRef, (snap) => {
      if (!snap.exists() || !isMounted.current) return;
      const data = snap.val() || {};
      if (data.status === 'declined') {
        stopRingtone();
        endEverything('declined');
      } else if (data.status === 'busy') {
        stopRingtone();
        if (!answeredRef.current) setCallStatus('On another call right now');
      } else if (data.status === 'ended') {
        endEverything('ended', data.endedByName || partnerProfile.name);
      } else if (data.status === 'connecting') {
        setCallStatus('Connecting…');
        stopRingtone();
      } else if (data.status === 'connected') {
        setCallStatus('Connected');
        stopRingtone();
      }
    });
    return () => off(statusRef);
  }, [myUid, theirUid, endEverything, stopRingtone, partnerProfile.name]);

  // Caller: invite path backup for decline
  useEffect(() => {
    if (!isCaller || !myUid || !theirUid) return;
    const inviteRef = ref(db, `calls/${theirUid}/${myUid}`);
    const unsub = onValue(inviteRef, (snap) => {
      if (!snap.exists() || !isMounted.current) return;
      const data = snap.val() || {};
      if (data.status === 'declined') {
        stopRingtone();
        endEverything('declined');
      } else if (data.status === 'busy') {
        stopRingtone();
        if (!answeredRef.current) setCallStatus('On another call right now');
      } else if (data.status === 'ended') {
        endEverything('ended', data.endedByName || partnerProfile.name);
      }
    });
    return () => off(inviteRef);
  }, [isCaller, myUid, theirUid, endEverything, stopRingtone, partnerProfile.name]);

  // Offline while ringing
  useEffect(() => {
    if (!isCaller || !theirUid || connected) return;
    let seenOnline = false;
    let offlineTimer = null;
    const pRef = ref(db, `presence/online/${theirUid}`);
    const unsub = onValue(pRef, (snap) => {
      if (!isMounted.current || connectedRef.current) return;
      const val = snap.val();
      if (val === true) {
        seenOnline = true;
        if (offlineTimer) {
          clearTimeout(offlineTimer);
          offlineTimer = null;
        }
        return;
      }
      if ((val === false || val === null) && seenOnline) {
        if (offlineTimer) return;
        offlineTimer = setTimeout(() => {
          if (!isMounted.current || connectedRef.current) return;
          stopRingtone();
          const msg = `${partnerProfile.name || 'User'} went offline`;
          setCallStatus(msg);
          setTimeout(() => endEverything('ended', msg), 1500);
        }, 1500);
      }
    });
    return () => {
      off(pRef);
      if (offlineTimer) clearTimeout(offlineTimer);
    };
  }, [isCaller, theirUid, connected, endEverything, stopRingtone, partnerProfile.name]);

  // Busy flag while connected
  useEffect(() => {
    if (!myUid || !connected) return;
    set(ref(db, `busy/${myUid}`), true).catch(() => {});
    return () => {
      remove(ref(db, `busy/${myUid}`)).catch(() => {});
    };
  }, [myUid, connected]);

  // Start media + invite invite once peer is ready
  useEffect(() => {
    if (!myPeerId || !myUid || !theirUid) return;
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingModeRef.current || 'user',
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        if (cancelled || !isMounted.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        // Video starts OFF, audio stays ON
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack) vTrack.enabled = false;
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });

        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsVideoOff(true);
        isVideoOffRef.current = true;
        isMutedRef.current = false;

        // Answer pending PeerJS call (caller)
        if (pendingCallRef.current && isCallerRef.current && !answeredRef.current) {
          answeredRef.current = true;
          callRef.current = pendingCallRef.current;
          pendingCallRef.current.answer(stream);
          setupCallEventsRef.current?.(pendingCallRef.current);
          setCallStatus('Connecting…');
        }

        if (isCaller) {
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

          // Remove old invite so onChildAdded fires on re-call
          try {
            await remove(ref(db, invitePath));
          } catch (_) {}

          const invitePayload = {
            callerId: myUid,
            callerPeerId: myPeerId,
            name: callerName,
            avatar: callerAvatar,
            status: 'ringing',
            timestamp: Date.now(),
          };
          await set(ref(db, invitePath), invitePayload);
          await publishStatus('ringing', { callerPeerId: myPeerId });
          // Publish my media (video off, mic on) to THEIR tree only
          publishMediaState(false, true);
          // DO NOT play ringtone on caller side — only receiver hears it
          console.log('[Call] Invite written', invitePath, 'peer', myPeerId);
        }

        if (isReceiver) {
          publishMediaState(false, true);
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

  const answerCall = useCallback((call, stream) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    callRef.current = call;
    call.answer(stream);
    setupCallEventsRef.current?.(call);
    setCallStatus('Connecting…');
    stopRingtone();
    publishStatusRef.current?.('connecting');
    publishMediaRef.current?.(isMutedRef.current, isVideoOffRef.current);
  }, [stopRingtone]);

  const handleAccept = async () => {
    stopRingtone();
    setCallStatus('Connecting…');
    const stream = localStreamRef.current;
    if (!stream) {
      setCallStatus('Camera not ready…');
      return;
    }
    if (!peerRef.current) {
      setCallStatus('Connection not ready…');
      return;
    }
    if (answeredRef.current) return;

    const existing = callRef.current || pendingCallRef.current;
    if (existing) {
      answerCall(existing, stream);
      return;
    }

    try {
      let callerPeerId = targetUser?.callerPeerId || null;

      if (!callerPeerId && invitePath) {
        const inviteSnap = await get(ref(db, invitePath));
        if (inviteSnap.exists()) callerPeerId = inviteSnap.val()?.callerPeerId || null;
      }
      if (!callerPeerId) {
        const sigSnap = await get(ref(db, `calls/${myUid}/signals/${theirUid}`));
        if (sigSnap.exists()) callerPeerId = sigSnap.val()?.callerPeerId || null;
      }
      if (!callerPeerId) {
        const pidSnap = await get(ref(db, `peerIds/${theirUid}`));
        if (pidSnap.exists()) callerPeerId = pidSnap.val();
      }

      if (!callerPeerId) {
        console.error('[Call] No callerPeerId');
        setCallStatus('Could not reach caller. Try again.');
        return;
      }

      console.log('[Call] Receiver dialing caller peer', callerPeerId);
      const call = peerRef.current.call(callerPeerId, stream);
      if (!call) {
        setCallStatus('Could not start connection.');
        return;
      }
      callRef.current = call;
      answeredRef.current = true;
      setupCallEventsRef.current?.(call);
      setCallStatus('Connecting…');
      publishStatusRef.current?.('connecting', { receiverPeerId: myPeerId });
      publishMediaRef.current?.(isMutedRef.current, isVideoOffRef.current);

      call.on('error', (err) => {
        console.error('[Call] Outgoing call error', err);
        if (isMounted.current) setCallStatus('Could not connect. Try again.');
      });
    } catch (err) {
      console.error('[Call] Accept dial failed:', err);
      setCallStatus('Connection failed');
    }
  };

  handleAcceptRef.current = handleAccept;

  // Receiver: auto-connect after banner Accept (modal opens as receiver)
  useEffect(() => {
    if (!isReceiver || connected || answeredRef.current) return;
    if (!myPeerId || !localStream) return;
    const t = setTimeout(() => handleAcceptRef.current?.(), 400);
    return () => clearTimeout(t);
  }, [isReceiver, connected, myPeerId, localStream]);

  const handleEndCall = () => {
    stopRingtone();
    publishStatus('ended', {
      endedByName: myProfile.name || 'User',
      by: myUid,
    });
    if (callRef.current) {
      try {
        callRef.current.close();
      } catch (_) {}
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (peerRef.current) {
      try {
        peerRef.current.destroy();
      } catch (_) {}
    }
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
    isMutedRef.current = muted;
    publishMediaState(muted, isVideoOffRef.current);
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    const off = !track.enabled;
    setIsVideoOff(off);
    isVideoOffRef.current = off;
    // Only publishes MY state to THEIR listen path — never overwrites theirs
    publishMediaState(isMutedRef.current, off);
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
      if (isVideoOffRef.current) newVideoTrack.enabled = false;

      const call = callRef.current;
      if (call && call.peerConnection) {
        const sender = call.peerConnection
          .getSenders()
          .find((s) => s.track && s.track.kind === 'video');
        if (sender) await sender.replaceTrack(newVideoTrack);
      }

      if (oldStream) {
        oldStream.getVideoTracks().forEach((t) => t.stop());
        const cloned = new MediaStream([
          newVideoTrack,
          ...(oldStream.getAudioTracks().length
            ? oldStream.getAudioTracks()
            : newStream.getAudioTracks()),
        ]);
        localStreamRef.current = cloned;
        setLocalStream(cloned);
        if (localVideoRef.current) localVideoRef.current.srcObject = cloned;
      } else {
        localStreamRef.current = newStream;
        setLocalStream(newStream);
      }
      if (oldStream?.getAudioTracks().length) {
        newStream.getAudioTracks().forEach((t) => t.stop());
      }
    } catch (err) {
      console.warn('[Call] switchCamera failed', err);
      facingModeRef.current = next === 'user' ? 'environment' : 'user';
    }
  };

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
      stopRingtone();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch (_) {}
      }
      if (myUid) remove(ref(db, `busy/${myUid}`)).catch(() => {});
    };
  }, [myUid, stopRingtone]);

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

  // Show partner avatar when we have no remote video to display
  const showPlaceholder = !remoteStream || remoteVideoOff;
  const showRings = isCaller && !connected && !remoteStream;

  return (
    <div className="echo-call">
      {/* Ringtone element exists but is only used if needed; caller never plays it */}
      <audio ref={ringAudioRef} src={ringtoneSound} preload="auto" loop />

      <div className="echo-call-stage">
        {/* Remote stream always attached for AUDIO even when video is off */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="echo-call-remote-video"
          style={{
            opacity: remoteStream && !remoteVideoOff ? 1 : 0,
            position: remoteStream && !remoteVideoOff ? 'relative' : 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            zIndex: remoteStream && !remoteVideoOff ? 1 : 0,
          }}
        />

        {showPlaceholder && (
          <div className="echo-call-placeholder" style={{ zIndex: 2 }}>
            {showRings && (
              <>
                <div className="echo-call-ring echo-call-ring-1" />
                <div className="echo-call-ring echo-call-ring-2" />
                <div className="echo-call-ring echo-call-ring-3" />
              </>
            )}
            <div className="echo-call-avatar-wrap">
              <Avatar
                src={partnerProfile.avatar}
                name={partnerProfile.name}
                size={isMobile ? 100 : 130}
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
          <button className="echo-call-btn" onClick={switchCamera} title="Flip camera">
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
