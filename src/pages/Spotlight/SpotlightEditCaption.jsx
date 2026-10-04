// src/pages/Spotlight/SpotlightEditCaption.jsx
import React, { useEffect, useState } from 'react';
import Toast from '../../components/Toast/Toast';
import { updateSpotlightCaption } from '../../services/spotlightService';

const SpotlightEditCaption = ({ isOpen, post, currentUser, onClose, onSaved }) => {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (isOpen && post) setText(post.caption || '');
  }, [isOpen, post]);

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

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateSpotlightCaption(post.id, currentUser?.uid, text);
      onSaved?.({ ...post, caption: text });
      onClose?.();
    } catch (err) {
      setToast({ message: 'Could not save', type: 'error' });
      setTimeout(() => setToast(null), 2200);
      setSaving(false);
    }
  };

  return (
    <div className="spotlight-edit-caption-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="spotlight-edit-caption-sheet" role="dialog" aria-modal="true">
        <div className="spotlight-edit-caption-header">
          <span>Edit caption</span>
          <button type="button" onClick={onClose} aria-label="Close"><i className="fas fa-times" /></button>
        </div>
        <textarea
          className="spotlight-edit-caption-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a caption..."
          maxLength={300}
          rows={4}
          autoFocus
        />
        <div className="spotlight-edit-caption-count">{text.length}/300</div>
        <div className="spotlight-edit-caption-actions">
          <button type="button" className="spotlight-edit-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="spotlight-edit-save" onClick={handleSave} disabled={saving}>
            {saving ? <i className="fas fa-spinner fa-spin" /> : 'Save'}
          </button>
        </div>
        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      </div>
    </div>
  );
};

export default SpotlightEditCaption;
