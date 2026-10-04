// src/pages/Spotlight/SpotlightPost.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  listenToSpotlightLike,
  listenToSpotlightReecho,
  listenToEchoAuthor,
  toggleSpotlightLike,
  toggleSpotlightReecho,
  toggleEchoAuthor,
  markSpotlightSeen,
} from '../../services/spotlightService';
import SpotlightActions from './SpotlightActions';

const SpotlightPost = ({
  post,
  isActive,
  currentUser,
  onOpenComments,
  onOpenShare,
  onOpenProfile,
  onRegisterVideo,
  muted,
  onToggleMute,
}) => {
  const videoRef = useRef(null);
  const [liked, setLiked] = useState(false);
  const [reechoed, setReechoed] = useState(false);
  const [echoed, setEchoed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showHeart, setShowHeart] = useState(false);
  const lastTapRef = useRef(0);

  /* ─── Realtime subscriptions for this post ─── */
  useEffect(() => {
    if (!post?.id || !currentUser?.uid) return () => {};
    const unsubs = [
      listenToSpotlightLike(post.id, currentUser.uid, setLiked),
      listenToSpotlightReecho(post.id, currentUser.uid, setReechoed),
      listenToEchoAuthor(post.uid, currentUser.uid, setEchoed),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [post?.id, post?.uid, currentUser?.uid]);

  /* ─── Play / pause based on active state ─── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || post.mediaType !== 'video') return;
    if (isActive) {
      v.currentTime = 0;
      v.play().catch(() => {});
      setPaused(false);
      if (currentUser?.uid) markSpotlightSeen(currentUser.uid, post.id).catch(() => {});
    } else {
      v.pause();
    }
  }, [isActive, post.id, post.mediaType, currentUser?.uid]);

  /* ─── Sync mute state ─── */
  useEffect(() => {
    const v = videoRef.current;
    if (v) v.muted = !!muted;
  }, [muted, isActive]);

  /* ─── Progress bar ─── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || post.mediaType !== 'video') return;
    const onTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    const onEnd = () => {
      // Loop
      v.currentTime = 0;
      v.play().catch(() => {});
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
    };
  }, [post.mediaType]);

  useEffect(() => {
    if (onRegisterVideo) onRegisterVideo(post.id, videoRef.current);
    return () => { if (onRegisterVideo) onRegisterVideo(post.id, null); };
  }, [post.id, onRegisterVideo]);

  /* ─── Handlers ─── */
  const handleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap → like with heart animation
      if (!liked) handleLike(true);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    } else {
      // Single tap → toggle play/pause
      const v = videoRef.current;
      if (v) {
        if (v.paused) { v.play().catch(() => {}); setPaused(false); }
        else { v.pause(); setPaused(true); }
      }
    }
    lastTapRef.current = now;
  };

  const handleLike = useCallback(async (force = false) => {
    if (!currentUser?.uid) return;
    if (force && liked) return;
    try { await toggleSpotlightLike(post.id, currentUser.uid); } catch (_) {}
  }, [post.id, currentUser?.uid, liked]);

  const handleReecho = useCallback(async () => {
    if (!currentUser?.uid) return;
    try { await toggleSpotlightReecho(post.id, currentUser.uid); } catch (_) {}
  }, [post.id, currentUser?.uid]);

  const handleEcho = useCallback(async () => {
    if (!currentUser?.uid || post.uid === currentUser.uid) return;
    try { await toggleEchoAuthor(post.uid, currentUser.uid); } catch (_) {}
  }, [post.uid, currentUser?.uid]);

  const caption = post.caption || '';
  const authorName = post.authorName || 'User';

  return (
    <div className="spotlight-post">
      {/* Progress bar (videos only) */}
      {post.mediaType === 'video' && (
        <div className="spotlight-progress-track">
          <div className="spotlight-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      {/* Media */}
      <div className="spotlight-media" onClick={handleTap} role="button" tabIndex={0}>
        {post.mediaType === 'video' ? (
          <video
            ref={videoRef}
            className="spotlight-video"
            src={post.mediaUrl}
            poster={post.posterUrl || ''}
            playsInline
            muted={muted}
            loop
            preload="metadata"
          />
        ) : (
          <img
            className="spotlight-image"
            src={post.mediaUrl}
            alt={caption || 'Spotlight post'}
            draggable={false}
          />
        )}

        {/* In-app watermark (bottom-left, always visible) */}
        <div className="spotlight-watermark" aria-hidden="true">
          <span className="spotlight-watermark-tick" />
          <span className="spotlight-watermark-text">ECHO</span>
        </div>

        {/* Big pause icon when paused */}
        {paused && post.mediaType === 'video' && (
          <div className="spotlight-pause-indicator">
            <i className="fas fa-play" />
          </div>
        )}

        {/* Double-tap heart */}
        {showHeart && (
          <div className="spotlight-heart-pop">
            <i className="fas fa-heart" />
          </div>
        )}
      </div>

      {/* Right-side action rail */}
      <SpotlightActions
        post={post}
        liked={liked}
        reechoed={reechoed}
        echoed={echoed}
        onLike={handleLike}
        onComment={() => onOpenComments?.(post)}
        onShare={() => onOpenShare?.(post)}
        onReecho={handleReecho}
        onEcho={handleEcho}
        onAuthorTap={() => onOpenProfile?.(post.uid)}
      />

      {/* Bottom-left author + caption */}
      <div className="spotlight-bottom-left">
        <button
          type="button"
          className="spotlight-author-chip"
          onClick={() => onOpenProfile?.(post.uid)}
        >
          <span className="spotlight-author-avatar">
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt="" loading="lazy" />
            ) : (
              <span>{(authorName || 'U').charAt(0).toUpperCase()}</span>
            )}
          </span>
          <span className="spotlight-author-name">@{authorName.replace(/\s+/g, '').toLowerCase()}</span>
        </button>

        {caption && (
          <div className="spotlight-caption">
            {caption.length > 140 ? `${caption.slice(0, 140)}…` : caption}
          </div>
        )}
      </div>

      {/* Mute toggle (bottom-right of media, above the rail) */}
      {post.mediaType === 'video' && (
        <button
          type="button"
          className="spotlight-mute-btn"
          onClick={(e) => { e.stopPropagation(); onToggleMute?.(); }}
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          <i className={muted ? 'fas fa-volume-mute' : 'fas fa-volume-up'} />
        </button>
      )}
    </div>
  );
};

export default SpotlightPost;