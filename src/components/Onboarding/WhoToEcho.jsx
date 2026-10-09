// src/components/Onboarding/WhoToEcho.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Avatar from '../common/Avatar';
import Toast from '../Toast/Toast';
import { hapticLight, hapticSuccess, hapticError } from '../../utils/haptics';
import { getSuggestedUsers } from '../../services/suggestedUsersService';
import { followUser, unfollowUser } from '../../services/echowerService';
import './WhoToEcho.css';

const WhoToEcho = ({ onContinue, onSkip }) => {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followedIds, setFollowedIds] = useState(() => new Set());
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2200);
  };

  // Load suggestions once
  useEffect(() => {
    let cancelled = false;
    if (!user?.uid) return;
    setLoading(true);
    getSuggestedUsers(user.uid, 20)
      .then((list) => {
        if (!cancelled) setUsers(list || []);
      })
      .catch((err) => {
        console.warn('suggested users failed', err);
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.uid]);

  const handleToggleFollow = useCallback(async (targetUid) => {
    if (!user?.uid || !targetUid) return;
    if (pendingIds.has(targetUid)) return;

    hapticLight();
    setPendingIds((prev) => {
      const next = new Set(prev);
      next.add(targetUid);
      return next;
    });

    const already = followedIds.has(targetUid);
    try {
      if (already) {
        await unfollowUser(user.uid, targetUid);
        setFollowedIds((prev) => {
          const next = new Set(prev);
          next.delete(targetUid);
          return next;
        });
      } else {
        await followUser(user.uid, targetUid);
        hapticSuccess();
        setFollowedIds((prev) => new Set(prev).add(targetUid));
      }
    } catch (err) {
      console.warn('follow toggle failed', err);
      hapticError();
      showToast('Could not update follow', 'error');
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUid);
        return next;
      });
    }
  }, [user?.uid, followedIds, pendingIds]);

  const handleContinue = () => {
    hapticSuccess();
    onContinue?.(Array.from(followedIds));
  };

  const handleSkip = () => {
    hapticLight();
    onSkip?.();
  };

  return (
    <div className="wte-page">
      <div className="wte-header">
        <h1 className="wte-title">Who to Echo</h1>
        <p className="wte-subtitle">
          Follow creators and friends to fill your feed.
        </p>
      </div>

      <div className="wte-list">
        {loading ? (
          <>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="wte-skeleton-row">
                <div className="wte-skeleton-avatar" />
                <div className="wte-skeleton-lines">
                  <div className="wte-skeleton-line w60" />
                  <div className="wte-skeleton-line w40" />
                </div>
                <div className="wte-skeleton-btn" />
              </div>
            ))}
          </>
        ) : users.length === 0 ? (
          <div className="wte-empty">
            <div className="wte-empty-icon">🫧</div>
            <p>No suggestions yet</p>
            <span>You can find people from the search tab anytime.</span>
          </div>
        ) : (
          users.map((u) => {
            const isFollowed = followedIds.has(u.uid);
            const isPending = pendingIds.has(u.uid);
            return (
              <div key={u.uid} className="wte-row">
                <div className="wte-avatar-wrap">
                  <Avatar src={u.avatar} name={u.name} size={48} />
                  {u.isVerified && (
                    <span className="wte-verified" title="Verified">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path
                          d="M12 1.5 14.4 4l3.3-.4.9 3.2 2.9 1.6-1.3 3.1 1.3 3.1-2.9 1.6-.9 3.2-3.3-.4L12 22.5 9.6 20l-3.3.4-.9-3.2-2.9-1.6L3.8 12.5 2.5 9.4l2.9-1.6.9-3.2L9.6 4 12 1.5zm-1.2 13.8 5.5-5.5-1.4-1.4-4.1 4.1-2-2-1.4 1.4 3.4 3.4z"
                          fill="currentColor"
                        />
                      </svg>
                    </span>
                  )}
                </div>

                <div className="wte-info">
                  <div className="wte-name-row">
                    <span className="wte-name">{u.name}</span>
                    {u.isCreator && <span className="wte-badge">Creator</span>}
                  </div>
                  {u.username && (
                    <span className="wte-handle">@{u.username}</span>
                  )}
                  {u.bio && <span className="wte-bio">{u.bio}</span>}
                </div>

                <button
                  type="button"
                  className={`wte-follow-btn ${isFollowed ? 'followed' : ''} ${isPending ? 'pending' : ''}`}
                  onClick={() => handleToggleFollow(u.uid)}
                  disabled={isPending}
                  aria-pressed={isFollowed}
                >
                  {isPending ? (
                    <span className="wte-spinner" />
                  ) : isFollowed ? (
                    'Following'
                  ) : (
                    'Follow'
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="wte-footer">
        <button type="button" className="wte-skip-btn" onClick={handleSkip}>
          Skip for now
        </button>
        <button
          type="button"
          className="wte-continue-btn"
          onClick={handleContinue}
          disabled={loading}
        >
          {followedIds.size > 0
            ? `Continue (${followedIds.size} followed)`
            : 'Continue'}
        </button>
      </div>

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default WhoToEcho;
