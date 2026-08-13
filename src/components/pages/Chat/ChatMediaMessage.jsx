// src/components/pages/Chat/ChatMediaMessage.jsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

// ─── Fullscreen Video Player ─────────────────────────────────────
const FullscreenVideoPlayer = ({ src, onClose }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset to start and pause (unmuted)
    video.currentTime = 0;
    video.muted = false;
    video.pause();
    setIsPlaying(false);

    // Cleanup
    return () => {
      video.pause();
    };
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (video.paused) {
        video.play();
        setIsPlaying(true);
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.warn('Play error:', err);
    }
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
        />
        <button className="fullscreen-close-btn" onClick={onClose}>
          <i className="fas fa-times" />
        </button>
        <button className="fullscreen-play-btn" onClick={togglePlay}>
          <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} />
        </button>
      </div>
    </div>,
    document.body
  );
};

// ─── Custom Video Player (inline) ───────────────────────────────
const VideoPlayer = ({ src, caption }) => {
  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFullscreen, setShowFullscreen] = useState(false);

  // Auto-play muted on mount
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.play().catch(() => {});
      setIsMuted(true);
    }
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
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

  const toggleMute = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    if (!video.muted && video.paused) {
      try {
        const promise = video.play();
        if (promise !== undefined) {
          promise.then(() => setIsPlaying(true)).catch(() => {});
        }
      } catch (err) {}
    }
  };

  const openFullscreen = (e) => {
    e.stopPropagation();
    setShowFullscreen(true);
  };

  return (
    <>
      <div className="chat-media-video-wrapper" onClick={openFullscreen}>
        <video
          ref={videoRef}
          src={src}
          loop
          playsInline
          muted={isMuted}
          className="chat-media-video"
          onClick={(e) => e.stopPropagation()}
          onLoadedData={() => setIsLoading(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        {isLoading && <div className="video-loading-spinner"><i className="fas fa-spinner fa-spin" /></div>}
        {!isPlaying && !isLoading && (
          <div className="video-play-icon">
            <i className="fas fa-play-circle" />
          </div>
        )}
        <div className="video-controls-overlay">
          <button className="video-mute-btn" onClick={toggleMute}>
            <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`} />
          </button>
        </div>
      </div>
      {caption && <div className="chat-media-caption">{caption}</div>}

      {showFullscreen && (
        <FullscreenVideoPlayer src={src} onClose={() => setShowFullscreen(false)} />
      )}
    </>
  );
};

// ─── Image with Retry ────────────────────────────────────────────
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
            key={retryCount} // Force re-render on retry
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
  const { mediaType, mediaUrl, caption } = message;

  if (mediaType === 'video') {
    return <VideoPlayer src={mediaUrl} caption={caption} />;
  }

  // image
  return <ImageWithLightbox src={mediaUrl} caption={caption} />;
};

export default ChatMediaMessage;