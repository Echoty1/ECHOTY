// src/components/pages/Chat/MessageMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const MessageMenu = ({ children, isOwn, onDelete, onReply, onEdit }) => {
  const [showActions, setShowActions] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const containerRef = useRef(null);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Close actions on outside tap
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

  const showDelete = isOwn && typeof onDelete === 'function';
  const showEdit = isOwn && typeof onEdit === 'function';
  const showReply = !isOwn && typeof onReply === 'function';
  const hasActions = showDelete || showEdit || showReply;

  if (!hasActions) {
    return <>{children}</>;
  }

  const handleMouseEnter = () => {
    if (!isTouchDevice) {
      setShowActions(true);
    }
  };

  const handleMouseLeave = (e) => {
    if (!isTouchDevice) {
      const related = e.relatedTarget;
      if (related && related.nodeType === 1 && containerRef.current) {
        if (!containerRef.current.contains(related)) {
          setShowActions(false);
        }
      } else {
        setShowActions(false);
      }
    }
  };

  const handleToggle = (e) => {
    if (isTouchDevice) {
      e.stopPropagation();
      setShowActions((prev) => !prev);
    }
  };

  const handleReplyClick = (e) => {
    e.stopPropagation();
    setShowActions(false);
    if (typeof onReply === 'function') {
      onReply();
    }
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    setShowActions(false);
    if (typeof onEdit === 'function') {
      onEdit();
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setShowActions(false);
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowConfirm(false);
    if (typeof onDelete === 'function') {
      onDelete();
    }
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
        {showReply && (
          <button className="message-action-btn reply" onClick={handleReplyClick}>
            <i className="fas fa-reply" />
          </button>
        )}
        {showEdit && (
          <button className="message-action-btn edit" onClick={handleEditClick}>
            <i className="fas fa-pen" />
          </button>
        )}
        {showDelete && (
          <button className="message-action-btn delete" onClick={handleDeleteClick}>
            <i className="fas fa-trash-alt" />
          </button>
        )}
      </div>
      <DeleteConfirmationModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default MessageMenu;c