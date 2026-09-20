// src/components/pages/Chat/WallpaperPicker.jsx
import React, { useRef, useState } from 'react';
import { WALLPAPERS } from '../../../constants/wallpapers';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const MAX_UPLOAD_SIZE = 8 * 1024 * 1024; // 8 MB

const WallpaperPicker = ({ current, currentCustom, onSelect, onSelectCustom, onClose }) => {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please choose an image file.');
    if (file.size > MAX_UPLOAD_SIZE) return alert('Image must be smaller than 8 MB.');

    setUploading(true);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, true);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
      };
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) {
            try { resolve(JSON.parse(xhr.responseText).secure_url); }
            catch (err) { reject(err); }
          } else reject(new Error('Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Network error'));
      });
      xhr.send(formData);

      const url = await uploadPromise;
      onSelectCustom(url);
      onClose();
    } catch (err) {
      console.error('Wallpaper upload failed:', err);
      alert('Could not upload wallpaper. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)', zIndex: 99999,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '560px', background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0', padding: '20px 16px 28px',
          maxHeight: '75vh', overflowY: 'auto',
          animation: 'wallpaperSlideUp 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        <div style={{ width: '40px', height: '4px', background: 'var(--text-muted)', opacity: 0.3, borderRadius: '2px', margin: '0 auto 16px' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>
            Chat Wallpaper
          </h3>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{
              background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '16px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: uploading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              minHeight: 'auto',
              minWidth: 'auto',
              opacity: uploading ? 0.7 : 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {uploading ? `Uploading ${progress}%` : 'Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
        </div>

        {/* Custom wallpaper preview if any */}
        {currentCustom && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
              YOUR UPLOAD
            </div>
            <button
              onClick={() => { onSelectCustom(currentCustom); onClose(); }}
              style={{
                position: 'relative',
                width: '100%',
                height: '90px',
                borderRadius: '12px',
                border: current === '__custom__' ? '3px solid #6C3CE1' : '1px solid var(--border-color)',
                backgroundImage: `url(${currentCustom})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                cursor: 'pointer',
                padding: 0,
                minHeight: 'auto',
              }}
            >
              {current === '__custom__' && (
                <div style={{
                  position: 'absolute', top: '6px', right: '6px',
                  background: '#6C3CE1', color: '#fff', borderRadius: '50%',
                  width: '22px', height: '22px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700,
                }}>✓</div>
              )}
              <div style={{
                position: 'absolute', bottom: '6px', left: '8px',
                fontSize: '11px', fontWeight: 700, color: '#fff',
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
              }}>
                Custom Wallpaper
              </div>
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '12px' }}>
          {WALLPAPERS.map((wp) => {
            const isActive = current === wp.id;
            return (
              <button
                key={wp.id}
                onClick={() => { onSelect(wp.id); onClose(); }}
                style={{
                  position: 'relative', width: '100%', aspectRatio: '1 / 1',
                  borderRadius: '12px',
                  border: isActive ? '3px solid #6C3CE1' : '1px solid var(--border-color)',
                  background: wp.type === 'color'
                    ? (wp.value === 'transparent' ? 'var(--bg-primary)' : wp.value)
                    : wp.value,
                  backgroundSize: wp.type === 'pattern' ? '20px 20px' : 'cover',
                  cursor: 'pointer', overflow: 'hidden', padding: 0, minHeight: 'auto',
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute', top: '4px', right: '4px',
                    background: '#6C3CE1', color: '#fff', borderRadius: '50%',
                    width: '20px', height: '20px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700,
                  }}>✓</div>
                )}
                <div style={{
                  position: 'absolute', bottom: '4px', left: '4px', right: '4px',
                  fontSize: '10px', fontWeight: 600, color: '#fff',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)', textAlign: 'center',
                }}>
                  {wp.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WallpaperPicker;
