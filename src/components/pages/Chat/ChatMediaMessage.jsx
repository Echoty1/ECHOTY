// src/components/pages/Chat/ChatMediaMessage.jsx
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useVideoAudio } from '../../../contexts/VideoAudioContext';
import { useCachedImage, useCachedBlobUrl } from '../../../utils/mediaCache';

// ─── Simple loading spinner ────────────────────────────────────
const LoadingSpinner = () => (
  <div className="media-loading-spinner">
    <div className="upload-spinner">
      <svg className="spinner-ring" viewBox="0 0 50 50">
        <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
      </svg>
    </div>
  </div>
);

// ─── Upload overlay (for sender) ──────────────────────────────

const ZoomLightbox = ({ src, alt, caption, onClose }) => {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const pinch = useRef(null);
  const lastTap = useRef(0);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('echo-hide-bottom-nav');
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove('echo-hide-bottom-nav');
    };
  }, []);

  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinch.current = { start: dist(e.touches[0], e.touches[1]), scale };
    }
  };
  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinch.current) {
      e.preventDefault();
      const next = pinch.current.scale * (dist(e.touches[0], e.touches[1]) / pinch.current.start);
      setScale(Math.min(4, Math.max(1, next)));
    } else if (e.touches.length === 1 && scale > 1) {
      setPos((p) => ({
        x: p.x + e.touches[0].clientX - (pinch.current?.lx || e.touches[0].clientX),
        y: p.y + e.touches[0].clientY - (pinch.current?.ly || e.touches[0].clientY),
      }));
      pinch.current = { ...(pinch.current || {}), lx: e.touches[0].clientX, ly: e.touches[0].clientY };
    }
  };
  const onTouchEnd = () => { pinch.current = null; };
  const onDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (scale > 1) { setScale(1); setPos({ x: 0, y: 0 }); }
      else setScale(2.2);
    }
    lastTap.current = now;
  };

  return ReactDOM.createPortal(
    <div className="media-lightbox-overlay" onClick={onClose}>
      <div
        className="media-lightbox-content"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <img
          src={src}
          alt={alt}
          className="media-lightbox-image"
          onClick={onDoubleTap}
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
        />
        {caption && <div className="media-lightbox-caption">{caption}</div>}
        <button type="button" className="media-lightbox-close" onClick={onClose}>
          <i className="fas fa-times" />
        </button>
      </div>
    </div>,
    document.body
  );
};

const UploadOverlay = () => (
  <div className="media-upload-overlay">
    <LoadingSpinner />
  </div>
);

// ─── Invalid URL placeholder ──────────────────────────────────
const InvalidMediaPlaceholder = () => (
  <div className="media-error-placeholder">
    <i className="fas fa-exclamation-triangle" />
    <span>Media unavailable</span>
  </div>
);

// ─── Fullscreen Video Player (internal – only used if disablePreview is false) ──
const FullscreenVideoPlayer = ({ src, onClose }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.body.classList.add('hide-bottom-nav');
    return () => document.body.classList.remove('hide-bottom-nav');
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
        {isLoading && <LoadingSpinner />}
        {error && (
          <div className="fullscreen-error">
            <i className="fas fa-exclamation-triangle" />
            <span>Could not load video</span>
            <button onClick={() => { setError(false); setIsLoading(true); videoRef.current?.load(); }}>
              Retry
            </button>
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

// ─── Inline Video Player ──────────────────────────────────────────
const VideoPlayer = ({ videoId, src, caption, isMediaReady, isUploading, disablePreview }) => {
  const { blobUrl, isLoading: cacheLoading, error: cacheError } = useCachedBlobUrl(src);

  // ─── If uploading, show upload overlay ──────────────────────
  if (isUploading) {
    return (
      <div className="chat-media-video-wrapper" style={{ position: 'relative', minHeight: '200px', background: '#000' }}>
        <video
          src={src}
          className="chat-media-video"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          style={{ opacity: 0.3 }}
        />
        <UploadOverlay />
      </div>
    );
  }

  // ─── Invalid source ──────────────────────────────────────────
  if (!src || src.startsWith('blob:')) {
    return <InvalidMediaPlaceholder />;
  }

  const videoRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const { activeUnmutedId, requestUnmute, muteAll } = useVideoAudio();

  // ─── When blobUrl is ready, we consider the video loaded ──
  useEffect(() => {
    if (blobUrl && !cacheLoading && !cacheError) {
      setIsReady(true);
      setLoadError(false);
    }
  }, [blobUrl, cacheLoading, cacheError]);

  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const onCanPlay = () => { setIsReady(true); setLoadError(false); };
    const onError = () => { setLoadError(true); setIsReady(true); };
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);
    if (video.readyState >= 3) setIsReady(true);
    return () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
    };
  }, [blobUrl]); // re-run when blobUrl changes

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
    if (disablePreview) return; // 🚫 block internal fullscreen
    muteAll();
    setShowFullscreen(true);
  };

  const displaySrc = blobUrl || src;

  return (
    <>
      <div className="chat-media-video-wrapper" onClick={openFullscreen}>
        <video
          ref={videoRef}
          src={displaySrc}
          className="chat-media-video"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          controls={false}
          crossOrigin="anonymous"
          style={{ opacity: (isReady && !cacheLoading) ? 1 : 0 }}
        />
        {(cacheLoading || !isReady) && !loadError && <LoadingSpinner />}
        {loadError && (
          <div className="media-error-placeholder" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)' }}>
            <i className="fas fa-exclamation-triangle" />
            <button onClick={() => { setLoadError(false); setIsReady(false); videoRef.current?.load(); }}>
              Retry
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
      {showFullscreen && !disablePreview && (
        <FullscreenVideoPlayer src={displaySrc} onClose={() => setShowFullscreen(false)} />
      )}
    </>
  );
};

