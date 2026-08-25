// src/components/pages/Chat/MessageMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const MessageMenu = ({
  children,
  isOwn,
  canDelete = false,
  onDelete,
  onReply,
  onEdit,
  onReact,
  copyText,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const copyTimeout = useRef(null);

  const handleCopy = (e) => {
    e.stopPropagation();
    if (!copyText) return;
    navigator.clipboard
      .writeText(copyText)
      .then(() => {
        setCopied(true);
        if (copyTimeout.current) clearTimeout(copyTimeout.current);
        copyTimeout.current = setTimeout(() => {
          setCopied(false);
        }, 1000);
      })
      .catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = copyText;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      });
    setShowActions(false);
  };

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
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
    };
  }, [isTouchDevice]);

  const showReply = typeof onReply === 'function';
  const showCopy = !!copyText && typeof copyText === 'string' && copyText.trim().length > 0;
  const showEdit = isOwn && typeof onEdit === 'function';
  const showDelete = canDelete && typeof onDelete === 'function';
  const showReact = typeof onReact === 'function';

  const hasActions = showDelete || showEdit || showReply || showCopy || showReact;

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

  const handleReactClick = (e) => {
    e.stopPropagation();
    setShowActions(false);
    if (typeof onReact === 'function') {
      onReact();
    }
  };

  const handleConfirmDelete = () => {
    setShowConfirm(false);
    if (typeof onDelete === 'function') {
      onDelete();
    }
  };

  return (
    <div
      className={`message-wrapper ${isOwn ? 'own' : 'partner'}`}
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={isTouchDevice ? handleToggle : undefined}
    >
      {children}
      <div className={`message-actions ${showActions ? 'visible' : ''}`}>
        {showCopy && (
          <button className="message-action-btn copy" onClick={handleCopy} title="Copy">
            <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
          </button>
        )}
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
        {showReact && (
          <button className="message-action-btn react" onClick={handleReactClick} title="React">
            <i className="fas fa-smile" />
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

export default MessageMenu;