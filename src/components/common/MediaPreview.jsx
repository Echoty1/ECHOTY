// src/components/common/MediaPreview.js
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import './MediaPreview.css';

const MediaPreview = ({ src, type, onClose, alt }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return ReactDOM.createPortal(
    <div className="echo-media-preview" onClick={handleClick}>
      <div className="echo-media-preview-content">
        {type === 'video' ? (
          <video src={src} controls autoPlay playsInline className="echo-media-preview-video" />
        ) : (
          <img src={src} alt={alt || 'Media'} className="echo-media-preview-image" />
        )}
        <button className="echo-media-preview-close" onClick={onClose}>
          <i className="fas fa-times" />
        </button>
      </div>
    </div>,
    document.body
  );
};

export default MediaPreview;