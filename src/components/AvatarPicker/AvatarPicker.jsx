// src/components/AvatarPicker/AvatarPicker.jsx
import React from 'react';

const AvatarPicker = ({ isOpen, onClose, onUploadImage, onChooseLibrary, uploading, isDemo }) => {
  if (!isOpen) return null;

  return (
    <div className="avatar-picker-overlay" onClick={uploading ? undefined : onClose}>
      <div className="avatar-picker-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="avatar-picker-handle" />
        <h3>Change Profile Avatar</h3>
        {isDemo && <p style={{ color: '#f59e0b', fontSize: '14px', marginBottom: '12px' }}>Demo users can only choose from the library.</p>}
        <div className="avatar-picker-options">
          <button 
            className="avatar-picker-option"
            onClick={onUploadImage}
            disabled={uploading || isDemo}
            style={{ opacity: (uploading || isDemo) ? 0.5 : 1 }}
          >
            <span className="avatar-picker-icon">📷</span>
            <span>Upload Image</span>
          </button>

          {/* ─── Upload GIF removed permanently ────────────────── */}
          {/* <button ...>Upload GIF</button> */}

          <button 
            className="avatar-picker-option"
            onClick={onChooseLibrary}
            disabled={uploading}
          >
            <span className="avatar-picker-icon">📚</span>
            <span>Choose from Library</span>
          </button>
        </div>

        <button 
          className="avatar-picker-cancel" 
          onClick={uploading ? undefined : onClose}
          disabled={uploading}
          style={{
            background: uploading ? '#6C3CE1' : 'rgba(255,255,255,0.1)',
            color: '#FFF',
            opacity: uploading ? 0.9 : 1,
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {uploading ? 'Uploading...' : 'Cancel'}
        </button>
      </div>
    </div>
  );
};

export default AvatarPicker;