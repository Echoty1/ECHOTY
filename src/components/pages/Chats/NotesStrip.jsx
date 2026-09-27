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
import {
  subscribeToSongCatalog,
  searchCatalog,
  findCatalogTrack,
  extractSpotifyTrackId,
  lookupSongByUrl,
} from '../../../services/songCatalog';
import { useSongPreview } from '../../../hooks/useSongPreview';
import Avatar from '../../common/Avatar';
import { useProfile } from '../../../contexts/ProfileContext';

// ─── Song picker sheet ──────────────────────────────────────────
const SongPickerSheet = ({ open, catalog, onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('search');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const { play, playingId } = useSongPreview();

  useEffect(() => {
    if (!open) {
      setQuery('');
      setTab('search');
      setUrl('');
      setError('');
      setPreview(null);
    }
  }, [open]);

  const filtered = useMemo(() => searchCatalog(catalog, query), [catalog, query]);

  const handlePasteLookup = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    setPreview(null);
    try {
      const trackId = extractSpotifyTrackId(trimmed);
      const cached = trackId ? findCatalogTrack(catalog, trackId) : null;
      if (cached) {
        setPreview(cached);
        setError('');
        return;
      }

      const result = await lookupSongByUrl(trimmed);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (!result?.title) {
        setError('Not available at the moment. Try a song from the list.');
        return;
      }
      setPreview(result);
    } catch (err) {
      setError('Lookup failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    onSelect(preview);
  };

  if (!open) return null;

  return (
    <div className="note-song-sheet-backdrop" onClick={onClose}>
      <div className="note-song-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="note-song-sheet-handle" />
        <div className="note-song-sheet-header">
          <h3>Add a song</h3>
          <button
            type="button"
            className="note-song-sheet-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="note-song-sheet-tabs">
          <button
            type="button"
            className={`note-song-tab ${tab === 'search' ? 'active' : ''}`}
            onClick={() => setTab('search')}
          >
            Search
          </button>
          <button
            type="button"
            className={`note-song-tab ${tab === 'paste' ? 'active' : ''}`}
            onClick={() => setTab('paste')}
          >
            Paste link
          </button>
        </div>

        {tab === 'search' ? (
          <>
            <div className="note-song-search-row">
              <input
                type="text"
                className="note-song-search-input"
                placeholder="Search by title or artist…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div className="note-song-list">
              {filtered.length === 0 ? (
                <div className="note-song-empty">
                  <span className="note-song-empty-icon">🎵</span>
                  <p>No songs found.</p>
                  <p className="note-song-empty-hint">
                    Try the "Paste link" tab or wait for more songs to be added.
                  </p>
                </div>
              ) : (
                filtered.map((song) => {
                  const songKey = song.trackId || song.sourceUrl;
                  const isPlaying = playingId === songKey;
                  const isSelected =
                    preview?.trackId && preview.trackId === song.trackId;
                  return (
                    <div
                      key={song.trackId}
                      className={`note-song-list-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setPreview(song)}
                    >
                      <span className="note-song-list-art">
                        {song.artwork ? (
                          <img src={song.artwork} alt="" loading="lazy" />
                        ) : (
                          <span>🎵</span>
                        )}
                      </span>
                      <span className="note-song-list-meta">
                        <span className="note-song-list-title">{song.title}</span>
                        <span className="note-song-list-artist">
                          {song.artist || 'Unknown artist'}
                        </span>
                      </span>
                      {song.previewUrl && (
                        <button
                          type="button"
                          className={`note-song-list-play ${isPlaying ? 'is-playing' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            play({ trackId: songKey, previewUrl: song.previewUrl });
                          }}
                          aria-label={isPlaying ? 'Stop preview' : 'Play preview'}
                        >
                          {isPlaying ? (
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <rect x="6" y="5" width="4" height="14" fill="currentColor" />
                              <rect x="14" y="5" width="4" height="14" fill="currentColor" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" width="14" height="14">
                              <path d="M8 5v14l11-7z" fill="currentColor" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="note-song-paste">
            <input
              type="url"
              className="note-song-search-input"
              placeholder="https://open.spotify.com/track/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePasteLookup();
                }
              }}
              autoFocus
            />
            <button
              type="button"
              className="note-song-paste-btn"
              onClick={handlePasteLookup}
              disabled={busy || !url.trim()}
            >
              {busy ? 'Looking up…' : 'Look up'}
            </button>
            {error && <p className="note-song-paste-error">{error}</p>}
            {preview && (
              <div className="note-song-paste-preview">
                <span className="note-song-list-art">
                  {preview.artwork ? (
                    <img src={preview.artwork} alt="" loading="lazy" />
                  ) : (
                    <span>🎵</span>
                  )}
                </span>
                <span className="note-song-list-meta">
                  <span className="note-song-list-title">{preview.title}</span>
                  <span className="note-song-list-artist">
                    {preview.artist || 'Unknown artist'}
                  </span>
                </span>
              </div>
            )}
          </div>
        )}

        <div className="note-song-sheet-footer">
          <button type="button" className="note-btn note-btn-danger" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="note-btn note-btn-primary"
            onClick={handleConfirm}
            disabled={!preview}
          >
            {preview ? 'Use this song' : 'Select a song'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main NotesStrip ────────────────────────────────────────────
const NotesStrip = ({ visibleUids = [] }) => {
  const { user } = useAuth();
  const { profiles = {} } = useProfile();
  const navigate = useNavigate();

  const [myNote, setMyNote] = useState(null);
  const [myViewers, setMyViewers] = useState([]);
  const [allNotes, setAllNotes] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const [songLookup, setSongLookup] = useState(null);
  const [songSheetOpen, setSongSheetOpen] = useState(false);

  const [reactionTarget, setReactionTarget] = useState(null);
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);

  const { play: playPreview, playingId } = useSongPreview();

  const seenNoteIds = useRef(new Set());
  const [newNoteIds, setNewNoteIds] = useState(new Set());

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

  useEffect(() => {
    const unsub = subscribeToSongCatalog((list) => {
      setCatalog(list);
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

  const filteredNotes = useMemo(() => {
    return allNotes.filter((n) => {
      if (n.uid === user?.uid) return false;
      if (visibleUids.length === 0) return true;
      return visibleUids.includes(n.uid);
    });
  }, [allNotes, user?.uid, visibleUids]);

  const openComposer = () => {
    setDraft(myNote?.text || '');
    setSongLookup(myNote?.song || null);
    setComposerOpen(true);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setDraft('');
    setSongLookup(null);
  };

  const handleSongSelected = (song) => {
    setSongLookup(song);
    setSongSheetOpen(false);
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

  const handleTapOtherNote = async (note) => {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (!user?.uid) return;

    if (note.song?.previewUrl) {
      try {
        playPreview({
          trackId: note.song.trackId || note.uid,
          previewUrl: note.song.previewUrl,
        });
      } catch (_) {}
    }

    markNoteSeen(note.uid, user.uid).catch(() => {});

    setTimeout(() => {
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
    }, 400);
  };

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
    const songKey = song.trackId || song.sourceUrl;
    const isPlaying = playingId === songKey;
    const hasPreview = !!song.previewUrl;

    const handleClick = (e) => {
      if (!interactive) return;
      e.stopPropagation();
      if (hasPreview) {
        playPreview({ trackId: songKey, previewUrl: song.previewUrl });
      } else {
        openSongLink(e, song);
      }
    };

    return (
      <div
        role="button"
        tabIndex={0}
        className={`note-song-pill ${interactive ? 'is-interactive' : ''} ${isPlaying ? 'is-playing' : ''}`}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleClick(e);
        }}
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
          {song.artist && <span className="note-song-artist">{song.artist}</span>}
        </span>
        <span className="note-song-play" aria-hidden="true">
          {isPlaying ? (
            <svg viewBox="0 0 24 24" width="14" height="14">
              <rect x="6" y="5" width="4" height="14" fill="currentColor" />
              <rect x="14" y="5" width="4" height="14" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
          )}
        </span>
      </div>
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
            <Avatar src={getAvatar(v.uid)} name={getDisplayName(v.uid)} size={18} />
          </span>
        ))}
        {extra > 0 && <span className="note-viewer-more">+{extra}</span>}
      </div>
    );
  };

  return (
    <>
      <div className="notes-strip">
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
              className={`note-card ${newNoteIds.has(note.uid) ? 'note-card-new' : ''}`}
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
              onChange={(e) => setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH))}
              maxLength={NOTE_MAX_LENGTH}
              rows={3}
              autoFocus
            />

            <div className="note-song-block">
              {songLookup ? (
                <div className="note-song-attached">
                  {renderSongPill(songLookup, { interactive: false })}
                  <button
                    type="button"
                    className="note-song-remove"
                    onClick={() => setSongLookup(null)}
                    aria-label="Remove song"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="note-song-add-btn"
                  onClick={() => setSongSheetOpen(true)}
                >
                  <span className="note-song-add-icon">🎵</span>
                  Add song
                </button>
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

      <SongPickerSheet
        open={songSheetOpen}
        catalog={catalog}
        onSelect={handleSongSelected}
        onClose={() => setSongSheetOpen(false)}
      />

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
