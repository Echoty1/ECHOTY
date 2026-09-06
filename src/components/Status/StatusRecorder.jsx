// src/components/Status/StatusRecorder.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createVoiceStatus } from '../../services/statusService';
import './StatusRecorder.css';

// ─── Same Cloudinary config from your ChatView.js ────────────────
const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';

const uploadToCloudinary = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, true);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.secure_url);
        } catch (err) {
          reject(new Error('Invalid response from Cloudinary'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
};

const MAX_DURATION = 30;

const StatusRecorder = ({ onClose }) => {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Please allow microphone access to record an Echo.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    clearInterval(timerRef.current);
    setIsRecording(false);
  };

  const handlePost = async () => {
    if (!audioBlob || !user) return;
    setUploading(true);
    setUploadProgress(0);

    try {
      const file = new File([audioBlob], `echo_status_${Date.now()}.webm`, {
        type: 'audio/webm',
      });

      const audioUrl = await uploadToCloudinary(file, (percent) => {
        setUploadProgress(percent);
      });

      await createVoiceStatus(user.uid, {
        audioUrl,
        duration,
        caption: caption.trim(),
      });

      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to post your Echo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setAudioBlob(null);
    setPreviewUrl(null);
    setDuration(0);
    setCaption('');
    setUploadProgress(0);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="status-recorder-overlay">
      <div className="status-recorder-card">
        <button className="recorder-close" onClick={onClose}>
          ×
        </button>

        <h2 className="recorder-title">New Echo</h2>
        <p className="recorder-subtitle">Record a 30-second voice status</p>

        {!audioBlob ? (
          <div className="recorder-main">
            <div className={`record-circle ${isRecording ? 'pulsing' : ''}`}>
              <div className="mic-icon">{isRecording ? '🔴' : '🎙️'}</div>
            </div>

            <div className="timer-display">
              {formatTime(duration)} <span>/ 00:30</span>
            </div>

            <button
              className={`record-action-btn ${isRecording ? 'stop' : 'start'}`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>
          </div>
        ) : (
          <div className="preview-main">
            <audio src={previewUrl} controls className="preview-audio" />

            <input
              type="text"
              className="caption-input"
              placeholder="Add a short caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={60}
            />

            {uploading && (
              <div style={{ fontSize: 13, color: '#a78bfa', textAlign: 'center' }}>
                Uploading... {uploadProgress}%
              </div>
            )}

            <div className="preview-actions">
              <button className="btn-secondary" onClick={reset} disabled={uploading}>
                Re-record
              </button>
              <button
                className="btn-primary"
                onClick={handlePost}
                disabled={uploading}
              >
                {uploading ? 'Posting...' : 'Post Echo'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusRecorder;
