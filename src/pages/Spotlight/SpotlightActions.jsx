// src/pages/Spotlight/SpotlightActions.jsx
import React, { useState, useEffect } from 'react';

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
  onDuet,
  onAuthorTap,
  showDuet = true,
}) => {
  // Local state to make the counts update instantly
  const [likeCount, setLikeCount] = useState(post.likeCount || 0);
  const [reechoCount, setReechoCount] = useState(post.reechoCount || 0);

  // Sync if the post prop changes externally
  useEffect(() => {
    setLikeCount(post.likeCount || 0);
    setReechoCount(post.reechoCount || 0);
  }, [post.likeCount, post.reechoCount]);

  const handleLikeClick = () => {
    // Optimistically update local UI
    setLikeCount((prev) => (liked ? Math.max(0, prev - 1) : prev + 1));
    onLike?.();
  };

  const handleReechoClick = () => {
    // Optimistically update local UI
    setReechoCount((prev) => (reechoed ? Math.max(0, prev - 1) : prev + 1));
    onReecho?.();
  };

  return (
    <div className="spotlight-actions">
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

      <button
        type="button"
        className={`spotlight-action ${liked ? 'active like' : ''}`}
        onClick={handleLikeClick}
        aria-label={liked ? 'Unlike' : 'Like'}
      >
        <span className="spotlight-action-icon">
          <i className={`${liked ? 'fas' : 'far'} fa-heart`} />
        </span>
        <span className="spotlight-action-count">{fmt(likeCount)}</span>
      </button>

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

      <button
        type="button"
        className={`spotlight-action ${reechoed ? 'active reecho' : ''}`}
        onClick={handleReechoClick}
        aria-label={reechoed ? 'Undo Reecho' : 'Reecho'}
        title="Reecho to your profile"
      >
        <span className="spotlight-action-icon">
          <i className="fas fa-retweet" />
        </span>
        <span className="spotlight-action-count">{fmt(reechoCount)}</span>
      </button>

      {showDuet && (
        <button
          type="button"
          className="spotlight-action duet"
          onClick={onDuet}
          aria-label="Duet"
          title="Duet this Spotlight"
        >
          <span className="spotlight-action-icon">
            <i className="fas fa-clone" />
          </span>
          <span className="spotlight-action-count">
            {post.duetCount ? fmt(post.duetCount) : 'Duet'}
          </span>
        </button>
      )}

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
