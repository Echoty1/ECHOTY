// src/components/VideoChat/LiveViewModal.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'peerjs';
import { db } from '../../services/firebase';
import { ref, onValue, get, set, remove, onDisconnect } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../common/Avatar';
import LiveChat from './LiveChat';
import './LiveViewModal.css';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

const dummyCallStream = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 16, 16);
  const stream = canvas.captureStream(4);
  try {
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = actx.createMediaStreamDestination();
    dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  } catch (_) {}
  return stream;
};

const LiveViewModal = ({ broadcasterId, broadcasterName, broadcasterAvatar, onClose }) => {
  const { user } = useAuth();
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const callRef = useRef(null);
  const cancelledRef = useRef(false);
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [pulses, setPulses] = useState([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [endedOpen, setEndedOpen] = useState(false);
  const [profile, setProfile] = useState({
    name: broadcasterName || 'Live',
    avatar: broadcasterAvatar || '',
  });

  const handlePulse = useCallback((emoji) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const left = 12 + Math.random() * 70;
    setPulses((prev) => [...prev.slice(-18), { id, emoji, left }]);
    setTimeout(() => setPulses((prev) => prev.filter((p) => p.id !== id)), 2200);
  }, []);

  useEffect(() => {
    document.body.classList.add('echo-hide-bottom-nav');
    return () => document.body.classList.remove('echo-hide-bottom-nav');
  }, []);

  useEffect(() => {
    if (!broadcasterId || !user?.uid) return undefined;
    const seat = ref(db, `live/${broadcasterId}/viewers/${user.uid}`);
    set(seat, Date.now()).catch(() => {});
    onDisconnect(seat).remove().catch(() => {});
    return () => {
      remove(seat).catch(() => {});
    };
  }, [broadcasterId, user?.uid]);

  useEffect(() => {
    if (!broadcasterId) return undefined;
    const vRef = ref(db, `live/${broadcasterId}/viewers`);
    return onValue(vRef, (snap) => {
      const data = snap.val() || {};
      setViewerCount(Object.keys(data).filter((id) => id !== broadcasterId).length);
    });
  }, [broadcasterId]);

  useEffect(() => {
    if (!broadcasterId) return undefined;
    cancelledRef.current = false;

    const unsubProfile = onValue(ref(db, `profiles/${broadcasterId}`), (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setProfile({
          name: d.name || broadcasterName || 'Live',
          avatar: d.avatar || '',
        });
      }
    });

    const unsubLive = onValue(ref(db, `live/${broadcasterId}`), (snap) => {
      if (!snap.exists() && !cancelledRef.current) {
        setEndedOpen(true);
        setStatus('Ended');
      }
    });

    const peer = new Peer(undefined, {
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      debug: 0,
      config: ICE_CONFIG,
    });
    peerRef.current = peer;

    const attachRemote = (remoteStream) => {
      const el = remoteVideoRef.current;
      if (!el || !remoteStream) return;
      el.srcObject = remoteStream;
      el.muted = true;
      const play = () => {
        el.play()
          .then(() => {
            el.muted = false;
          })
          .catch(() => {});
      };
      play();
      el.onloadedmetadata = play;
    };

    const makeCall = (peerId) => {
      if (cancelledRef.current || !peerRef.current || !peerId) return;
      setStatus('Connecting…');
      try {
        if (callRef.current) {
          try { callRef.current.close(); } catch (_) {}
        }
        const call = peerRef.current.call(peerId, dummyCallStream());
        callRef.current = call;
        if (!call) {
          setError('Could not start the stream connection.');
          return;
        }
        call.on('stream', (remoteStream) => {
          if (cancelledRef.current) return;
          attachRemote(remoteStream);
          setStatus('Live');
          setError(null);
        });
        call.on('close', () => {
          if (!cancelledRef.current && !endedOpen) setStatus('Reconnecting…');
        });
        call.on('error', () => {
          if (!cancelledRef.current) setStatus('Reconnecting…');
        });
      } catch (_) {
        setError('Cannot connect to stream.');
      }
    };

    const start = async () => {
      for (let i = 0; i < 16 && !cancelledRef.current; i += 1) {
        const liveSnap = await get(ref(db, `live/${broadcasterId}`));
        if (!liveSnap.exists()) {
          setEndedOpen(true);
          return;
        }
        const livePeer = liveSnap.val()?.peerId;
        const alt = livePeer || (await get(ref(db, `peerIds/${broadcasterId}`))).val();
        if (alt && peerRef.current?.id) {
          makeCall(alt);
          setTimeout(() => {
            if (!cancelledRef.current && status !== 'Live' && remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
              makeCall(alt);
            }
          }, 4000);
          return;
        }
        await new Promise((r) => setTimeout(r, 700));
      }
      if (!cancelledRef.current) setError('Could not reach this live.');
    };

    peer.on('open', () => { start(); });
    peer.on('error', () => {
      if (!cancelledRef.current) setError('Network issue. Check your connection and try again.');
    });

    return () => {
      cancelledRef.current = true;
      unsubProfile();
      unsubLive();
      try { callRef.current?.close(); } catch (_) {}
      try { peer.destroy(); } catch (_) {}
      peerRef.current = null;
    };
  }, [broadcasterId, broadcasterName]);

  const closeEnded = () => {
    setEndedOpen(false);
    onClose?.();
  };

  return (
    <div className="live-viewer-modal">
      <div className="live-viewer-stage">
        <div className="live-viewer-video-pane">
          {error && !endedOpen ? (
            <div className="live-viewer-error">
              <h2>{error}</h2>
              <button type="button" onClick={onClose}>Close</button>
            </div>
          ) : (
            <>
              <video ref={remoteVideoRef} autoPlay playsInline className="live-viewer-video" />
              {status !== 'Live' && !endedOpen && (
                <div className="live-viewer-status-overlay">{status}</div>
              )}
              <div className="live-viewer-chip">
                <span className="live-viewer-dot" />
                <Avatar src={profile.avatar} name={profile.name} size={28} />
                <span className="live-viewer-name">{profile.name}</span>
                <span className="live-viewer-badge">LIVE</span>
                <span className="live-viewer-count">{viewerCount} watching</span>
              </div>
              <div className="broadcast-pulses" aria-hidden="true">
                {pulses.map((p) => (
                  <span key={p.id} className="broadcast-pulse" style={{ left: `${p.left}%` }}>{p.emoji}</span>
                ))}
              </div>
              <div className="live-viewer-actions">
                <button type="button" className="live-viewer-chat-toggle" onClick={() => setChatOpen((v) => !v)}>
                  <i className={`fas ${chatOpen ? 'fa-comment-slash' : 'fa-comments'}`} />
                  {chatOpen ? 'Hide chat' : 'Chat'}
                </button>
                <button type="button" className="live-viewer-leave" onClick={onClose}>Leave</button>
              </div>
            </>
          )}
        </div>
        <aside className={`live-viewer-chat-pane ${chatOpen ? 'is-open' : 'is-closed'}`}>
          <LiveChat broadcasterId={broadcasterId} isHost={false} compact onPulse={handlePulse} />
        </aside>
      </div>

      {endedOpen && (
        <div className="live-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="live-dialog">
            <div className="live-dialog-kicker">Live ended</div>
            <h2 className="live-dialog-title">{profile.name} has ended the live</h2>
            <p className="live-dialog-copy">The stream is no longer available. You can return to Home.</p>
            <button type="button" className="live-dialog-primary" onClick={closeEnded}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveViewModal;
