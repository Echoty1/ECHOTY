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
    navigate(`/chat/${note.uid}`, {
      state: { prefilledNote: note.text },
    });
  };

  const remaining = NOTE_MAX_LENGTH - draft.length;

  const getDisplayName = (uid) => {
    const profile = profiles[uid] || {};
    return profile.name || profile.displayName || 'User';
  };

  return (
    <>
      <div className="notes-strip">
        <button
          type="button"
          className="note-card note-card-mine"
          onClick={openComposer}
          aria-label={myNote ? 'Edit your note' : 'Add a note'}
        >
          <div className={`note-avatar-wrap ${myNote ? 'has-note' : ''}`}>
            <Avatar
              src={profiles[user?.uid]?.avatar}
              name={getDisplayName(user?.uid)}
              size={56}
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
            aria-label={`Reply to note from ${getDisplayName(note.uid)}`}
          >
            <div className="note-avatar-wrap has-note">
              <Avatar
                src={profiles[note.uid]?.avatar}
                name={getDisplayName(note.uid)}
                size={56}
              />
            </div>
            <div className="note-bubble">
              <span className="note-text">{note.text}</span>
            </div>
            <span className="note-name">{getDisplayName(note.uid).split(' ')[0]}</span>
          </button>
        ))}
      </div>

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
    </>
  );
};

export default NotesStrip;
