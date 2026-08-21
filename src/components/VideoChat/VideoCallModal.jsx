// src/components/VideoChat/VideoCallModal.jsx
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
  // ─── State ──────────────────────────────────────────────────────
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
  const [cameraError, setCameraError] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isMediaReady, setIsMediaReady] = useState(false);
  const [showStartScreen, setShowStartScreen] = useState(true); // show the "Start Call" button

  const [partnerProfile, setPartnerProfile] = useState({
    name: targetUser?.name || 'User',
    avatar: targetUser?.avatar || '',
  });
  const [myProfile, setMyProfile] = useState({
    name: currentUser?.name || 'You',
    avatar: currentUser?.avatar || '',
  });

  // ─── Refs ──────────────────────────────────────────────────────
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
  const myUid = currentUser?.uid;
  const theirUid = targetUser?.uid;

  const invitePath =
    myUid && theirUid
      ? isCaller
        ? `calls/${theirUid}/${myUid}`
        : `calls/${myUid}/${theirUid}`
      : null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // ─── Load partner profile ──────────────────────────────────────
  useEffect(() => {
    if (!theirUid) return;
    const pRef = ref(db, `profiles/${theirUid}`);
    const unsub = onValue(pRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.val();
      setPartnerProfile((prev) => ({
        name: d.name || prev.name || 'User',
        avatar: d.avatar || prev.avatar || '',
      }));
    });
    return () => off(pRef);
  }, [theirUid]);

  // ─── Load my profile ────────────────────────────────────────────
  useEffect(() => {
    if (!myUid) return;
    const pRef = ref(db, `profiles/${myUid}`);
    const unsub = onValue(pRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.val();
      setMyProfile({
        name: d.name || currentUser?.name || 'You',
        avatar: d.avatar || currentUser?.avatar || '',
      });
    });
    return () => off(pRef);
  }, [myUid, currentUser?.name, currentUser?.avatar]);

  // ─── Check permission state ────────────────────────────────────
  const checkPermissions = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      setPermissionState(result.state);
      result.onchange = () => setPermissionState(result.state);
    } catch (e) {
      // Permissions API not supported – assume prompt
      setPermissionState('prompt');
    }
  }, []);

  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // ─── Stop ringtone helper ─────────────────────────────────────
  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // ─── Cleanup signals ──────────────────────────────────────────
  const cleanupSignals = useCallback(() => {
    if (!myUid || !theirUid) return;
    if (invitePath) remove(ref(db, invitePath)).catch(() => {});
    remove(ref(db, `calls/${myUid}/signals/${theirUid}`)).catch(() => {});
    remove(ref(db, `calls/${theirUid}/signals/${myUid}`)).catch(() => {});
  }, [myUid, theirUid, invitePath]);

  // ─── End everything ────────────────────────────────────────────
  const endEverything = useCallback(
    (reason = 'ended', byName = '') => {
      if (!isMounted.current) return;
      stopRingtone();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      cleanupSignals();

      if (reason === 'declined') {
        if (isCaller) {
          setCallDeclined(true);
          setCallStatus('Declined');
          setTimeout(() => {
            if (isMounted.current) onClose();
          }, 2000);
        } else {
          onClose();
        }
        return;
      }

      setEndedByName(byName || partnerProfile.name || 'User');
      setCallEnded(true);
      setCallStatus('Call Ended');
      setTimeout(() => {
        if (isMounted.current) onClose();
      }, 2000);
    },
    [onClose, stopRingtone, isCaller, cleanupSignals, partnerProfile.name]
  );

  // ─── Publish media state ──────────────────────────────────────
  const publishMediaState = useCallback(
    (muted, videoOff) => {
      if (!myUid || !theirUid) return;
      const path = `calls/${theirUid}/signals/${myUid}/media`;
      set(ref(db, path), {
        muted: !!muted,
        videoOff: !!videoOff,
        updatedAt: Date.now(),
      }).catch((e) => console.warn('[Call] media publish failed', e));
    },
    [myUid, theirUid]
  );

  // ─── Publish status ────────────────────────────────────────────
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

  // ─── Setup call events ────────────────────────────────────────
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

  // ─── Peer setup ─────────────────────────────────────────────────
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

  // ─── Listen for remote media state ────────────────────────────
  useEffect(() => {
    if (!myUid || !theirUid) return;
    const mediaRef = ref(db, `calls/${myUid}/signals/${theirUid}/media`);
    const unsub = onValue(mediaRef, (snap) => {
      if (!snap.exists()) return;
      const m = snap.val();
      setRemoteMuted(!!m.muted);
      setRemoteVideoOff(m.videoOff !== false);
    });
    return () => off(mediaRef);
  }, [myUid, theirUid]);

  // ─── Listen for remote status ──────────────────────────────────
  useEffect(() => {
    if (!myUid || !theirUid) return;
    const sigRef = ref(db, `calls/${myUid}/signals/${theirUid}`);
    const unsub = onValue(sigRef, (snap) => {
      if (!snap.exists() || !isMounted.current) return;
      const data = snap.val();
      if (data.status === 'declined') {
        stopRingtone();
        endEverything('declined');
      } else if (data.status === 'ended') {
        const name =
          data.endedByName ||
          (data.by === theirUid ? partnerProfile.name : partnerProfile.name);
        endEverything('ended', name);
      } else if (data.status === 'connected') {
        setCallStatus((s) => (s === 'Ringing…' ? 'Connecting…' : s));
        stopRingtone();
      }
    });
    return () => off(sigRef);
  }, [myUid, theirUid, endEverything, stopRingtone, partnerProfile.name]);

  // ─── Start media (only called on user gesture) ────────────────
  const startMedia = useCallback(async () => {
    if (!myPeerId || !myUid || !theirUid) return;

    // Clean up any existing stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      if (!isMounted.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const vTrack = stream.getVideoTracks()[0];
      if (vTrack) vTrack.enabled = false;

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVideoOff(true);
      setCameraError(false);
      setIsMediaReady(true);
      setShowStartScreen(false);

      if (isCaller) {
        // Write invite
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
      console.error('[Call] getUserMedia failed:', err);
      setCameraError(true);
      setIsMediaReady(false);
    }
  }, [myPeerId, isCaller, isReceiver, myUid, theirUid, currentUser, myProfile, invitePath, publishStatus, publishMediaState, setupCallEvents]);

  // ─── Retry camera ──────────────────────────────────────────────
  const retryCamera = useCallback(() => {
    setCameraError(false);
    startMedia();
  }, [startMedia]);

  // ─── Open browser permission settings ─────────────────────────
  const openPermissionSettings = () => {
    const url = window.location.href;
    if (navigator.userAgent.includes('Chrome') || navigator.userAgent.includes('Edg')) {
      window.open(`chrome://settings/content/siteDetails?site=${encodeURIComponent(url)}`, '_blank');
    } else if (navigator.userAgent.includes('Firefox')) {
      window.open('about:preferences#privacy', '_blank');
    } else {
      alert('Please check your browser settings to allow camera and microphone for this site.');
    }
  };

  // ─── Answer call ──────────────────────────────────────────────
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

  // ─── Accept (receiver) ────────────────────────────────────────
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

  // ─── Auto‑accept for receiver ──────────────────────────────────
  useEffect(() => {
    if (!isReceiver || connected || answeredRef.current) return;
    if (!myPeerId || !localStream) return;
    const t = setTimeout(() => handleAcceptRef.current?.(), 300);
    return () => clearTimeout(t);
  }, [isReceiver, connected, myPeerId, localStream]);

  // ─── End call ──────────────────────────────────────────────────
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
    setTimeout(() => cleanupSignals(), 1500);
    onClose();
  };

  // ─── Toggle mute ───────────────────────────────────────────────
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

  // ─── Toggle video ──────────────────────────────────────────────
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

  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ─── Render ──────────────────────────────────────────────────────

  // Declined / Ended screens
  if (callDeclined && isCaller) {
    return (
      <div className="echo-call">
        <div className="echo-call-result">
          <div className="echo-call-result-icon declined">📵</div>
          <h2 style={{ color: '#f87171' }}>Call Declined</h2>
          <p>{partnerProfile.name} declined your call.</p>
          <button className="echo-call-result-btn" onClick={onClose}>Back</button>
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
          <p>{endedByName} ended the call.</p>
          <button className="echo-call-result-btn" onClick={onClose}>Back</button>
        </div>
      </div>
    );
  }

  // ─── Start screen (user gesture required) ─────────────────────
  if (showStartScreen) {
    return (
      <div className="echo-call">
        <div className="echo-call-result" style={{ padding: '40px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📞</div>
          <h2>{isCaller ? 'Calling' : 'Incoming Call'}</h2>
          <p style={{ marginBottom: 8 }}>
            {isCaller
              ? `Connecting to ${partnerProfile.name}...`
              : `${partnerProfile.name} is calling you...`}
          </p>
          <div className="echo-call-avatar-wrap" style={{ margin: '16px auto' }}>
            <Avatar src={partnerProfile.avatar} name={partnerProfile.name} size={100} />
          </div>
          <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 20 }}>
            {isCaller
              ? 'To start the call, allow camera and microphone access.'
              : 'To answer, allow camera and microphone access.'}
          </p>
          <button
            className="echo-call-result-btn"
            onClick={startMedia}
            style={{ fontSize: 18, padding: '14px 40px' }}
          >
            {isCaller ? 'Start Call' : 'Answer Call'}
          </button>
          {!isCaller && (
            <button
              className="echo-call-result-btn"
              style={{ marginLeft: 12, background: '#444', boxShadow: 'none' }}
              onClick={onClose}
            >
              Decline
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Camera error screen ──────────────────────────────────────
  if (cameraError) {
    const isDenied = permissionState === 'denied';
    return (
      <div className="echo-call">
        <div className="echo-call-result">
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎥</div>
          <h2 style={{ color: '#f87171' }}>
            {isDenied ? 'Camera Access Blocked' : 'Camera Error'}
          </h2>
          <p style={{ marginBottom: 8 }}>
            {isDenied
              ? 'You have denied camera access. Please unblock it in your browser settings.'
              : 'Unable to access camera. Please try again.'}
          </p>
          <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 20 }}>
            {isDenied
              ? 'Click the padlock icon in your address bar → Site settings → Reset permissions.'
              : 'Make sure no other app is using your camera.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="echo-call-result-btn" onClick={retryCamera}>
              Retry
            </button>
            {isDenied && (
              <button
                className="echo-call-result-btn"
                style={{ background: '#555', boxShadow: 'none' }}
                onClick={openPermissionSettings}
              >
                How to fix
              </button>
            )}
            <button
              className="echo-call-result-btn"
              style={{ background: '#444', boxShadow: 'none' }}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main call UI (only when media is ready) ──────────────────
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
              {connected && remoteVideoOff ? 'Camera off' : callStatus}
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
            <Avatar src={myProfile.avatar} name={myProfile.name} size={isMobile ? 48 : 56} />
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