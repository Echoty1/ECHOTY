// src/components/common/UserPreviewModal.jsx
import React from 'react';
import ECHOMOJI from '../UI/ECHOMOJI';
import { getSkinById } from '../../constants/echomoji';
import Avatar from './Avatar';

const UserPreviewModal = ({
  user,
  onClose,
  onChat,
  onVideoCall,
  onJoinLive,
  callerIsLive = false,
}) => {
  if (!user) return null;

  const skin = user.activeSkin ? getSkinById(user.activeSkin) : null;
  const isLive = user.isLive || false;
  // Call disabled if THEY are live OR YOU are live
  const callDisabled = isLive || callerIsLive;

  return (
    <div className="user-preview-overlay" onClick={onClose}>
      <div className="user-preview-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="user-preview-close" onClick={onClose}>
          <i className="fas fa-times" />
        </button>

        <div className="user-preview-avatar-wrapper">
          <div
            className="user-preview-avatar-ring"
            style={
              isLive
                ? {
                    background: 'linear-gradient(135deg, #ef4444, #f97316)',
                    boxShadow: '0 0 24px rgba(239, 68, 68, 0.5)',
                  }
                : undefined
            }
          >
            <Avatar src={user.avatar} name={user.name} size={80} />
          </div>
        </div>

        <div className="user-preview-name-row">
          <span className="user-preview-name">{user.name}</span>
          <span className="user-preview-echomoji">
            <ECHOMOJI
              mood={user.mood || 'happy'}
              skin={skin}
              size={36}
              interactive={false}
              animated={true}
            />
          </span>
          {isLive && (
            <span className="user-preview-live-badge">LIVE</span>
          )}
        </div>

        {user.bio && <p className="user-preview-bio">{user.bio}</p>}

        <div className="user-preview-actions">
          <button type="button" className="user-preview-chat-btn" onClick={onChat}>
            <i className="fas fa-comment" /> Chat
          </button>

          <button
            type="button"
            className={`user-preview-call-btn${callDisabled ? ' is-disabled' : ''}`}
            onClick={callDisabled ? undefined : onVideoCall}
            disabled={callDisabled}
            title={
              isLive
                ? 'User is live – join their stream instead'
                : callerIsLive
                ? 'End your live stream to call'
                : 'Video call'
            }
          >
            <i className="fas fa-video" /> Call
          </button>

          {isLive && (
            <button type="button" className="user-preview-join-btn" onClick={onJoinLive}>
              <i className="fas fa-broadcast-tower" /> Join Live
            </button>
          )}
        </div>
      </div>

      <style>{`
        .user-preview-overlay {
          position: fixed;
          inset: 0;
          z-index: 9990;
          background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease;
        }
        .user-preview-card {
          position: relative;
          width: min(360px, 100%);
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 24px;
          padding: 28px 24px 24px;
          text-align: center;
          box-shadow: 0 24px 60px var(--shadow-color);
          animation: scaleIn 0.25s ease;
        }
        .user-preview-close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 50%;
          background: var(--bg-input);
          color: var(--text-secondary);
          cursor: pointer;
          font-size: 16px;
        }
        .user-preview-avatar-wrapper {
          display: flex;
          justify-content: center;
          margin-bottom: 12px;
        }
        .user-preview-avatar-ring {
          border-radius: 50%;
          padding: 3px;
          line-height: 0;
        }
        .user-preview-avatar-ring > * {
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
        }
        .user-preview-name-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 4px;
          flex-wrap: wrap;
        }
        .user-preview-name {
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .user-preview-echomoji {
          display: inline-flex;
          line-height: 0;
        }
        .user-preview-live-badge {
          background: #ef4444;
          color: #fff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.5px;
          padding: 3px 10px;
          border-radius: 12px;
          animation: pulse-dot 1.5s infinite;
        }
        .user-preview-bio {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 10px 0 20px;
          font-style: italic;
        }
        .user-preview-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .user-preview-chat-btn,
        .user-preview-call-btn,
        .user-preview-join-btn {
          padding: 10px 20px;
          border-radius: 30px;
          border: none;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .user-preview-chat-btn {
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          color: #fff;
          box-shadow: 0 4px 20px rgba(108, 60, 225, 0.2);
        }
        .user-preview-call-btn {
          background: var(--bg-input);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }
        .user-preview-call-btn.is-disabled,
        .user-preview-call-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          pointer-events: none;
          transform: none;
        }
        .user-preview-join-btn {
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: #fff;
          box-shadow: 0 4px 20px rgba(239, 68, 68, 0.35);
          width: 100%;
          justify-content: center;
          margin-top: 4px;
          padding: 12px 20px;
          font-size: 15px;
        }
        .user-preview-join-btn:hover {
          transform: scale(1.02);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
      `}</style>
    </div>
  );
};

export default UserPreviewModal;
