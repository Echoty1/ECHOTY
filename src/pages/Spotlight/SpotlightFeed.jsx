// src/pages/Spotlight/SpotlightFeed.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import Toast from '../../components/Toast/Toast';
import SpotlightPost from './SpotlightPost';
import SpotlightComments from './SpotlightComments';
import SpotlightShare from './SpotlightShare';
import SpotlightOptions from './SpotlightOptions';
import {
  fetchSpotlightFeed,
  rankSpotlightFeed,
  fetchSeenSpotlightIds,
  deleteSpotlightPost,
} from '../../services/spotlightService';

const SpotlightFeed = () => {
  const { user } = useAuth();
  const { getProfile, fetchProfile } = useProfile();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(() => {
    try {
      const saved = localStorage.getItem('echo_spotlight_muted');
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });
  const [commentsFor, setCommentsFor] = useState(null);
  const [shareFor, setShareFor] = useState(null);
  const [optionsFor, setOptionsFor] = useState(null);
  const [toast, setToast] = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  const containerRef = useRef(null);
  const videoRefs = useRef({});
  const focusPostId = params.get('focus');

  useEffect(() => {
    try {
      localStorage.setItem('echo_spotlight_muted', muted ? '1' : '0');
    } catch (_) {}
  }, [muted]);

  useEffect(() => {
    if (!user?.uid) return;
    const cached = getProfile(user.uid);
    if (cached) setMyProfile(cached);
    else fetchProfile(user.uid);
  }, [user?.uid, getProfile, fetchProfile]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const [all, seenSet] = await Promise.all([
        fetchSpotlightFeed({ maxCount: 80 }),
        user?.uid ? fetchSeenSpotlightIds(user.uid) : Promise.resolve(new Set()),
      ]);

      // Never apply the "seen" penalty to the focused post — a
      // freshly-uploaded post should always rank first for its author.
      const seenForRanking = new Set(seenSet);
      if (focusPostId) seenForRanking.delete(focusPostId);

      let ranked = rankSpotlightFeed(all, seenForRanking);

      // If arriving with ?focus=ID, force that post to the very top.
      if (focusPostId) {
        const idx = ranked.findIndex((p) => p.id === focusPostId);
        if (idx > 0) {
          const [target] = ranked.splice(idx, 1);
          ranked = [target, ...ranked];
        } else if (idx === -1) {
          // Post not in the ranked list — pull it fresh from the DB
          // so the author still sees what they just posted.
          try {
            const { ref, get } = await import('firebase/database');
            const { db } = await import('../../services/firebase');
            const snap = await get(ref(db, `spotlight/posts/${focusPostId}`));
            if (snap.exists()) {
              ranked = [{ id: focusPostId, ...snap.val() }, ...ranked];
            }
          } catch (_) {}
        }
      }

      setPosts(ranked);
      setActiveIndex(0);
      requestAnimationFrame(() => {
        const el = containerRef.current;
        if (el) el.scrollTop = 0;
      });
    } catch (err) {
      console.error('Spotlight feed load failed:', err);
      setToast({ message: 'Could not load Spotlight', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [focusPostId, user?.uid]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Strip ?focus=ID from the URL after a couple of seconds so refreshing
  // the page doesn't keep pinning the same post to the top.
  useEffect(() => {
    if (!focusPostId) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      next.delete('focus');
      setParams(next, { replace: true });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusPostId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || posts.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number(e.target.getAttribute('data-index'));
            if (!Number.isNaN(idx)) setActiveIndex(idx);
          }
        });
      },
      { root: container, threshold: [0.6, 0.9] }
    );

    const slides = container.querySelectorAll('.spotlight-slide');
    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [posts.length]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCommentsFor(null);
        setShareFor(null);
        setOptionsFor(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleRegisterVideo = useCallback((postId, el) => {
    if (el) videoRefs.current[postId] = el;
    else delete videoRefs.current[postId];
  }, []);

  const handleOpenProfile = (uid) => {
    navigate(`/spotlight/user/${uid}`);
  };

  const handleOpenOptions = useCallback((post) => {
    setOptionsFor(post);
  }, []);

  const handleDeletePost = useCallback(async (post) => {
    if (!post || !user?.uid) return;
    try {
      await deleteSpotlightPost(user.uid, post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setToast({ message: 'Spotlight deleted', type: 'success' });
      setTimeout(() => setToast(null), 2200);
    } catch (err) {
      console.warn('Delete failed:', err);
      setToast({ message: 'Could not delete', type: 'error' });
      setTimeout(() => setToast(null), 2200);
    }
  }, [user?.uid]);

  return (
    <div className="spotlight-feed-page">
      <div className="spotlight-top-bar">
        <h1 className="spotlight-top-title">
          <span className="spotlight-top-title-tick" />
          Spotlight
        </h1>

        <div className="spotlight-top-actions">
          <button
            type="button"
            className="spotlight-top-btn"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Unmute' : 'Mute'}
            title={muted ? 'Unmute' : 'Mute'}
          >
            <i className={muted ? 'fas fa-volume-mute' : 'fas fa-volume-up'} />
          </button>
          <button
            type="button"
            className="spotlight-top-btn primary"
            onClick={() => navigate('/spotlight/upload')}
            aria-label="Upload"
            title="Upload"
          >
            <i className="fas fa-plus" />
          </button>
        </div>
      </div>

      <div className="spotlight-feed-container" ref={containerRef}>
        {loading ? (
          <div className="spotlight-feed-loading">
            <div className="spotlight-feed-spinner" />
            <p>Loading Spotlight…</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="spotlight-feed-empty">
            <i className="fas fa-video" />
            <h2>No Spotlights yet</h2>
            <p>Be the first to post a video or image.</p>
            <button
              type="button"
              className="spotlight-empty-cta"
              onClick={() => navigate('/spotlight/upload')}
            >
              <i className="fas fa-plus" /> Create Spotlight
            </button>
          </div>
        ) : (
          posts.map((post, i) => (
            <div key={post.id} className="spotlight-slide" data-index={i}>
              <SpotlightPost
                post={post}
                isActive={i === activeIndex}
                currentUser={user}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                onOpenComments={(p) => setCommentsFor(p)}
                onOpenShare={(p) => setShareFor(p)}
                onOpenOptions={handleOpenOptions}
                onOpenProfile={handleOpenProfile}
                onRegisterVideo={handleRegisterVideo}
              />
            </div>
          ))
        )}
      </div>

      {posts.length > 1 && (
        <div className="spotlight-feed-counter" aria-hidden="true">
          <span>{activeIndex + 1}</span>
          <span className="spotlight-feed-counter-sep">/</span>
          <span>{posts.length}</span>
        </div>
      )}

      <button
        type="button"
        className="spotlight-fab-create"
        onClick={() => navigate('/spotlight/upload')}
        aria-label="Create Spotlight"
        title="Create Spotlight"
      >
        <i className="fas fa-plus" />
      </button>

      <SpotlightComments
        isOpen={!!commentsFor}
        post={commentsFor}
        currentUser={user}
        currentProfile={myProfile}
        onClose={() => setCommentsFor(null)}
      />

      <SpotlightShare
        isOpen={!!shareFor}
        post={shareFor}
        currentUser={user}
        onClose={() => setShareFor(null)}
        onToast={setToast}
      />

      <SpotlightOptions
        isOpen={!!optionsFor}
        post={optionsFor}
        currentUser={user}
        onClose={() => setOptionsFor(null)}
        onToast={setToast}
        onDeleted={handleDeletePost}
      />

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default SpotlightFeed;
