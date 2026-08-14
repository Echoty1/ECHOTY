// src/components/pages/Chat/ChatMediaMessage.jsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useVideoAudio } from '../../../contexts/VideoAudioContext';
import { useCachedBlobUrl, useCachedImage } from '../../../utils/mediaCache';

// ─── Fullscreen Video Player ─────────────────────────────────────
const FullscreenVideoPlayer = ({ src, onClose }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.body.classList.add('hide-bottom-nav');
    return () => {
      document.body.classList.remove('hide-bottom-nav');
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.muted = false;
    video.pause();
    setIsPlaying(false);
    video.preload = 'metadata';
    return () => video.pause();
  }, [src]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || error) return;
    try {
      if (video.paused) {
        const promise = video.play();
        if (promise !== undefined) {
          promise.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
        }
      } else {
        video.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.warn('Toggle play error:', err);
    }
  };

  const handleCanPlay = () => { setIsLoading(false); setError(false); };
  const handleError = () => { setError(true); setIsLoading(false); };

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
          crossOrigin="anonymous"
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
const VideoPlayer = ({ videoId, src, caption, uploadProgress, isMediaReady }) => {
  const { blobUrl, isLoading: cacheLoading, error: cacheError } = useCachedBlobUrl(src);
  const videoSrc = blobUrl || src;

  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const { activeUnmutedId, requestUnmute, muteAll } = useVideoAudio();

  const isReady = isMediaReady || localReady || (!cacheLoading && !cacheError);

  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const onCanPlay = () => { setLocalReady(true); setLoadError(false); };
    const onError = () => { setLoadError(true); setLocalReady(true); };
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
    if (video.readyState >= 3) setLocalReady(true);
    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
    };
  }, [videoSrc]);

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

  const toggleMute = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (!isMuted) {
      video.muted = true;
      setIsMuted(true);
      muteAll();
    } else {
      video.muted = false;
      setIsMuted(false);
      requestUnmute(videoId);
    }
  };

  const openFullscreen = () => {
    muteAll();
    setShowFullscreen(true);
  };

  const progress = typeof uploadProgress === 'number' ? uploadProgress : null;
  const showOverlay = !isReady || (progress !== null && progress < 100);

  return (
    <>
      <div className="chat-media-video-wrapper" onClick={openFullscreen}>
        <video
          ref={videoRef}
          src={videoSrc}
          className="chat-media-video"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          controls={false}
          crossOrigin="anonymous"
          style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.3s ease' }}
        />
        {showOverlay && !loadError && (
          <div className="image-upload-overlay">
            <div className="upload-spinner">
              <svg className="spinner-ring" viewBox="0 0 50 50">
                <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
              </svg>
              <span className="upload-progress-text">
                {progress !== null && progress < 100 ? Math.round(progress) : 100}%
              </span>
            </div>
          </div>
        )}
        {loadError && (
          <div className="image-error-placeholder" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}>
            <i className="fas fa-image" style={{ fontSize: '32px', opacity: 0.3 }} />
            <button className="image-retry-btn" onClick={() => { setLoadError(false); setLocalReady(false); videoRef.current?.load(); }}>
              <i className="fas fa-redo" /> Retry
            </button>
          </div>
        )}
        {isReady && !loadError && (
          <button className="video-mute-btn-overlay" onClick={toggleMute}>
            <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`} />
          </button>
        )}
        <div className="video-play-icon-overlay">
          <i className="fas fa-play-circle" />
        </div>
      </div>
      {caption && <div className="chat-media-caption">{caption}</div>}
      {showFullscreen && (
        <FullscreenVideoPlayer src={videoSrc} onClose={() => setShowFullscreen(false)} />
      )}
    </>
  );
};

// ─── Image with unified loader ──────────────────────────────────
const ImageWithLightbox = ({ src, caption, uploadProgress, isMediaReady }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  const cachedImage = useCachedImage(src, null);
  const imageSrc = cachedImage || src;

  const isReady = isMediaReady || imageLoaded;

  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    img.onload = () => { setImageLoaded(true); setLoadError(false); };
    img.onerror = () => { setLoadError(true); setImageLoaded(true); };
    if (img.complete) setImageLoaded(true);
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  const openLightbox = () => setLightboxOpen(true);
  const closeLightbox = () => setLightboxOpen(false);

  const handleRetry = (e) => {
    e.stopPropagation();
    setLoadError(false);
    setImageLoaded(false);
    setRetryCount(prev => prev + 1);
    const img = new Image();
    img.src = src;
    img.onload = () => { setImageLoaded(true); setLoadError(false); };
    img.onerror = () => { setLoadError(true); setImageLoaded(true); };
    if (img.complete) setImageLoaded(true);
  };

  useEffect(() => {
    if (lightboxOpen) {
      document.body.classList.add('hide-bottom-nav');
    } else {
      document.body.classList.remove('hide-bottom-nav');
    }
    return () => document.body.classList.remove('hide-bottom-nav');
  }, [lightboxOpen]);

  const progress = typeof uploadProgress === 'number' ? uploadProgress : null;
  const showOverlay = !isReady || (progress !== null && progress < 100);

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
          <>
            <img
              src={imageSrc}
              alt={caption || 'Image'}
              className="chat-media-image"
              loading="lazy"
              style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.3s ease' }}
              key={retryCount}
              crossOrigin="anonymous"
            />
            {showOverlay && (
              <div className="image-upload-overlay">
                <div className="upload-spinner">
                  <svg className="spinner-ring" viewBox="0 0 50 50">
                    <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
                  </svg>
                  <span className="upload-progress-text">
                    {progress !== null && progress < 100 ? Math.round(progress) : 100}%
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {caption && <div className="chat-media-caption">{caption}</div>}

      {lightboxOpen && !loadError && (
        <div className="media-lightbox-overlay" onClick={closeLightbox}>
          <div className="media-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={imageSrc} alt={caption || 'Image'} className="media-lightbox-image" />
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

// ─── Main Media Message ──────────────────────────────────────────
const ChatMediaMessage = ({ message }) => {
  const { mediaType, mediaUrl, caption, id, uploadProgress, isMediaReady } = message;

  if (mediaType === 'video') {
    return <VideoPlayer videoId={id} src={mediaUrl} caption={caption} uploadProgress={uploadProgress} isMediaReady={isMediaReady} />;
  }

  // image
  return <ImageWithLightbox src={mediaUrl} caption={caption} uploadProgress={uploadProgress} isMediaReady={isMediaReady} />;
};

export default ChatMediaMessage;