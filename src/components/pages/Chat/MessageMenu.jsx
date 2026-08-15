// src/components/pages/Chat/MessageMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const MessageMenu = ({ children, isOwn, onDelete, onReply, onEdit, copyText }) => {
  const [showActions, setShowActions] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef(null);
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const copyTimeout = useRef(null);

  // ─── Copy handler ──────────────────────────────────────────────
  const handleCopy = (e) => {
    e.stopPropagation();
    if (!copyText) return;
    navigator.clipboard.writeText(copyText)
      .then(() => {
        setCopied(true);
        if (copyTimeout.current) clearTimeout(copyTimeout.current);
        copyTimeout.current = setTimeout(() => {
          setCopied(false);
        }, 1000);
      })
      .catch(() => {
        // Fallback
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

  // ─── Close actions on outside tap ─────────────────────────────
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

  // Only show copy if copyText is a non-empty string
  const showCopy = !!copyText && typeof copyText === 'string' && copyText.trim().length > 0;

  // For own messages: show edit, delete, copy (if text)
  // For partner messages: show reply, copy (if text)
  const showDelete = isOwn && typeof onDelete === 'function';
  const showEdit = isOwn && typeof onEdit === 'function';
  const showReply = !isOwn && typeof onReply === 'function';

  const hasActions = showDelete || showEdit || showReply || showCopy;

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