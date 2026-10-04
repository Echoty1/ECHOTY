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
import EchoLoader from '../../common/EchoLoader';

const LONG_PRESS_MS = 500;

const SpotlightPost = ({
  post,
  isActive,
  currentUser,
  onOpenComments,
  onOpenShare,
  onOpenProfile,
  onRegisterVideo,
  onOpenOptions,
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
  const [videoReady, setVideoReady] = useState(post.mediaType !== 'video');
  const lastTapRef = useRef(0);
  const pressTimerRef = useRef(null);
  const longPressTriggered = useRef(false);

  useEffect(() => {
    if (!post?.id || !currentUser?.uid) return () => {};
    const unsubs = [
      listenToSpotlightLike(post.id, currentUser.uid, setLiked),
      listenToSpotlightReecho(post.id, currentUser.uid, setReechoed),
      listenToEchoAuthor(post.uid, currentUser.uid, setEchoed),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [post?.id, post?.uid, currentUser?.uid]);

  /* Play / pause */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || post.mediaType !== 'video') return;

    if (isActive) {
      try {
        if (v.duration && v.currentTime >= v.duration - 0.2) v.currentTime = 0;
      } catch (_) {}
      const attemptPlay = () => v.play().catch(() => {});
      attemptPlay();
      const retry = setTimeout(attemptPlay, 150);
      setPaused(false);
      if (currentUser?.uid) markSpotlightSeen(currentUser.uid, post.id).catch(() => {});
      return () => clearTimeout(retry);
    } else {
      try { v.pause(); } catch (_) {}
    }
  }, [isActive, post.id, post.mediaType, currentUser?.uid]);

  /* Mute sync */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !!muted;
    const onLoaded = () => { if (v) v.muted = !!muted; };
    v.addEventListener('loadedmetadata', onLoaded);
    if (v.readyState >= 1) v.muted = !!muted;
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [muted, isActive, post.id]);

  /* Progress bar */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || post.mediaType !== 'video') return;
    const onTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    const onEnd = () => {
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

  /* Video readiness — drives the ECHO loader overlay */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || post.mediaType !== 'video') return;
    const onReady = () => setVideoReady(true);
    const onWaiting = () => setVideoReady(false);
    const onPlaying = () => setVideoReady(true);
    v.addEventListener('loadeddata', onReady);
    v.addEventListener('canplay', onReady);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('waiting', onWaiting);
    if (v.readyState >= 2) setVideoReady(true);
    return () => {
      v.removeEventListener('loadeddata', onReady);
      v.removeEventListener('canplay', onReady);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('waiting', onWaiting);
    };
  }, [post.mediaType, post.id]);

  useEffect(() => {
    if (onRegisterVideo) onRegisterVideo(post.id, videoRef.current);
    return () => { if (onRegisterVideo) onRegisterVideo(post.id, null); };
  }, [post.id, onRegisterVideo]);

  const startLongPress = () => {
    longPressTriggered.current = false;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      longPressTriggered.current = true;
      onOpenOptions?.(post);
    }, LONG_PRESS_MS);
  };
  const cancelLongPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleTap = () => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) handleLike(true);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    } else {
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
      {post.mediaType === 'video' && (
        <div className="spotlight-progress-track">
          <div className="spotlight-progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div
        className="spotlight-media"
        onClick={handleTap}
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        onContextMenu={(e) => { e.preventDefault(); onOpenOptions?.(post); }}
        role="button"
        tabIndex={0}
      >
        {post.mediaType === 'video' ? (
          <video
            ref={videoRef}
            className="spotlight-video"
            src={post.mediaUrl}
            poster={post.posterUrl || ''}
            playsInline
            muted={muted}
            loop
            preload="auto"
          />
        ) : (
          <img
            className="spotlight-image"
            src={post.mediaUrl}
            alt={caption || 'Spotlight post'}
            draggable={false}
          />
        )}

        {/* ECHO loader overlay while video buffers */}
        {post.mediaType === 'video' && !videoReady && (
          <div className="spotlight-video-loader">
            <EchoLoader size="md" />
          </div>
        )}

        <div className="spotlight-watermark" aria-hidden="true">
          <span className="spotlight-watermark-tick" />
          <span className="spotlight-watermark-text">ECHO</span>
        </div>

        {paused && post.mediaType === 'video' && videoReady && (
          <div className="spotlight-pause-indicator">
            <i className="fas fa-play" />
          </div>
        )}

        {showHeart && (
          <div className="spotlight-heart-pop">
            <i className="fas fa-heart" />
          </div>
        )}
      </div>

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
    </div>
  );
};

export default SpotlightPost;
