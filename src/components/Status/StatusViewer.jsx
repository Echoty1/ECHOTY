import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import {
  listenToUserStatuses,
  markStatusViewed,
  addReaction,
} from '../../services/statusService';
import { STATUS_EMOJIS } from './statusEmojis';
import Avatar from '../common/Avatar';
import './StatusViewer.css';

const StatusViewer = ({ userId, onClose }) => {
  const { user } = useAuth();
  const { profiles } = useProfile();
  const [statuses, setStatuses] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef(null);
  const progressInterval = useRef(null);

  const profile = profiles[userId] || {};
  const currentStatus = statuses[currentIndex];

  useEffect(() => {
    const unsub = listenToUserStatuses(userId, (list) => {
      setStatuses(list);
      if (list.length === 0) onClose();
    });
    return unsub;
  }, [userId, onClose]);

  useEffect(() => {
    if (!currentStatus || !user) return;

    // Mark as viewed
    markStatusViewed(userId, currentStatus.id, user.uid);

    // Auto play
    if (audioRef.current) {
      audioRef.current.src = currentStatus.audioUrl;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentStatus, userId, user]);

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
  }, [isPlaying, currentStatus, currentIndex]);

  const goNext = () => {
    if (currentIndex < statuses.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
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
                  width:
                    i < currentIndex
                      ? '100%'
                      : i === currentIndex
                      ? `${progress}%`
                      : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="viewer-header">
          <div className="viewer-user">
            <Avatar src={profile.avatar} name={profile.name} size={40} />
            <div>
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
          <button className="viewer-close" onClick={onClose}>
            ×
          </button>
        </div>

        {/* Main content */}
        <div className="viewer-content">
          <div className="voice-visual">
            <div className={`big-avatar ${isPlaying ? 'playing' : ''}`}>
              <Avatar src={profile.avatar} name={profile.name} size={140} />
            </div>
            {currentStatus.caption && (
              <p className="status-caption">{currentStatus.caption}</p>
            )}
          </div>

          <audio
            ref={audioRef}
            onEnded={goNext}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        </div>

        {/* Navigation zones */}
        <div className="nav-zones">
          <div className="nav-left" onClick={goPrev} />
          <div className="nav-right" onClick={goNext} />
        </div>

        {/* Custom emoji reactions */}
        <div className="reaction-bar">
          {STATUS_EMOJIS.map((item) => (
            <button
              key={item.emoji}
              className="reaction-btn"
              onClick={() => handleReaction(item.emoji)}
              title={item.label}
            >
              {item.emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatusViewer;
