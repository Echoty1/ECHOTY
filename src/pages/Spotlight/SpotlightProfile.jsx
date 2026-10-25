// src/pages/Spotlight/SpotlightProfile.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import Toast from '../../components/Toast/Toast';
import AccountSwitcher from '../../components/common/AccountSwitcher';
import {
  listenToUserSpotlightPosts,
  listenToUserReechoedPosts,
  listenToEchoAuthor,
  toggleEchoAuthor,
  fetchEchoersCount,
} from '../../services/spotlightService';

const fmt = (n) => {
  const v = Number(n) || 0;
  if (v < 1000) return String(v);
  if (v < 1000000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `${(v / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
};

const SpotlightProfile = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user, getSavedAccounts, switchAccount, signOutAll } = useAuth();

  const [tab, setTab] = useState('posts');
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [reechoed, setReechoed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [echoed, setEchoed] = useState(false);
  const [echoersCount, setEchoersCount] = useState(0);
  const [echoingCount, setEchoingCount] = useState(0);
  const [previewPost, setPreviewPost] = useState(null);
  const [toast, setToast] = useState(null);
  
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState([]);

  const isMe = user?.uid === uid;

  useEffect(() => {
    if (isMe) {
      setSavedAccounts(getSavedAccounts());
    }
  }, [isMe, getSavedAccounts, showSwitcher]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await get(ref(db, `profiles/${uid}`));
        if (!cancelled && snap.exists()) setProfile(snap.val());
      } catch (_) {}
      const cnt = await fetchEchoersCount(uid);
      if (!cancelled) setEchoersCount(cnt);

      try {
        const echoSnap = await get(ref(db, `spotlight/echoes/${uid}`));
        if (!cancelled) {
          setEchoingCount(echoSnap.exists() ? Object.keys(echoSnap.val()).length : 0);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [uid]);

  useEffect(() => {
    if (!uid) return () => {};
    setLoading(true);
    const unsub = listenToUserSpotlightPosts(uid, (list) => {
      setPosts(list);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid) return () => {};
    const unsub = listenToUserReechoedPosts(uid, setReechoed);
    return () => unsub && unsub();
  }, [uid]);

  useEffect(() => {
    if (!uid || !user?.uid || isMe) return () => {};
    const unsub = listenToEchoAuthor(uid, user.uid, setEchoed);
    return () => unsub && unsub();
  }, [uid, user?.uid, isMe]);

  const handleEcho = async () => {
    if (isMe) return;
    try {
      const next = await toggleEchoAuthor(uid, user.uid);
      const cnt = await fetchEchoersCount(uid);
      setEchoersCount(cnt);
      setToast({ message: next ? 'Echoed this creator 🎙️' : 'Stopped echoing', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (_) {
      setToast({ message: 'Something went wrong', type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const openOwnSpotlight = () => {
    navigate('/spotlight');
  };

  const handleSwitchAccount = async (account) => {
    try {
      await switchAccount(account);
    } catch (err) {
      setToast({ message: err.message, type: 'error' });
      setTimeout(() => setToast(null), 2000);
    }
  };

  const handleAddAccount = () => {
    setShowSwitcher(false);
    window.location.href = '/login';
  };

  const handleSignOutAll = async () => {
    if (window.confirm("Sign out of all accounts?")) {
      await signOutAll();
      window.location.href = '/login';
    }
  };

  const name = profile?.name || 'User';
  const avatar = profile?.avatar || '';

  const renderGrid = (list, emptyLabel) => {
    if (loading && tab === 'posts') {
      return (
        <div className="spotlight-profile-empty">
          <div className="spotlight-feed-spinner" />
          <p>Loading…</p>
        </div>
      );
    }
    if (!list || list.length === 0) {
      return (
        <div className="spotlight-profile-empty">
          <i className="fas fa-video" />
          <p>{emptyLabel}</p>
        </div>
      );
    }
    return (
      <div className="spotlight-profile-grid">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            className="spotlight-profile-tile"
            onClick={() => setPreviewPost(p)}
          >
            {p.mediaType === 'video' ? (
              <>
                <video
                  src={p.mediaUrl}
                  muted
                  playsInline
                  preload="metadata"
                  poster={p.posterUrl || ''}
                />
                <span className="spotlight-profile-tile-play">
                  <i className="fas fa-play" />
                </span>
              </>
            ) : (
              <img src={p.mediaUrl} alt="" loading="lazy" />
            )}
            <span className="spotlight-profile-tile-stat">
              <i className="fas fa-heart" /> {fmt(p.likeCount)}
            </span>
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="spotlight-profile-page">
      <div className="spotlight-profile-topbar">
        <button
          type="button"
          className="spotlight-profile-back"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <i className="fas fa-arrow-left" />
        </button>
        <h1 className="spotlight-profile-handle">
          @{name.replace(/\s+/g, '').toLowerCase()}
        </h1>
        <div style={{ width: 40 }} />
      </div>

      <div className="spotlight-profile-header">
        <div className="spotlight-profile-avatar">
          {avatar ? (
            <img src={avatar} alt="" />
          ) : (
            <span>{name.charAt(0).toUpperCase()}</span>
          )}
        </div>

        <div className="spotlight-profile-info">
          <div className="spotlight-profile-name">{name}</div>
          {profile?.bio && <div className="spotlight-profile-bio">{profile.bio}</div>}

          <div className="spotlight-profile-stats">
            <div className="spotlight-profile-stat">
              <strong>{fmt(posts.length)}</strong>
              <span>Posts</span>
            </div>
            <div className="spotlight-profile-stat">
              <strong>{fmt(reechoed.length)}</strong>
              <span>Reechoed</span>
            </div>
            <div className="spotlight-profile-stat">
              <strong>{fmt(echoingCount)}</strong>
              <span>Echoing</span>
            </div>
            <div className="spotlight-profile-stat">
              <strong>{fmt(echoersCount)}</strong>
              <span>Echoers</span>
            </div>
          </div>

          {isMe ? (
            <div className="spotlight-profile-actions">
              <button
                type="button"
                className="spotlight-profile-echo-btn"
                onClick={openOwnSpotlight}
              >
                <i className="fas fa-bolt" /> Open Spotlight
              </button>
              <button
                type="button"
                className="spotlight-profile-echo-btn secondary"
                onClick={() => setShowSwitcher(true)}
                style={{ marginLeft: 8, background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <i className="fas fa-users" /> Switch Account
              </button>
            </div>
          ) : (
            <div className="spotlight-profile-actions">
              <button
                type="button"
                className={`spotlight-profile-echo-btn ${echoed ? 'echoed' : ''}`}
                onClick={handleEcho}
              >
                {echoed ? (
                  <>
                    <i className="fas fa-check" /> Echoed
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus" /> Echo
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="spotlight-profile-tabs">
        <button
          type="button"
          className={`spotlight-profile-tab ${tab === 'posts' ? 'active' : ''}`}
          onClick={() => setTab('posts')}
        >
          <i className="fas fa-th" /> Posts
        </button>
        <button
          type="button"
          className={`spotlight-profile-tab ${tab === 'reechoed' ? 'active' : ''}`}
          onClick={() => setTab('reechoed')}
        >
          <i className="fas fa-retweet" /> Reechoed
        </button>
      </div>

      <div className="spotlight-profile-content">
        {tab === 'posts' && renderGrid(posts, isMe ? 'You haven\u2019t posted yet' : 'No posts yet')}
        {tab === 'reechoed' && renderGrid(reechoed, 'No Reechoed posts yet')}
      </div>

      {previewPost && (
        <div
          className="spotlight-profile-preview-backdrop"
          onClick={() => setPreviewPost(null)}
        >
          <div
            className="spotlight-profile-preview"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="spotlight-profile-preview-close"
              onClick={() => setPreviewPost(null)}
              aria-label="Close"
            >
              <i className="fas fa-times" />
            </button>
            {previewPost.mediaType === 'video' ? (
              <video
                src={previewPost.mediaUrl}
                className="spotlight-profile-preview-media"
                controls
                autoPlay
                loop
                playsInline
                muted
              />
            ) : (
              <img
                src={previewPost.mediaUrl}
                alt=""
                className="spotlight-profile-preview-media"
              />
            )}
            {previewPost.caption && (
              <div className="spotlight-profile-preview-caption">{previewPost.caption}</div>
            )}
            <button
              type="button"
              className="spotlight-profile-preview-open"
              onClick={() => {
                setPreviewPost(null);
                navigate(`/spotlight?focus=${previewPost.id}`);
              }}
            >
              Open in feed →
            </button>
          </div>
        </div>
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      {/* Account Switcher */}
      <AccountSwitcher
        isOpen={showSwitcher}
        onClose={() => setShowSwitcher(false)}
        currentUser={{
          name: name,
          email: user?.email || 'user@echoty.xyz',
          avatar: avatar,
        }}
        savedAccounts={savedAccounts}
        onSwitchAccount={handleSwitchAccount}
        onAddAccount={handleAddAccount}
        onSignOutAll={handleSignOutAll}
      />
    </div>
  );
};

export default SpotlightProfile;
