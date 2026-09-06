// src/components/StatusRecorder.jsx
import React, { useRef, useState, useEffect } from 'react';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { createImageStatus } from '../services/statusService';
import './StatusRecorder.css';

const StatusRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [snappedImage, setSnappedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Start the camera when the component mounts
  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "user" }, // Front camera
          audio: false 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Camera access denied. Please allow camera permissions.");
      }
    };

    startCamera();

    // Cleanup: stop the camera when component unmounts
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Take the photo
  const handleSnap = () => {
    if (!videoRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Set canvas to the exact size of the video feed
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    // Draw the current video frame to the canvas
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg');
    setSnappedImage(imageDataUrl);
  };

  const retake = () => {
    setSnappedImage(null);
  };

  const handlePost = async () => {
    if (!snappedImage || !userId) return;
    setUploading(true);

    try {
      const storage = getStorage();
      const imageRef = storageRef(storage, `statuses/${userId}/${Date.now()}.jpg`);

      // Upload the base64 string directly
      await uploadString(imageRef, snappedImage, 'data_url');
      const downloadURL = await getDownloadURL(imageRef);

      // Save to database
      await createImageStatus(userId, { imageUrl: downloadURL, caption });
      onClose();
    } catch (error) {
      console.error("Error posting status:", error);
      alert("Failed to post status");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="status-recorder-overlay">
      <div className="status-recorder-modal">
        <h2>Create New Story</h2>

        {/* Error message if camera fails */}
        {error && <div className="camera-error">{error}</div>}

        {!snappedImage ? (
          <div className="camera-view">
            {/* Live Video Feed */}
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="video-feed"
            />
            {/* Hidden Canvas for capturing */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            
            {/* Snap Button */}
            <button className="snap-btn" onClick={handleSnap} disabled={!stream}>
              <div className="snap-btn-inner"></div>
            </button>
          </div>
        ) : (
          <>
            {/* Preview of snapped image */}
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
              <button onClick={handlePost} disabled={uploading}>
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

export default StatusRecorder;
