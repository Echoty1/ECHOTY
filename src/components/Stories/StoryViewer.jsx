import React, { useState, useEffect } from 'react';
import { markStatusViewed } from '../../services/statusService';
import './StoriesBar.css';

const StoryViewer = ({ stories, ownerName, ownerAvatar, viewerId, onClose, onNext }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

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
      // Animate out current image, then switch
      setIsSwitching(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setIsSwitching(false);
      }, 250);
    } else {
      // All stories are gone: Beautifully fade out the whole viewer
      setIsClosing(true);
      setTimeout(onClose, 400);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 400);
  };

  if (!currentStory) return null;

  return (
    <div className={`viewer-overlay ${isClosing ? 'closing' : ''}`}>
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
          <div className="viewer-avatar-ring">
            <img src={ownerAvatar || 'https://via.placeholder.com/40'} alt={ownerName} className="viewer-avatar" />
          </div>
          <span className="owner-name">{ownerName || 'User'}</span>
          <span className="viewer-time">Now</span>
        </div>
        <button className="close-viewer" onClick={handleClose}>✕</button>
      </div>

      {/* Stacked Curve + Main Image Area */}
      <div className="viewer-tap-area" onClick={handleNext}>
        
        {/* OLD SNAPS PEEKING FROM THE BACK */}
        <div className="stacked-stories-back">
          {stories.slice(currentIndex + 1, currentIndex + 4).map((_, idx) => (
            <div 
              key={idx} 
              className={`back-story-layer layer-${idx + 1}`}
            ></div>
          ))}
        </div>

        {/* CURRENT STORY (LATEST SNAP) */}
        <div className={`viewer-image-container ${isSwitching ? 'switching' : ''}`}>
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
