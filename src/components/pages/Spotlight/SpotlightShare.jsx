// src/pages/Spotlight/SpotlightShare.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, get, onValue } from 'firebase/database';
import { db } from '../../services/firebase';
import { spotlightShareUrl, spotlightShareText } from '../../utils/echoWatermark';

const SpotifyShare = ({ isOpen, post, currentUser, onClose, onToast }) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUser?.uid) return () => {};
    const unsub = onValue(ref(db, `userChats/${currentUser.uid}`), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, v]) => ({
          id,
          name: v.partnerName || v.name || 'User',
          avatar: v.partnerAvatar || '',
          lastUpdated: v.lastUpdated || 0,
        }))
        .sort((a, b) => b.lastUpdated - a.lastUpdated);
      setChats(list);
    });
    return () => unsub();
  }, [isOpen, currentUser?.uid]);

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

  const url = spotlightShareUrl(post?.id);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onToast?.({ message: 'Link copied', type: 'success' });
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      onToast?.({ message: 'Copy failed', type: 'error' });
    }
  };

  const handleNativeShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${post.authorName || 'Someone'} on ECHO Spotlight`,
          text: spotlightShareText(post, post.authorName),
          url,
        });
        onClose?.();
      } else {
        handleCopy();
      }
    } catch (_) { /* user cancelled */ }
  };

  const handleSendToChat = (partnerId) => {
    navigate(`/chat/${partnerId}`, {
      state: {
        prefilledNote: `Check this out on ECHO Spotlight 🎬 ${url}`,
      },
    });
    onClose?.();
  };

  return (
    <div className="spotlight-share-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="spotlight-share-sheet" role="dialog" aria-modal="true">
        <div className="spotlight-share-handle" aria-hidden="true" />
        <div className="spotlight-share-header">
          <span className="spotlight-share-title">Share</span>
          <button type="button" className="spotlight-share-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="spotlight-share-quickrow">
          <button type="button" className="spotlight-share-quick" onClick={handleCopy}>
            <span className="spotlight-share-quick-icon copy">
              <i className={copied ? 'fas fa-check' : 'fas fa-link'} />
            </span>
            <span className="spotlight-share-quick-label">{copied ? 'Copied' : 'Copy link'}</span>
          </button>

          <button type="button" className="spotlight-share-quick" onClick={handleNativeShare}>
            <span className="spotlight-share-quick-icon native">
              <i className="fas fa-share-alt" />
            </span>
            <span className="spotlight-share-quick-label">More</span>
          </button>

          <button type="button" className="spotlight-share-quick" onClick={() => { window.open(url, '_blank', 'noopener'); onClose?.(); }}>
            <span className="spotlight-share-quick-icon open">
              <i className="fas fa-external-link-alt" />
            </span>
            <span className="spotlight-share-quick-label">Open</span>
          </button>
        </div>

        <div className="spotlight-share-section-title">Send to chat</div>

        <div className="spotlight-share-chat-list">
          {chats.length === 0 ? (
            <p className="spotlight-share-empty">No chats yet.</p>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                type="button"
                className="spotlight-share-chat-row"
                onClick={() => handleSendToChat(c.id)}
              >
                <span className="spotlight-share-chat-avatar">
                  {c.avatar ? (
                    <img src={c.avatar} alt="" loading="lazy" />
                  ) : (
                    <span>{(c.name || 'U').charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <span className="spotlight-share-chat-name">{c.name}</span>
                <span className="spotlight-share-chat-send">
                  <i className="fas fa-paper-plane" />
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SpotifyShare;
