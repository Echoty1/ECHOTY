// src/components/common/UserPreviewModal.jsx
import React from 'react';
import ECHOMOJI from '../UI/ECHOMOJI';
import { getSkinById } from '../../constants/echomoji';
import Avatar from './Avatar';

const UserPreviewModal = ({ user, onClose, onChat, onVideoCall, onJoinLive }) => {
  if (!user) return null;

  const skin = user.activeSkin ? getSkinById(user.activeSkin) : null;
  const isLive = user.isLive || false;

  return (
    <div className="user-preview-overlay" onClick={onClose}>
      <div className="user-preview-card" onClick={(e) => e.stopPropagation()}>
        <button className="user-preview-close" onClick={onClose}>
          <i className="fas fa-times" />
        </button>

        <div className="user-preview-avatar-wrapper">
          <div className="user-preview-avatar-ring">
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
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '2px 10px',
                borderRadius: '12px',
                marginLeft: '6px',
                animation: 'pulse-dot 1.5s infinite',
              }}
            >
              LIVE
            </span>
          )}
        </div>

        {user.bio && <p className="user-preview-bio">{user.bio}</p>}

        <div className="user-preview-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="user-preview-chat-btn" onClick={onChat}>
            <i className="fas fa-comment" /> Chat
          </button>
          <button className="user-preview-call-btn" onClick={onVideoCall}>
            <i className="fas fa-video" /> Call
          </button>
          {isLive && (
            <button
              className="user-preview-join-btn"
              onClick={onJoinLive}
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '30px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)',
                transition: 'transform 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <i className="fas fa-eye" /> Join Live
            </button>
          )}
        </div>
      </div>

      <style>{`
        .user-preview-overlay {
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
          z-index: 10000;
          animation: fadeIn 0.2s ease;
        }
        .user-preview-card {
          background: var(--bg-secondary);
          border-radius: 28px;
          padding: 36px 30px 28px;
          max-width: 360px;
          width: 90%;
          text-align: center;
          border: 1px solid var(--border-color);
          box-shadow: 0 24px 80px var(--shadow-color);
          animation: scaleIn 0.25s ease;
          position: relative;
          overflow: hidden;
        }
        .user-preview-card::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle at 30% 20%, rgba(108, 60, 225, 0.06), transparent 70%);
          pointer-events: none;
        }
        .user-preview-close {
          position: absolute;
          top: 14px;
          right: 16px;
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 20px;
          cursor: pointer;
          transition: color 0.2s, transform 0.15s;
          z-index: 2;
        }
        .user-preview-close:hover {
          color: var(--text-primary);
          transform: rotate(90deg);
        }
        .user-preview-avatar-wrapper {
          display: flex;
          justify-content: center;
          margin-bottom: 12px;
        }
        .user-preview-avatar-ring {
          width: 88px;
          height: 88px;
          border-radius: 50%;
          padding: 4px;
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          box-shadow: 0 0 30px rgba(108, 60, 225, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .user-preview-avatar-ring > * {
          border-radius: 50%;
          border: 2px solid var(--bg-secondary);
          width: 100%;
          height: 100%;
          object-fit: cover;
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
          letter-spacing: -0.2px;
        }
        .user-preview-echomoji {
          display: inline-flex;
          line-height: 0;
        }
        .user-preview-bio {
          font-size: 14px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 10px 0 20px;
          word-break: break-word;
          max-width: 80%;
          margin-left: auto;
          margin-right: auto;
          font-style: italic;
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
          transition: transform 0.2s, box-shadow 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .user-preview-chat-btn {
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          color: #fff;
          box-shadow: 0 4px 20px rgba(108, 60, 225, 0.2);
        }
        .user-preview-chat-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 6px 30px rgba(108, 60, 225, 0.35);
        }
        .user-preview-call-btn {
          background: var(--bg-input);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }
        .user-preview-call-btn:hover {
          transform: scale(1.04);
          background: var(--border-color);
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
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
};

export default UserPreviewModal;