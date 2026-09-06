import React, { useRef, useState, useEffect } from 'react';
import { createImageStatus, getUserMemories, deleteStatus } from '../../services/statusService';
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null); // 🚨 CRITICAL: We use a ref, not useState, so it NEVER resets
  const tapTimeoutRef = useRef(null);
  const lastTapRef = useRef(0);

  const [snapping, setSnapping] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [memories, setMemories] = useState([]);
  const [showMemories, setShowMemories] = useState(false);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLoadingCam, setIsLoadingCam] = useState(true);

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
        // If switching cameras, stop the old stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: facingMode }, 
          audio: false 
        });

        if (cancelled) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = mediaStream; // Keep it permanently
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            resolve();
          } else {
            videoRef.current.onloadeddata = resolve;
          }
        });

        if (!cancelled) {
          setIsLoadingCam(false);
        }
      } catch (err) {
        console.error("Camera access denied.", err);
        setIsLoadingCam(false);
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      // 🚨 CRITICAL: Stop camera ONLY when component actually closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, [facingMode]);

  useEffect(() => {
    if (videoRef.current) {
      const mirror = facingMode === 'user' ? 'scaleX(-1)' : '';
      videoRef.current.style.transform = `scale(${zoomLevel}) ${mirror}`;
    }
  }, [zoomLevel, facingMode]);

  const handleWheelZoom = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoomLevel(prev => Math.min(3, Math.max(1, prev - e.deltaY * 0.01)));
    }
  };

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

  const handlePointerUp = () => {
    if (snapping) return;

    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (timeSinceLastTap < 250) {
      clearTimeout(tapTimeoutRef.current);
      lastTapRef.current = 0;
      setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
      return;
    }

    lastTapRef.current = now;
    tapTimeoutRef.current = setTimeout(() => {
      if (lastTapRef.current !== 0) {
        handleSnap();
      }
    }, 250);
  };

  const handleSnap = async () => {
    if (!videoRef.current || snapping) return;

    // 🚨 CRITICAL: Instantly show the flash and camera stays open!
    setSnapping(true);
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 200);

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;

    if (facingMode === 'user') {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);

    try {
      if (!userId) {
        console.error("User ID is missing!");
        alert("User ID is missing. Please log out and log back in.");
        setSnapping(false);
        return;
      }

      // Post to database in the background
      await createImageStatus(userId, { imageUrl: imageDataUrl, caption: '' });
      
      // 🚨 CRITICAL: Instantly stop "snapping" so it doesn't gray out, just do this immediately
      setSnapping(false);
      
      // Then refresh memories in the background
      await fetchMemories();

    } catch (err) {
      console.error("Error saving status:", err);
      alert(`Failed to post Echus: ${err.message}`);
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

        <div 
          className="small-camera-space"
          onClick={handlePointerUp}
          onWheel={handleWheelZoom}
          onTouchMove={handleTouchMove}
        >
          {/* Camera is ALWAYS visible, no hide */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="small-video-feed"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          
          {/* Flash Effect */}
          {showFlash && <div className="snapping-flash"></div>}

          {isLoadingCam && (
            <div className="camera-loading" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '12px', pointerEvents: 'none' }}>
              Loading...
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />

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
