// src/components/pages/Chat/EditMessageModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

const EditMessageModal = ({ isOpen, onClose, messageText, onSave }) => {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setText(messageText || '');
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, messageText]);

  const handleSave = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== messageText) {
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

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="edit-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="edit-modal-header">
          <h3>Edit Message</h3>
          <button className="edit-modal-close" onClick={onClose}>✕</button>
        </div>
        <textarea
          ref={textareaRef}
          className="edit-modal-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Edit your message..."
        />
        <div className="edit-modal-actions">
          <button className="edit-modal-btn cancel" onClick={onClose}>Cancel</button>
          <button
            className="edit-modal-btn save"
            onClick={handleSave}
            disabled={!text.trim() || text.trim() === messageText}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditMessageModal;