// src/pages/Spotlight/SpotlightDuetPreview.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import Toast from '../../components/Toast/Toast';
import { publishSpotlightDuet } from '../../services/spotlightDuets';
import { publishSpotlightPost } from '../../services/spotlightService';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';

const SpotlightDuetPreview = ({ sourcePost, duetFile, onCancel }) => {
  const { user } = useAuth();
  const { getProfile, fetchProfile } = useProfile();
  const navigate = useNavigate();

  const myVideoRef = useRef(null);
  const sourceVideoRef = useRef(null);
  const sourceVideoFileRef = useRef(null);

  const [previewUrl, setPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState(null);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    const cached = getProfile(user.uid);
    if (cached) setProfile(cached);
    else fetchProfile(user.uid);
  }, [user?.uid, getProfile, fetchProfile]);

  useEffect(() => {
    if (duetFile) setPreviewUrl(URL.createObjectURL(duetFile));
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duetFile]);

  /* Sync both previews when playing */
  useEffect(() => {
    const my = myVideoRef.current;
    const src = sourceVideoRef.current;
    if (!my) return;

    const sync = () => {
      if (src) {
        try { src.currentTime = my.currentTime; } catch (_) {}
      }
    };

    my.addEventListener('timeupdate', sync);
    return () => my.removeEventListener('timeupdate', sync);
  }, []);

  /* Fetch source video as a File so we can upload it to Cloudinary and
     get a real MP4 that plays alongside the duet in the feed. Some
     hosts block CORS; if it fails, we fall back to referencing the URL. */
  useEffect(() => {
    if (!sourcePost || sourcePost.mediaType !== 'video') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(sourcePost.mediaUrl, { mode: 'cors' });
        if (!res.ok) return;
        const blob = await res.blob();
        if (!cancelled) {
          sourceVideoFileRef.current = new File(
            [blob],
            `duet_source_${sourcePost.id}.mp4`,
            { type: blob.type || 'video/mp4' }
          );
        }
      } catch (err) {
        console.warn('[Duet] source fetch failed, will reference URL:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [sourcePost]);

  const uploadBlobToCloudinary = (f, onProgress) => {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('file', f);
      form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
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
            const poster = data.public_id
              ? `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/so_0/${data.public_id}.jpg`
              : '';
            resolve({ url: data.secure_url, posterUrl: poster, duration: data.duration || 0 });
          } catch (err) { reject(err); }
        } else {
          reject(new Error(`Cloudinary ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(form);
    });
  };

  const handlePublish = async () => {
    if (!duetFile || !user?.uid || !sourcePost) return;
    setUploading(true);
    setProgress(0);
    setError('');

    try {
      const res = await uploadBlobToCloudinary(duetFile, setProgress);

      const postId = await publishSpotlightDuet({
        uid: user.uid,
        authorName: profile?.name || user.displayName || 'User',
        authorAvatar: profile?.avatar || '',
        mediaUrl: res.url,
        posterUrl: res.posterUrl,
        caption,
        duration: res.duration,
        width: 0,
        height: 0,
        sourcePostId: sourcePost.id,
        sourceUid: sourcePost.uid,
        sourceAuthorName: sourcePost.authorName,
        sourceAuthorAvatar: sourcePost.authorAvatar,
        sourceMediaUrl: sourcePost.mediaUrl,
        sourceMediaType: sourcePost.mediaType,
        sourcePosterUrl: sourcePost.posterUrl,
        sourceCaption: sourcePost.caption,
      });

      navigate('/spotlight', {
        replace: true,
        state: { freshPostId: postId },
      });
    } catch (err) {
      console.error('[Duet] publish failed:', err);
      setError(err?.message || 'Upload failed');
      setUploading(false);
    }
  };

  if (!sourcePost) return null;

  return (
    <div className="spotlight-upload-page spotlight-duet-preview-page">
      <div className="spotlight-upload-top">
        <button
          type="button"
          className="spotlight-upload-close"
          onClick={onCancel}
          aria-label="Cancel"
        >
          <i className="fas fa-times" />
        </button>
        <h1 className="spotlight-upload-title">
          <i className="fas fa-retweet" /> Duet
        </h1>
        <button
          type="button"
          className="spotlight-upload-publish-top"
          onClick={handlePublish}
          disabled={uploading}
        >
          {uploading ? `${progress}%` : 'Post'}
        </button>
      </div>

      <div className="spotlight-upload-body">
        <div className="spotlight-duet-preview-frame">
          {/* Source (top half) */}
          <div className="spotlight-duet-preview-half top">
            {sourcePost.mediaType === 'image' ? (
              <img
                src={sourcePost.mediaUrl}
                alt=""
                className="spotlight-duet-preview-media"
              />
            ) : (
              <video
                ref={sourceVideoRef}
                src={sourcePost.mediaUrl}
                className="spotlight-duet-preview-media"
                playsInline
                muted
                loop
              />
            )}
            <div className="spotlight-duet-preview-tag">
              <span className="spotlight-duet-preview-tag-tick" />
              ECHO
            </div>
            <div className="spotlight-duet-preview-author">
              @{(sourcePost.authorName || 'user').replace(/\s+/g, '').toLowerCase()}
            </div>
          </div>

          {/* Your recording (bottom half) */}
          <div className="spotlight-duet-preview-half bottom">
            {previewUrl && (
              <video
                ref={myVideoRef}
                src={previewUrl}
                className="spotlight-duet-preview-media mirrored"
                playsInline
                muted
                loop
                autoPlay
                controls={false}
                onClick={(e) => {
                  const v = e.currentTarget;
                  const s = sourceVideoRef.current;
                  if (v.paused) { v.play(); if (s) s.play(); }
                  else { v.pause(); if (s) s.pause(); }
                }}
              />
            )}
            <div className="spotlight-duet-preview-tag">
              <span className="spotlight-duet-preview-tag-tick" />
              ECHO
            </div>
            <div className="spotlight-duet-preview-author">
              @{((profile?.name || 'you')).replace(/\s+/g, '').toLowerCase()}
            </div>
          </div>
        </div>

        <textarea
          className="spotlight-upload-caption"
          placeholder="Write a caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={300}
          rows={3}
        />
        <div className="spotlight-upload-caption-count">{caption.length}/300</div>

        {error && (
          <div className="spotlight-duet-preview-error">
            <i className="fas fa-exclamation-triangle" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="spotlight-upload-actions">
        <button
          type="button"
          className="spotlight-upload-publish"
          onClick={handlePublish}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <i className="fas fa-spinner fa-spin" /> Uploading {progress}%
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane" /> Post Duet
            </>
          )}
        </button>
      </div>

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default SpotlightDuetPreview;
