import React, { useState, useEffect } from 'react';
import { markStatusViewed } from '../../services/statusService';
import './StoriesBar.css';

const StoryViewer = ({ stories, ownerName, ownerAvatar, viewerId, onClose, onFinished }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    setProgress(0);
    setIsFading(false);
    if (!currentStory) return;

    if (currentStory.userId && currentStory.id && viewerId) {
      markStatusViewed(currentStory.userId, currentStory.id, viewerId);
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          triggerNext();
          return 100;
        }
        return prev + 2; // Adjust speed here (2 = 5 seconds approx)
      });
    }, 100);

    return () => clearInterval(interval);
  }, [currentStory, currentIndex, viewerId]);

  const triggerNext = () => {
    if (isFading) return; // Prevent double taps
    setIsFading(true); // Start the fade out animation

    setTimeout(() => {
      if (currentIndex < stories.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        onFinished();
        onClose();
      }
    }, 250); // Wait 250ms for the CSS fade to finish before switching
  };

  if (!currentStory) return null;

  return (
    <div className="viewer-overlay">
      {/* Progress Bars */}
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
        <button className="close-viewer" onClick={onClose}>✕</button>
      </div>

      {/* Main Stage */}
      <div className="viewer-tap-area" onClick={triggerNext}>
        
        {/* Tilted Background Cards */}
        <div className="stacked-cards-bg">
          <div className={`stack-card layer-1 ${isFading ? 'fade-out' : ''}`}>
             <img src={currentStory.imageUrl} alt="" />
          </div>
          <div className={`stack-card layer-2 ${isFading ? 'fade-out' : ''}`}>
             <img src={currentStory.imageUrl} alt="" />
          </div>
        </div>

        {/* The Active Image */}
        <div className={`viewer-image-container ${isFading ? 'fade-out' : 'fade-in'}`}>
          <img 
            src={currentStory.imageUrl} 
            alt="Story" 
            className="viewer-image" 
            draggable={false}
          />
        </div>

      </div>

      {/* Floating Reactions */}
      <div className="instants-floating-reactions" onClick={(e) => e.stopPropagation()}>
        <button className="reaction-btn small"><i className="fas fa-smile" /></button>
        <button className="reaction-btn large"><i className="fas fa-heart" /></button>
        <button className="reaction-btn small"><i className="fas fa-plus" /></button>
      </div>
    </div>
  );
};

export default StoryViewer;
