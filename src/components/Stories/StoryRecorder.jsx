import React, { useRef, useState, useEffect } from 'react';
import { createImageStatus, getUserMemories, deleteStatus } from '../../services/statusService';
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const tapTimeoutRef = useRef(null);
  const lastTapRef = useRef(0);
  
  const [stream, setStream] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [memories, setMemories] = useState([]);
  const [showMemories, setShowMemories] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [facingMode, setFacingMode] = useState('user');

  const fetchMemories = async () => {
    const data = await getUserMemories(userId);
    setMemories(data);
  };

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
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, [facingMode]);

  // ✅ FIXED TAP LOGIC: Waits 250ms to see if it's a double tap
  const handleCameraTap = () => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    // If it's a double tap (less than 250ms since last tap), flip camera
    if (timeSinceLastTap < 250) {
      clearTimeout(tapTimeoutRef.current); // Cancel the pending single tap snap
      lastTapRef.current = 0;
      setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
      return;
    }

    // Otherwise, set lastTapRef and wait 250ms to see if a double tap comes
    lastTapRef.current = now;
    tapTimeoutRef.current = setTimeout(() => {
      // If no double tap happened in 250ms, treat it as a single tap and snap
      if (lastTapRef.current !== 0) {
        handleSingleTapSnap();
      }
    }, 250);
  };

  const handleSingleTapSnap = async () => {
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

  const handleDeleteMemory = async (statusId) => {
    if (!window.confirm("Delete this Echus?")) return;
    await deleteStatus(userId, statusId);
    fetchMemories();
  };

  const closeMemory = () => setSelectedMemory(null);

  return (
    <div className="recorder-overlay">
      <div className="recorder-modal-small">
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
        </div>

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
