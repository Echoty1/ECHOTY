// src/pages/Spotlight/SpotlightUpload.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import Toast from '../../components/Toast/Toast';
import { publishSpotlightPost } from '../../services/spotlightService';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const SpotlightUpload = () => {
  const { user } = useAuth();
  const { getProfile, fetchProfile } = useProfile();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const cached = getProfile(user.uid);
    if (cached) setProfile(cached);
    else fetchProfile(user.uid);
  }, [user?.uid, getProfile, fetchProfile]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      setToast({ message: 'File too large (max 100 MB)', type: 'error' });
      return;
    }
    const isVideo = f.type.startsWith('video/');
    const isImage = f.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setToast({ message: 'Only video or image files', type: 'error' });
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setMediaType(isVideo ? 'video' : 'image');
    setPreviewUrl(URL.createObjectURL(f));
  };

  const uploadToCloudinary = (f, onProgress) => {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', f);
      form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const isVideo = f.type.startsWith('video/');
      const endpoint = isVideo
        ? `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`
        : `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

      const xhr = new XMLHttpRequest();
      xhr.open('POST', endpoint, true);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            const safePoster = isVideo && data.public_id
              ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/so_0/${data.public_id}.jpg`
              : '';
            resolve({
              url: data.secure_url,
              posterUrl: safePoster,
              duration: data.duration || 0,
              width: data.width || 0,
              height: data.height || 0,
            });
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error(`Cloudinary ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    });
  };

  const handlePublish = async () => {
    if (!file || !user?.uid || uploading) return;
    setUploading(true);
    setProgress(0);

    try {
      const res = await uploadToCloudinary(file, setProgress);

      const postId = await publishSpotlightPost({
        uid: user.uid,
        authorName: profile?.name || user.displayName || 'User',
        authorAvatar: profile?.avatar || '',
        mediaUrl: res.url,
        mediaType,
        posterUrl: mediaType === 'video' ? res.posterUrl : '',
        caption,
        duration: res.duration,
        width: res.width,
        height: res.height,
      });

      // Navigate immediately. Pass the freshly-published post as router
      // state so the feed trusts it without re-fetching.
      navigate('/spotlight', {
        replace: true,
        state: { freshPostId: postId },
      });
    } catch (err) {
      console.error('[Spotlight] Publish FAILED:', err?.code || '', err?.message || err);
      const msg = err?.message?.includes('PERMISSION_DENIED')
        ? 'Permission denied — check Firebase rules'
        : err?.message || 'Upload failed. Try again.';
      setToast({ message: msg, type: 'error' });
      setUploading(false);
    }
  };

  return (
    <div className="spotlight-upload-page">
      <div className="spotlight-upload-top">
        <button
          type="button"
          className="spotlight-upload-close"
          onClick={() => navigate(-1)}
          aria-label="Cancel"
        >
          <i className="fas fa-times" />
        </button>
        <h1 className="spotlight-upload-title">New Spotlight</h1>
        <button
          type="button"
          className="spotlight-upload-publish-top"
          onClick={handlePublish}
          disabled={!file || uploading}
        >
          {uploading ? `${progress}%` : 'Post'}
        </button>
      </div>

      <div className="spotlight-upload-body">
        {!previewUrl ? (
          <button
            type="button"
            className="spotlight-upload-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            <i className="fas fa-cloud-upload-alt" />
            <span className="spotlight-upload-dropzone-title">Pick a video or image</span>
            <span className="spotlight-upload-dropzone-sub">MP4, MOV, JPG, PNG · max 100 MB</span>
          </button>
        ) : (
          <div className="spotlight-upload-preview">
            {mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={previewUrl}
                className="spotlight-upload-media"
                controls
                playsInline
                loop
              />
            ) : (
              <img
                src={previewUrl}
                alt="Preview"
                className="spotlight-upload-media"
              />
            )}

            <div className="spotlight-upload-watermark">
              <span className="spotlight-upload-watermark-tick" />
              <span className="spotlight-upload-watermark-text">ECHO</span>
            </div>

            <button
              type="button"
              className="spotlight-upload-replace"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <i className="fas fa-sync-alt" /> Replace
            </button>
          </div>
        )}

        <textarea
          className="spotlight-upload-caption"
          placeholder="Write a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={300}
          rows={3}
        />
        <div className="spotlight-upload-caption-count">{caption.length}/300</div>
      </div>

      <div className="spotlight-upload-actions">
        <button
          type="button"
          className="spotlight-upload-publish"
          onClick={handlePublish}
          disabled={!file || uploading}
        >
          {uploading ? (
            <>
              <i className="fas fa-spinner fa-spin" /> Uploading {progress}%
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane" /> Post to Spotlight
            </>
          )}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        style={{ display: 'none' }}
        onChange={pickFile}
      />

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default SpotlightUpload;
