// src/components/pages/Chats/NoteRepliesSheet.jsx
import React, { useEffect, useRef, useState } from 'react';
import { subscribeToNoteReplies, deleteNoteReply } from '../../../services/notesService';
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

const NoteRepliesSheet = ({
  open,
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
  const sheetRef = useRef(null);

  const getDisplayName = (uid) => {
    if (!uid) return 'User';
    const profile = profiles?.[uid] || {};
    return profile.name || profile.displayName || 'User';
  };
  const getAvatar = (uid) => (uid ? profiles?.[uid]?.avatar || '' : '');

  useEffect(() => {
    if (!open || !noteOwnerUid) {
      setReplies([]);
      return;
    }
    const unsub = subscribeToNoteReplies(noteOwnerUid, setReplies);
    return () => unsub();
  }, [open, noteOwnerUid]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleReplyTap = (reply) => {
    if (!reply?.authorUid) return;
    if (reply.authorUid === user?.uid) return;
    onOpenChatWith?.(reply);
  };

  const handleDelete = async (reply) => {
    setConfirmDelete(reply);
  };

  const confirmDeleteReply = async () => {
    if (!confirmDelete) return;
    await deleteNoteReply(noteOwnerUid, confirmDelete.id);
    setConfirmDelete(null);
  };

  return (
    <div className="nrs-backdrop" onClick={onClose}>
      <div
        className="nrs-sheet"
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nrs-glow" aria-hidden="true" />
        <div className="nrs-handle" />
        <div className="nrs-header">
          <div className="nrs-header-left">
            <span className="nrs-header-icon">💬</span>
            <div>
              <h3 className="nrs-title">Replies</h3>
              <span className="nrs-subtitle">
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'} to{' '}
                {noteOwnerName || 'this note'}
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

        <div className="nrs-list">
          {replies.length === 0 ? (
            <div className="nrs-empty">
              <div className="nrs-empty-icon">🕊️</div>
              <p>No replies yet.</p>
              <span>Be the first to reply to this note.</span>
            </div>
          ) : (
            replies.map((reply) => {
              const isMine = reply.authorUid === user?.uid;
              const isNoteOwner = noteOwnerUid === user?.uid;
              const canDelete = isMine || isNoteOwner;
              const songKey = reply.song?.trackId || reply.song?.sourceUrl;
              const isPlaying = reply.song?.previewUrl && playingId === songKey;

              return (
                <div key={reply.id} className="nrs-reply">
                  <button
                    type="button"
                    className="nrs-reply-avatar-btn"
                    onClick={() => !isMine && handleReplyTap(reply)}
                    aria-label={`Open chat with ${reply.authorName || 'User'}`}
                  >
                    <Avatar
                      src={reply.authorAvatar || getAvatar(reply.authorUid)}
                      name={reply.authorName || getDisplayName(reply.authorUid)}
                      size={40}
                    />
                  </button>

                  <div className="nrs-reply-body">
                    <div className="nrs-reply-head">
                      <span className="nrs-reply-name">
                        {reply.authorName || getDisplayName(reply.authorUid)}
                        {isMine && <span className="nrs-reply-you"> · you</span>}
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
                        className={`nrs-reply-song ${isPlaying ? 'is-playing' : ''}`}
                        onClick={() => {
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
                            <img src={reply.song.artwork} alt="" loading="lazy" />
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

                    {!isMine && (
                      <button
                        type="button"
                        className="nrs-reply-dm"
                        onClick={() => handleReplyTap(reply)}
                      >
                        Reply in chat →
                      </button>
                    )}
                  </div>

                  {canDelete && (
                    <button
                      type="button"
                      className="nrs-reply-delete"
                      onClick={() => handleDelete(reply)}
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

      {confirmDelete && (
        <div
          className="nrs-confirm-backdrop"
          onClick={() => setConfirmDelete(null)}
        >
          <div className="nrs-confirm" onClick={(e) => e.stopPropagation()}>
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
