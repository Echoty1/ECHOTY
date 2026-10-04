// src/pages/Spotlight/SpotlightShare.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../services/firebase';
import { getShareableFile, spotlightShareUrl } from '../../utils/echoWatermark';

const SITE = 'https://echoty.xyz';

const canShareFiles = () => {
  if (typeof navigator === 'undefined') return false;
  if (!navigator.share || !navigator.canShare) return false;
  try {
    const probe = new File([new Blob([''], { type: 'video/mp4' })], 't.mp4', { type: 'video/mp4' });
    return navigator.canShare({ files: [probe] });
  } catch (_) {
    return false;
  }
};

const SpotlightShare = ({ isOpen, post, currentUser, onClose, onToast }) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

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

  if (!isOpen || !post) return null;

  const url = `${SITE}/spotlight?focus=${post.id}&w=1`;
  const shareText = `Watch "${post.caption || 'this Spotlight'}" by @${(post.authorName || 'user')
    .replace(/\s+/g, '')
    .toLowerCase()} on ECHO 🎬`;

  const caption = `${shareText}\n${url}`;

  /* ─── Try sending the file via navigator.share ──────────── */
  const tryShareFile = async (fallbackAction) => {
    if (sending) return;
    setSending(true);

    try {
      if (canShareFiles()) {
        const result = await getShareableFile(post);
        if (result?.file) {
          try {
            await navigator.share({
              files: [result.file],
              title: shareText,
              text: caption,
            });
            setSending(false);
            onClose?.();
            return true;
          } catch (err) {
            // User cancelled — that's fine, don't fall back
            if (err?.name === 'AbortError') {
              setSending(false);
              return true;
            }
            console.warn('[Share] file share failed, falling back:', err);
          }
        }
      }
    } catch (err) {
      console.warn('[Share] getShareableFile error:', err);
    }

    // Fallback
    setSending(false);
    fallbackAction?.();
    return false;
  };

  const handleWhatsApp = async () => {
    // WhatsApp accepts files via native share only. If files aren't
    // supported, fall back to opening WhatsApp with the caption+link
    // (user can attach manually), or to copy-to-clipboard.
    const shared = await tryShareFile(() => {
      // Fallback: open WhatsApp web with caption (link only).
      // wa.me accepts text only — no file upload path on desktop.
      window.open(
        `https://wa.me/?text=${encodeURIComponent(caption)}`,
        '_blank',
        'noopener,noreferrer'
      );
      onClose?.();
    });
    return shared;
  };

  const handleTelegram = async () => {
    const shared = await tryShareFile(() => {
      window.open(
        `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText)}`,
        '_blank',
        'noopener,noreferrer'
      );
      onClose?.();
    });
    return shared;
  };

  const handleTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer'
    );
    onClose?.();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onToast?.({ message: 'Link copied', type: 'success' });
      setTimeout(() => setCopied(false), 2000);
      setTimeout(() => onToast?.(null), 1800);
    } catch (_) {
      onToast?.({ message: 'Copy failed', type: 'error' });
      setTimeout(() => onToast?.(null), 2200);
    }
  };

  const handleNative = async () => {
    await tryShareFile(handleCopy);
  };

  const handleSendToChat = (partnerId) => {
    navigate(`/chat/${partnerId}`, {
      state: { prefilledNote: `${shareText}\n${url}` },
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
          <button
            type="button"
            className="spotlight-share-quick"
            onClick={handleWhatsApp}
            disabled={sending}
          >
            <span className="spotlight-share-quick-icon whatsapp">
              {sending ? <i className="fas fa-spinner fa-spin" /> : <i className="fab fa-whatsapp" />}
            </span>
            <span className="spotlight-share-quick-label">WhatsApp</span>
          </button>

          <button type="button" className="spotlight-share-quick" onClick={handleTwitter}>
            <span className="spotlight-share-quick-icon twitter">
              <i className="fab fa-x-twitter" />
            </span>
            <span className="spotlight-share-quick-label">X</span>
          </button>

          <button
            type="button"
            className="spotlight-share-quick"
            onClick={handleTelegram}
            disabled={sending}
          >
            <span className="spotlight-share-quick-icon telegram">
              {sending ? <i className="fas fa-spinner fa-spin" /> : <i className="fab fa-telegram" />}
            </span>
            <span className="spotlight-share-quick-label">Telegram</span>
          </button>

          <button type="button" className="spotlight-share-quick" onClick={handleCopy}>
            <span className="spotlight-share-quick-icon copy">
              <i className={copied ? 'fas fa-check' : 'fas fa-link'} />
            </span>
            <span className="spotlight-share-quick-label">{copied ? 'Copied' : 'Copy link'}</span>
          </button>

          <button
            type="button"
            className="spotlight-share-quick"
            onClick={handleNative}
            disabled={sending}
          >
            <span className="spotlight-share-quick-icon native">
              <i className="fas fa-share-alt" />
            </span>
            <span className="spotlight-share-quick-label">More</span>
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

export default SpotlightShare;
