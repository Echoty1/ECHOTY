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
  lookupSongLink,
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

  // Song state
  const [songUrl, setSongUrl] = useState('');
  const [songLookup, setSongLookup] = useState(null);
  const [songLooking, setSongLooking] = useState(false);
  const [songError, setSongError] = useState('');
  const [songInputOpen, setSongInputOpen] = useState(false);

  // Reaction picker
  const [reactionTarget, setReactionTarget] = useState(null);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  // Track newly arrived notes for pop-in animation
  const seenNoteIds = useRef(new Set());
  const [newNoteIds, setNewNoteIds] = useState(new Set());

  // ─── Helpers FIRST ───────────────────────────────────────────
  const getDisplayName = (uid) => {
    if (!uid) return 'User';
    const profile = profiles?.[uid] || {};
    return profile.name || profile.displayName || 'User';
  };
  const getAvatar = (uid) => (uid ? profiles?.[uid]?.avatar || '' : '');

  const openSongLink = (e, song) => {
    if (!song?.sourceUrl) return;
    e?.stopPropagation?.();
    e?.preventDefault?.();
    window.open(song.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  // ─── Subscribe to my own note ────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const noteRef = ref(db, `notes/${user.uid}`);
    const unsub = onValue(noteRef, (snap) => {
      const data = snap.val();
      if (
        !data ||
        (!data.text && !data.song) ||
        (data.expiresAt && data.expiresAt < Date.now())
      ) {
        setMyNote(null);
      } else {
        setMyNote(data);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // ─── Viewers of my own note ──────────────────────────────────
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
      const incomingNew = new Set();
      live.forEach((n) => {
        if (!seenNoteIds.current.has(n.uid)) {
          incomingNew.add(n.uid);
          seenNoteIds.current.add(n.uid);
        }
      });
      if (incomingNew.size > 0) {
        setNewNoteIds(incomingNew);
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

  const resetSongState = () => {
    setSongUrl('');
    setSongLookup(null);
    setSongLooking(false);
    setSongError('');
    setSongInputOpen(false);
  };

  const openComposer = () => {
    setDraft(myNote?.text || '');
    setSongLookup(myNote?.song || null);
    setSongUrl('');
    setSongError('');
    setSongInputOpen(false);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setDraft('');
    resetSongState();
  };

  const handleLookupSong = async () => {
    const url = songUrl.trim();
    if (!url) return;
    setSongLooking(true);
    setSongError('');
    try {
      const found = await lookupSongLink(url);
      if (!found) {
        setSongError('Could not read that link. Try a Spotify or Apple Music track URL.');
        setSongLookup(null);
      } else {
        setSongLookup(found);
        setSongInputOpen(false);
      }
    } catch {
      setSongError('Lookup failed. Try again.');
    } finally {
      setSongLooking(false);
    }
  };

  const handleRemoveSong = () => {
    setSongLookup(null);
    setSongUrl('');
    setSongError('');
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    if (!draft.trim() && !songLookup) return;
    setSaving(true);
    try {
      await saveNote(user.uid, draft, songLookup || null);
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

  // ─── Tap another person's note → open chat with quoted reply ──
  const handleTapOtherNote = async (note) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (!user?.uid) return;

    markNoteSeen(note.uid, user.uid).catch(() => {});

    navigate(`/chat/${note.uid}`, {
      state: {
        prefilledNote: note.text || '',
        replyToNote: true,
        noteAuthorUid: note.uid,
        noteAuthorName: getDisplayName(note.uid),
        noteCreatedAt: note.createdAt,
        noteSong: note.song || null,
      },
    });
  };

  // ─── Long-press → reactions ──────────────────────────────────
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

  // ─── Rendering helpers ───────────────────────────────────────
  const renderNoteBubbleContent = (text) => {
    if (!text) return null;
    if (isSingleEmoji(text)) {
      return <span className="note-text note-text-emoji-xl">{text}</span>;
    }
    if (isEmojiOnly(text)) {
      return <span className="note-text note-text-emoji-lg">{text}</span>;
    }
    return <span className="note-text">{text}</span>;
  };

  const renderSongPill = (song, { interactive = true } = {}) => {
    if (!song || !song.title) return null;
    return (
      <button
        type="button"
        className={`note-song-pill ${interactive ? 'is-interactive' : ''}`}
        onClick={(e) => interactive && openSongLink(e, song)}
        aria-label={`Play ${song.title} by ${song.artist}`}
      >
        <span className="note-song-art">
          {song.artwork ? (
            <img src={song.artwork} alt="" loading="lazy" />
          ) : (
            <span className="note-song-art-fallback">🎵</span>
          )}
        </span>
        <span className="note-song-info">
          <span className="note-song-title">{song.title}</span>
          {song.artist && (
            <span className="note-song-artist">{song.artist}</span>
          )}
        </span>
        <span className="note-song-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </span>
      </button>
    );
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
              <>
                {renderNoteBubbleContent(myNote.text)}
                {myNote.song && renderSongPill(myNote.song, { interactive: false })}
              </>
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
            <div
              key={note.uid}
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
              role="button"
              tabIndex={0}
              aria-label={`Open note from ${getDisplayName(note.uid)}`}
              style={{ cursor: 'pointer' }}
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
                {note.song && renderSongPill(note.song, { interactive: true })}
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
            </div>
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

            {/* ─── Song block ─── */}
            <div className="note-song-block">
              {songLookup ? (
                <div className="note-song-attached">
                  {renderSongPill(songLookup, { interactive: false })}
                  <button
                    type="button"
                    className="note-song-remove"
                    onClick={handleRemoveSong}
                    aria-label="Remove song"
                  >
                    ✕
                  </button>
                </div>
              ) : songInputOpen ? (
                <div className="note-song-input-row">
                  <input
                    type="url"
                    className="note-song-input"
                    placeholder="Paste Spotify or Apple Music link…"
                    value={songUrl}
                    onChange={(e) => setSongUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLookupSong();
                      }
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="note-song-lookup"
                    onClick={handleLookupSong}
                    disabled={songLooking || !songUrl.trim()}
                  >
                    {songLooking ? '…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    className="note-song-cancel"
                    onClick={() => {
                      setSongInputOpen(false);
                      setSongUrl('');
                      setSongError('');
                    }}
                    aria-label="Cancel"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="note-song-add-btn"
                  onClick={() => setSongInputOpen(true)}
                >
                  <span className="note-song-add-icon">🎵</span>
                  Add song
                </button>
              )}

              {songError && (
                <p className="note-song-error">{songError}</p>
              )}
            </div>

            <div className="note-composer-meta">
              <span className={`note-counter ${remaining <= 10 ? 'low' : ''}`}>
                {remaining}
              </span>
              {isEmojiOnly(draft) && !songLookup && (
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
                disabled={saving || (!draft.trim() && !songLookup)}
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
          <div className="note-menu" onClick={(e) => e.stopPropagation()}>
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
