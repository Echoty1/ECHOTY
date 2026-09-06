// src/components/Status/StatusRecorder.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { createVoiceStatus } from '../../services/statusService';
import './StatusRecorder.css';

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

const VOICE_FILTERS = [
  { id: 'normal', label: 'Normal', icon: '🎙️' },
  { id: 'deep', label: 'Deep', icon: '🌑' },
  { id: 'high', label: 'High', icon: '🐿️' },
  { id: 'robot', label: 'Robot', icon: '🤖' },
  { id: 'soft', label: 'Soft', icon: '☁️' },
  { id: 'echo', label: 'Echo', icon: '🔁' },
];

const StatusRecorder = ({ onClose }) => {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [duration, setDuration] = useState(0);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState('normal');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [previewUrl]);

  // Apply simple voice effects using Web Audio API
  const applyVoiceFilter = async (blob, filterId) => {
    if (filterId === 'normal') return blob;

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioBuffer.sampleRate
      );

      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;

      let lastNode = source;

      if (filterId === 'deep') {
        // Lower pitch feel (playbackRate trick + slight filter)
        source.playbackRate.value = 0.82;
      } else if (filterId === 'high') {
        source.playbackRate.value = 1.25;
      } else if (filterId === 'robot') {
        const waveShaper = offlineCtx.createWaveShaper();
        waveShaper.curve = makeDistortionCurve(80);
        waveShaper.oversample = '4x';
        lastNode.connect(waveShaper);
        lastNode = waveShaper;
      } else if (filterId === 'soft') {
        const filter = offlineCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        lastNode.connect(filter);
        lastNode = filter;
      } else if (filterId === 'echo') {
        const delay = offlineCtx.createDelay(1.0);
        delay.delayTime.value = 0.22;
        const feedback = offlineCtx.createGain();
        feedback.gain.value = 0.35;
        lastNode.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(offlineCtx.destination);
      }

