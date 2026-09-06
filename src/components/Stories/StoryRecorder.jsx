import React, { useRef, useState, useEffect } from 'react';
import { createImageStatus } from '../../services/statusService'; 
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [snappedImage, setSnappedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // 1. Start Camera
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
        setError("Camera access denied. Please allow camera permissions.");
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 2. Snap and COMPRESS
  const handleSnap = () => {
    if (!videoRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Compress to 0.5 to keep DB small
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.5);
    setSnappedImage(imageDataUrl);
  };

  const retake = () => setSnappedImage(null);

  // 3. Upload to DB directly (No Firebase Storage needed!)
  const handlePost = async () => {
    if (!snappedImage || !userId) return;
    setUploading(true);
    setError('');

    try {
      // Pass base64 string directly as imageUrl
      await createImageStatus(userId, { imageUrl: snappedImage, caption });
      
      onClose();
    } catch (err) {
      console.error("Error posting story:", err);
      setError(`Upload failed: ${err.message || 'Please check your internet connection.'}`);
      setUploading(false);
    }
  };

  return (
    <div className="recorder-overlay">
      <div className="recorder-modal">
        <h2>Create New Story</h2>
        
        {error && <div className="camera-error" style={{ color: '#ff4d4f', marginBottom: '10px' }}>{error}</div>}

        {!snappedImage ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <button className="snap-btn" onClick={handleSnap} disabled={!stream}>
              <div className="snap-btn-inner"></div>
            </button>
          </>
        ) : (
          <>
            <div className="snapped-preview">
              <img src={snappedImage} alt="Preview" className="image-preview" />
            </div>
            <input 
              type="text" 
              placeholder="Add a caption..." 
              value={caption} 
              onChange={(e) => setCaption(e.target.value)} 
              className="caption-input"
            />
            <div className="modal-actions">
              <button onClick={retake} disabled={uploading}>Retake</button>
              <button onClick={handlePost} disabled={uploading} style={{ backgroundColor: uploading ? '#555' : '#0095f6' }}>
                {uploading ? 'Posting...' : 'Share to Story'}
              </button>
            </div>
          </>
        )}
        <button className="close-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default StoryRecorder;
