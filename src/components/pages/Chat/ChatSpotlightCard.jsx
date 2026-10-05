// src/components/pages/Chat/ChatSpotlightCard.jsx
import React from 'react';

const ChatSpotlightCard = ({ spotlight, onOpen }) => {
  if (!spotlight) return null;

  const {
    postId,
    mediaType,
    thumbnail,
    posterUrl,
    caption,
    authorName,
    authorAvatar,
  } = spotlight;

  const thumb = thumbnail || posterUrl || '';
  const handle = (authorName || 'user').replace(/\s+/g, '').toLowerCase();
  const preview = (caption || '').slice(0, 90);

  const handleClick = (e) => {
    e.stopPropagation();
    if (postId) onOpen?.(postId);
  };

  return (
    <button
      type="button"
      className="chat-spotlight-card"
      onClick={handleClick}
      aria-label="Open Spotlight"
    >
      <div className="chat-spotlight-thumb">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" />
        ) : (
          <div className="chat-spotlight-thumb-fallback">
            <i className="fas fa-video" />
          </div>
        )}
        {mediaType === 'video' && (
          <span className="chat-spotlight-play" aria-hidden="true">
            <i className="fas fa-play" />
          </span>
        )}
      </div>

      <div className="chat-spotlight-body">
        <div className="chat-spotlight-brand">
          <span className="chat-spotlight-tick" />
          <span>Spotlight</span>
        </div>

        {preview && <p className="chat-spotlight-caption">{preview}</p>}

        <div className="chat-spotlight-author">
          {authorAvatar ? (
            <img src={authorAvatar} alt="" loading="lazy" />
          ) : (
            <span className="chat-spotlight-author-fallback">
              {(authorName || 'U').charAt(0).toUpperCase()}
            </span>
          )}
          <span className="chat-spotlight-author-name">@{handle}</span>
        </div>

        <span className="chat-spotlight-watch">
          Watch <i className="fas fa-chevron-right" />
        </span>
      </div>
    </button>
  );
};

export default ChatSpotlightCard;
