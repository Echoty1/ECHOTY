// src/components/StatusViewer.jsx
import React, { useEffect, useState } from 'react';
import { markStatusViewed } from '../services/statusService';
import './StatusViewer.css';

const StatusViewer = ({ status, ownerName, viewerId, onClose, onNext }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!status) return;

    // Mark as viewed
    if (status.userId && status.id && viewerId) {
      markStatusViewed(status.userId, status.id, viewerId);
    }

    // Auto-advance after 5 seconds (Instagram style)
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          onNext();
          return 100;
        }
        return prev + 2; // 50 steps * 100ms = 5 seconds
      });
    }, 100);

    return () => clearInterval(interval);
  }, [status, viewerId, onNext]);

  if (!status) return null;

  return (
    <div className="status-viewer-overlay" onClick={onClose}>
      {/* Progress Bar */}
      <div className="progress-bar-container">
        <div className="progress-bar" style={{ width: `${progress}%` }}></div>
      </div>

      {/* Header */}
      <div className="status-viewer-header">
        <span className="owner-name">{ownerName || 'User'}</span>
        <button className="close-viewer">✕</button>
      </div>

      {/* Image Content */}
      <div className="status-image-container">
        <img src={status.imageUrl} alt="Story" className="status-image" />
        {status.caption && <p className="status-caption">{status.caption}</p>}
      </div>

      {/* Navigation Buttons (Optional) */}
      <div className="nav-buttons">
        <button onClick={onNext}>Next →</button>
      </div>
    </div>
  );
};

export default StatusViewer;
