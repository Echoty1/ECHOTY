import React, { useState, useEffect } from 'react';
import { markStatusViewed } from '../../services/statusService';
import './StoriesBar.css';

const StoryViewer = ({ stories, ownerName, ownerAvatar, viewerId, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    setProgress(0);
    if (!currentStory) return;

    // Mark as viewed the moment it opens
    if (currentStory.userId && currentStory.id && viewerId) {
      markStatusViewed(currentStory.userId, currentStory.id, viewerId);
    }

    // Auto-advance timer (5 seconds)
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
    <div className="viewer-overlay" onClick={handleNext}>
      
      {/* TOP AREA: Progress Bars & Header */}
      <div className="viewer-top-section" onClick={(e) => e.stopPropagation()}>
        {/* Progress bars */}
        <div className="viewer-progress-container">
          {stories.map((_, idx) => (
            <div key={idx} className={`viewer-progress-segment ${idx < currentIndex ? 'full' : idx === currentIndex ? 'active' : ''}`}>
              <div 
                className="viewer-progress-fill" 
                style={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' }}
              ></div>
            </div>
          ))}
        </div>

        {/* Glassmorphism User Header */}
        <div className="viewer-user-header">
          <div className="viewer-user-info">
            <div className="viewer-avatar-ring">
              <img src={ownerAvatar || 'https://via.placeholder.com/40'} alt={ownerName} className="viewer-avatar" />
            </div>
            <div className="viewer-text-info">
              <span className="viewer-username">{ownerName || 'User'}</span>
              <span className="viewer-time">Just now</span>
            </div>
          </div>
          
          <button className="viewer-close-btn" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* MAIN IMAGE AREA - Perfectly centered, high quality */}
      <div className="viewer-main-area">
        <div className="viewer-image-wrapper">
          <img 
            src={currentStory.imageUrl} 
            alt="Story" 
            className="viewer-image" 
            draggable={false}
          />
        </div>
      </div>

    </div>
  );
};

export default StoryViewer;
