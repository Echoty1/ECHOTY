// src/pages/Spotlight/SpotlightRecorder.jsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './SpotlightRecorder.css';

const MAX_DURATION_SEC = 60;

const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch (_) {}
  }
  return '';
};

const extForMime = (mime) => {
  if (!mime) return 'webm';
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
};

const formatTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

const SpotlightRecorder = ({ onDone, onCancel }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const pausedTimeRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [facing, setFacing] = useState('user');
  const [error, setError] = useState('');
  const [mime, setMime] = useState('');

  /* ─── Init camera ──────────────────────────────────────── */
  const startCamera = useCallback(async (facingMode) => {
    setError('');
    setReady(false);

    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera not available in this browser');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
      setMime(pickMimeType());
      setReady(true);
    } catch (err) {
      console.warn('[Recorder] camera failed:', err);
      setError(err?.message || 'Could not access camera');
    }
  }, []);

  useEffect(() => {
    startCamera(facing);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        try { recorderRef.current.stop(); } catch (_) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flipCamera = async () => {
    if (recording) return; // don't flip mid-record
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    await startCamera(next);
  };

  /* ─── Timer ────────────────────────────────────────────── */
  const startTimer = () => {
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    setElapsed(0);
    timerRef.current = setInterval(() => {
      const total = (Date.now() - startTimeRef.current) / 1000 - pausedTimeRef.current;
      setElapsed(total);
      if (total >= MAX_DURATION_SEC) {
        stopRecording();
      }
    }, 100);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  /* ─── Recording ────────────────────────────────────────── */
  const startRecording = () => {
    if (!streamRef.current || recording) return;
    setError('');
    chunksRef.current = [];

    const type = mime || pickMimeType();
    let recorder;
    try {
      recorder = type ? new MediaRecorder(streamRef.current, { mimeType: type }) : new MediaRecorder(streamRef.current);
    } catch (err) {
      setError('Recording not supported');
      return;
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      stopTimer();
      const finalMime = recorder.mimeType || type || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: finalMime });
      chunksRef.current = [];
      if (blob.size === 0) {
        setError('Nothing was recorded');
        setRecording(false);
        setPaused(false);
        return;
      }
      const ext = extForMime(finalMime);
      // Hand off the recorded blob to the parent (upload wizard).
      onDone?.({
        blob,
        mime: finalMime,
        ext,
        duration: elapsed,
        width: videoRef.current?.videoWidth || 0,
        height: videoRef.current?.videoHeight || 0,
      });
    };

    try {
      recorder.start(250); // 250ms chunks
    } catch (err) {
      setError('Could not start recording');
      return;
    }

    recorderRef.current = recorder;
    setRecording(true);
    setPaused(false);
    startTimer();
  };

  const stopRecording = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      if (rec.state === 'recording' || rec.state === 'paused') {
        rec.stop();
      }
    } catch (_) {}
    recorderRef.current = null;
    setRecording(false);
    setPaused(false);
  };

  const togglePause = () => {
    const rec = recorderRef.current;
    if (!rec) return;
    try {
      if (rec.state === 'recording') {
        rec.pause();
        setPaused(true);
        pausedTimeRef.current += 0; // mark pause point
        pausedTimeRef.current = Date.now() - startTimeRef.current - elapsed * 1000 + pausedTimeRef.current;
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (rec.state === 'paused') {
        rec.resume();
        setPaused(false);
        // Adjust timer
        startTimeRef.current = Date.now() - elapsed * 1000 - pausedTimeRef.current;
        timerRef.current = setInterval(() => {
          const total = (Date.now() - startTimeRef.current) / 1000 - pausedTimeRef.current / 1000;
          setElapsed(total);
          if (total >= MAX_DURATION_SEC) stopRecording();
        }, 100);
      }
    } catch (_) {}
  };

  const closeRecorder = () => {
    if (recording) {
      if (!window.confirm('Discard recording?')) return;
      stopRecording();
    }
    onCancel?.();
  };

  const progressPct = Math.min(100, (elapsed / MAX_DURATION_SEC) * 100);

  return (
    <div className="spotlight-recorder">
      <video
        ref={videoRef}
        className="spotlight-recorder-video"
        playsInline
        autoPlay
        muted
      />

      <div className="spotlight-recorder-scrim" aria-hidden="true" />

      {/* Top bar */}
      <div className="spotlight-recorder-top">
        <button
          type="button"
          className="spotlight-recorder-icon-btn"
          onClick={closeRecorder}
          aria-label="Close"
        >
          <i className="fas fa-times" />
        </button>

        <div className={`spotlight-recorder-timer ${recording ? 'live' : ''}`}>
          {recording && <span className="spotlight-recorder-dot" />}
          {formatTime(elapsed)} <span className="spotlight-recorder-timer-max">/ 1:00</span>
        </div>

        <button
          type="button"
          className="spotlight-recorder-icon-btn"
          onClick={flipCamera}
          disabled={recording}
          aria-label="Flip camera"
        >
          <i className="fas fa-camera-rotate" />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="spotlight-recorder-error">
          <i className="fas fa-exclamation-triangle" />
          <p>{error}</p>
          <button type="button" onClick={() => startCamera(facing)}>Retry</button>
        </div>
      )}

      {/* Progress ring around shutter */}
      <div className="spotlight-recorder-bottom">
        <button
          type="button"
          className="spotlight-recorder-flip-side"
          onClick={flipCamera}
          disabled={recording}
          aria-label="Flip camera"
        >
          <i className="fas fa-camera-rotate" />
        </button>

        <button
          type="button"
          className={`spotlight-recorder-shutter ${recording ? 'recording' : ''} ${paused ? 'paused' : ''}`}
          onClick={recording ? stopRecording : startRecording}
          disabled={!ready && !error}
          aria-label={recording ? 'Stop recording' : 'Start recording'}
        >
          <svg className="spotlight-recorder-ring" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="5" />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="url(#recGrad)"
              strokeWidth="5"
              strokeDasharray={`${(progressPct / 100) * 339.3} 339.3`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
            <defs>
              <linearGradient id="recGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6C3CE1" />
                <stop offset="100%" stopColor="#EC4899" />
              </linearGradient>
            </defs>
          </svg>
          <span className={`spotlight-recorder-shutter-core ${recording ? 'recording' : ''}`} />
        </button>

        <button
          type="button"
          className="spotlight-recorder-pause-side"
          onClick={togglePause}
          disabled={!recording}
          aria-label={paused ? 'Resume' : 'Pause'}
        >
          <i className={paused ? 'fas fa-play' : 'fas fa-pause'} />
        </button>
      </div>

      {/* Hint */}
      {!recording && (
        <div className="spotlight-recorder-hint">
          Tap the circle to record · up to 60 seconds
        </div>
      )}
      {paused && (
        <div className="spotlight-recorder-paused-pill">Paused</div>
      )}
    </div>
  );
};

export default SpotlightRecorder;
