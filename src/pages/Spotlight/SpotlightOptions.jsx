// src/pages/Spotlight/SpotlightOptions.jsx
import React, { useEffect, useState } from 'react';
import ConfirmModal from '../../components/common/ConfirmModal';

const SITE = 'https://echoty.xyz';

const SpotlightOptions = ({
  isOpen,
  post,
  currentUser,
  onClose,
  onToast,
  onDeleted,
  onRestore,
  onConfirmDelete,
}) => {
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  const isOwn = post.uid === currentUser?.uid;
  const url = `${SITE}/spotlight?focus=${post.id}&w=1`;

  const handleDownload = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { prepareWatermarkedMedia, downloadBlob } = await import('../../utils/echoWatermark');
      const res = await prepareWatermarkedMedia(post);
      if (!res) throw new Error('No media');
      if (res.kind === 'url') {
        const a = document.createElement('a');
        a.href = res.url;
        a.download = res.filename;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else if (res.kind === 'blob') {
        downloadBlob(res.blob, res.filename);
      }
      onToast?.({ message: 'Downloading…', type: 'success' });
      setTimeout(() => onToast?.(null), 1800);
      onClose?.();
    } catch (err) {
      onToast?.({ message: 'Could not download', type: 'error' });
      setTimeout(() => onToast?.(null), 2200);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      onToast?.({ message: 'Link copied', type: 'success' });
      setTimeout(() => onToast?.(null), 1800);
      onClose?.();
    } catch (_) {
      onToast?.({ message: 'Copy failed', type: 'error' });
      setTimeout(() => onToast?.(null), 2200);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${post.authorName || 'Someone'} on ECHO Spotlight`,
          url,
        });
        onClose?.();
      } else {
        handleCopyLink();
      }
    } catch (_) { /* cancelled */ }
  };

  const handleDeleteRequest = () => {
    setConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    setConfirmOpen(false);
    onClose?.();
    onConfirmDelete?.(post);
  };

  return (
    <>
      <div
        className="spotlight-options-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      >
        <div className="spotlight-options-sheet" role="dialog" aria-modal="true">
          <div className="spotlight-options-handle" aria-hidden="true" />

          <div className="spotlight-options-header">
            <span className="spotlight-options-title">Options</span>
            <button
              type="button"
              className="spotlight-options-close"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fas fa-times" />
            </button>
          </div>

          <div className="spotlight-options-grid">
            <button
              type="button"
              className="spotlight-option-tile"
              onClick={handleDownload}
              disabled={saving}
            >
              <span className="spotlight-option-icon download">
                {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-download" />}
              </span>
              <span className="spotlight-option-label">Download</span>
            </button>

            <button type="button" className="spotlight-option-tile" onClick={handleCopyLink}>
              <span className="spotlight-option-icon copy">
                <i className="fas fa-link" />
              </span>
              <span className="spotlight-option-label">Copy link</span>
            </button>

            <button type="button" className="spotlight-option-tile" onClick={handleShare}>
              <span className="spotlight-option-icon share">
                <i className="fas fa-share-alt" />
              </span>
              <span className="spotlight-option-label">Share</span>
            </button>
          </div>

          <div className="spotlight-options-list">
            <button
              type="button"
              className="spotlight-option-row"
              onClick={() => { window.open(url, '_blank', 'noopener'); onClose?.(); }}
            >
              <i className="fas fa-external-link-alt" />
              <span>Open in new tab</span>
            </button>

            {isOwn && (
              <button
                type="button"
                className="spotlight-option-row danger"
                onClick={handleDeleteRequest}
              >
                <i className="fas fa-trash" />
                <span>Delete Spotlight</span>
              </button>
            )}

            {!isOwn && (
              <button
                type="button"
                className="spotlight-option-row"
                onClick={() => {
                  onToast?.({ message: 'Reported. Thanks for the signal.', type: 'success' });
                  setTimeout(() => onToast?.(null), 2200);
                  onClose?.();
                }}
              >
                <i className="fas fa-flag" />
                <span>Report</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Spotlight?"
        message="You'll have 5 seconds to undo. After that, this Spotlight is gone forever."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </>
  );
};

export default SpotlightOptions;
