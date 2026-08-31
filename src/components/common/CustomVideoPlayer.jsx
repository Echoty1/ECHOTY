// src/components/common/CustomVideoPlayer.js
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useCachedBlobUrl } from '../../utils/mediaCache';
import './CustomVideoPlayer.css';

const CustomVideoPlayer = ({ src, onClose, poster }) => {
  // ─── Use cached blob URL ──────────────────────────────────────
  const { blobUrl, isLoading: cacheLoading, error: cacheError } = useCachedBlobUrl(src);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const playPromiseRef = useRef(null);

  // ─── When blobUrl is ready, we can play ──────────────────────
  useEffect(() => {
    if (blobUrl && !cacheLoading && !cacheError) {
      setIsLoading(false);
      // Auto-play the video
      const video = videoRef.current;
      if (video) {
        const promise = video.play();
        if (promise !== undefined) {
          promise
            .then(() => setIsPlaying(true))
            .catch(err => {
              if (err.name !== 'AbortError') {
                console.warn('Auto-play error:', err);
              }
            });
        }
      }
    }
  }, [blobUrl, cacheLoading, cacheError]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    };
  }, []);

  // Hide controls after 3 seconds of inactivity (when playing)
  useEffect(() => {
    if (isPlaying && showControls) {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, [isPlaying, showControls]);

  const handleUserInteraction = () => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    if (isPlaying) {
      controlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      const promise = video.play();
      if (promise !== undefined) {
        promise
          .then(() => setIsPlaying(true))
          .catch(err => {
            if (err.name !== 'AbortError') {
              console.warn('Play error:', err);
            }
          });
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
    handleUserInteraction();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const pct = (video.currentTime / video.duration) * 100;
    setProgress(pct);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setIsLoading(false);
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;
    const rect = progressRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const x = clientX - rect.left;
    const width = rect.width || 1;
    const pct = Math.min(1, Math.max(0, x / width));
    video.currentTime = pct * video.duration;
    setProgress(pct * 100);
    handleUserInteraction();
  };

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStartX(touch.clientX);
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    if (!touchStartX) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const video = videoRef.current;
    if (!video || !duration) return;
    const seekAmount = (deltaX / window.innerWidth) * duration;
    const newTime = Math.min(duration, Math.max(0, video.currentTime + seekAmount));
    video.currentTime = newTime;
    setProgress((newTime / duration) * 100);
    setTouchStartX(touch.clientX);
    handleUserInteraction();
  };

  const handleTouchEnd = () => {
    setTouchStartX(null);
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, togglePlay]);

  const handleClose = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      setIsPlaying(false);
    }
    onClose();
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If still loading the blob, show loader
  if (cacheLoading && !blobUrl) {
    return ReactDOM.createPortal(
      <div className="echo-video-player-overlay">
        <div className="echo-video-loader">
          <div className="echo-video-spinner" />
        </div>
      </div>,
      document.body
    );
  }

  // If error, show error and allow retry
  if (cacheError || !blobUrl) {
    return ReactDOM.createPortal(
      <div className="echo-video-player-overlay" onClick={onClose}>
        <div className="echo-video-player-content" style={{ textAlign: 'center', color: '#fff' }}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: 48, marginBottom: 16 }} />
          <p>Could not load video.</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#6C3CE1',
              border: 'none',
              color: '#fff',
              padding: '8px 24px',
              borderRadius: '20px',
              cursor: 'pointer',
              marginTop: 12,
            }}
          >
            Retry
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return ReactDOM.createPortal(
    <div
      className="echo-video-player-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onMouseMove={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
      <div className="echo-video-player-content" ref={containerRef}>
        {isLoading && (
          <div className="echo-video-loader">
            <div className="echo-video-spinner" />
          </div>
        )}

        <video
          ref={videoRef}
          className="echo-video-player-video"
          src={blobUrl}
          poster={poster || ''}
          playsInline
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />

        <div
          className={`echo-video-controls-overlay ${showControls ? 'visible' : 'hidden'}`}
          onClick={handleUserInteraction}
        >
          <button
            className={`echo-video-center-btn ${isPlaying ? 'hidden' : ''}`}
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} />
          </button>

          <button
            className="echo-video-close-top"
            onClick={handleClose}
            aria-label="Close"
          >
            <i className="fas fa-times" />
          </button>

          <div className="echo-video-controls-bar">
            <div
              className="echo-video-progress-track"
              ref={progressRef}
              onClick={handleSeek}
              onTouchStart={handleSeek}
            >
              <div
                className="echo-video-progress-fill"
                style={{ width: `${progress}%` }}
              />
              <div
                className="echo-video-progress-handle"
                style={{ left: `${progress}%` }}
              />
            </div>

            <div className="echo-video-controls-bottom">
              <button
                className="echo-video-control-btn"
                onClick={togglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} />
              </button>
              <span className="echo-video-time">
                {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CustomVideoPlayer;