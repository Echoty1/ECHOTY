import React, { useRef, useState, useEffect } from 'react';
import { createImageStatus, getUserMemories, deleteStatus } from '../../services/statusService';
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const lastTapRef = useRef(0);
  
  const [stream, setStream] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [memories, setMemories] = useState([]);
  const [showMemories, setShowMemories] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null); // When a memory is opened
  const [facingMode, setFacingMode] = useState('user'); // 'user' or 'environment'

  // Fetch memories
  const fetchMemories = async () => {
    const data = await getUserMemories(userId);
    setMemories(data);
  };

  // Start Camera
  useEffect(() => {
    const startCamera = async () => {
      try {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode }, 
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
  }, [facingMode]); // Restart camera when facingMode changes

  // Single Tap = Snap & Auto-post. Double Tap = Flip Camera.
  const handleCameraTap = async () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    // Double tap detected: Flip the camera
    if (timeSinceLastTap < 300) {
      lastTapRef.current = 0;
      setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
      return;
    }

    // Single tap: Snap & Post
    lastTapRef.current = now;
    if (!videoRef.current || snapping) return;
    setSnapping(true);

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    try {
      await createImageStatus(userId, { imageUrl: imageDataUrl, caption: '' });
      setSnapping(false); 
      fetchMemories(); 
    } catch (err) {
      console.error("Error auto-posting:", err);
      setSnapping(false);
    }
  };

  // Delete memory
  const handleDeleteMemory = async (statusId) => {
    if (!window.confirm("Delete this Echus?")) return;
    await deleteStatus(userId, statusId);
    fetchMemories();
  };

  // Close full screen memory
  const closeMemory = () => setSelectedMemory(null);

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

        {/* Camera Feed - Single Tap to snap, Double Tap to flip */}
        <div 
          className="small-camera-space" 
          onClick={handleCameraTap}
          style={{ opacity: snapping ? 0.6 : 1, pointerEvents: snapping ? 'none' : 'auto' }}
        >
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`small-video-feed ${facingMode === 'user' ? 'mirror' : ''}`}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {snapping && <div className="snapping-flash"></div>}
          {!snapping && <div className="camera-tap-overlay"></div>}
        </div>

        {/* Memories Grid Modal */}
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

        {/* Full Memory Viewer (Covers camera when selected) */}
        {selectedMemory && (
          <div className="memory-fullscreen-overlay" onClick={closeMemory}>
            <div className="memory-fullscreen-content" onClick={(e) => e.stopPropagation()}>
              <img src={selectedMemory.imageUrl} alt="Memory Full" />
              <div className="memory-fullscreen-actions">
                <button className="cancel-memory-btn" onClick={closeMemory}>Cancel</button>
                <button className="delete-memory-btn" onClick={() => {
                  handleDeleteMemory(selectedMemory.id);
                  setSelectedMemory(null);
                }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default StoryRecorder;
