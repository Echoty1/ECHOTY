// src/components/Status/StatusViewer.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import {
  listenToUserStatuses,
  markStatusViewed,
  addReaction,
  deleteStatus,
} from '../../services/statusService';
import { STATUS_EMOJIS } from './statusEmojis';
import Avatar from '../common/Avatar';
import './StatusViewer.css';

const StatusViewer = ({ userId, onClose }) => {
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();
  const [statuses, setStatuses] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSeenBy, setShowSeenBy] = useState(false);

  const audioRef = useRef(null);
  const progressInterval = useRef(null);
  const isOwn = user?.uid === userId;

  const profile = profiles[userId] || {};
  const currentStatus = statuses[currentIndex];

  // Load statuses
  useEffect(() => {
    const unsub = listenToUserStatuses(userId, (list) => {
      setStatuses(list);
      if (list.length === 0) onClose();
    });
    return unsub;
  }, [userId, onClose]);

  // Mark as viewed + auto play
  useEffect(() => {
    if (!currentStatus || !user) return;

    // Mark as viewed (this makes it disappear for the viewer)
    markStatusViewed(userId, currentStatus.id, user.uid);

    // Fetch profiles of people who viewed (for owner)
    if (currentStatus.views) {
      Object.keys(currentStatus.views).forEach((uid) => {
        if (!profiles[uid]) fetchProfile?.(uid);
      });
    }

    if (audioRef.current) {
      audioRef.current.src = currentStatus.audioUrl;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentStatus?.id]);

  // Progress bar timer
  useEffect(() => {
    if (!isPlaying || !currentStatus) return;

    const duration = currentStatus.duration || 30;
    setProgress(0);

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 100 / (duration * 10);
        if (next >= 100) {
          clearInterval(progressInterval.current);
          goNext();
          return 100;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(progressInterval.current);
  }, [isPlaying, currentStatus?.id, currentIndex]);

  const goNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose(); // Finished all → close and disappear
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  };

  const handleReaction = async (emoji) => {
    if (!currentStatus || !user) return;
    await addReaction(userId, currentStatus.id, emoji, user.uid);
  };

  const handleDelete = async () => {
    if (!currentStatus || !isOwn) return;
    try {
      await deleteStatus(userId, currentStatus.id);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error(err);
      alert('Failed to delete Echo');
    }
  };

  const viewCount = currentStatus?.views ? Object.keys(currentStatus.views).length : 0;
  const viewers = currentStatus?.views
    ? Object.keys(currentStatus.views).map((uid) => ({
        uid,
        name: profiles[uid]?.name || 'User',
        avatar: profiles[uid]?.avatar,
      }))
    : [];

  if (!currentStatus) return null;

  return (
    <div className="status-viewer-overlay">
      <div className="status-viewer">
        {/* Progress bars */}
        <div className="status-progress-bars">
          {statuses.map((_, i) => (
            <div key={i} className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="viewer-header">
          <div className="viewer-user">
            <Avatar src={profile.avatar} name={profile.name} size={42} />
            <div className="viewer-user-info">
              <div className="viewer-name">{profile.name || 'User'}</div>
              <div className="viewer-time">
                {currentStatus.createdAt
                  ? new Date(currentStatus.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </div>
            </div>
          </div>

          <div className="viewer-actions">
            {isOwn && (
              <button
                className="viewer-delete-btn"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete"
              >
                🗑️
              </button>
            )}
            <button className="viewer-close-btn" onClick={onClose} title="Close">
              ✕
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="viewer-content">
          <div className="voice-visual">
            <div className={`big-avatar ${isPlaying ? 'playing' : ''}`}>
              <Avatar src={profile.avatar} name={profile.name} size={150} />
            </div>

            {currentStatus.caption && (
              <p className="status-caption">{currentStatus.caption}</p>
            )}

            {/* View count - only for owner */}
            {isOwn && viewCount > 0 && (
              <button className="view-count-btn" onClick={() => setShowSeenBy(true)}>
                👁️ {viewCount} {viewCount === 1 ? 'view' : 'views'}
              </button>
            )}
          </div>

          <audio
            ref={audioRef}
            onEnded={goNext}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>

        {/* Tap zones */}
        <div className="nav-zones">
          <div className="nav-left" onClick={goPrev} />
          <div className="nav-right" onClick={goNext} />
        </div>

        {/* Reactions */}
        <div className="reaction-bar">
          {STATUS_EMOJIS.map((item) => (
            <button
              key={item.emoji}
              className="reaction-btn"
              onClick={() => handleReaction(item.emoji)}
            >
              {item.emoji}
            </button>
          ))}
        </div>

        {/* Seen by modal */}
        {showSeenBy && (
          <div className="seen-by-overlay" onClick={() => setShowSeenBy(false)}>
            <div className="seen-by-box" onClick={(e) => e.stopPropagation()}>
              <div className="seen-by-header">
                <h3>Seen by</h3>
                <button onClick={() => setShowSeenBy(false)}>✕</button>
              </div>
              <div className="seen-by-list">
                {viewers.length === 0 ? (
                  <p className="seen-empty">No views yet</p>
                ) : (
                  viewers.map((v) => (
                    <div key={v.uid} className="seen-by-item">
                      <Avatar src={v.avatar} name={v.name} size={40} />
                      <span>{v.name}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete confirm */}
        {showDeleteConfirm && (
          <div className="delete-confirm-overlay">
            <div className="delete-confirm-box">
              <h3>Delete this Echo?</h3>
              <p>This cannot be undone.</p>
              <div className="delete-confirm-actions">
                <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button className="danger" onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusViewer;
