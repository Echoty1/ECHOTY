// src/components/pages/Chat/EditMediaCaptionModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const EditMediaCaptionModal = ({ isOpen, onClose, currentCaption, mediaType, onSave }) => {
  const [caption, setCaption] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCaption(currentCaption || '');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, currentCaption]);

  const handleSave = () => {
    const trimmed = caption.trim();
    if (trimmed !== currentCaption) {
      onSave(trimmed);
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const mediaLabel = mediaType === 'video' ? 'Video' : mediaType === 'audio' ? 'Voice Note' : 'Image';

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="edit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-header">
          <h3>Edit {mediaLabel} Caption</h3>
          <button className="edit-modal-close" onClick={onClose}>✕</button>
        </div>
        <textarea
          ref={textareaRef}
          className="edit-modal-textarea"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Add a caption..."
        />
        <div className="edit-modal-actions">
          <button className="edit-modal-btn cancel" onClick={onClose}>Cancel</button>
          <button
            className="edit-modal-btn save"
            onClick={handleSave}
            disabled={caption.trim() === currentCaption}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditMediaCaptionModal;