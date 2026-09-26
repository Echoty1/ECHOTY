// src/components/pages/Chats/NotesStrip.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../services/firebase';
import {
  saveNote,
  removeNote,
  subscribeToAllNotes,
  NOTE_MAX_LENGTH,
} from '../../../services/notesService';
import Avatar from '../../common/Avatar';
import { useProfile } from '../../../contexts/ProfileContext';

const NotesStrip = ({ visibleUids = [] }) => {
  const { user } = useAuth();
  const { profiles } = useProfile();
  const navigate = useNavigate();

  const [myNote, setMyNote] = useState(null);
  const [allNotes, setAllNotes] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  // NEW: preview overlay state
  const [previewNote, setPreviewNote] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const noteRef = ref(db, `notes/${user.uid}`);
    const unsub = onValue(noteRef, (snap) => {
      const data = snap.val();
      if (!data || !data.text || (data.expiresAt && data.expiresAt < Date.now())) {
        setMyNote(null);
      } else {
        setMyNote(data);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const unsub = subscribeToAllNotes((live) => {
      setAllNotes(live);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setAllNotes((prev) => prev.filter((n) => n.expiresAt > now));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close preview on Escape
  useEffect(() => {
    if (!previewNote) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setPreviewNote(null);
    };
    document.addEventListener('keydown', onKey);
    // Lock body scroll while preview is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [previewNote]);

  const filteredNotes = allNotes.filter((n) => {
    if (n.uid === user?.uid) return false;
    if (visibleUids.length === 0) return true;
    return visibleUids.includes(n.uid);
  });

  const openComposer = () => {
    setDraft(myNote?.text || '');
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setDraft('');
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await saveNote(user.uid, draft);
      closeComposer();
    } catch (err) {
      console.error('Failed to save note', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await removeNote(user.uid);
      closeComposer();
    } catch (err) {
      console.error('Failed to delete note', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTapOtherNote = (note) => {
    setPreviewNote(note);
  };

  const handleReplyFromPreview = () => {
    if (!previewNote) return;
    const targetUid = previewNote.uid;
    const text = previewNote.text;
    setPreviewNote(null);
    navigate(`/chat/${targetUid}`, {
      state: { prefilledNote: text },
    });
  };

  const remaining = NOTE_MAX_LENGTH - draft.length;

  const getDisplayName = (uid) => {
    const profile = profiles[uid] || {};
    return profile.name || profile.displayName || 'User';
  };

  const getAvatar = (uid) => profiles[uid]?.avatar || '';

  const formatTimeLeft = (note) => {
    if (!note?.expiresAt) return '';
    const ms = note.expiresAt - Date.now();
    if (ms <= 0) return 'expired';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 1) return `${hours}h left`;
    return `${mins}m left`;
  };

  return (
    <>
      {/* ─── THE STRIP ─── */}
      <div className="notes-strip">
        <button
          type="button"
          className="note-card note-card-mine"
          onClick={openComposer}
          aria-label={myNote ? 'Edit your note' : 'Add a note'}
        >
          <div className={`note-avatar-wrap ${myNote ? 'has-note' : ''}`}>
            <Avatar
              src={getAvatar(user?.uid)}
              name={getDisplayName(user?.uid)}
              size={64}
            />
            {!myNote && <span className="note-plus">+</span>}
          </div>
          <div className="note-bubble note-bubble-mine">
            {myNote ? (
              <span className="note-text">{myNote.text}</span>
            ) : (
              <span className="note-placeholder">Add a note…</span>
            )}
          </div>
          <span className="note-name">You</span>
        </button>

        {filteredNotes.map((note) => (
          <button
            key={note.uid}
            type="button"
            className="note-card"
            onClick={() => handleTapOtherNote(note)}
            aria-label={`View note from ${getDisplayName(note.uid)}`}
          >
            <div className="note-avatar-wrap has-note">
              <Avatar
                src={getAvatar(note.uid)}
                name={getDisplayName(note.uid)}
                size={64}
              />
            </div>
            <div className="note-bubble">
              <span className="note-text">{note.text}</span>
            </div>
            <span className="note-name">{getDisplayName(note.uid).split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* ─── COMPOSER (write/edit your note) ─── */}
      {composerOpen && (
        <div
          className="note-composer-backdrop"
          onClick={closeComposer}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="note-composer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="note-composer-header">
              <h3>Your note</h3>
              <button
                type="button"
                className="note-composer-close"
                onClick={closeComposer}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="note-composer-hint">
              Share a thought — it disappears after 24 hours.
            </p>

            <textarea
              className="note-composer-input"
              placeholder="What's on your mind?"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              autoFocus
            />

            <div className="note-composer-meta">
              <span className={`note-counter ${remaining <= 10 ? 'low' : ''}`}>
                {remaining}
              </span>
            </div>

            <div className="note-composer-actions">
              {myNote && (
                <button
                  type="button"
                  className="note-btn note-btn-danger"
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                className="note-btn note-btn-primary"
                onClick={handleSave}
                disabled={saving || !draft.trim()}
              >
                {saving ? 'Saving…' : myNote ? 'Update' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FULL NOTE PREVIEW (blurred backdrop) ─── */}
      {previewNote && (
        <div
          className="note-preview-backdrop"
          onClick={() => setPreviewNote(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="note-preview"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="note-preview-close"
              onClick={() => setPreviewNote(null)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="note-preview-avatar">
              <Avatar
                src={getAvatar(previewNote.uid)}
                name={getDisplayName(previewNote.uid)}
                size={96}
              />
            </div>

            <h3 className="note-preview-name">
              {getDisplayName(previewNote.uid)}
            </h3>

            <p className="note-preview-time">
              {formatTimeLeft(previewNote)}
            </p>

            <div className="note-preview-bubble">
              <p className="note-preview-text">{previewNote.text}</p>
            </div>

            <button
              type="button"
              className="note-preview-reply"
              onClick={handleReplyFromPreview}
            >
              Reply to {getDisplayName(previewNote.uid).split(' ')[0]}
            </button>

            <p className="note-preview-hint">Tap outside or press Esc to close</p>
          </div>
        </div>
      )}
    </>
  );
};

export default NotesStrip;
