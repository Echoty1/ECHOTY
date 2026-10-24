import React, { useState, useEffect } from 'react';
import { markStatusViewed } from '../../services/statusService';
import './StoriesBar.css';

const StoryViewer = ({ stories, ownerName, ownerAvatar, viewerId, onClose, onFinished }) => {
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
      setProgress(0);
    } else {
      onFinished();
      onClose();
    }
  };

  const handleClose = () => onClose();

  if (!currentStory) return null;

  return (
    <div className="viewer-overlay">
      {/* Progress Bars at the very top */}
      <div className="progress-bar-container">
        {stories.map((_, idx) => (
          <div key={idx} className={`progress-segment ${idx < currentIndex ? 'full' : idx === currentIndex ? 'active' : ''}`}>
            <div className="progress-bar-fill" style={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' }}></div>
          </div>
        ))}
      </div>

      {/* Top Header */}
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

      {/* The Main Stage */}
      <div className="viewer-tap-area" onClick={handleNext}>
        
        {/* Tilted Background Cards */}
        <div className="stacked-cards-bg">
          <div className="stack-card layer-1">
             <img src={currentStory.imageUrl} alt="" />
          </div>
          <div className="stack-card layer-2">
             <img src={currentStory.imageUrl} alt="" />
          </div>
        </div>

        {/* The Active Image */}
        <div className="viewer-image-container">
          <img 
            src={currentStory.imageUrl} 
            alt="Story" 
            className="viewer-image" 
            draggable={false}
          />
        </div>

      </div>

      {/* Floating Reactions (Inside the tap area so they don't close the story) */}
      <div className="instants-floating-reactions" onClick={(e) => e.stopPropagation()}>
        <button className="reaction-btn small"><i className="fas fa-smile" /></button>
        <button className="reaction-btn large"><i className="fas fa-heart" /></button>
        <button className="reaction-btn small"><i className="fas fa-plus" /></button>
      </div>
    </div>
  );
};

export default StoryViewer;
