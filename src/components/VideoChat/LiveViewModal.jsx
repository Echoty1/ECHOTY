// src/components/VideoChat/LiveViewModal.jsx
// View-only live stream (multi-viewer via PeerJS)
import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import { db } from '../../services/firebase';
import { ref, onValue, off, get } from 'firebase/database';
import Avatar from '../common/Avatar';

const LiveViewModal = ({ broadcasterId, broadcasterName, broadcasterAvatar, onClose }) => {
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const [status, setStatus] = useState('Connecting…');
  const [error, setError] = useState(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [profile, setProfile] = useState({
    name: broadcasterName || 'Live',
    avatar: broadcasterAvatar || '',
  });

  useEffect(() => {
    if (!broadcasterId) return;

    // Load profile
    const pRef = ref(db, `profiles/${broadcasterId}`);
    onValue(pRef, (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setProfile({
          name: d.name || broadcasterName || 'Live',
          avatar: d.avatar || '',
        });
      }
    });

    // Watch live node – if removed, stream ended
    const liveRef = ref(db, `live/${broadcasterId}`);
    const unsubLive = onValue(liveRef, (snap) => {
      if (!snap.exists()) {
        setStatus('Stream ended');
        setTimeout(() => onClose?.(), 1800);
      } else {
        const d = snap.val() || {};
        if (typeof d.viewers === 'number') setViewerCount(d.viewers);
      }
    });

    let cancelled = false;
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

    peer.on('open', async () => {
      if (cancelled) return;
      try {
        const snap = await get(ref(db, `live/${broadcasterId}/peerId`));
        const peerId = snap.val();
        if (!peerId) {
          // fallback: peerIds/{uid}
          const alt = await get(ref(db, `peerIds/${broadcasterId}`));
          if (!alt.exists()) {
            setError('Broadcaster is not available.');
            setStatus('Offline');
            return;
          }
          connectTo(alt.val());
          return;
        }
        connectTo(peerId);
      } catch (e) {
        console.error('[Live] peerId fetch failed', e);
        setError('Cannot reach broadcaster.');
        setStatus('Error');
      }
    });

    const connectTo = (peerId) => {
      if (cancelled || !peerRef.current) return;
      setStatus('Connecting…');
      // Viewer sends no stream – receive only
      const call = peerRef.current.call(peerId, null);
      if (!call) {
        setError('Could not start stream connection.');
        setStatus('Error');
        return;
      }
      call.on('stream', (remoteStream) => {
        if (cancelled) return;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.play().catch(() => {});
        }
        setStatus('Live');
        setError(null);
      });
      call.on('close', () => {
        setStatus('Stream ended');
        setTimeout(() => onClose?.(), 1500);
      });
      call.on('error', () => {
        setError('Cannot connect to stream.');
        setStatus('Error');
      });
    };

    peer.on('error', (err) => {
      console.error('[Live] peer error', err);
      setError('Connection error.');
      setStatus('Error');
    });

    return () => {
      cancelled = true;
      off(pRef);
      off(liveRef);
      if (peerRef.current) {
        try { peerRef.current.destroy(); } catch (_) {}
        peerRef.current = null;
      }
    };
  }, [broadcasterId, broadcasterName, onClose]);

  return (
    <div className="echo-live-viewer">
      <div className="echo-live-viewer-stage">
        {error ? (
          <div className="echo-live-viewer-error">
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <h2>{error}</h2>
            <button type="button" className="echo-live-viewer-close" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="echo-live-viewer-video" />
            {status !== 'Live' && (
              <div className="echo-live-viewer-status-overlay">{status}</div>
            )}
            <div className="echo-live-viewer-chip">
              <span className="echo-live-viewer-dot" />
              <Avatar src={profile.avatar} name={profile.name} size={28} />
              <span className="echo-live-viewer-name">{profile.name}</span>
              <span className="echo-live-viewer-badge">LIVE</span>
            </div>
            <button type="button" className="echo-live-viewer-leave" onClick={onClose}>
              Leave
            </button>
          </>
        )}
      </div>

      <style>{`
        .echo-live-viewer {
          position: fixed;
          inset: 0;
          z-index: 100000;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .echo-live-viewer-stage {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .echo-live-viewer-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
        }
        .echo-live-viewer-status-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255,255,255,0.8);
          font-size: 16px;
          font-weight: 600;
          background: rgba(0,0,0,0.4);
        }
        .echo-live-viewer-chip {
          position: absolute;
          top: 20px;
          left: 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: rgba(10,10,15,0.7);
          backdrop-filter: blur(16px);
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          font-size: 14px;
          font-weight: 600;
        }
        .echo-live-viewer-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 10px #ef4444;
          animation: livePulse 1.2s ease-in-out infinite;
        }
        @keyframes livePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .echo-live-viewer-badge {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #fff;
          background: #ef4444;
          padding: 3px 8px;
          border-radius: 8px;
        }
        .echo-live-viewer-leave {
          position: absolute;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 36px;
          border: none;
          border-radius: 28px;
          background: rgba(239,68,68,0.9);
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          box-shadow: 0 8px 28px rgba(239,68,68,0.35);
        }
        .echo-live-viewer-error {
          text-align: center;
          color: #fff;
          padding: 24px;
        }
        .echo-live-viewer-error h2 {
          margin: 0 0 20px;
          font-size: 18px;
          color: #fca5a5;
        }
        .echo-live-viewer-close {
          padding: 12px 32px;
          border: none;
          border-radius: 28px;
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default LiveViewModal;
