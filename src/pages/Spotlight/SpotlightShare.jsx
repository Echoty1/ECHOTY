// src/pages/Spotlight/SpotlightShare.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, push, set, update, runTransaction } from 'firebase/database';
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

const SpotlightShare = ({
  isOpen,
  post,
  currentUser,
  currentProfile,
  onClose,
  onToast,
}) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingToId, setSendingToId] = useState(null);

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
  const handle = (post.authorName || 'user').replace(/\s+/g, '').toLowerCase();
  const shareText = `Watch "${post.caption || 'this Spotlight'}" by @${handle} on ECHO 🎬`;
  const caption = `${shareText}\n${url}`;

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
    setSending(false);
    fallbackAction?.();
    return false;
  };

  const handleWhatsApp = async () => {
    const shared = await tryShareFile(() => {
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

  /* ─── SEND-TO-CHAT: writes a rich spotlight message into the thread ─── */
  const handleSendToChat = async (partnerId) => {
    if (!currentUser?.uid || !partnerId) return;
    setSendingToId(partnerId);

    try {
      const cId = [currentUser.uid, partnerId].sort().join('_');
      const messagesRef = ref(db, `chats/${cId}/messages`);
      const newMsgRef = push(messagesRef);

      const thumbnail =
        post.mediaType === 'video'
          ? post.posterUrl || ''
          : post.mediaUrl || '';

      const payload = {
        senderId: currentUser.uid,
        receiverId: partnerId,
        type: 'spotlight',
        timestamp: Date.now(),
        clientTs: Date.now(),
        isRead: false,
        spotlight: {
          postId: post.id,
          mediaType: post.mediaType,
          mediaUrl: post.mediaUrl,
          posterUrl: post.posterUrl || '',
          thumbnail,
          caption: (post.caption || '').slice(0, 140),
          authorUid: post.uid,
          authorName: post.authorName || 'User',
          authorAvatar: post.authorAvatar || '',
        },
      };

      await set(newMsgRef, payload);

      /* Update BOTH userChats entries so the chat list reflects it */
      const now = Date.now();
      const myName = currentProfile?.name || currentUser.displayName || 'User';
      const myAvatar = currentProfile?.avatar || '';

      await runTransaction(ref(db, `userChats/${currentUser.uid}/${partnerId}`), (cur) => {
        const base = cur || { id: partnerId };
        return {
          ...base,
          id: partnerId,
          partnerName: base.partnerName || 'User',
          partnerAvatar: base.partnerAvatar || '',
          lastMessage: '🎬 Spotlight',
          lastSenderId: currentUser.uid,
          lastUpdated: now,
          unreadCount: 0,
        };
      });

      await runTransaction(ref(db, `userChats/${partnerId}/${currentUser.uid}`), (cur) => {
        const base = cur || { id: currentUser.uid };
        return {
          ...base,
          id: currentUser.uid,
          partnerName: base.partnerName || myName,
          partnerAvatar: base.partnerAvatar || myAvatar,
          lastMessage: '🎬 Spotlight',
          lastSenderId: currentUser.uid,
          lastUpdated: now,
          unreadCount: (base.unreadCount || 0) + 1,
        };
      });

      window.dispatchEvent(
        new CustomEvent('chat-list-update', {
          detail: {
            partnerId,
            patch: {
              lastMessage: '🎬 Spotlight',
              lastSenderId: currentUser.uid,
              timestamp: now,
              unreadCount: 0,
            },
          },
        })
      );

      onToast?.({ message: 'Sent to chat', type: 'success' });
      setTimeout(() => onToast?.(null), 1600);
      onClose?.();
    } catch (err) {
      console.error('[Share] send-to-chat failed:', err);
      onToast?.({ message: 'Could not send', type: 'error' });
      setTimeout(() => onToast?.(null), 2200);
      /* Fallback: navigate with a prefilled link so the user isn't stuck */
      navigate(`/chat/${partnerId}`, {
        state: { prefilledNote: caption },
      });
      onClose?.();
    } finally {
      setSendingToId(null);
    }
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
                disabled={sendingToId === c.id}
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
                  {sendingToId === c.id ? (
                    <i className="fas fa-spinner fa-spin" />
                  ) : (
                    <i className="fas fa-paper-plane" />
                  )}
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
