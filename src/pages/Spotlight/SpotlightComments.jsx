// src/pages/Spotlight/SpotlightComments.jsx
import React, { useEffect, useRef, useState } from 'react';
import {
  listenToSpotlightComments,
  addSpotlightComment,
  deleteSpotlightComment,
  toggleCommentLike,
  listenToCommentLike,
  addCommentReply,
  listenToCommentReplies,
  deleteCommentReply,
} from '../../services/spotlightService';

const QUICK_EMOJIS = ['❤️', '😂', '🔥', '👏', '😮'];

const timeAgo = (ts) => {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString();
};

/* ─── Comment like pill with emoji picker ──────────────────── */
const CommentLikePill = ({ postId, comment, currentUser }) => {
  const [reaction, setReaction] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [count, setCount] = useState(comment.likeCount || 0);

  useEffect(() => {
    if (!postId || !comment?.id || !currentUser?.uid) return () => {};
    return listenToCommentLike(postId, comment.id, currentUser.uid, setReaction);
  }, [postId, comment?.id, currentUser?.uid]);

  const pick = async (emoji) => {
    setPickerOpen(false);
    if (!currentUser?.uid) return;
    try {
      const active = await toggleCommentLike(postId, comment.id, currentUser.uid, emoji);
      setReaction(active ? emoji : null);
      setCount((c) => Math.max(0, c + (active ? 1 : -1)));
    } catch (_) {}
  };

  return (
    <div className="spotlight-comment-like">
      <button
        type="button"
        className={`spotlight-comment-like-btn ${reaction ? 'active' : ''}`}
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="React to comment"
      >
        {reaction ? <span className="spotlight-comment-emoji">{reaction}</span> : <i className="far fa-heart" />}
      </button>
      {count > 0 && <span className="spotlight-comment-like-count">{count}</span>}
      {pickerOpen && (
        <div className="spotlight-comment-like-picker">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              className="spotlight-comment-like-pick"
              onClick={() => pick(e)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Reply thread (renders under a comment) ──────────────── */
const CommentReplies = ({ postId, comment, currentUser, currentProfile }) => {
  const [replies, setReplies] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!postId || !comment?.id) return () => {};
    return listenToCommentReplies(postId, comment.id, setReplies);
  }, [postId, comment?.id]);

  const send = async () => {
    const t = text.trim();
    if (!t || !currentUser?.uid || sending) return;
    setSending(true);
    try {
      await addCommentReply(
        postId,
        comment.id,
        currentUser.uid,
        currentProfile?.name || currentUser.displayName || 'User',
        currentProfile?.avatar || '',
        t
      );
      setText('');
    } catch (_) {}
    setSending(false);
  };

  return (
    <div className="spotlight-comment-replies">
      {replies.map((r) => {
        const isMine = r.uid === currentUser?.uid;
        return (
          <div key={r.id} className="spotlight-comment-row reply">
            <span className="spotlight-comment-avatar small">
              {r.authorAvatar ? (
                <img src={r.authorAvatar} alt="" loading="lazy" />
              ) : (
                <span>{(r.authorName || 'U').charAt(0).toUpperCase()}</span>
              )}
            </span>
            <div className="spotlight-comment-body">
              <div className="spotlight-comment-header">
                <span className="spotlight-comment-name">{r.authorName || 'User'}</span>
                <span className="spotlight-comment-time">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="spotlight-comment-text">{r.text}</p>
            </div>
            {isMine && (
              <button
                type="button"
                className="spotlight-comment-delete"
                onClick={() => deleteCommentReply(postId, comment.id, r.id).catch(() => {})}
                aria-label="Delete reply"
              >
                <i className="fas fa-trash" />
              </button>
            )}
          </div>
        );
      })}

      {currentUser?.uid && (
        <div className="spotlight-comment-reply-input">
          <span className="spotlight-comment-avatar small">
            {currentProfile?.avatar ? (
              <img src={currentProfile.avatar} alt="" />
            ) : (
              <span>{(currentProfile?.name || 'U').charAt(0).toUpperCase()}</span>
            )}
          </span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Reply to ${comment.authorName || 'User'}...`}
            maxLength={500}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
          />
          <button
            type="button"
            className="spotlight-comment-reply-send"
            onClick={send}
            disabled={!text.trim() || sending}
            aria-label="Send reply"
          >
            {sending ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
          </button>
        </div>
      )}
    </div>
  );
};

/* ─── Single comment row with reply toggle ───────────────── */
const CommentRow = ({ postId, comment, post, currentUser, currentProfile }) => {
  const [showReplies, setShowReplies] = useState(false);
  const mine = comment.uid === currentUser?.uid;
  const isAuthor = comment.uid === post?.uid;
  const replyCount = comment.replyCount || 0;

  return (
    <div className="spotlight-comment-thread">
      <div className="spotlight-comment-row">
        <div className="spotlight-comment-avatar">
          {comment.authorAvatar ? (
            <img src={comment.authorAvatar} alt="" loading="lazy" />
          ) : (
            <span>{(comment.authorName || 'U').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="spotlight-comment-body">
          <div className="spotlight-comment-header">
            <span className="spotlight-comment-name">
              {comment.authorName || 'User'}
              {isAuthor && <span className="spotlight-comment-badge">Author</span>}
            </span>
            <span className="spotlight-comment-time">{timeAgo(comment.createdAt)}</span>
          </div>
          <div className="spotlight-comment-text">{comment.text}</div>
          <div className="spotlight-comment-meta-row">
            <button
              type="button"
              className="spotlight-comment-reply-toggle"
              onClick={() => setShowReplies((v) => !v)}
            >
              <i className="far fa-comment" />
              {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : 'Reply'}
            </button>
          </div>
        </div>
        <div className="spotlight-comment-right">
          {currentUser?.uid && (
            <CommentLikePill postId={postId} comment={comment} currentUser={currentUser} />
          )}
          {mine && (
            <button
              type="button"
              className="spotlight-comment-delete"
              onClick={() => deleteSpotlightComment(postId, comment.id).catch(() => {})}
              aria-label="Delete comment"
            >
              <i className="fas fa-trash" />
            </button>
          )}
        </div>
      </div>

      {showReplies && (
        <CommentReplies
          postId={postId}
          comment={comment}
          currentUser={currentUser}
          currentProfile={currentProfile}
        />
      )}
    </div>
  );
};

/* ─── Main sheet ─────────────────────────────────────────── */
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
            comments.map((c) => (
              <CommentRow
                key={c.id}
                postId={post.id}
                comment={c}
                post={post}
                currentUser={currentUser}
                currentProfile={currentProfile}
              />
            ))
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
