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
import EchoLoader from '../../components/common/EchoLoader';

const LONG_PRESS_MS = 500;

/* Render caption with clickable #hashtags.
   Handles trailing punctuation like #fyp, #fyp! #fyp. and leading spaces. */
const renderCaptionWithHashtags = (caption) => {
  if (!caption) return null;

  // Split on whitespace but keep the whitespace tokens
  const tokens = String(caption).split(/(\s+)/);

  return tokens.map((token, i) => {
    // Match hashtag anywhere in the token (allows trailing punctuation)
    const match = token.match(/#([a-zA-Z0-9_]{1,40})/);

    if (!match) return <span key={i}>{token}</span>;

    const tag = match[1];
    const before = token.slice(0, match.index);
    const after = token.slice(match.index + match[0].length);

    return (
      <span key={i}>
        {before}
        <span
          className="spotlight-caption-hashtag"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent('spotlight-hashtag-tap', { detail: tag })
            );
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              window.dispatchEvent(
                new CustomEvent('spotlight-hashtag-tap', { detail: tag })
              );
            }
          }}
        >
          #{tag}
        </span>
        {after}
      </span>
    );
  });
};

const SpotlightPost = ({
  post,
  isActive,
  currentUser,
  currentProfile,
  onOpenComments,
  onOpenShare,
  onOpenProfile,
  onOpenOptions,
  onOpenDuet,
  onRegisterVideo,
  muted,
  onToggleMute,
}) => {
  const videoRef = useRef(null);
  const sourceVideoRef = useRef(null);
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

  const isDuet = post.type === 'duet' && post.duet;

  useEffect(() => {
    if (!post?.id || !currentUser?.uid) return () => {};
    const unsubs = [
      listenToSpotlightLike(post.id, currentUser.uid, setLiked),
      listenToSpotlightReecho(post.id, currentUser.uid, setReechoed),
      listenToEchoAuthor(post.uid, currentUser.uid, setEchoed),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [post?.id, post?.uid, currentUser?.uid]);

  useEffect(() => {
    const v = videoRef.current;
    const s = sourceVideoRef.current;
    if (post.mediaType !== 'video') return;

    if (isActive) {
      try {
        if (v && v.duration && v.currentTime >= v.duration - 0.2) v.currentTime = 0;
        if (s && s.duration && s.currentTime >= s.duration - 0.2) s.currentTime = 0;
      } catch (_) {}
      const attemptPlay = () => {
        v?.play().catch(() => {});
        s?.play().catch(() => {});
      };
      attemptPlay();
      const retry = setTimeout(attemptPlay, 150);
      setPaused(false);
      if (currentUser?.uid) markSpotlightSeen(currentUser.uid, post.id).catch(() => {});
      return () => clearTimeout(retry);
    } else {
      try { v?.pause(); } catch (_) {}
      try { s?.pause(); } catch (_) {}
    }
  }, [isActive, post.id, post.mediaType, currentUser?.uid]);

  useEffect(() => {
    if (!isDuet) return;
    const v = videoRef.current;
    const s = sourceVideoRef.current;
    if (!v || !s) return;
    const sync = () => {
      try {
        if (Math.abs(v.currentTime - s.currentTime) > 0.25) {
          s.currentTime = v.currentTime % (s.duration || 1);
        }
      } catch (_) {}
    };
    v.addEventListener('timeupdate', sync);
    return () => v.removeEventListener('timeupdate', sync);
  }, [isDuet]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !!muted;
    const onLoaded = () => { if (v) v.muted = !!muted; };
    v.addEventListener('loadedmetadata', onLoaded);
    if (v.readyState >= 1) v.muted = !!muted;
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [muted, isActive, post.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || post.mediaType !== 'video') return;
    const onTime = () => {
      if (v.duration) setProgress((v.currentTime / v.duration) * 100);
    };
    const onEnd = () => {
      v.currentTime = 0;
      v.play().catch(() => {});
      if (sourceVideoRef.current) {
        sourceVideoRef.current.currentTime = 0;
        sourceVideoRef.current.play().catch(() => {});
      }
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
    };
  }, [post.mediaType]);

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

  const handleLike = useCallback(
    async (force = false) => {
      if (!currentUser?.uid) return;
      if (force && liked) return;
      const actorMeta = {
        name: currentProfile?.name || currentUser?.displayName || 'Someone',
        avatar: currentProfile?.avatar || '',
      };
      const postMeta = {
        uid: post.uid,
        posterUrl: post.posterUrl,
        mediaUrl: post.mediaUrl,
      };
      try {
        await toggleSpotlightLike(post.id, currentUser.uid, actorMeta, postMeta);
      } catch (_) {}
    },
    [post.id, post.uid, currentUser?.uid, currentProfile?.name, currentProfile?.avatar, liked, post.posterUrl, post.mediaUrl]
  );

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
      const s = sourceVideoRef.current;
      if (v) {
        if (v.paused) {
          v.play().catch(() => {});
          s?.play().catch(() => {});
          setPaused(false);
        } else {
          v.pause();
          s?.pause();
          setPaused(true);
        }
      }
    }
    lastTapRef.current = now;
  };

  const handleReecho = useCallback(async () => {
    if (!currentUser?.uid) return;
    const actorMeta = {
      name: currentProfile?.name || currentUser?.displayName || 'Someone',
      avatar: currentProfile?.avatar || '',
    };
    const postMeta = {
      uid: post.uid,
      posterUrl: post.posterUrl,
      mediaUrl: post.mediaUrl,
    };
    try {
      await toggleSpotlightReecho(post.id, currentUser.uid, actorMeta, postMeta);
    } catch (_) {}
  }, [post.id, post.uid, currentUser?.uid, currentProfile?.name, currentProfile?.avatar, post.posterUrl, post.mediaUrl]);

  const handleEcho = useCallback(async () => {
    if (!currentUser?.uid || post.uid === currentUser.uid) return;
    const actorMeta = {
      name: currentProfile?.name || currentUser?.displayName || 'Someone',
      avatar: currentProfile?.avatar || '',
    };
    try {
      await toggleEchoAuthor(post.uid, currentUser.uid, actorMeta);
    } catch (_) {}
  }, [post.uid, currentUser?.uid, currentProfile?.name, currentProfile?.avatar]);

  const handleDuet = useCallback(() => {
    if (!currentUser?.uid) return;
    if (post.uid === currentUser.uid) return;
    onOpenDuet?.(post);
  }, [post, currentUser?.uid, onOpenDuet]);

  const caption = post.caption || '';
  const authorName = post.authorName || 'User';
  const canDuet = post.uid !== currentUser?.uid;

  return (
    <div className={`spotlight-post ${isDuet ? 'is-duet' : ''}`}>
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
        {isDuet ? (
          <div className="spotlight-duet-frame">
            <div className="spotlight-duet-half top">
              {post.duet.sourceMediaType === 'image' ? (
                <img src={post.duet.sourceMediaUrl} alt="" className="spotlight-duet-media" />
              ) : (
                <video
                  ref={sourceVideoRef}
                  src={post.duet.sourceMediaUrl}
                  className="spotlight-duet-media"
                  playsInline
                  muted={muted}
                  loop
                  preload="metadata"
                />
              )}
              <div className="spotlight-duet-tag">
                <span className="spotlight-duet-tag-tick" />
                @{(post.duet.sourceAuthorName || 'user').replace(/\s+/g, '').toLowerCase()}
              </div>
            </div>
            <div className="spotlight-duet-half bottom">
              <video
                ref={videoRef}
                src={post.mediaUrl}
                poster={post.posterUrl || ''}
                className="spotlight-duet-media"
                playsInline
                muted={muted}
                loop
                preload="auto"
              />
              <div className="spotlight-duet-tag">
                <span className="spotlight-duet-tag-tick" />
                @{authorName.replace(/\s+/g, '').toLowerCase()}
              </div>
            </div>
          </div>
        ) : post.mediaType === 'video' ? (
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

        {post.mediaType === 'video' && !videoReady && (
          <div className="spotlight-video-loader">
            <EchoLoader size="md" />
          </div>
        )}

        <div className="spotlight-watermark" aria-hidden="true">
          <span className="spotlight-watermark-tick" />
          <span className="spotlight-watermark-text">ECHO</span>
        </div>

        {paused && videoReady && (
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
        onDuet={handleDuet}
        showDuet={canDuet}
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
          <span className="spotlight-author-name">
            @{authorName.replace(/\s+/g, '').toLowerCase()}
          </span>
        </button>

        {isDuet && post.duet?.sourceAuthorName && (
          <button
            type="button"
            className="spotlight-duet-source-chip"
            onClick={() => onOpenProfile?.(post.duet.sourceUid)}
          >
            <i className="fas fa-retweet" />
            Duet with @{(post.duet.sourceAuthorName || 'user').replace(/\s+/g, '').toLowerCase()}
          </button>
        )}

        {caption && (
          <div className="spotlight-caption">
            {renderCaptionWithHashtags(
              caption.length > 140 ? `${caption.slice(0, 140)}…` : caption
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpotlightPost;
