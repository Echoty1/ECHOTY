import React, { useRef, useState, useEffect } from 'react';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
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

  // 2. Snap and COMPRESS the image
  const handleSnap = () => {
    if (!videoRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // COMPRESS: 0.6 quality reduces file size significantly
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.6);
    setSnappedImage(imageDataUrl);
  };

  const retake = () => setSnappedImage(null);

  // 3. Upload with proper error handling
  const handlePost = async () => {
    if (!snappedImage || !userId) return;
    setUploading(true);
    setError('');

    try {
      const storage = getStorage();
      // Use the uid and timestamp so we don't overwrite files
      const imageRef = storageRef(storage, `statuses/${userId}/${Date.now()}.jpg`);

      await uploadString(imageRef, snappedImage, 'data_url');
      const downloadURL = await getDownloadURL(imageRef);

      await createImageStatus(userId, { imageUrl: downloadURL, caption });
      
      // Success! Close the modal
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
        
        {/* Show error if any */}
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
