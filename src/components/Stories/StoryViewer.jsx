import React, { useState, useEffect } from 'react';
import { markStatusViewed } from '../../services/statusService';
import './StoriesBar.css';

const StoryViewer = ({ stories, ownerName, viewerId, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    setProgress(0);
    if (!currentStory) return;

    if (currentStory.userId && currentStory.id && viewerId) {
      markStatusViewed(currentStory.userId, currentStory.id, viewerId);
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          handleNext();
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentStory, currentIndex, viewerId]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  if (!currentStory) return null;

  return (
    <div className="viewer-overlay">
      {/* Progress Bar */}
      <div className="progress-bar-container">
        {stories.map((_, idx) => (
          <div key={idx} className={`progress-segment ${idx < currentIndex ? 'full' : idx === currentIndex ? 'active' : ''}`}>
            <div className="progress-bar-fill" style={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' }}></div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="viewer-header">
        <div className="viewer-header-info">
          <span className="owner-name">{ownerName || 'User'}</span>
          <span className="viewer-time">Now</span>
        </div>
        <button className="close-viewer" onClick={onClose}>✕</button>
      </div>

      {/* Main Image Area */}
      <div className="viewer-tap-area" onClick={handleNext}>
        <div className="viewer-image-container">
          <img src={currentStory.imageUrl} alt="Story" className="viewer-image" />
          {currentStory.caption && <p className="viewer-caption">{currentStory.caption}</p>}
        </div>
      </div>

      {/* Footer */}
      <div className="viewer-footer">
        <button className="viewer-reply-input">
          <span>Reply to {ownerName || 'user'}...</span>
        </button>
        <div className="viewer-footer-icons">
          <span className="icon">❤️</span>
          <span className="icon">💬</span>
        </div>
      </div>
    </div>
  );
};

export default StoryViewer;
