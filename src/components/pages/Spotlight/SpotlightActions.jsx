// src/pages/Spotlight/SpotlightActions.jsx
import React from 'react';

const fmt = (n) => {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 1000000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `${(v / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
};

const SpotlightActions = ({
  post,
  liked,
  reechoed,
  echoed,
  onLike,
  onComment,
  onShare,
  onReecho,
  onEcho,
  onAuthorTap,
}) => {
  return (
    <div className="spotlight-actions">
      {/* Author avatar with Echo (+ follow) indicator */}
      <button
        type="button"
        className="spotlight-actions-avatar-btn"
        onClick={onAuthorTap}
        aria-label={`Open ${post.authorName}'s profile`}
      >
        <span className="spotlight-actions-avatar-ring">
          {post.authorAvatar ? (
            <img src={post.authorAvatar} alt="" loading="lazy" />
          ) : (
            <span className="spotlight-actions-avatar-fallback">
              {(post.authorName || 'U').charAt(0).toUpperCase()}
            </span>
          )}
        </span>

        {!echoed && (
          <span
            className="spotlight-actions-echo-pill"
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onEcho?.(); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onEcho?.(); } }}
            aria-label="Echo this creator"
            title="Echo (follow)"
          >
            <i className="fas fa-plus" />
          </span>
        )}
      </button>

      {/* Like */}
      <button
        type="button"
        className={`spotlight-action ${liked ? 'active like' : ''}`}
        onClick={onLike}
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <span className="spotlight-action-icon">
          <i className={`${liked ? 'fas' : 'far'} fa-heart`} />
        </span>
        <span className="spotlight-action-count">{fmt(post.likeCount)}</span>
      </button>

      {/* Comment */}
      <button
        type="button"
        className="spotlight-action"
        onClick={onComment}
        aria-label="Comments"
      >
        <span className="spotlight-action-icon">
          <i className="far fa-comment-dots" />
        </span>
        <span className="spotlight-action-count">{fmt(post.commentCount)}</span>
      </button>

      {/* Reecho */}
      <button
        type="button"
        className={`spotlight-action ${reechoed ? 'active reecho' : ''}`}
        onClick={onReecho}
        aria-label={reechoed ? 'Undo Reecho' : 'Reecho'}
        title="Reecho to your profile"
      >
        <span className="spotlight-action-icon">
          <i className="fas fa-retweet" />
        </span>
        <span className="spotlight-action-count">{fmt(post.reechoCount)}</span>
      </button>

      {/* Share */}
      <button
        type="button"
        className="spotlight-action"
        onClick={onShare}
        aria-label="Share"
      >
        <span className="spotlight-action-icon">
          <i className="fas fa-paper-plane" />
        </span>
        <span className="spotlight-action-count">Share</span>
      </button>
    </div>
  );
};

export default SpotlightActions;
