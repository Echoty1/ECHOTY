// src/components/pages/Chat/MessageMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const MessageMenu = ({ children, isOwn, onDelete }) => {
  const [showActions, setShowActions] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const containerRef = useRef(null);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Close actions on outside tap (mobile)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowActions(false);
      }
    };
    if (isTouchDevice) {
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTouchDevice]);

  if (!isOwn) {
    return <>{children}</>;
  }

  // Desktop: hover to reveal
  const handleMouseEnter = () => {
    if (!isTouchDevice) {
      setShowActions(true);
    }
  };

  const handleMouseLeave = (e) => {
    if (!isTouchDevice) {
      const related = e.relatedTarget;
      if (containerRef.current && !containerRef.current.contains(related)) {
        setShowActions(false);
      }
    }
  };

  // Mobile: tap to toggle
  const handleToggle = (e) => {
    if (isTouchDevice) {
      e.stopPropagation();
      setShowActions((prev) => !prev);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowActions(false);
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowConfirm(false);
    onDelete();
  };

  return (
    <div
      className="message-wrapper"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={isTouchDevice ? handleToggle : undefined}
    >
      {children}
      <div className={`message-actions ${showActions ? 'visible' : ''}`}>
        <button className="message-delete-btn" onClick={handleDeleteClick}>
          <i className="fas fa-trash-alt" />
        </button>
      </div>
      <DeleteConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default MessageMenu;