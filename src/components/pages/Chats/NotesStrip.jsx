// src/components/pages/Chats/NotesStrip.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../services/firebase';
import {
  saveNote,
  removeNote,
  subscribeToAllNotes,
  setNoteReaction,
  removeNoteReaction,
  markNoteSeen,
  subscribeToNoteViewers,
  isEmojiOnly,
  isSingleEmoji,
  NOTE_MAX_LENGTH,
  QUICK_REACTIONS,
} from '../../../services/notesService';
import Avatar from '../../common/Avatar';
import { useProfile } from '../../../contexts/ProfileContext';

const NotesStrip = ({ visibleUids = [] }) => {
  const { user } = useAuth();
  const { profiles = {} } = useProfile();
  const navigate = useNavigate();

  const [myNote, setMyNote] = useState(null);
  const [myViewers, setMyViewers] = useState([]);
  const [allNotes, setAllNotes] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Reaction picker
  const [reactionTarget, setReactionTarget] = useState(null);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  // Track which notes were rendered on first pass (for pop-in animation)
  const seenNoteIds = useRef(new Set());
  const [newNoteIds, setNewNoteIds] = useState(new Set());

  // ─── Helpers FIRST ───────────────────────────────────────────
  const getDisplayName = (uid) => {
    if (!uid) return 'User';
    const profile = profiles?.[uid] || {};
    return profile.name || profile.displayName || 'User';
  };
  const getAvatar = (uid) => (uid ? profiles?.[uid]?.avatar || '' : '');

  // ─── Subscribe to my own note ────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const noteRef = ref(db, `notes/${user.uid}`);
    const unsub = onValue(noteRef, (snap) => {
      const data = snap.val();
      if (
        !data ||
        !data.text ||
        (data.expiresAt && data.expiresAt < Date.now())
      ) {
        setMyNote(null);
      } else {
        setMyNote(data);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // ─── Subscribe to viewers of my own note ─────────────────────
  useEffect(() => {
    if (!user?.uid || !myNote) {
      setMyViewers([]);
      return;
    }
    const unsub = subscribeToNoteViewers(user.uid, (list) => {
      setMyViewers(list);
    });
    return () => unsub();
  }, [user?.uid, myNote]);

  // ─── Subscribe to all notes ──────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToAllNotes((live) => {
      // Detect newly-arrived note UIDs for pop-in
      const incomingNew = new Set();
      live.forEach((n) => {
        if (!seenNoteIds.current.has(n.uid)) {
          incomingNew.add(n.uid);
          seenNoteIds.current.add(n.uid);
        }
      });
      if (incomingNew.size > 0) {
        setNewNoteIds(incomingNew);
        // Clear the "new" flag after the animation window
        setTimeout(() => setNewNoteIds(new Set()), 700);
      }
      setAllNotes(live);
    });
    return () => unsub();
  }, []);

  // ─── Sweep expired notes every minute ────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setAllNotes((prev) => prev.filter((n) => n.expiresAt > now));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredNotes = useMemo(() => {
    return allNotes.filter((n) => {
      if (n.uid === user?.uid) return false;
      if (visibleUids.length === 0) return true;
      return visibleUids.includes(n.uid);
    });
  }, [allNotes, user?.uid, visibleUids]);

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
      setMenuOpen(false);
      closeComposer();
    } catch (err) {
      console.error('Failed to delete note', err);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyMyNote = async () => {
    if (!myNote?.text) return;
    try {
      await navigator.clipboard.writeText(myNote.text);
    } catch {}
    setMenuOpen(false);
  };

  // ─── TAP another person's note ───────────────────────────────
  const handleTapOtherNote = async (note) => {
    // If long-press already fired, skip the tap navigation
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (!user?.uid) return;

    // Mark seen first (fire-and-forget)
    markNoteSeen(note.uid, user.uid).catch(() => {});

    navigate(`/chat/${note.uid}`, {
      state: {
        prefilledNote: note.text,
        noteAuthorUid: note.uid,
        noteAuthorName: getDisplayName(note.uid),
        noteCreatedAt: note.createdAt,
        replyToNote: true,
      },
    });
  };

  // ─── Long-press → reactions (or my-note menu) ────────────────
  const handleNotePressStart = (e, note) => {
    longPressFired.current = false;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (navigator.vibrate) navigator.vibrate(30);
      setReactionTarget(note);
    }, 420);
  };

  const handleNotePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMyNotePressStart = () => {
    if (!myNote) return;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30);
      setMenuOpen(true);
    }, 420);
  };

  const handleReaction = async (emoji) => {
    if (!user?.uid || !reactionTarget) return;
    const note = reactionTarget;
    const existing = note.reactions?.[user.uid];
    setReactionTarget(null);
    try {
      if (existing === emoji) {
        await removeNoteReaction(note.uid, user.uid);
      } else {
        await setNoteReaction(note.uid, user.uid, emoji);
      }
    } catch (err) {
      console.warn('reaction failed', err);
    }
  };

  const remaining = NOTE_MAX_LENGTH - draft.length;

  // ─── Render helpers ──────────────────────────────────────────
  const renderNoteBubbleContent = (text) => {
    if (isSingleEmoji(text)) {
      return <span className="note-text note-text-emoji-xl">{text}</span>;
    }
    if (isEmojiOnly(text)) {
      return <span className="note-text note-text-emoji-lg">{text}</span>;
    }
    return <span className="note-text">{text}</span>;
  };

  const renderViewerAvatars = () => {
    if (!myViewers.length) return null;
    const shown = myViewers.slice(0, 4);
    const extra = myViewers.length - shown.length;
    return (
      <div className="note-viewers-row" aria-label="Seen by">
        {shown.map((v) => (
          <span key={v.uid} className="note-viewer-avatar">
            <Avatar
              src={getAvatar(v.uid)}
              name={getDisplayName(v.uid)}
              size={18}
            />
          </span>
        ))}
        {extra > 0 && <span className="note-viewer-more">+{extra}</span>}
      </div>
    );
  };

  return (
    <>
      <div className="notes-strip">
        {/* ─── Your own note ─── */}
        <button
          type="button"
          className={`note-card note-card-mine ${myNote ? 'has-note' : ''}`}
          onClick={openComposer}
          onMouseDown={handleMyNotePressStart}
          onMouseUp={handleNotePressEnd}
          onMouseLeave={handleNotePressEnd}
          onTouchStart={handleMyNotePressStart}
          onTouchEnd={handleNotePressEnd}
          onTouchCancel={handleNotePressEnd}
          onContextMenu={(e) => e.preventDefault()}
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
              renderNoteBubbleContent(myNote.text)
            ) : (
              <span className="note-placeholder">Add a note…</span>
            )}
          </div>
          <span className="note-name">You</span>
          {myNote && renderViewerAvatars()}
        </button>

        {/* ─── Others' notes ─── */}
        {filteredNotes.map((note) => {
          const reactions = note.reactions || {};
          const grouped = {};
          Object.values(reactions).forEach((emoji) => {
            if (!grouped[emoji]) grouped[emoji] = 0;
            grouped[emoji] += 1;
          });

          return (
            <button
              key={note.uid}
              type="button"
              className={`note-card ${
                newNoteIds.has(note.uid) ? 'note-card-new' : ''
              }`}
              onClick={() => handleTapOtherNote(note)}
              onMouseDown={(e) => handleNotePressStart(e, note)}
              onMouseUp={handleNotePressEnd}
              onMouseLeave={handleNotePressEnd}
              onTouchStart={(e) => handleNotePressStart(e, note)}
              onTouchEnd={handleNotePressEnd}
              onTouchCancel={handleNotePressEnd}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={`Open note from ${getDisplayName(note.uid)}`}
            >
              <div className="note-avatar-wrap has-note">
                <Avatar
                  src={getAvatar(note.uid)}
                  name={getDisplayName(note.uid)}
                  size={64}
                />
              </div>
              <div className="note-bubble">
                {renderNoteBubbleContent(note.text)}
                {Object.keys(grouped).length > 0 && (
                  <span className="note-reaction-badges">
                    {Object.entries(grouped).map(([emoji, count]) => (
                      <span key={emoji} className="note-reaction-badge">
                        {emoji}
                        {count > 1 ? ` ${count}` : ''}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <span className="note-name">
                {getDisplayName(note.uid).split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Composer modal ─── */}
      {composerOpen && (
        <div
          className="note-composer-backdrop"
          onClick={closeComposer}
          role="dialog"
          aria-modal="true"
        >
          <div className="note-composer" onClick={(e) => e.stopPropagation()}>
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
              onChange={(e) =>
                setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))
              }
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              autoFocus
            />

            <div className="note-composer-meta">
              <span className={`note-counter ${remaining <= 10 ? 'low' : ''}`}>
                {remaining}
              </span>
              {isEmojiOnly(draft) && (
                <span className="note-emoji-badge">Emoji mode</span>
              )}
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

      {/* ─── Reaction picker ─── */}
      {reactionTarget && (
        <div
          className="note-reaction-backdrop"
          onClick={() => setReactionTarget(null)}
        >
          <div
            className="note-reaction-picker"
            onClick={(e) => e.stopPropagation()}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="note-reaction-btn"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── My-note quick menu ─── */}
      {menuOpen && myNote && (
        <div
          className="note-reaction-backdrop"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="note-menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="note-menu-item"
              onClick={() => {
                setMenuOpen(false);
                openComposer();
              }}
            >
              ✏️ Edit
            </button>
            <button
              type="button"
              className="note-menu-item"
              onClick={handleCopyMyNote}
            >
              📋 Copy
            </button>
            <button
              type="button"
              className="note-menu-item danger"
              onClick={handleDelete}
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NotesStrip;
