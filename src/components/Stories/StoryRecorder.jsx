import React, { useRef, useState, useEffect } from 'react';
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from 'firebase/storage';
import { createImageStatus } from '../../services/statusService'; // Import from existing service
import './StoriesBar.css';

const StoryRecorder = ({ userId, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [snappedImage, setSnappedImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSnap = () => {
    if (!videoRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    setSnappedImage(canvas.toDataURL('image/jpeg'));
  };

  const retake = () => setSnappedImage(null);

  const handlePost = async () => {
    if (!snappedImage || !userId) return;
    setUploading(true);

    try {
      const storage = getStorage();
      const imageRef = storageRef(storage, `statuses/${userId}/${Date.now()}.jpg`);
      await uploadString(imageRef, snappedImage, 'data_url');
      const downloadURL = await getDownloadURL(imageRef);
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
    <div className="recorder-overlay">
      <div className="recorder-modal">
        <h2>Create New Story</h2>
        {error && <div className="camera-error">{error}</div>}

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

export default StoryRecorder;
