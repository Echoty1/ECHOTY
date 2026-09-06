// src/components/StatusRecorder.jsx
import React, { useRef, useState } from 'react';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createImageStatus } from '../services/statusService';
import './StatusRecorder.css';

const StatusRecorder = ({ userId, onClose }) => {
  const [image, setImage] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => setImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handlePost = async () => {
    if (!image || !userId) return;
    setUploading(true);

    try {
      const storage = getStorage();
      const imageRef = storageRef(storage, `statuses/${userId}/${Date.now()}.jpg`);

      // Convert base64 to blob for upload
      const response = await fetch(image);
      const blob = await response.blob();

      await uploadBytes(imageRef, blob);
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
        
        {!image ? (
          <div className="upload-area" onClick={() => fileInputRef.current.click()}>
            <p>Click to snap a picture</p>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
          </div>
        ) : (
          <>
            <img src={image} alt="Preview" className="image-preview" />
            <input 
              type="text" 
              placeholder="Add a caption..." 
              value={caption} 
              onChange={(e) => setCaption(e.target.value)} 
              className="caption-input"
            />
            <div className="modal-actions">
              <button onClick={() => setImage(null)} disabled={uploading}>Retake</button>
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
