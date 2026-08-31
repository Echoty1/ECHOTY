// src/components/pages/Chat/VoiceRecorder.jsx
import React, { useState, useRef, useEffect } from 'react';

const VoiceRecorder = ({ onSend, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const isMounted = useRef(true);

  // Determine supported MIME type
  const getSupportedMimeType = () => {
    const types = ['audio/webm', 'audio/mp4', 'audio/ogg'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return 'audio/webm'; // fallback
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        // Validate blob size
        if (blob.size === 0) {
          alert('Recording was empty. Please try again.');
          handleCancel();
          return;
        }
        const url = URL.createObjectURL(blob);
        if (isMounted.current) {
          setAudioBlob(blob);
          setAudioUrl(url);
          setIsRecording(false);
        }
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        if (isMounted.current) {
          setDuration(prev => prev + 1);
        }
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Please allow microphone access to record voice notes.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsRecording(false);
    setDuration(0);
    onCancel();
  };

  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob, duration);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Simple waveform bars for preview
  const bars = Array.from({ length: 20 }, (_, i) => (
    <div
      key={i}
      className="waveform-bar"
      style={{ height: `${10 + Math.random() * 30}px` }}
    />
  ));

  return (
    <div className="voice-recorder-overlay">
      <div className="voice-recorder-content">
        {!audioUrl ? (
          // Recording state
          <div className="voice-recorder-status">
            <span className="recording-dot" />
            <span className="recording-time">{formatTime(duration)}</span>
          </div>
        ) : (
          // Preview state
          <div className="voice-recorder-preview">
            <div className="audio-waveform">{bars}</div>
            <span className="audio-duration">{formatTime(duration)}</span>
          </div>
        )}
        <div className="voice-recorder-actions">
          {!audioUrl ? (
            <>
              {!isRecording ? (
                <button className="recorder-btn start" onClick={startRecording}>
                  <i className="fas fa-microphone" />
                </button>
              ) : (
                <button className="recorder-btn stop" onClick={stopRecording}>
                  <i className="fas fa-stop" />
                </button>
              )}
              <button className="recorder-btn cancel" onClick={handleCancel}>
                <i className="fas fa-times" />
              </button>
            </>
          ) : (
            <>
              <button className="recorder-btn send" onClick={handleSend}>
                <i className="fas fa-paper-plane" />
              </button>
              <button className="recorder-btn cancel" onClick={handleCancel}>
                <i className="fas fa-trash-alt" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceRecorder;