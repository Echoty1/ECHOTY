// src/components/pages/Chat/AudioPlayer.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useCachedBlobUrl } from '../../../utils/mediaCache';

const AudioPlayer = ({ src }) => {
  // ─── Use cached blob URL ──────────────────────────────────────
  const { blobUrl, isLoading: cacheLoading, error: cacheError } = useCachedBlobUrl(src);

  // ─── Fallback for invalid or blob URLs ──────────────────────
  if (!src) {
    return (
      <div className="audio-placeholder">
        <i className="fas fa-music" />
        <span>Audio unavailable</span>
      </div>
    );
  }

  // If it's a blob URL (local preview), we can use it directly, but we still show loading if caching
  // For blob URLs, we don't need to cache; we'll set loaded immediately.
  const isBlob = src.startsWith('blob:');
  const audioSrc = isBlob ? src : (blobUrl || src);
  const isLoadedFromCache = !isBlob && (blobUrl !== null && !cacheLoading && !cacheError);
  const isReady = isBlob || isLoadedFromCache;

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [localLoaded, setLocalLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const barRefs = useRef([]);
  const animationRef = useRef(null);
  const playPromiseRef = useRef(null);

  // ─── Waveform animation ──────────────────────────────────────
  const animateWaveform = () => {
    if (!isPlaying) return;
    const heights = barRefs.current.map(() => Math.floor(Math.random() * 30) + 8);
    barRefs.current.forEach((bar, i) => {
      if (bar) bar.style.height = `${heights[i]}px`;
    });
    animationRef.current = requestAnimationFrame(animateWaveform);
  };

  useEffect(() => {
    if (isPlaying) {
      animateWaveform();
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      barRefs.current.forEach((bar) => {
        if (bar) bar.style.height = '12px';
      });
    }
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  // ─── Audio events ──────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setLocalLoaded(true);
      setError(false);
    };

    const onLoadedData = () => {
      setLocalLoaded(true);
      setError(false);
      if (isPlaying) {
        const promise = audio.play();
        if (promise !== undefined) {
          promise.catch((err) => {
            if (err.name !== 'AbortError') {
              console.warn('Play error:', err);
              setError(true);
            }
          });
        }
      }
    };

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(duration);
    };
    const onError = () => {
      setError(true);
      setLocalLoaded(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('loadeddata', onLoadedData);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('loadeddata', onLoadedData);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [audioSrc, duration, isPlaying]);

  // ─── Controls ──────────────────────────────────────────────────
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      const promise = audio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            if (err.name !== 'AbortError') {
              console.warn('Play error:', err);
              setError(true);
            }
          });
      }
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleRetry = () => {
    setError(false);
    setLocalLoaded(false);
    setRetryCount(prev => prev + 1);
    const audio = audioRef.current;
    if (audio) {
      audio.src = audioSrc;
      audio.load();
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const bars = Array.from({ length: 24 }, (_, i) => (
    <div
      key={i}
      className="waveform-bar"
      ref={(el) => (barRefs.current[i] = el)}
      style={{ height: '12px' }}
    />
  ));

  // ─── Show loading spinner while caching ──────────────────────
  if (!isBlob && cacheLoading && !error) {
    return (
      <div className="audio-loading-placeholder">
        <div className="upload-spinner">
          <svg className="spinner-ring" viewBox="0 0 50 50">
            <circle className="spinner-path" cx="25" cy="25" r="20" fill="none" strokeWidth="4" />
          </svg>
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────
  if (error || cacheError) {
    return (
      <div className="audio-error-placeholder">
        <i className="fas fa-exclamation-triangle" />
        <span>Audio unavailable</span>
        <button onClick={handleRetry}>Retry</button>
      </div>
    );
  }

  // ─── Render player ────────────────────────────────────────────
  return (
    <div className="audio-player">
      <audio ref={audioRef} src={audioSrc} preload="auto" crossOrigin="anonymous" key={retryCount} />
      <button className="audio-play-btn" onClick={togglePlay}>
        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} />
      </button>
      <div className="audio-progress">
        <div className="audio-waveform-bars">{bars}</div>
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime || 0}
          onChange={handleSeek}
          className="audio-slider"
          disabled={!localLoaded}
        />
        <div className="audio-time">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;