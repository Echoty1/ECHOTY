// src/components/common/UserPreviewModal.jsx
import React from 'react';
import ECHOMOJI from '../UI/ECHOMOJI';
import { getSkinById } from '../../constants/echomoji';
import Avatar from './Avatar';

const UserPreviewModal = ({ user, onClose, onChat }) => {
  if (!user) return null;

  const skin = user.activeSkin ? getSkinById(user.activeSkin) : null;
  const mood = user.mood || 'happy';

  return (
    <div className="user-preview-overlay" onClick={onClose}>
      <div className="user-preview-card" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="user-preview-close" onClick={onClose}>
          <i className="fas fa-times" />
        </button>

        {/* Avatar with glow ring */}
        <div className="user-preview-avatar-wrapper">
          <div className="user-preview-avatar-ring">
            <Avatar src={user.avatar} name={user.name} size={80} />
          </div>
        </div>

        {/* Name + ECHOMOJI side by side */}
        <div className="user-preview-name-row">
          <span className="user-preview-name">{user.name}</span>
          <span className="user-preview-echomoji">
            <ECHOMOJI
              mood={mood}
              skin={skin}
              size={36}
              interactive={false}
              animated={true}
            />
          </span>
        </div>

        {/* Bio */}
        {user.bio && (
          <p className="user-preview-bio">{user.bio}</p>
        )}

        {/* Chat button */}
        <button className="user-preview-chat-btn" onClick={onChat}>
          <i className="fas fa-comment" /> Chat
        </button>
      </div>

      <style>{`
        .user-preview-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.25s ease;
        }
        .user-preview-card {
          background: #12121A;
          border-radius: 28px;
          padding: 36px 30px 28px;
          max-width: 360px;
          width: 90%;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(108, 60, 225, 0.08);
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
          color: #666;
          font-size: 20px;
          cursor: pointer;
          transition: color 0.2s, transform 0.15s;
          z-index: 2;
        }
        .user-preview-close:hover {
          color: #fff;
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
        }
        .user-preview-avatar-ring > * {
          border-radius: 50%;
          border: 2px solid #12121A;
        }
        .user-preview-name-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 4px;
        }
        .user-preview-name {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.2px;
        }
        .user-preview-echomoji {
          display: inline-flex;
          line-height: 0;
        }
        .user-preview-bio {
          font-size: 14px;
          color: #bbb;
          line-height: 1.6;
          margin: 10px 0 20px;
          word-break: break-word;
          max-width: 80%;
          margin-left: auto;
          margin-right: auto;
          font-style: italic;
        }
        .user-preview-chat-btn {
          padding: 10px 32px;
          border-radius: 30px;
          border: none;
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          color: #fff;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 20px rgba(108, 60, 225, 0.2);
        }
        .user-preview-chat-btn:hover {
          transform: scale(1.04);
          box-shadow: 0 6px 30px rgba(108, 60, 225, 0.35);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.92); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default UserPreviewModal;