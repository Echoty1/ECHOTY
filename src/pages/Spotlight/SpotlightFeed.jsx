// src/pages/Spotlight/SpotlightFeed.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import Toast from '../../components/Toast/Toast';
import SpotlightPost from './SpotlightPost';
import SpotlightComments from './SpotlightComments';
import SpotlightShare from './SpotlightShare';
import SpotlightOptions from './SpotlightOptions';
import SpotlightNotifications from './SpotlightNotifications';
import SpotlightHashtagSheet from './SpotlightHashtagSheet';
import useSpotlightSEO from '../../hooks/useSpotlightSEO';
import { listenToSpotlightUnreadCount } from '../../services/spotlightNotifications';
import {
  listenToSpotlightFeed,
  rankSpotlightFeed,
  fetchSeenSpotlightIds,
  softDeleteSpotlightPost,
  restoreSpotlightPost,
  hardDeleteSpotlightPost,
  listenToMyEchoing,
} from '../../services/spotlightService';

const PULL_THRESHOLD = 80;
const UNDO_WINDOW_MS = 5000;

const SpotlightFeed = () => {
  const { user } = useAuth();
  const { getProfile, fetchProfile } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

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
  const [notifsOpen, setNotifsOpen] = useState(false);
  const [hashtagSheet, setHashtagSheet] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  // Feed tabs + search
  const [feedTab, setFeedTab] = useState('foryou'); // 'foryou' | 'following'
  const [echoing, setEchoing] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [hasNewAbove, setHasNewAbove] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [showUndoToast, setShowUndoToast] = useState(false);

  const containerRef = useRef(null);
  const videoRefs = useRef({});
  const seenIdsRef = useRef(new Set());
  const rawPostsRef = useRef([]);
  const newestSeenCreatedAtRef = useRef(0);
  const scrollEndTimer = useRef(null);
  const pullStartRef = useRef(null);

  const freshPostId = location.state?.freshPostId || null;
  const focusPostId = params.get('focus');

  useSpotlightSEO(focusPostId);

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

  /* Unread count for bell badge */
  useEffect(() => {
    if (!user?.uid) return () => {};
    return listenToSpotlightUnreadCount(user.uid, setUnreadCount);
  }, [user?.uid]);

  /* Listen to who I'm echoing */
  useEffect(() => {
    if (!user?.uid) return () => {};
    return listenToMyEchoing(user.uid, setEchoing);
  }, [user?.uid]);

  /* Hashtag sheet custom event */
  useEffect(() => {
    const handler = (e) => {
      if (e.detail) setHashtagSheet(e.detail);
    };
    window.addEventListener('spotlight-hashtag-tap', handler);
    return () => window.removeEventListener('spotlight-hashtag-tap', handler);
  }, []);

  /* Recompute visible feed whenever data / tab / search changes */
  const applyFilters = useCallback(() => {
    const raw = rawPostsRef.current || [];
    const pinnedId = freshPostId || focusPostId;
    const seenForRanking = new Set(seenIdsRef.current);
    if (pinnedId) seenForRanking.delete(pinnedId);

    let ranked = rankSpotlightFeed(raw, seenForRanking);

    if (pinnedId) {
      const idx = ranked.findIndex((p) => p.id === pinnedId);
      if (idx > 0) {
        const [target] = ranked.splice(idx, 1);
        ranked = [target, ...ranked];
      }
    }

    // Following tab
    if (feedTab === 'following') {
      const set = new Set(echoing);
      ranked = ranked.filter((p) => set.has(p.uid));
    }

    // Search filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      ranked = ranked.filter((p) => {
        const caption = (p.caption || '').toLowerCase();
        const author = (p.authorName || '').toLowerCase();
        return caption.includes(q) || author.includes(q);
      });
    }

    const newestCreatedAt = ranked.reduce(
      (max, p) => Math.max(max, p.createdAt || 0),
      0
    );

    if (
      newestSeenCreatedAtRef.current > 0 &&
      newestCreatedAt > newestSeenCreatedAtRef.current &&
      containerRef.current &&
      containerRef.current.scrollTop > 40 &&
      feedTab === 'foryou' &&
      !q
    ) {
      setHasNewAbove(true);
    }

    newestSeenCreatedAtRef.current = newestCreatedAt;
    setPosts(ranked);
    setLoading(false);
  }, [feedTab, echoing, searchQuery, freshPostId, focusPostId]);

  /* Real-time feed — keep raw posts cached, apply filters separately */
  useEffect(() => {
    let cancelled = false;
    let unsub = null;

    (async () => {
      const seenSet = user?.uid ? await fetchSeenSpotlightIds(user.uid) : new Set();
      if (cancelled) return;
      seenIdsRef.current = seenSet;

      unsub = listenToSpotlightFeed({ maxCount: 80 }, (rawPosts) => {
        if (cancelled) return;
        rawPostsRef.current = rawPosts;
        applyFilters();
      });
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /* Reapply filters when tab / search / echoing change */
  useEffect(() => {
    if (rawPostsRef.current.length > 0) applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    if (!freshPostId) return;
    setActiveIndex(0);
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = 0;
    });
    const t = setTimeout(() => {
      navigate(location.pathname, { replace: true, state: null });
    }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freshPostId]);

  /* Active slide detection */
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
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1.0] }
    );
    const slides = container.querySelectorAll('.spotlight-slide');
    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [posts.length]);

  /* Scroll-end + pull-to-refresh */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = setTimeout(() => {
        const h = container.clientHeight || 1;
        const top = container.scrollTop;
        setActiveIndex(Math.round(top / h));
        if (top < 40) setHasNewAbove(false);
      }, 90);
    };
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
      if (!shouldRefresh) { setPullY(0); return; }
      setRefreshing(true);
      try {
        const seenSet = user?.uid ? await fetchSeenSpotlightIds(user.uid) : new Set();
        seenIdsRef.current = seenSet;
        applyFilters();
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
  }, [user?.uid, pullY, applyFilters]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCommentsFor(null);
        setShareFor(null);
        setOptionsFor(null);
        setNotifsOpen(false);
        setHashtagSheet(null);
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleRegisterVideo = useCallback((postId, el) => {
    if (el) videoRefs.current[postId] = el;
    else delete videoRefs.current[postId];
  }, []);

  const handleOpenProfile = (uid) => navigate(`/spotlight/user/${uid}`);
  const handleOpenOptions = useCallback((post) => setOptionsFor(post), []);

  const handleConfirmDelete = useCallback(async (post) => {
    if (!post || !user?.uid) return;
    try {
      await softDeleteSpotlightPost(post.id);
    } catch (err) {
      setToast({ message: 'Could not delete', type: 'error' });
      setTimeout(() => setToast(null), 2200);
      return;
    }
    rawPostsRef.current = rawPostsRef.current.filter((p) => p.id !== post.id);
    applyFilters();
    setShowUndoToast(true);

    const timerId = setTimeout(async () => {
      try { await hardDeleteSpotlightPost(post.id, user.uid); } catch (_) {}
      setPendingDelete(null);
      setShowUndoToast(false);
    }, UNDO_WINDOW_MS);

    setPendingDelete({ post, timerId });
  }, [user?.uid, applyFilters]);

  const handleUndoDelete = useCallback(async () => {
    if (!pendingDelete) return;
    clearTimeout(pendingDelete.timerId);
    try {
      await restoreSpotlightPost(pendingDelete.post.id);
      setToast({ message: 'Restored', type: 'success' });
      setTimeout(() => setToast(null), 1500);
    } catch (_) {}
    setPendingDelete(null);
    setShowUndoToast(false);
  }, [pendingDelete]);

  const jumpToTop = () => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    setHasNewAbove(false);
  };

  const switchTab = (tab) => {
    if (tab === feedTab) return;
    setFeedTab(tab);
    setActiveIndex(0);
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = 0;
    });
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
            onClick={() => setNotifsOpen(true)}
            aria-label="Activity"
            title="Activity"
          >
            <i className="far fa-bell" />
            {unreadCount > 0 && (
              <span className="spotlight-top-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

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

      {/* Feed tabs */}
      <div className="spotlight-feed-tabs">
        <button
          type="button"
          className={`spotlight-feed-tab ${feedTab === 'foryou' ? 'active' : ''}`}
          onClick={() => switchTab('foryou')}
        >
          For You
        </button>
        <button
          type="button"
          className={`spotlight-feed-tab ${feedTab === 'following' ? 'active' : ''}`}
          onClick={() => switchTab('following')}
        >
          Following
        </button>
        <button
          type="button"
          className={`spotlight-feed-tab search ${searchOpen ? 'active' : ''}`}
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Search"
        >
          <i className="fas fa-search" />
        </button>
      </div>

      {searchOpen && (
        <div className="spotlight-feed-search">
          <input
            type="text"
            placeholder="Search captions or @users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear">
              <i className="fas fa-times" />
            </button>
          )}
        </div>
      )}

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
            <i className={feedTab === 'following' ? 'fas fa-user-plus' : 'fas fa-video'} />
            <h2>
              {feedTab === 'following'
                ? 'Nothing from people you Echo yet'
                : searchQuery
                  ? 'No matching posts'
                  : 'No Spotlights yet'}
            </h2>
            <p>
              {feedTab === 'following'
                ? 'Echo creators you like and their posts show up here.'
                : searchQuery
                  ? 'Try a different search term.'
                  : 'Be the first to post a video or image.'}
            </p>
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
                currentProfile={myProfile}
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

      {hasNewAbove && (
        <button type="button" className="spotlight-new-pill" onClick={jumpToTop}>
          <i className="fas fa-arrow-up" /> New Spotlight
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
        onConfirmDelete={handleConfirmDelete}
      />

      <SpotlightNotifications
        isOpen={notifsOpen}
        uid={user?.uid}
        onClose={() => setNotifsOpen(false)}
        onOpenPost={(id) => navigate(`/spotlight?focus=${id}`)}
        onOpenProfile={(uid) => navigate(`/spotlight/user/${uid}`)}
      />

      <SpotlightHashtagSheet
        isOpen={!!hashtagSheet}
        tag={hashtagSheet}
        onClose={() => setHashtagSheet(null)}
        onPickPost={(id) => navigate(`/spotlight?focus=${id}`)}
      />

      {showUndoToast && (
        <div className="spotlight-undo-toast">
          <span>Deleted</span>
          <button type="button" onClick={handleUndoDelete}>Undo</button>
        </div>
      )}

      {toast && !showUndoToast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default SpotlightFeed;
