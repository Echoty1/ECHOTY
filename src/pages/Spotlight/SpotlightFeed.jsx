// src/pages/Spotlight/SpotlightFeed.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import Toast from '../../components/Toast/Toast';
import SpotlightPost from './SpotlightPost';
import SpotlightComments from './SpotlightComments';
import SpotlightShare from './SpotlightShare';
import SpotlightOptions from './SpotlightOptions';
import {
  listenToSpotlightFeed,
  rankSpotlightFeed,
  fetchSeenSpotlightIds,
  deleteSpotlightPost,
} from '../../services/spotlightService';

const PULL_THRESHOLD = 80;

const SpotlightFeed = () => {
  const { user } = useAuth();
  const { getProfile, fetchProfile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();

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

  // Pull-to-refresh
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // "New Spotlight ↑" pill
  const [hasNewAbove, setHasNewAbove] = useState(false);

  const containerRef = useRef(null);
  const videoRefs = useRef({});
  const seenIdsRef = useRef(new Set());
  const newestSeenCreatedAtRef = useRef(0);
  const scrollEndTimer = useRef(null);
  const pullStartRef = useRef(null);

  const freshPostId = location.state?.freshPostId || null;

  /* Mute pref persistence */
  useEffect(() => {
    try {
      localStorage.setItem('echo_spotlight_muted', muted ? '1' : '0');
    } catch (_) {}
  }, [muted]);

  /* My profile for comments */
  useEffect(() => {
    if (!user?.uid) return;
    const cached = getProfile(user.uid);
    if (cached) setMyProfile(cached);
    else fetchProfile(user.uid);
  }, [user?.uid, getProfile, fetchProfile]);

  /* ─── Real-time feed ──────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    let unsub = null;

    (async () => {
      // Fetch seen IDs once (for ranking)
      const seenSet = user?.uid ? await fetchSeenSpotlightIds(user.uid) : new Set();
      if (cancelled) return;
      seenIdsRef.current = seenSet;

      unsub = listenToSpotlightFeed({ maxCount: 80 }, (rawPosts) => {
        if (cancelled) return;

        // Fresh post should never be seen-penalized
        const seenForRanking = new Set(seenIdsRef.current);
        if (freshPostId) seenForRanking.delete(freshPostId);

        let ranked = rankSpotlightFeed(rawPosts, seenForRanking);

        // Pin fresh post to top
        if (freshPostId) {
          const idx = ranked.findIndex((p) => p.id === freshPostId);
          if (idx > 0) {
            const [target] = ranked.splice(idx, 1);
            ranked = [target, ...ranked];
          }
        }

        // Detect brand-new posts arriving from other users
        const newestCreatedAt = ranked.reduce(
          (max, p) => Math.max(max, p.createdAt || 0),
          0
        );

        // Only show the "new above" pill if:
        // - we already had posts (so this isn't the initial load)
        // - the newest post is newer than the newest we've shown
        // - the user isn't at the top of the feed
        if (
          newestSeenCreatedAtRef.current > 0 &&
          newestCreatedAt > newestSeenCreatedAtRef.current &&
          containerRef.current &&
          containerRef.current.scrollTop > 40
        ) {
          setHasNewAbove(true);
        }

        newestSeenCreatedAtRef.current = newestCreatedAt;
        setPosts(ranked);
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [user?.uid, freshPostId]);

  /* Scroll to top on fresh post */
  useEffect(() => {
    if (!freshPostId) return;
    setActiveIndex(0);
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = 0;
    });
    // Clear router state so refresh doesn't re-pin
    const t = setTimeout(() => {
      navigate(location.pathname, { replace: true, state: null });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshPostId]);

  /* ─── Active slide detection ─────────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container || posts.length === 0) return;

    const ratios = new Map();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const idx = Number(e.target.getAttribute('data-index'));
          if (Number.isNaN(idx)) return;
          ratios.set(idx, e.isIntersecting ? e.intersectionRatio : 0);
        });

        let bestIdx = 0;
        let bestRatio = 0;
        ratios.forEach((r, i) => {
          if (r > bestRatio) {
            bestRatio = r;
            bestIdx = i;
          }
        });
        if (bestRatio > 0.4) setActiveIndex(bestIdx);
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      }
    );

    const slides = container.querySelectorAll('.spotlight-slide');
    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [posts.length]);

  /* Scroll-end fallback + pull-to-refresh + clear "new above" */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = setTimeout(() => {
        const h = container.clientHeight || 1;
        const top = container.scrollTop;
        const idx = Math.round(top / h);
        setActiveIndex(idx);
        if (top < 40) setHasNewAbove(false);
      }, 90);
    };

    // ── Pull-to-refresh (touch only) ─────────────────────────
    const onTouchStart = (e) => {
      if (container.scrollTop > 0) return;
      pullStartRef.current = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (pullStartRef.current == null) return;
      if (container.scrollTop > 0) {
        pullStartRef.current = null;
        setPullY(0);
        return;
      }
      const dy = e.touches[0].clientY - pullStartRef.current;
      if (dy > 0) setPullY(Math.min(dy * 0.5, PULL_THRESHOLD * 1.4));
    };
    const onTouchEnd = async () => {
      if (pullStartRef.current == null) return;
      const shouldRefresh = pullY > PULL_THRESHOLD;
      pullStartRef.current = null;
      if (!shouldRefresh) {
        setPullY(0);
        return;
      }
      // Trigger refresh: re-fetch seen IDs, re-sort. Realtime listener
      // will deliver the newest posts.
      setRefreshing(true);
      try {
        const seenSet = user?.uid ? await fetchSeenSpotlightIds(user.uid) : new Set();
        seenIdsRef.current = seenSet;
      } catch (_) {}
      setPullY(0);
      setTimeout(() => {
        setRefreshing(false);
        container.scrollTo({ top: 0, behavior: 'smooth' });
      }, 600);
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd);
    return () => {
      container.removeEventListener('scroll', onScroll);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    };
  }, [user?.uid, pullY]);

  /* Escape closes any sheet */
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
      // Realtime listener will deliver the removal automatically
      setToast({ message: 'Spotlight deleted', type: 'success' });
      setTimeout(() => setToast(null), 2200);
    } catch (err) {
      console.warn('Delete failed:', err);
      setToast({ message: 'Could not delete', type: 'error' });
      setTimeout(() => setToast(null), 2200);
    }
  }, [user?.uid]);

  const jumpToTop = () => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    setHasNewAbove(false);
  };

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

      {/* Pull-to-refresh indicator */}
      {(pullY > 0 || refreshing) && (
        <div
          className="spotlight-pull-indicator"
          style={{ transform: `translateY(${refreshing ? 60 : pullY}px)` }}
        >
          <i className={refreshing ? 'fas fa-spinner fa-spin' : 'fas fa-arrow-down'} />
          <span>{refreshing ? 'Refreshing…' : pullY > PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}</span>
        </div>
      )}

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

      {/* "New Spotlight ↑" pill */}
      {hasNewAbove && (
        <button
          type="button"
          className="spotlight-new-pill"
          onClick={jumpToTop}
        >
          <i className="fas fa-arrow-up" />
          New Spotlight
        </button>
      )}

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
