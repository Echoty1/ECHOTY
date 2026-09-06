import React, { useState, useEffect, useRef } from 'react';
import { markStatusViewed } from '../../services/statusService';
import './StoriesBar.css';

const StoryViewer = ({ stories, ownerName, ownerAvatar, viewerId, onClose, onNext }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const audioRef = useRef(null);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    setProgress(0);
    if (!currentStory) return;

    // Mark as viewed
    if (currentStory.userId && currentStory.id && viewerId) {
      markStatusViewed(currentStory.userId, currentStory.id, viewerId);
    }

    // Auto-advance timer
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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

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

      {/* Main Image Area with smooth transition */}
      <div className="viewer-tap-area" onClick={handleNext}>
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
