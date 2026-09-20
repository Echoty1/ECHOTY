// src/components/pages/Chat/ChatPreviewPopup.js
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../../../services/firebase';
import {
  ref,
  query,
  orderByChild,
  limitToLast,
  onValue,
  push,
  set,
} from 'firebase/database';
import Avatar from '../../common/Avatar';

const ChatPreviewPopup = ({ chat, onClose, onOpenChat, position }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [resolvedPath, setResolvedPath] = useState(null);
  const popupRef = useRef(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);

  // ─── Fetch messages — auto-detect path ─────────────────────
  useEffect(() => {
    if (!chat?.id || !chat?.myUid) return;
    setLoading(true);

    const myUid = chat.myUid;
    const otherUid = chat.id;

    const pathsToTry = [
      `messages/${otherUid}`,
      `chats/${otherUid}/messages`,
      `chats/${myUid}_${otherUid}/messages`,
      `chats/${otherUid}_${myUid}/messages`,
      `messages/${myUid}/${otherUid}`,
      `messages/${otherUid}/${myUid}`,
      `userChats/${myUid}/${otherUid}/messages`,
      `userChats/${otherUid}/${myUid}/messages`,
    ];

    const unsubs = [];
    let gotData = false;

    pathsToTry.forEach((path) => {
      const msgsRef = query(
        ref(db, path),
        orderByChild('timestamp'),
        limitToLast(8)
      );
      const unsub = onValue(
        msgsRef,
        (snap) => {
          if (gotData) return;
          const data = snap.val();
          if (!data || Object.keys(data).length === 0) return;

          gotData = true;
          setResolvedPath(path);

          const list = Object.entries(data)
            .map(([id, m]) => ({ id, ...m }))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

          setMessages(list);
          setLoading(false);
          unsubs.forEach((u) => { try { u(); } catch {} });
        },
        () => {}
      );
      unsubs.push(unsub);
    });

    const fallback = setTimeout(() => {
      if (!gotData) {
        setResolvedPath(`messages/${otherUid}`);
        setLoading(false);
      }
    }, 2500);

    return () => {
      clearTimeout(fallback);
      unsubs.forEach((u) => { try { u(); } catch {} });
    };
  }, [chat?.id, chat?.myUid]);

  // ─── Auto-scroll on new messages ───────────────────────────
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages]);

  // ─── Auto-focus input on open ──────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  // ─── Close on outside click / Escape ───────────────────────
  useEffect(() => {
    const handleOutside = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        triggerClose();
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') triggerClose();
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleOutside);
      document.addEventListener('touchstart', handleOutside);
    }, 150);
    document.addEventListener('keydown', handleKey);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
    // eslint-disable-next-line
  }, []);

  const triggerClose = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => onClose(), 180);
  };

  // ─── Send message ──────────────────────────────────────────
  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const myUid = chat.myUid;
      const otherUid = chat.id;
      const basePath = resolvedPath || `messages/${otherUid}`;
      const newMsgRef = push(ref(db, basePath));

      const payload = {
        text,
        senderId: myUid,
        receiverId: otherUid,
        timestamp: Date.now(),
        type: 'text',
      };

      await set(newMsgRef, payload);

      // Optimistic append
      setMessages((prev) => [
        ...prev,
        { id: newMsgRef.key, ...payload },
      ]);

      setDraft('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!chat) return null;

  // ─── Styles ────────────────────────────────────────────────
  const popupStyle = {
    position: 'fixed',
    top: Math.min(Math.max(position.y - 40, 16), window.innerHeight - 480),
    left: Math.min(Math.max(position.x - 60, 16), window.innerWidth - 400),
    width: 'min(380px, calc(100vw - 24px))',
    height: '440px',
    background: 'var(--bg-card)',
    borderRadius: '20px',
    border: '1px solid var(--border-color)',
    boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(108,60,225,0.35)',
    zIndex: 99999,
    overflow: 'hidden',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    animation: closing
      ? 'chatPreviewOut 0.18s ease-in forwards'
      : 'chatPreviewIn 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    display: 'flex',
    flexDirection: 'column',
    transformOrigin: 'top left',
  };

  const headerStyle = {
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background:
      'linear-gradient(135deg, rgba(108,60,225,0.12), rgba(236,72,153,0.06))',
    flexShrink: 0,
  };

  const bodyStyle = {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    scrollBehavior: 'smooth',
  };

  const footerStyle = {
    padding: '10px 12px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'var(--bg-input)',
    flexShrink: 0,
  };

  const inputRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const inputStyle = {
    flex: 1,
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '22px',
    padding: '10px 14px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    minHeight: 'auto',
    fontFamily: 'inherit',
  };

  const sendBtnStyle = {
    width: '38px',
    height: '38px',
    minWidth: '38px',
    minHeight: '38px',
    borderRadius: '50%',
    border: 'none',
    background: draft.trim()
      ? 'linear-gradient(135deg, #6C3CE1, #EC4899)'
      : 'var(--bg-input)',
    color: draft.trim() ? '#fff' : 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: draft.trim() ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
    padding: 0,
  };

  const bubbleStyle = (isMe) => ({
    alignSelf: isMe ? 'flex-end' : 'flex-start',
    maxWidth: '100%',
    width: 'fit-content',
    padding: '8px 12px',
    borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
    background: isMe
      ? 'linear-gradient(135deg, #6C3CE1, #EC4899)'
      : 'var(--bg-input)',
    color: isMe ? '#fff' : 'var(--text-primary)',
    fontSize: '13px',
    lineHeight: 1.4,
    wordBreak: 'break-word',
    border: isMe ? 'none' : '1px solid var(--border-color)',
    boxShadow: isMe
      ? '0 4px 12px rgba(108,60,225,0.25)'
      : '0 2px 6px rgba(0,0,0,0.08)',
    display: 'inline-block',
  });

  const timeStyle = (isMe) => ({
    fontSize: '10px',
    color: 'var(--text-muted)',
    marginTop: '3px',
    marginLeft: isMe ? 0 : '2px',
    marginRight: isMe ? '2px' : 0,
    textAlign: isMe ? 'right' : 'left',
    opacity: 0.7,
  });

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const openChat = () => {
    triggerClose();
    setTimeout(() => onOpenChat(chat.id), 180);
  };

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={headerStyle}>
        <Avatar src={chat.avatar} name={chat.name} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {chat.name}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: chat.online ? '#10B981' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {chat.online ? '🟢 Online' : 'Quick reply'}
          </div>
        </div>
        <button
          onClick={openChat}
          style={{
            background: 'transparent',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            borderRadius: '14px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            minHeight: 'auto',
            minWidth: 'auto',
          }}
        >
          Full Chat →
        </button>
      </div>

      {/* Messages */}
      <div ref={bodyRef} style={bodyStyle}>
        {loading ? (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '30px 0',
            }}
          >
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              fontSize: '13px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '40px 20px',
              lineHeight: 1.5,
            }}
          >
            No messages yet.
            <br />
            Say hi 👋
          </div>
        ) : (
          messages.map((m) => {
            const isMe =
              m.senderId === chat.myUid ||
              m.from === chat.myUid ||
              m.uid === chat.myUid ||
              m.sender === chat.myUid ||
              m.authorId === chat.myUid;

            const text = m.text || m.message || m.content || '';
            const imgUrl = m.imageUrl || m.mediaUrl || m.image;
            const type = m.type || (imgUrl ? 'image' : 'text');

            return (
              <div
                key={m.id}
                style={{
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start',
                  width: 'fit-content',
                  minWidth: '60px',
                }}
              >
                <div style={bubbleStyle(isMe)}>
                  {type === 'image' && imgUrl ? (
                    <img
                      src={imgUrl}
                      alt=""
                      style={{
                        maxWidth: '180px',
                        borderRadius: '10px',
                        display: 'block',
                      }}
                    />
                  ) : type === 'voice' ? (
                    <span>🎤 Voice message</span>
                  ) : type === 'gif' ? (
                    <span>🎞️ GIF</span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-block',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {text}
                    </span>
                  )}
                </div>
                <div style={timeStyle(isMe)}>
                  {formatTime(m.timestamp || m.createdAt)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer — reply input */}
      <div style={footerStyle}>
        <div style={inputRowStyle}>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            style={inputStyle}
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            style={sendBtnStyle}
            title="Send"
          >
            {sending ? (
              <span style={{ fontSize: '14px' }}>…</span>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </div>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--text-muted)',
            textAlign: 'center',
          }}
        >
          Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
};

export default ChatPreviewPopup;