// ─── Image with Lightbox ──────────────────────────────────────────
const ImageWithLightbox = ({ src, caption, isMediaReady, isUploading, disablePreview }) => {
  const cachedImage = useCachedImage(src, null);
  const imageSrc = cachedImage || src;

  // If uploading, show overlay
  if (isUploading) {
    return (
      <div className="chat-media-image-wrapper" style={{ position: 'relative', minHeight: '200px', background: '#0A0A0F' }}>
        <img
          src={src}
          alt={caption || 'Uploading...'}
          className="chat-media-image"
          style={{ opacity: 0.3 }}
        />
        <UploadOverlay />
      </div>
    );
  }

  // If src is invalid, show placeholder
  if (!src) {
    return <InvalidMediaPlaceholder />;
  }

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // For blob URLs, we consider it loaded immediately
  const isBlob = src.startsWith('blob:');
  const isReady = isMediaReady || imageLoaded || isBlob || (cachedImage !== null && cachedImage !== src);

  useEffect(() => {
    if (!src || isBlob || cachedImage) return;
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
  }, [src, isBlob, cachedImage]);

  const openLightbox = () => {
    if (disablePreview) return; // 🚫 block internal lightbox
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const handleRetry = (e) => {
    e.stopPropagation();
    setLoadError(false);
    setImageLoaded(false);
    const img = new Image();
    img.src = src;
    img.onload = () => { setImageLoaded(true); setLoadError(false); };
    img.onerror = () => { setLoadError(true); setImageLoaded(true); };
    if (img.complete) setImageLoaded(true);
  };

  useEffect(() => {
    if (lightboxOpen) document.body.classList.add('hide-bottom-nav');
    else document.body.classList.remove('hide-bottom-nav');
    return () => document.body.classList.remove('hide-bottom-nav');
  }, [lightboxOpen]);

  // If it's a blob, we don't show error or loading spinner
  if (isBlob) {
    return (
      <>
        <div className="chat-media-image-wrapper" onClick={openLightbox}>
          <img src={imageSrc} alt={caption || 'Image'} className="chat-media-image" loading="lazy" />
        </div>
        {caption && <div className="chat-media-caption">{caption}</div>}
        {lightboxOpen && !disablePreview && (
          <ZoomLightbox src={imageSrc} alt={caption || 'Image'} caption={caption} onClose={closeLightbox} />
        )}
      </>
    );
  }

  // For non-blob URLs
  return (
    <>
      <div className="chat-media-image-wrapper" onClick={loadError ? undefined : openLightbox}>
        {loadError ? (
          <div className="media-error-placeholder">
            <i className="fas fa-exclamation-triangle" />
            <button onClick={handleRetry}>Retry</button>
          </div>
        ) : (
          <>
            <img
              src={imageSrc}
              alt={caption || 'Image'}
              className="chat-media-image"
              loading="lazy"
              style={{ opacity: isReady ? 1 : 0, transition: 'opacity 0.3s ease' }}
              crossOrigin="anonymous"
            />
            {!isReady && <LoadingSpinner />}
          </>
        )}
      </div>
      {caption && <div className="chat-media-caption">{caption}</div>}
      {lightboxOpen && !loadError && !disablePreview && (
        <ZoomLightbox src={imageSrc} alt={caption || 'Image'} caption={caption} onClose={closeLightbox} />
      )}
    </>
  );
};

// ─── Main Media Message ──────────────────────────────────────────
const ChatMediaMessage = ({ message, isUploading = false, uploadProgress, disablePreview = false }) => {
  const { mediaType, mediaUrl, caption, id, isMediaReady } = message;

  if (mediaType === 'video') {
    return (
      <VideoPlayer
        videoId={id}
        src={mediaUrl}
        caption={caption}
        isMediaReady={isMediaReady}
        isUploading={isUploading}
        disablePreview={disablePreview}
      />
    );
  }

  return (
    <ImageWithLightbox
      src={mediaUrl}
      caption={caption}
      isMediaReady={isMediaReady}
      isUploading={isUploading}
      disablePreview={disablePreview}
    />
  );
};

export default ChatMediaMessage;
