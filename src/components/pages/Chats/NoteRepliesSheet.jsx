// src/components/pages/Chats/NoteRepliesSheet.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  subscribeToNoteReplies,
  deleteNoteReply,
  postNoteReply,
} from '../../../services/notesService';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { useSongPreview } from '../../../hooks/useSongPreview';
import Avatar from '../../common/Avatar';

const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
};

const QUICK_EMOJI_REPLIES = ['❤️', '😂', '🔥', '😮', '👍'];

const NoteRepliesSheet = ({
  open,
  note,                // { uid, text, song, createdAt }
  noteOwnerUid,
  noteOwnerName,
  onClose,
  onOpenChatWith,
  onPostReply,
}) => {
  const { user } = useAuth();
  const { profiles = {} } = useProfile();
  const { play, playingId } = useSongPreview();

  const [replies, setReplies] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailReply, setDetailReply] = useState(null);
  const [quickSending, setQuickSending] = useState(false);

  const sheetRef = useRef(null);

  const getDisplayName = (uid) => {
    if (!uid) return 'User';
    const profile = profiles?.[uid] || {};
    return profile.name || profile.displayName || 'User';
  };
  const getAvatar = (uid) => (uid ? profiles?.[uid]?.avatar || '' : '');

  /* ─── Subscribe to replies ─── */
  useEffect(() => {
    if (!open || !noteOwnerUid) {
      setReplies([]);
      setDetailReply(null);
      return;
    }
    const unsub = subscribeToNoteReplies(noteOwnerUid, setReplies);
    return () => unsub();
  }, [open, noteOwnerUid]);

  /* ─── Esc key: close detail first, then sheet ─── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (detailReply) setDetailReply(null);
        else if (confirmDelete) setConfirmDelete(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, detailReply, confirmDelete]);

  if (!open) return null;

  /* ─── Handlers ─── */
  const handleReplyCardTap = (reply) => {
    setDetailReply(reply);
  };

  const handleOpenChatFromDetail = (reply) => {
    if (!reply?.authorUid) return;
    if (reply.authorUid === user?.uid) return;
    setDetailReply(null);
    onOpenChatWith?.(reply);
  };

  const handleCopyReply = async (reply) => {
    if (!reply) return;
    const text =
      reply.text ||
      (reply.song?.title
        ? `🎵 ${reply.song.title}${
            reply.song.artist ? ' · ' + reply.song.artist : ''
          }`
        : '');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
    } catch (_) {}
    setDetailReply(null);
  };

  const handleDelete = (reply) => {
    setConfirmDelete(reply);
  };

  const confirmDeleteReply = async () => {
    if (!confirmDelete) return;
    try {
      await deleteNoteReply(noteOwnerUid, confirmDelete.id);
    } catch (err) {
      console.warn('delete reply failed', err);
    }
    if (detailReply?.id === confirmDelete.id) setDetailReply(null);
    setConfirmDelete(null);
  };

  const handleQuickEmoji = async (emoji) => {
    if (!user?.uid || !noteOwnerUid) return;
    if (noteOwnerUid === user.uid) return;
    if (quickSending) return;
    setQuickSending(true);
    try {
      await postNoteReply(noteOwnerUid, {
        authorUid: user.uid,
        authorName:
          profiles?.[user.uid]?.name ||
          user.displayName ||
          'User',
        authorAvatar: profiles?.[user.uid]?.avatar || '',
        text: emoji,
      });
    } catch (err) {
      console.warn('quick reply failed', err);
    } finally {
      setQuickSending(false);
    }
  };

  const isOwnNote = noteOwnerUid === user?.uid;
  const noteAuthorName = isOwnNote
    ? 'You'
    : getDisplayName(noteOwnerUid);
  const noteAuthorAvatar = isOwnNote
    ? getAvatar(user?.uid)
    : getAvatar(noteOwnerUid);

  return (
    <div className="nrs-backdrop" onClick={onClose}>
      <div
        className="nrs-sheet"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nrs-glow" aria-hidden="true" />
        <div className="nrs-handle" />

        {/* ─── Header ─── */}
        <div className="nrs-header">
          <div className="nrs-header-left">
            <span className="nrs-header-icon">💬</span>
            <div className="nrs-header-text">
              <h3 className="nrs-title">Replies</h3>
              <span className="nrs-subtitle">
                {replies.length === 0
                  ? `Reply to ${noteOwnerName || 'this note'}`
                  : `${replies.length} ${
                      replies.length === 1 ? 'reply' : 'replies'
                    } to ${noteOwnerName || 'this note'}`}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="nrs-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ─── Original note preview card ─── */}
        {note && (
          <div className="nrs-note-preview">
            <div className="nrs-note-preview-top">
              <Avatar
                src={noteAuthorAvatar}
                name={noteAuthorName}
                size={28}
              />
              <span className="nrs-note-preview-author">
                {noteAuthorName}
              </span>
              <span className="nrs-note-preview-time">
                {timeAgo(note.createdAt)}
              </span>
            </div>

            {note.text && (
              <p className="nrs-note-preview-text">{note.text}</p>
            )}

            {note.song && (
              <button
                type="button"
                className={`nrs-note-preview-song ${
                  playingId === (note.song.trackId || note.song.sourceUrl)
                    ? 'is-playing'
                    : ''
                }`}
                onClick={() => {
                  if (note.song.previewUrl) {
                    play({
                      trackId: note.song.trackId || note.song.sourceUrl,
                      previewUrl: note.song.previewUrl,
                    });
                  } else if (note.song.sourceUrl) {
                    window.open(
                      note.song.sourceUrl,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }
                }}
                aria-label={`Play ${note.song.title}`}
              >
                <span className="nrs-note-preview-song-art">
                  {note.song.artwork ? (
                    <img src={note.song.artwork} alt="" loading="lazy" />
                  ) : (
                    <span>🎵</span>
                  )}
                </span>
                <span className="nrs-note-preview-song-info">
                  <span className="nrs-note-preview-song-title">
                    {note.song.title}
                  </span>
                  {note.song.artist && (
                    <span className="nrs-note-preview-song-artist">
                      {note.song.artist}
                    </span>
                  )}
                </span>
                <span
                  className="nrs-note-preview-song-play"
                  aria-hidden="true"
                >
                  {playingId ===
                  (note.song.trackId || note.song.sourceUrl) ? (
                    <svg viewBox="0 0 24 24" width="12" height="12">
                      <rect
                        x="6"
                        y="5"
                        width="4"
                        height="14"
                        fill="currentColor"
                      />
                      <rect
                        x="14"
                        y="5"
                        width="4"
                        height="14"
                        fill="currentColor"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="12" height="12">
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                  )}
                </span>
              </button>
            )}
          </div>
        )}

        {/* ─── Replies list ─── */}
        <div className="nrs-list">
          {replies.length === 0 ? (
            <div className="nrs-empty">
              <div className="nrs-empty-icon">🕊️</div>
              <p>No replies yet.</p>
              <span>Be the first to reply — tap an emoji below</span>

              {!isOwnNote && (
                <div className="nrs-quick-react-row">
                  {QUICK_EMOJI_REPLIES.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="nrs-quick-react-btn"
                      onClick={() => handleQuickEmoji(emoji)}
                      disabled={quickSending}
                      aria-label={`Reply with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            replies.map((reply) => {
              const isMine = reply.authorUid === user?.uid;
              const canDelete = isMine || isOwnNote;
              const songKey =
                reply.song?.trackId || reply.song?.sourceUrl;
              const isPlaying =
                reply.song?.previewUrl && playingId === songKey;

              return (
                <div
                  key={reply.id}
                  className="nrs-reply nrs-reply-tappable"
                  onClick={() => handleReplyCardTap(reply)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleReplyCardTap(reply);
                  }}
                >
                  <div className="nrs-reply-avatar-btn">
                    <Avatar
                      src={
                        reply.authorAvatar ||
                        getAvatar(reply.authorUid)
                      }
                      name={
                        reply.authorName ||
                        getDisplayName(reply.authorUid)
                      }
                      size={40}
                    />
                  </div>

                  <div className="nrs-reply-body">
                    <div className="nrs-reply-head">
                      <span className="nrs-reply-name">
                        {reply.authorName ||
                          getDisplayName(reply.authorUid)}
                        {isMine && (
                          <span className="nrs-you-badge">
                            <span className="nrs-you-badge-text">
                              You
                            </span>
                            <span
                              className="nrs-you-badge-tick"
                              aria-hidden="true"
                            >
                              <svg
                                viewBox="0 0 12 12"
                                width="10"
                                height="10"
                              >
                                <path
                                  d="M2.5 6.2l2 2 5-5"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          </span>
                        )}
                      </span>
                      <span className="nrs-reply-time">
                        {timeAgo(reply.createdAt)}
                      </span>
                    </div>

                    {reply.text && (
                      <p className="nrs-reply-text">{reply.text}</p>
                    )}

                    {reply.song && (
                      <button
                        type="button"
                        className={`nrs-reply-song ${
                          isPlaying ? 'is-playing' : ''
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (reply.song.previewUrl) {
                            play({
                              trackId: songKey,
                              previewUrl: reply.song.previewUrl,
                            });
                          } else if (reply.song.sourceUrl) {
                            window.open(
                              reply.song.sourceUrl,
                              '_blank',
                              'noopener,noreferrer'
                            );
                          }
                        }}
                        aria-label={`Play ${reply.song.title}`}
                      >
                        <span className="nrs-reply-song-art">
                          {reply.song.artwork ? (
                            <img
                              src={reply.song.artwork}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span>🎵</span>
                          )}
                        </span>
                        <span className="nrs-reply-song-info">
                          <span className="nrs-reply-song-title">
                            {reply.song.title}
                          </span>
                          {reply.song.artist && (
                            <span className="nrs-reply-song-artist">
                              {reply.song.artist}
                            </span>
                          )}
                        </span>
                        <span className="nrs-reply-song-play">
                          {isPlaying ? (
                            <svg
                              viewBox="0 0 24 24"
                              width="12"
                              height="12"
                            >
                              <rect
                                x="6"
                                y="5"
                                width="4"
                                height="14"
                                fill="currentColor"
                              />
                              <rect
                                x="14"
                                y="5"
                                width="4"
                                height="14"
                                fill="currentColor"
                              />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              width="12"
                              height="12"
                            >
                              <path
                                d="M8 5v14l11-7z"
                                fill="currentColor"
                              />
                            </svg>
                          )}
                        </span>
                      </button>
                    )}
                  </div>

                  <span className="nrs-reply-chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path
                        d="M9 6l6 6-6 6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>

                  {canDelete && (
                    <button
                      type="button"
                      className="nrs-reply-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(reply);
                      }}
                      aria-label="Delete reply"
                      title="Delete reply"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="nrs-footer">
          <button
            type="button"
            className="nrs-footer-btn"
            onClick={() => onPostReply?.()}
          >
            <span className="nrs-footer-icon">💬</span>
            <span>Reply to this note</span>
          </button>
        </div>
      </div>

      {/* ─── Reply detail modal ─── */}
      {detailReply && (
        <div
          className="nrs-detail-backdrop"
          onClick={() => setDetailReply(null)}
        >
          <div
            className="nrs-detail"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="nrs-detail-close"
              onClick={() => setDetailReply(null)}
              aria-label="Close"
            >
              ✕
            </button>

            <Avatar
              src={
                detailReply.authorAvatar ||
                getAvatar(detailReply.authorUid)
              }
              name={
                detailReply.authorName ||
                getDisplayName(detailReply.authorUid)
              }
              size={72}
            />

            <h3 className="nrs-detail-name">
              {detailReply.authorName ||
                getDisplayName(detailReply.authorUid)}
              {detailReply.authorUid === user?.uid && (
                <span className="nrs-you-badge nrs-you-badge-lg">
                  <span className="nrs-you-badge-text">You</span>
                  <span
                    className="nrs-you-badge-tick"
                    aria-hidden="true"
                  >
                    <svg viewBox="0 0 12 12" width="10" height="10">
                      <path
                        d="M2.5 6.2l2 2 5-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </span>
              )}
            </h3>

            <span className="nrs-detail-time">
              {timeAgo(detailReply.createdAt)}
            </span>

            {detailReply.text && (
              <p className="nrs-detail-text">{detailReply.text}</p>
            )}

            {detailReply.song && (
              <button
                type="button"
                className={`nrs-detail-song ${
                  playingId ===
                  (detailReply.song.trackId ||
                    detailReply.song.sourceUrl)
                    ? 'is-playing'
                    : ''
                }`}
                onClick={() => {
                  if (detailReply.song.previewUrl) {
                    play({
                      trackId:
                        detailReply.song.trackId ||
                        detailReply.song.sourceUrl,
                      previewUrl: detailReply.song.previewUrl,
                    });
                  } else if (detailReply.song.sourceUrl) {
                    window.open(
                      detailReply.song.sourceUrl,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }
                }}
              >
                <span className="nrs-detail-song-art">
                  {detailReply.song.artwork ? (
                    <img
                      src={detailReply.song.artwork}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <span>🎵</span>
                  )}
                </span>
                <span className="nrs-detail-song-info">
                  <span className="nrs-detail-song-title">
                    {detailReply.song.title}
                  </span>
                  {detailReply.song.artist && (
                    <span className="nrs-detail-song-artist">
                      {detailReply.song.artist}
                    </span>
                  )}
                </span>
                <span
                  className="nrs-detail-song-play"
                  aria-hidden="true"
                >
                  {playingId ===
                  (detailReply.song.trackId ||
                    detailReply.song.sourceUrl) ? (
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <rect
                        x="6"
                        y="5"
                        width="4"
                        height="14"
                        fill="currentColor"
                      />
                      <rect
                        x="14"
                        y="5"
                        width="4"
                        height="14"
                        fill="currentColor"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="14" height="14">
                      <path d="M8 5v14l11-7z" fill="currentColor" />
                    </svg>
                  )}
                </span>
              </button>
            )}

            <div className="nrs-detail-actions">
              {detailReply.authorUid !== user?.uid && (
                <button
                  type="button"
                  className="nrs-detail-btn nrs-detail-btn-primary"
                  onClick={() =>
                    handleOpenChatFromDetail(detailReply)
                  }
                >
                  <span>Reply in chat</span>
                  <svg viewBox="0 0 24 24" width="14" height="14">
                    <path
                      d="M9 6l6 6-6 6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}

              <button
                type="button"
                className="nrs-detail-btn nrs-detail-btn-ghost"
                onClick={() => handleCopyReply(detailReply)}
              >
                📋 Copy
              </button>

              {(detailReply.authorUid === user?.uid ||
                isOwnNote) && (
                <button
                  type="button"
                  className="nrs-detail-btn nrs-detail-btn-danger"
                  onClick={() => handleDelete(detailReply)}
                >
                  🗑️ Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete confirmation ─── */}
      {confirmDelete && (
        <div
          className="nrs-confirm-backdrop"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="nrs-confirm"
            onClick={(e) => e.stopPropagation()}
          >
            <h4>Delete reply?</h4>
            <p>This can't be undone.</p>
            <div className="nrs-confirm-actions">
              <button
                type="button"
                className="nrs-confirm-btn nrs-confirm-cancel"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="nrs-confirm-btn nrs-confirm-danger"
                onClick={confirmDeleteReply}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteRepliesSheet;
