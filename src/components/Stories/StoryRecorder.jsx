import React, { useRef, useState, useEffect } from 'react';
import { createImageStatus, getUserMemories, deleteStatus } from '../../services/statusService';
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  
  const [facingMode, setFacingMode] = useState('user');
  const [showFlash, setShowFlash] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  
  // Memories State
  const [memories, setMemories] = useState([]);
  const [showMemories, setShowMemories] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);

  const fetchMemories = async () => {
    try {
      const data = await getUserMemories(userId);
      setMemories(data);
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    }
  };

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

  const openMemories = () => {
    fetchMemories();
    setShowMemories(true);
  };

  return (
    <div className="instants-camera-overlay">
      {/* Top Header */}
      <div className="instants-camera-header">
        <button className="camera-close-btn" onClick={onClose}>
          <i className="fas fa-times" />
        </button>
        <h2 className="camera-title">New instant</h2>
        <button className="camera-history-btn" onClick={openMemories}>
          <i className="fas fa-th" />
          {memories.length > 0 && <span className="history-badge">{memories.length}</span>}
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

      {/* Audience Pill */}
      <div className="instants-audience-pill">
        <div className="audience-avatar">
          <i className="fas fa-user" />
        </div>
        Friends <i className="fas fa-chevron-down" />
      </div>

      {/* Memories Panel */}
      {showMemories && !selectedMemory && (
        <div className="memories-glass-panel">
          <div className="memories-header">
            <h4>Your Echus Memories</h4>
            <button className="close-memories" onClick={() => setShowMemories(false)}>✕</button>
          </div>
          
          {memories.length === 0 ? (
            <p className="no-memories">No memories yet. Snap a photo to see it here.</p>
          ) : (
            <div className="memories-grid">
              {memories.map((mem) => (
                <div key={mem.id} className="memory-card" onClick={() => setSelectedMemory(mem)}>
                  <img src={mem.imageUrl} alt="Memory" />
                  <div className="memory-info">
                    <span>{new Date(mem.createdAt).toLocaleDateString()}</span>
                    <button className="delete-memory" onClick={(e) => {
                      e.stopPropagation();
                      deleteStatus(userId, mem.id).then(fetchMemories);
                    }}>
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Memory */}
      {selectedMemory && (
        <div className="memory-fullscreen-overlay" onClick={() => setSelectedMemory(null)}>
          <div className="memory-fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <img src={selectedMemory.imageUrl} alt="Memory Full" />
            <div className="memory-fullscreen-actions">
              <button className="cancel-memory-btn" onClick={() => setSelectedMemory(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryRecorder;
