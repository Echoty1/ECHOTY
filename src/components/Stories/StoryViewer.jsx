import React, { useEffect, useState } from 'react';
import { markStatusViewed } from '../../services/statusService'; // Import from existing service
import './StoriesBar.css';

const StoryViewer = ({ story, ownerName, viewerId, onClose, onNext }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!story) return;

    if (story.userId && story.id && viewerId) {
      markStatusViewed(story.userId, story.id, viewerId);
    }

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          onNext();
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [story, viewerId, onNext]);

  if (!story) return null;

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      </div>

      <div className="viewer-header">
        <span className="owner-name">{ownerName || 'User'}</span>
        <button className="close-viewer">✕</button>
      </div>

      <div className="viewer-image-container">
        <img src={story.imageUrl} alt="Story" className="viewer-image" />
        {story.caption && <p className="viewer-caption">{story.caption}</p>}
      </div>

      <div className="viewer-nav">
        <button onClick={onNext}>Next →</button>
      </div>
    </div>
  );
};

export default StoryViewer;
