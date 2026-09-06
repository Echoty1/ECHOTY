import React, { useRef, useState, useEffect } from 'react';
import { createImageStatus, getUserMemories } from '../../services/statusService';
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [memories, setMemories] = useState([]);

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

    getUserMemories(userId).then(setMemories).catch(() => {});

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
      onClose();
    } catch (err) {
      console.error("Error auto-posting:", err);
      setSnapping(false);
    }
  };

  return (
    <div className="recorder-overlay">
      <div className="recorder-modal-small">
        <div className="small-camera-header">
          <h3>Create New Echus</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Small Camera Square */}
        <div className="small-camera-space" onClick={handleTapToSnap} style={{ opacity: snapping ? 0.6 : 1 }}>
          <video ref={videoRef} autoPlay playsInline muted className="small-video-feed" />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Memories Section */}
        <div className="memories-section">
          <h4>Your Memories</h4>
          {memories.length === 0 ? (
            <p>No memories yet.</p>
          ) : (
            <div className="memories-scroll">
              {memories.map((mem, idx) => (
                <img key={idx} src={mem.imageUrl} alt="Memory" className="memory-thumb" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StoryRecorder;
