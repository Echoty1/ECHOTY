// src/pages/Spotlight/SpotlightNotifications.jsx
import React, { useEffect, useState } from 'react';
import {
  listenToSpotlightNotifications,
  markAllSpotlightNotificationsRead,
  clearSpotlightNotifications,
} from '../../services/spotlightNotifications';

const timeAgo = (ts) => {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString();
};

const getCopy = (type) => {
  switch (type) {
    case 'like': return 'liked your Spotlight';
    case 'comment': return 'commented on your Spotlight';
    case 'reecho': return 'reechoed your Spotlight';
    case 'duet': return 'started a duet with you';
    case 'echo': return 'echoed you';
    default: return 'interacted with your Spotlight';
  }
};

const getIcon = (type) => {
  switch (type) {
    case 'like': return 'fa-heart';
    case 'comment': return 'fa-comment-dots';
    case 'reecho': return 'fa-retweet';
    case 'duet': return 'fa-clone';
    case 'echo': return 'fa-bolt';
    default: return 'fa-bell';
  }
};

const SpotlightNotifications = ({ isOpen, uid, onClose, onOpenPost, onOpenProfile }) => {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !uid) return () => {};
    setLoading(true);
    let currentList = [];
    const unsub = listenToSpotlightNotifications(uid, (list) => {
      currentList = list;
      setNotifs(list);
      setLoading(false);
    });
    // Mark all read after a moment
    const t = setTimeout(() => {
      markAllSpotlightNotificationsRead(uid, currentList).catch(() => {});
    }, 1200);
    return () => { unsub && unsub(); clearTimeout(t); };
  }, [isOpen, uid]);

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

  const handleClear = async () => {
    await clearSpotlightNotifications(uid);
    onClose?.();
  };

  return (
    <div
      className="spotlight-notifs-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="spotlight-notifs-sheet" role="dialog" aria-modal="true">
        <div className="spotlight-notifs-handle" aria-hidden="true" />

        <div className="spotlight-notifs-header">
          <span className="spotlight-notifs-title">Activity</span>
          <div className="spotlight-notifs-header-actions">
            {notifs.length > 0 && (
              <button
                type="button"
                className="spotlight-notifs-clear"
                onClick={handleClear}
                title="Clear all"
              >
                <i className="fas fa-broom" />
              </button>
            )}
            <button
              type="button"
              className="spotlight-notifs-close"
              onClick={onClose}
              aria-label="Close"
            >
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        <div className="spotlight-notifs-list">
          {loading ? (
            <div className="spotlight-notifs-empty">
              <i className="fas fa-spinner fa-spin" />
            </div>
          ) : notifs.length === 0 ? (
            <div className="spotlight-notifs-empty">
              <i className="far fa-bell" />
              <p>No activity yet</p>
              <span>Likes, comments, reechoes and duets show up here.</span>
            </div>
          ) : (
            notifs.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`spotlight-notif-row ${n.read ? 'read' : 'unread'}`}
                onClick={() => {
                  if (n.postId) {
                    onOpenPost?.(n.postId);
                    onClose?.();
                  } else if (n.actorUid) {
                    onOpenProfile?.(n.actorUid);
                    onClose?.();
                  }
                }}
              >
                <div className="spotlight-notif-avatar">
                  {n.actorAvatar ? (
                    <img src={n.actorAvatar} alt="" loading="lazy" />
                  ) : (
                    <span>{(n.actorName || 'U').charAt(0).toUpperCase()}</span>
                  )}
                  <span className={`spotlight-notif-type ${n.type}`}>
                    <i className={`fas ${getIcon(n.type)}`} />
                  </span>
                </div>
                <div className="spotlight-notif-body">
                  <div className="spotlight-notif-text">
                    <strong>{n.actorName || 'Someone'}</strong> {getCopy(n.type)}
                  </div>
                  {n.text && (
                    <div className="spotlight-notif-snippet">"{n.text}"</div>
                  )}
                  <div className="spotlight-notif-time">{timeAgo(n.createdAt)}</div>
                </div>
                {n.postThumb && (
                  <div className="spotlight-notif-thumb">
                    <img src={n.postThumb} alt="" loading="lazy" />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SpotlightNotifications;
