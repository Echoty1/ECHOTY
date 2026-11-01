// src/components/common/MessageNotifier.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { getNotifEnabled } from '../../services/notificationService';

const AUTO_DISMISS_MS = 4200;

const MessageNotifier = () => {
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const timeoutRef = useRef(null);

  // Listen for message-notify events
  useEffect(() => {
    const onNotify = (e) => {
      if (!getNotifEnabled()) return;
      const payload = e.detail;
      if (!payload?.partnerId) return;
      setQueue((prev) => [...prev, payload]);
    };
    window.addEventListener('echo-message-notify', onNotify);
    return () => window.removeEventListener('echo-message-notify', onNotify);
  }, []);

  // Pop from queue when idle
  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
  }, [queue, current]);

  // Auto-dismiss current
  useEffect(() => {
    if (!current) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCurrent(null);
    }, AUTO_DISMISS_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [current]);

  const handleClick = () => {
    if (!current) return;
    const targetId = current.partnerId;
    setCurrent(null);
    navigate(`/chat/${targetId}`);
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    setCurrent(null);
  };

  if (!current) return null;

  return (
    <>
      <style>{`
        .echo-msg-notifier {
          position: fixed;
          top: calc(env(safe-area-inset-top, 0px) + 12px);
          left: 50%;
          transform: translateX(-50%);
          z-index: 999999;
          width: min(420px, calc(100vw - 24px));
          cursor: pointer;
          animation: echoMsgDrop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes echoMsgDrop {
          from { opacity: 0; transform: translateX(-50%) translateY(-110%); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .echo-msg-card {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          background: rgba(20, 15, 35, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 18px;
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.5),
            0 0 0 1px rgba(108, 60, 225, 0.3),
            0 0 32px rgba(108, 60, 225, 0.2);
        }
        html.theme-light .echo-msg-card {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow:
            0 20px 60px rgba(0, 0, 0, 0.15),
            0 0 0 1px rgba(108, 60, 225, 0.25),
            0 0 32px rgba(108, 60, 225, 0.12);
        }
        .echo-msg-avatar {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          overflow: hidden;
          box-shadow: 0 0 0 2px rgba(108, 60, 225, 0.5);
          position: relative;
        }
        .echo-msg-avatar::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 2px solid #A78BFA;
          animation: echoMsgRing 1.6s ease-out infinite;
        }
        @keyframes echoMsgRing {
          0%   { transform: scale(1); opacity: 0.8; }
          70%  { transform: scale(1.35); opacity: 0; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        .echo-msg-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .echo-msg-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-primary, #fff);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .echo-msg-text {
          font-size: 13px;
          color: var(--text-secondary, #a1a1aa);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .echo-msg-badge {
          display: inline-block;
          font-size: 9.5px;
          font-weight: 800;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: #C4B5FD;
          margin-bottom: 2px;
        }
        .echo-msg-close {
          flex-shrink: 0;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: transparent;
          border: none;
          color: var(--text-muted, #71717a);
          font-size: 14px;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: background 0.15s ease, color 0.15s ease;
        }
        .echo-msg-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #fff);
        }
        html.theme-light .echo-msg-close:hover {
          background: rgba(0, 0, 0, 0.06);
        }
      `}</style>

      <div className="echo-msg-notifier" onClick={handleClick} role="button" tabIndex={0}>
        <div className="echo-msg-card">
          <div className="echo-msg-avatar">
            <Avatar src={current.avatar} name={current.name} size={44} />
          </div>
          <div className="echo-msg-body">
            <span className="echo-msg-badge">New Message</span>
            <span className="echo-msg-name">{current.name}</span>
            <span className="echo-msg-text">{current.text}</span>
          </div>
          <button
            type="button"
            className="echo-msg-close"
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </>
  );
};

export default MessageNotifier;
