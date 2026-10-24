import React, { useRef, useState, useEffect } from 'react';
import { createImageStatus, getUserMemories, deleteStatus } from '../../services/statusService';
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose, onOpenMemories }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('user');
  const [showFlash, setShowFlash] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const startCamera = async () => {
      try {
        if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode }, 
          audio: false 
        });
        if (cancelled) return;
        streamRef.current = mediaStream;
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      } catch (err) {
        console.error("Camera access denied.", err);
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [facingMode]);

  const handleSnap = async () => {
    if (!videoRef.current || isSnapping) return;
    setIsSnapping(true);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 150);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    try {
      await createImageStatus(userId, { imageUrl: imageDataUrl, caption: '' });
      onClose(); // Close camera after snapping
    } catch (err) {
      alert(`Failed to post Echus: ${err.message}`);
      setIsSnapping(false);
    }
  };

  return (
    <div className="instants-camera-overlay">
      {/* Header */}
      <div className="instants-camera-header">
        <button className="camera-close-btn" onClick={onClose}>
          <i className="fas fa-times" />
        </button>
        <h2 className="camera-title">New instant</h2>
        <button className="camera-history-btn" onClick={onOpenMemories}>
          <i className="fas fa-th" />
          <span className="history-badge">1</span>
        </button>
      </div>

      {/* Camera Preview */}
      <div className="instants-camera-preview">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="instants-video-feed"
        />
        {showFlash && <div className="instants-flash" />}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Bottom Controls */}
      <div className="instants-camera-controls">
        <button className="camera-side-btn"><i className="fas fa-bolt" /></button>
        
        <button 
          className={`camera-shutter-btn ${isSnapping ? 'snapping' : ''}`} 
          onClick={handleSnap}
        >
          <div className="shutter-inner" />
        </button>
        
        <button 
          className="camera-side-btn" 
          onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
        >
          <i className="fas fa-sync-alt" />
        </button>
      </div>

      {/* Bottom Audience Pill */}
      <div className="instants-audience-pill">
        <div className="audience-avatar">
          <i className="fas fa-user" />
        </div>
        Friends <i className="fas fa-chevron-down" />
      </div>
    </div>
  );
};

export default StoryRecorder;
