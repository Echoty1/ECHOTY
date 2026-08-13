// src/components/pages/Chat/RepliedMessage.jsx
import React from 'react';

const RepliedMessage = ({ replyTo, onTap }) => {
  if (!replyTo) return null;

  const getPreviewText = () => {
    if (replyTo.textSnippet) return replyTo.textSnippet;
    if (replyTo.type === 'media') {
      return replyTo.mediaType === 'video' ? '🎬 Video' : '📷 Image';
    }
    return replyTo.text || 'Message';
  };

  const senderName = replyTo.senderName || 'Unknown';

  const handleClick = () => {
    if (onTap) onTap();
  };

  return (
    <div className="replied-message" onClick={handleClick}>
      <div className="replied-message-line" />
      <div className="replied-message-content">
        <span className="replied-message-sender">{senderName}</span>
        <span className="replied-message-text">{getPreviewText()}</span>
      </div>
    </div>
  );
};

export default RepliedMessage;