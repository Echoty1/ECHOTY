// src/components/pages/Chat/ReplyPreview.jsx
import React from 'react';

const ReplyPreview = ({ replyTo, onCancel }) => {
  if (!replyTo) return null;

  return (
    <div className="reply-preview">
      <div className="reply-preview-content">
        <div className="reply-preview-header">
          <span>Replying to <strong>{replyTo.senderName}</strong></span>
          <button className="reply-preview-close" onClick={onCancel}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="reply-preview-body">
          <span className="reply-preview-text">{replyTo.textSnippet}</span>
        </div>
      </div>
    </div>
  );
};

export default ReplyPreview;