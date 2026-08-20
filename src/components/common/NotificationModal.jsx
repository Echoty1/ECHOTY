// src/components/common/NotificationModal.jsx
import React from 'react';
import ReactDOM from 'react-dom';

const NotificationModal = ({ isOpen, onClose, title, body, timestamp }) => {
  if (!isOpen) return null;

  const formattedDate = timestamp
    ? new Date(timestamp).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return ReactDOM.createPortal(
    <div className="notif-modal-overlay" onClick={onClose}>
      <div className="notif-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="notif-modal-close" onClick={onClose}>
          <i className="fas fa-times" />
        </button>
        <div className="notif-modal-title">{title}</div>
        <div className="notif-modal-body">{body}</div>
        {timestamp && (
          <div className="notif-modal-time">
            <i className="far fa-clock" /> {formattedDate}
          </div>
        )}
      </div>

      <style>{`
        .notif-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          animation: notifFadeIn 0.2s ease;
        }
        .notif-modal-content {
          background: var(--bg-secondary);
          border-radius: 20px;
          padding: 32px 28px 24px;
          max-width: 420px;
          width: 90%;
          border: 1px solid var(--border-color);
          box-shadow: 0 24px 80px var(--shadow-color);
          animation: notifScaleIn 0.2s ease;
          position: relative;
        }
        .notif-modal-close {
          position: absolute;
          top: 14px;
          right: 16px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 20px;
          cursor: pointer;
          transition: color 0.2s, transform 0.15s;
        }
        .notif-modal-close:hover {
          color: var(--text-primary);
          transform: rotate(90deg);
        }
        .notif-modal-title {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 12px;
          padding-right: 30px;
        }
        .notif-modal-body {
          font-size: 15px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 16px;
          word-break: break-word;
        }
        .notif-modal-time {
          font-size: 12px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        @keyframes notifFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes notifScaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default NotificationModal;