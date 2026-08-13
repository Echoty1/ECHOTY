// src/components/pages/Chat/ChatMediaMessage.jsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useVideoAudio } from '../../../contexts/VideoAudioContext';

// ─── Fullscreen Video Player ─────────────────────────────────────
const FullscreenVideoPlayer = ({ src, onClose }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
    video.muted = false;
    video.pause();
    setIsPlaying(false);

    video.preload = 'metadata';

    return () => {
      video.pause();
    };
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || error) return;

    try {
      if (video.paused) {
        const promise = video.play();
        if (promise !== undefined) {
          promise
            .then(() => setIsPlaying(true))
            .catch((err) => {
              console.warn('Play interrupted:', err);
              setIsPlaying(false);
            });
        }
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.warn('Toggle play error:', err);
    }
  };

  const handleCanPlay = () => {
    setIsLoading(false);
    setError(false);
  };

  const handleError = () => {
    setError(true);
    setIsLoading(false);
  };

  return ReactDOM.createPortal(
    <div className="fullscreen-video-overlay" onClick={onClose}>
      <div className="fullscreen-video-content" onClick={(e) => e.stopPropagation()}>
        <video
          ref={videoRef}
          src={src}
          playsInline
          className="fullscreen-video"
          onClick={togglePlay}
          onCanPlay={handleCanPlay}
          onError={handleError}
          preload="metadata"
        />
        {isLoading && (
          <div className="fullscreen-loading-spinner">
            <i className="fas fa-spinner fa-spin" />
            <span>Loading...</span>
          </div>
        )}
        {error && (
          <div className="fullscreen-error">
            <i className="fas fa-exclamation-triangle" />
            <span>Could not load video</span>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}
        {!isLoading && !error && (
          <button className="fullscreen-play-btn" onClick={togglePlay}>
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} />
          </button>
        )}
        <button className="fullscreen-close-btn" onClick={onClose}>
          <i className="fas fa-times" />
        </button>
      </div>
    </div>,
    document.body
  );
};

// ─── Inline Video Player ──────────────────────────────────────
const VideoPlayer = ({ videoId, src, caption }) => {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showFullscreen, setShowFullscreen] = useState(false);

  const { activeUnmutedId, requestUnmute, muteAll } = useVideoAudio();

  // Listen to global activeUnmutedId changes
  useEffect(() => {
    if (!videoRef.current) return;
    if (activeUnmutedId !== null && activeUnmutedId !== videoId) {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
    if (activeUnmutedId === videoId) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  }, [activeUnmutedId, videoId]);

  // Toggle mute
  const toggleMute = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (!isMuted) {
      // Muting this video → clear global active
      video.muted = true;
      setIsMuted(true);
      muteAll(); // clears activeUnmutedId
    } else {
      // Unmuting this video → set as active
      video.muted = false;
      setIsMuted(false);
      requestUnmute(videoId);
    }
  };

  // Tap video → fullscreen preview (mutes all inline first)
  const openFullscreen = () => {
    muteAll();
    setShowFullscreen(true);
  };

  return (
    <>
      <div className="chat-media-video-wrapper" onClick={openFullscreen}>
        <video
          ref={videoRef}
          src={src}
          className="chat-media-video"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          controls={false}
        />
        <button className="video-mute-btn-overlay" onClick={toggleMute}>
          <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`} />
        </button>
        <div className="video-play-icon-overlay">
          <i className="fas fa-play-circle" />
        </div>
      </div>
      {caption && <div className="chat-media-caption">{caption}</div>}

      {showFullscreen && (
        <FullscreenVideoPlayer src={src} onClose={() => setShowFullscreen(false)} />
      )}
    </>
  );
};

// ─── Image with Lightbox ─────────────────────────────────────────
const ImageWithLightbox = ({ src, caption }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const openLightbox = () => setLightboxOpen(true);
  const closeLightbox = () => setLightboxOpen(false);

  const handleImageError = () => {
    setLoadError(true);
  };

  const handleRetry = (e) => {
    e.stopPropagation();
    setLoadError(false);
    setRetryCount(prev => prev + 1);
  };

  return (
    <>
      <div className="chat-media-image-wrapper" onClick={loadError ? undefined : openLightbox}>
        {loadError ? (
          <div className="image-error-placeholder">
            <i className="fas fa-image" style={{ fontSize: '32px', opacity: 0.3 }} />
            <button className="image-retry-btn" onClick={handleRetry}>
              <i className="fas fa-redo" /> Retry
            </button>
          </div>
        ) : (
          <img
            src={src}
            alt={caption || 'Image'}
            className="chat-media-image"
            loading="lazy"
            onError={handleImageError}
            key={retryCount}
          />
        )}
      </div>
      {caption && <div className="chat-media-caption">{caption}</div>}

      {lightboxOpen && !loadError && (
        <div className="media-lightbox-overlay" onClick={closeLightbox}>
          <div className="media-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={src} alt={caption || 'Image'} className="media-lightbox-image" />
            {caption && <div className="media-lightbox-caption">{caption}</div>}
            <button className="media-lightbox-close" onClick={closeLightbox}>
              <i className="fas fa-times" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Main Media Message Component ──────────────────────────────
const ChatMediaMessage = ({ message }) => {
  const { mediaType, mediaUrl, caption, id } = message;

  if (mediaType === 'video') {
    return <VideoPlayer videoId={id} src={mediaUrl} caption={caption} />;
  }

  // image
  return <ImageWithLightbox src={mediaUrl} caption={caption} />;
};

export default ChatMediaMessage;