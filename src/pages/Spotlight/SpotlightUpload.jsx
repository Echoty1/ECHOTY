// src/pages/Spotlight/SpotlightUpload.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import Toast from '../../components/Toast/Toast';
import SpotlightRecorder from './SpotlightRecorder';
import './Spotlight.css';
import { publishSpotlightPost } from '../../services/spotlightService';
import { saveDraft, listDrafts, deleteDraft, getDraft } from '../../services/spotlightDrafts';

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const SpotlightUpload = () => {
  const { user } = useAuth();
  const { getProfile, fetchProfile } = useProfile();
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  const [stage, setStage] = useState('pick'); // 'pick' | 'review'
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [duration, setDuration] = useState(0);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [profile, setProfile] = useState(null);
  const [toast, setToast] = useState(null);

  // Drafts
  const [hasDraft, setHasDraft] = useState(false);
  const [resuming, setResuming] = useState(false);
  const draftIdRef = useRef(null);
  const leavingRef = useRef(false);

  /* Profile */
  useEffect(() => {
    if (!user?.uid) return;
    const cached = getProfile(user.uid);
    if (cached) setProfile(cached);
    else fetchProfile(user.uid);
  }, [user?.uid, getProfile, fetchProfile]);

  /* Check for existing draft on mount */
  useEffect(() => {
    (async () => {
      try {
        const drafts = await listDrafts();
        if (drafts.length > 0) {
          setHasDraft(true);
          draftIdRef.current = drafts[0].id;
        }
      } catch (_) {}
    })();
  }, []);

  /* Cleanup preview URL */
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  /* Warn on exit if there's an unsaved file */
  useEffect(() => {
    const handler = (e) => {
      if (stage === 'review' && file && !leavingRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [stage, file]);

  /* ─── Handle picked file ──────────────────────────────── */
  const handleFileChosen = async (f) => {
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
    setStage('review');

    // Auto-save as draft (in case user backs out)
    try {
      const id = await saveDraft(f, {
        mediaType: isVideo ? 'video' : 'image',
        caption: '',
      });
      draftIdRef.current = id;
    } catch (_) {}
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    handleFileChosen(f);
  };

  /* ─── Recorder done ───────────────────────────────────── */
  const handleRecordingDone = async ({ blob, mime, ext, duration: dur, width, height }) => {
    setRecorderOpen(false);
    const f = new File([blob], `recording_${Date.now()}.${ext}`, { type: mime });
    setFile(f);
    setMediaType('video');
    setDuration(dur || 0);
    setDims({ width: width || 0, height: height || 0 });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
    setStage('review');

    try {
      const id = await saveDraft(f, {
        mediaType: 'video',
        duration: dur || 0,
        width: width || 0,
        height: height || 0,
      });
      draftIdRef.current = id;
    } catch (_) {}
  };

  /* ─── Resume an existing draft ────────────────────────── */
  const resumeDraft = async () => {
    if (!draftIdRef.current) return;
    setResuming(true);
    try {
      const d = await getDraft(draftIdRef.current);
      if (!d) {
        setToast({ message: 'Draft expired', type: 'error' });
        setHasDraft(false);
        return;
      }
      const f = new File([d.blob], `draft_${d.id}.${d.mediaType === 'video' ? 'webm' : 'jpg'}`, {
        type: d.blob.type || 'video/webm',
      });
      setFile(f);
      setMediaType(d.mediaType);
      setDuration(d.duration || 0);
      setDims({ width: d.width || 0, height: d.height || 0 });
      setCaption(d.caption || '');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(f));
      setStage('review');
    } catch (err) {
      setToast({ message: 'Could not load draft', type: 'error' });
    } finally {
      setResuming(false);
    }
  };

  const discardDraft = async () => {
    if (draftIdRef.current) {
      try { await deleteDraft(draftIdRef.current); } catch (_) {}
    }
    setHasDraft(false);
    draftIdRef.current = null;
    setToast({ message: 'Draft discarded', type: 'info' });
    setTimeout(() => setToast(null), 1800);
  };

  const replaceFile = () => {
    setStage('pick');
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCaption('');
  };

  const cancel = async () => {
    // If there's a file but no caption yet, ask if we should save as draft
    if (file && !caption.trim()) {
      const keep = window.confirm('Save as draft? You can resume it next time.');
      if (keep && draftIdRef.current) {
        // Already saved
        leavingRef.current = true;
        navigate(-1);
        return;
      }
      // User chose not to keep it → delete draft
      if (draftIdRef.current) {
        try { await deleteDraft(draftIdRef.current); } catch (_) {}
      }
    }
    leavingRef.current = true;
    navigate(-1);
  };

  /* ─── Upload ──────────────────────────────────────────── */
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
              duration: data.duration || duration,
              width: data.width || dims.width,
              height: data.height || dims.height,
            });
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

      // Draft is done — clear it
      if (draftIdRef.current) {
        try { await deleteDraft(draftIdRef.current); } catch (_) {}
      }
      leavingRef.current = true;

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

  /* ─── RENDER ──────────────────────────────────────────── */

  if (recorderOpen) {
    return (
      <SpotlightRecorder
        onDone={handleRecordingDone}
        onCancel={() => setRecorderOpen(false)}
      />
    );
  }

  return (
    <div className="spotlight-upload-page">
      <div className="spotlight-upload-top">
        <button
          type="button"
          className="spotlight-upload-close"
          onClick={cancel}
          aria-label="Cancel"
        >
          <i className="fas fa-times" />
        </button>
        <h1 className="spotlight-upload-title">
          {stage === 'pick' ? 'New Spotlight' : 'Review'}
        </h1>
        {stage === 'review' ? (
          <button
            type="button"
            className="spotlight-upload-publish-top"
            onClick={handlePublish}
            disabled={!file || uploading}
          >
            {uploading ? `${progress}%` : 'Post'}
          </button>
        ) : (
          <div style={{ width: 62 }} />
        )}
      </div>

      {stage === 'pick' && (
        <div className="spotlight-upload-body">
          {hasDraft && (
            <div className="spotlight-upload-draft">
              <div className="spotlight-upload-draft-info">
                <i className="fas fa-file-video" />
                <div>
                  <div className="spotlight-upload-draft-title">You have a draft</div>
                  <div className="spotlight-upload-draft-sub">Pick up where you left off</div>
                </div>
              </div>
              <div className="spotlight-upload-draft-actions">
                <button
                  type="button"
                  className="spotlight-upload-draft-resume"
                  onClick={resumeDraft}
                  disabled={resuming}
                >
                  {resuming ? <i className="fas fa-spinner fa-spin" /> : 'Resume'}
                </button>
                <button
                  type="button"
                  className="spotlight-upload-draft-discard"
                  onClick={discardDraft}
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          <div className="spotlight-upload-methods">
            <button
              type="button"
              className="spotlight-upload-method record"
              onClick={() => setRecorderOpen(true)}
            >
              <div className="spotlight-upload-method-icon">
                <i className="fas fa-video" />
              </div>
              <div className="spotlight-upload-method-title">Record</div>
              <div className="spotlight-upload-method-sub">Use your camera · up to 60s</div>
            </button>

            <button
              type="button"
              className="spotlight-upload-method gallery"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="spotlight-upload-method-icon">
                <i className="fas fa-photo-film" />
              </div>
              <div className="spotlight-upload-method-title">Upload</div>
              <div className="spotlight-upload-method-sub">Pick a video or image</div>
            </button>
          </div>

          <div className="spotlight-upload-format-note">
            MP4 · MOV · WebM · JPG · PNG — max 100 MB
          </div>
        </div>
      )}

      {stage === 'review' && previewUrl && (
        <div className="spotlight-upload-body">
          <div className="spotlight-upload-preview">
            {mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={previewUrl}
                className="spotlight-upload-media"
                controls
                playsInline
                loop
                autoPlay
                muted
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
              onClick={replaceFile}
              disabled={uploading}
            >
              <i className="fas fa-sync-alt" /> Replace
            </button>
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
        </div>
      )}

      {stage === 'review' && (
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
      )}

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
