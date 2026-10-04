// src/pages/Spotlight/SpotlightComments.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  listenToSpotlightComments,
  addSpotlightComment,
  deleteSpotlightComment,
} from '../../services/spotlightService';

const timeAgo = (ts) => {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString();
};

const SpotlightComments = ({ isOpen, post, currentUser, currentProfile, onClose }) => {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !post?.id) return () => {};
    const unsub = listenToSpotlightComments(post.id, setComments);
    return () => unsub();
  }, [isOpen, post?.id]);

  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        inputRef.current?.focus();
      }, 120);
      return () => clearTimeout(t);
    }
  }, [isOpen, comments.length]);

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

  if (!isOpen) return null;

  const handleSend = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await addSpotlightComment(
        post.id,
        currentUser?.uid,
        currentProfile?.name || currentUser?.displayName || 'User',
        currentProfile?.avatar || '',
        t
      );
      setText('');
    } catch (err) {
      console.warn('Comment failed:', err);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId) => {
    try { await deleteSpotlightComment(post.id, commentId); } catch (_) {}
  };

  return (
    <div className="spotlight-comments-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="spotlight-comments-sheet" role="dialog" aria-modal="true">
        <div className="spotlight-comments-handle" aria-hidden="true" />
        <div className="spotlight-comments-header">
          <span className="spotlight-comments-title">
            {comments.length === 0 ? 'Comments' : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
          </span>
          <button type="button" className="spotlight-comments-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="spotlight-comments-list" ref={scrollRef}>
          {comments.length === 0 ? (
            <div className="spotlight-comments-empty">
              <i className="far fa-comment-dots" />
              <p>No comments yet. Be the first.</p>
            </div>
          ) : (
            comments.map((c) => {
              const mine = c.uid === currentUser?.uid;
              const isAuthor = c.uid === post.uid;
              return (
                <div key={c.id} className="spotlight-comment-row">
                  <div className="spotlight-comment-avatar">
                    {c.authorAvatar ? (
                      <img src={c.authorAvatar} alt="" loading="lazy" />
                    ) : (
                      <span>{(c.authorName || 'U').charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="spotlight-comment-body">
                    <div className="spotlight-comment-header">
                      <span className="spotlight-comment-name">
                        {c.authorName || 'User'}
                        {isAuthor && <span className="spotlight-comment-badge">Author</span>}
                      </span>
                      <span className="spotlight-comment-time">{timeAgo(c.createdAt)}</span>
                    </div>
                    <div className="spotlight-comment-text">{c.text}</div>
                  </div>
                  {mine && (
                    <button
                      type="button"
                      className="spotlight-comment-delete"
                      onClick={() => handleDelete(c.id)}
                      aria-label="Delete comment"
                    >
                      <i className="fas fa-trash" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <form
          className="spotlight-comments-input-row"
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        >
          <input
            ref={inputRef}
            type="text"
            className="spotlight-comments-input"
            placeholder="Add a comment..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
          />
          <button
            type="submit"
            className="spotlight-comments-send"
            disabled={!text.trim() || sending}
            aria-label="Send"
          >
            {sending ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SpotlightComments;
