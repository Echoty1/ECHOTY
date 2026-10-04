// src/components/common/CustomVideoPlayer.js
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useCachedBlobUrl } from '../../utils/mediaCache';
import './CustomVideoPlayer.css';

const CustomVideoPlayer = ({ src, onClose, poster, autoFullscreen = false }) => {
  // ─── Use cached blob URL ──────────────────────────────────────
  const { blobUrl, isLoading: cacheLoading, error: cacheError } = useCachedBlobUrl(src);

  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const progressRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeout = useRef(null);
  const [touchStartX, setTouchStartX] = useState(null);
  const playPromiseRef = useRef(null);
  const autoFsTriggeredRef = useRef(false);

  // ─── When blobUrl is ready, play + optionally go fullscreen ──
  useEffect(() => {
    if (blobUrl && !cacheLoading && !cacheError) {
      setIsLoading(false);
      const video = videoRef.current;
      if (video) {
        const promise = video.play();
        if (promise !== undefined) {
          promise
            .then(() => setIsPlaying(true))
            .catch((err) => {
              if (err.name !== 'AbortError') {
                console.warn('Auto-play error:', err);
              }
            });
        }
      }

      if (autoFullscreen && !autoFsTriggeredRef.current) {
        autoFsTriggeredRef.current = true;
        setTimeout(() => {
          const el = containerRef.current;
          if (!el) return;
          if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
          else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
          else if (videoRef.current?.webkitEnterFullscreen) videoRef.current.webkitEnterFullscreen();
        }, 150);
      }
    }
  }, [blobUrl, cacheLoading, cacheError, autoFullscreen]);

  // ─── Body scroll lock + cleanup ──────────────────────────────
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

  // ─── Fullscreen change listener ──────────────────────────────
  useEffect(() => {
    const onChange = () => {
      const full =
        document.fullscreenElement === containerRef.current ||
        document.webkitFullscreenElement === containerRef.current ||
        videoRef.current?.webkitDisplayingFullscreen === true;
      setIsFullscreen(!!full);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  // ─── Auto-hide controls after 3s of inactivity ───────────────
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
          .catch((err) => {
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

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    handleUserInteraction();
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    const currentlyFull =
      document.fullscreenElement === el ||
      document.webkitFullscreenElement === el;
    if (!currentlyFull) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (videoRef.current?.webkitEnterFullscreen) videoRef.current.webkitEnterFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (videoRef.current?.webkitExitFullscreen) videoRef.current.webkitExitFullscreen();
    }
    handleUserInteraction();
  };

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    const stamp = Date.now();
    a.download = `echo_video_${stamp}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
      if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else onClose();
      }
      if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
      if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, isPlaying]);

  const handleClose = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      setIsPlaying(false);
    }
    if (document.fullscreenElement) document.exitFullscreen?.();
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
      className={`echo-video-player-overlay ${isFullscreen ? 'is-fullscreen' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      onMouseMove={handleUserInteraction}
      onTouchStart={handleUserInteraction}
    >
      <div
        className={`echo-video-player-content ${isFullscreen ? 'is-fullscreen' : ''}`}
        ref={containerRef}
      >
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

              <button
                className="echo-video-control-btn"
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                <i className={`fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}`} />
              </button>

              <span className="echo-video-time">
                {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
              </span>

              <div className="echo-video-controls-spacer" />

              <button
                className="echo-video-control-btn"
                onClick={handleDownload}
                aria-label="Download"
              >
                <i className="fas fa-download" />
              </button>

              <button
                className="echo-video-control-btn"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                <i className={`fas ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CustomVideoPlayer;
