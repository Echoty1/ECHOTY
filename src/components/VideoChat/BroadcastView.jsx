// src/components/VideoChat/BroadcastView.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';
import LiveChat from './LiveChat';
import './BroadcastView.css';

const BroadcastView = ({ onEnd, stream }) => {
  const videoRef = useRef(null);
  const { user } = useAuth();
  const [pulses, setPulses] = useState([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(false);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return onValue(ref(db, `live/${user.uid}/viewers`), (snap) => {
      const data = snap.val() || {};
      setViewerCount(Object.keys(data).filter((id) => id !== user.uid).length);
    });
  }, [user?.uid]);

  const handlePulse = useCallback((emoji) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const left = 12 + Math.random() * 70;
    setPulses((prev) => [...prev.slice(-18), { id, emoji, left }]);
    setTimeout(() => setPulses((prev) => prev.filter((p) => p.id !== id)), 2200);
  }, []);

  return (
    <div className="broadcast-view">
      <div className="broadcast-stage">
        <div className="broadcast-video-pane">
          <video ref={videoRef} autoPlay playsInline muted className="broadcast-video" />
          <div className="broadcast-video-ui">
            <div className="broadcast-top-bar">
              <span className="broadcast-live-badge">LIVE</span>
              <span className="broadcast-host-name">{user?.displayName || user?.name || 'You'}</span>
              <span className="broadcast-viewer-count">{viewerCount} watching</span>
              <button className="broadcast-end-btn" type="button" onClick={() => setConfirmEnd(true)}>
                <i className="fas fa-stop-circle" /> End
              </button>
            </div>
            <div className="broadcast-pulses" aria-hidden="true">
              {pulses.map((p) => (
                <span key={p.id} className="broadcast-pulse" style={{ left: `${p.left}%` }}>{p.emoji}</span>
              ))}
            </div>
            <button type="button" className="broadcast-chat-toggle" onClick={() => setChatOpen((v) => !v)}>
              <i className={`fas ${chatOpen ? 'fa-comment-slash' : 'fa-comments'}`} />
              {chatOpen ? 'Hide chat' : 'Show chat'}
            </button>
          </div>
        </div>
        <aside className={`broadcast-chat-pane ${chatOpen ? 'is-open' : 'is-closed'}`}>
          <LiveChat broadcasterId={user?.uid} isHost compact onPulse={handlePulse} />
        </aside>
      </div>

      {confirmEnd && (
        <div className="live-dialog-backdrop" role="dialog" aria-modal="true">
          <div className="live-dialog">
            <div className="live-dialog-kicker">End live</div>
            <h2 className="live-dialog-title">End this live stream?</h2>
            <p className="live-dialog-copy">Viewers will be disconnected and this live’s chat will be removed.</p>
            <div className="live-dialog-actions">
              <button type="button" className="live-dialog-ghost" onClick={() => setConfirmEnd(false)}>Keep streaming</button>
              <button type="button" className="live-dialog-danger" onClick={onEnd}>End live</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BroadcastView;
