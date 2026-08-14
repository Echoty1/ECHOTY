// src/components/pages/Chat/AudioPlayer.jsx
import React, { useState, useRef, useEffect } from 'react';

const AudioPlayer = ({ src }) => {
  if (!src) {
    return (
      <div className="audio-placeholder">
        <i className="fas fa-music" />
        <span>Audio unavailable</span>
      </div>
    );
  }

  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoaded, setIsLoaded] = useState(src?.startsWith('blob:') || false); // ✅ blob = instantly loaded
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const barRefs = useRef([]);
  const animationRef = useRef(null);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
      setError(false);
    };

    const onLoadedData = () => {
      setIsLoaded(true);
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
      setIsLoaded(false);
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
  }, [src, duration, isPlaying]);

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
    setIsLoaded(false);
    setRetryCount(prev => prev + 1);
    const audio = audioRef.current;
    if (audio) {
      audio.src = src;
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

  if (error) {
    return (
      <div className="audio-error-placeholder">
        <i className="fas fa-exclamation-triangle" />
        <span>Audio unavailable</span>
        <button onClick={handleRetry}>Retry</button>
      </div>
    );
  }

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={src} preload="auto" crossOrigin="anonymous" key={retryCount} />
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
          disabled={!isLoaded}
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