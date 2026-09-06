import React, { useRef, useState, useEffect } from 'react';
import { createImageStatus, getUserMemories, deleteStatus } from '../../services/statusService';
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [memories, setMemories] = useState([]);
  const [showMemories, setShowMemories] = useState(false);

  // Fetch memories
  const fetchMemories = async () => {
    const data = await getUserMemories(userId);
    setMemories(data);
  };

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" }, 
          audio: false 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Camera access denied.", err);
      }
    };

    startCamera();
    fetchMemories();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Tap to auto-snap and auto-post WITHOUT closing the page
  const handleTapToSnap = async () => {
    if (!videoRef.current || snapping) return;
    setSnapping(true);

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.5);

    try {
      await createImageStatus(userId, { imageUrl: imageDataUrl, caption: '' });
      setSnapping(false); // Reset so they can snap again
      fetchMemories(); // Refresh memories silently
    } catch (err) {
      console.error("Error auto-posting:", err);
      setSnapping(false);
    }
  };

  const handleDeleteMemory = async (statusId) => {
    if (!window.confirm("Delete this Echus?")) return;
    await deleteStatus(userId, statusId);
    fetchMemories();
  };

  return (
    <div className="recorder-overlay">
      <div className="recorder-modal-small">
        {/* Top Header */}
        <div className="small-camera-header">
          <h3>Create Echus</h3>
          <div className="camera-header-actions">
            <button 
              className="memories-btn"
              onClick={() => setShowMemories(!showMemories)}
            >
              <i className="fas fa-clock"></i> Memories
            </button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Camera Feed - Tap to snap, stays open */}
        <div 
          className="small-camera-space" 
          onClick={handleTapToSnap}
          style={{ opacity: snapping ? 0.6 : 1, pointerEvents: snapping ? 'none' : 'auto' }}
        >
          <video ref={videoRef} autoPlay playsInline muted className="small-video-feed" />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {snapping && <div className="snapping-flash"></div>}
        </div>

        {/* Memories Grid Modal (Floating Overlay inside the camera modal) */}
        {showMemories && (
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
                  <div key={mem.id} className="memory-card">
                    <img src={mem.imageUrl} alt="Memory" />
                    <div className="memory-info">
                      <span>{new Date(mem.createdAt).toLocaleDateString()}</span>
                      <button className="delete-memory" onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMemory(mem.id);
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

      </div>
    </div>
  );
};

export default StoryRecorder;
