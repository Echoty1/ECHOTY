import React, { useRef, useState, useEffect } from 'react';
import { createImageStatus, getUserMemories, deleteStatus } from '../../services/statusService';
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const tapTimeoutRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const lastTapRef = useRef(0);

  const [stream, setStream] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [memories, setMemories] = useState([]);
  const [showMemories, setShowMemories] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  
  // New states for Text & Zoom
  const [isLongPressed, setIsLongPressed] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textOverlay, setTextOverlay] = useState('');
  const [tempText, setTempText] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);

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
          video: { facingMode: facingMode, zoom: { ideal: zoomLevel } }, 
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
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
    };
  }, [facingMode]);

  // Apply CSS Zoom to video
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.style.transform = `scale(${zoomLevel}) ${facingMode === 'user' ? 'scaleX(-1)' : ''}`;
    }
  }, [zoomLevel, facingMode]);

  // Handle Mouse Scroll / Ctrl + Scroll for zoom
  const handleWheelZoom = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoomLevel(prev => Math.min(3, Math.max(1, prev - e.deltaY * 0.01)));
    }
  };

  // Handle Touch Pinch zoom
  const handleTouchMove = (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newZoom = Math.min(3, Math.max(1, distance / 150));
      setZoomLevel(newZoom);
    }
  };

  // Long Press to show text
  const handlePointerDown = (e) => {
    e.preventDefault();
    lastTapRef.current = Date.now();

    // Long Press Timer (500ms)
    longPressTimeoutRef.current = setTimeout(() => {
      setIsLongPressed(true);
      setShowTextInput(true);
      setTempText(textOverlay); // Prefill existing text
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimeoutRef.current);
    
    // If it wasn't a long press, treat as a tap
    if (!isLongPressed) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;

      // Double tap logic
      if (timeSinceLastTap < 250) {
        clearTimeout(tapTimeoutRef.current);
        lastTapRef.current = 0;
        setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
        return;
      }

      // Single tap snap logic with delay
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        if (lastTapRef.current !== 0) {
          handleSnap();
        }
      }, 250);
    } else {
      setIsLongPressed(false);
    }
  };

  const handleSnap = async () => {
    if (!videoRef.current || snapping) return;

    setSnapping(true);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    // ✅ FIX: Flip context back if using front camera so image isn't mirrored
    if (facingMode === 'user') {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    // Apply zoom via scale
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Apply Text Overlay
    if (textOverlay) {
      context.font = 'bold 32px Arial';
      context.fillStyle = 'white';
      context.strokeStyle = 'black';
      context.lineWidth = 4;
      context.textAlign = 'center';
      context.strokeText(textOverlay, canvas.width / 2, canvas.height / 2);
      context.fillText(textOverlay, canvas.width / 2, canvas.height / 2);
    }

    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    try {
      // Snap & Auto-post (does not close camera)
      await createImageStatus(userId, { imageUrl: imageDataUrl, caption: textOverlay });
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
            <button className="memories-btn" onClick={() => setShowMemories(!showMemories)}>
              <i className="fas fa-clock"></i> Memories
            </button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Camera Space with Long Press, Tap, & Zoom */}
        <div 
          className="small-camera-space"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheelZoom}
          onTouchMove={handleTouchMove}
          style={{ opacity: snapping ? 0.6 : 1 }}
        >
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="small-video-feed"
          />
          
          {/* Text Overlay (Shows current text even before snapping) */}
          {!showTextInput && textOverlay && (
            <div className="camera-text-overlay">
              <span>{textOverlay}</span>
            </div>
          )}

          {/* Text Input Popup */}
          {showTextInput && (
            <div className="camera-text-input-popup" onClick={(e) => e.stopPropagation()}>
              <input 
                type="text" 
                autoFocus 
                placeholder="Type your text..." 
                value={tempText}
                onChange={(e) => setTempText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setTextOverlay(tempText);
                    setShowTextInput(false);
                  }
                }}
              />
              <div className="text-input-actions">
                <button onClick={() => { setTextOverlay(tempText); setShowTextInput(false); }}>Done</button>
                <button onClick={() => { setTempText(''); setTextOverlay(''); setShowTextInput(false); }}>Clear</button>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {snapping && <div className="snapping-flash"></div>}

          {/* Switch Camera Button */}
          <button 
            className="switch-camera-btn" 
            onClick={(e) => {
              e.stopPropagation(); 
              setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
            }}
            aria-label="Switch Camera"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </button>
        </div>

        {/* Memories */}
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

        {/* Full Memory Viewer */}
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
