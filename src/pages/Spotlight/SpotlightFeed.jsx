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
  rankFreshFeed,
  rotateArray,
  getOrCreateSessionSeed,
  fetchSeenSpotlightIds,
  softDeleteSpotlightPost,
  restoreSpotlightPost,
  hardDeleteSpotlightPost,
  listenToMyEchoing,
  searchAuthorsAndHashtags,
  fetchTrendingHashtags,
  fetchPostsByAuthor,
  fetchPostsByHashtag,
} from '../../services/spotlightService';

const PULL_THRESHOLD = 80;
const UNDO_WINDOW_MS = 5000;
const RECENT_SEARCHES_KEY = 'echo_spotlight_recent_searches';
const MAX_RECENT_SEARCHES = 8;

const loadRecentSearches = () => {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string').slice(0, MAX_RECENT_SEARCHES) : [];
  } catch (_) {
    return [];
  }
};

const saveRecentSearches = (list) => {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES)));
  } catch (_) {}
};

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
    } catch { return true; }
  });
  const [autoAdvance, setAutoAdvance] = useState(() => {
    try {
      const saved = localStorage.getItem('echo_spotlight_auto_advance');
      return saved === null ? false : saved === '1';
    } catch { return false; }
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
  const [feedTab, setFeedTab] = useState('foryou');
  const [echoing, setEchoing] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches());
  const [searchSuggestions, setSearchSuggestions] = useState({ authors: [], hashtags: [] });
  const [trendingTags, setTrendingTags] = useState([]);
  // Extra state to allow search-by-author / search-by-hashtag to filter the feed
  const [authorFilter, setAuthorFilter] = useState(null); // { uid, name }
  const [hashtagFilter, setHashtagFilter] = useState(null); // tag string

  const [rotationSeed] = useState(() => getOrCreateSessionSeed(true));
  const [rotationOffset, setRotationOffset] = useState(0);

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
  const authorFilterPostsRef = useRef(null);
  const hashtagFilterPostsRef = useRef(null);

  const freshPostId = location.state?.freshPostId || null;
  const focusPostId = params.get('focus');

  useSpotlightSEO(focusPostId);

  useEffect(() => {
    try { localStorage.setItem('echo_spotlight_muted', muted ? '1' : '0'); } catch (_) {}
  }, [muted]);

  useEffect(() => {
    try { localStorage.setItem('echo_spotlight_auto_advance', autoAdvance ? '1' : '0'); } catch (_) {}
  }, [autoAdvance]);

  useEffect(() => {
    if (!user?.uid) return;
    const cached = getProfile(user.uid);
    if (cached) setMyProfile(cached);
    else fetchProfile(user.uid);
  }, [user?.uid, getProfile, fetchProfile]);

  useEffect(() => {
    if (!user?.uid) return () => {};
    return listenToSpotlightUnreadCount(user.uid, setUnreadCount);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return () => {};
    return listenToMyEchoing(user.uid, setEchoing);
  }, [user?.uid]);

  /* Load trending hashtags when search opens */
  useEffect(() => {
    if (!searchOpen) return;
    let cancelled = false;
    fetchTrendingHashtags({ maxCount: 10 }).then((rows) => {
      if (!cancelled) setTrendingTags(rows);
    });
    return () => { cancelled = true; };
  }, [searchOpen]);

  /* Debounced suggestions when user types */
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 1) {
      setSearchSuggestions({ authors: [], hashtags: [] });
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      searchAuthorsAndHashtags(q, { maxCount: 6 }).then((res) => {
        if (!cancelled) setSearchSuggestions(res);
      });
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQuery, searchOpen]);

  /* Hashtag sheet custom event */
  useEffect(() => {
    const handler = (e) => {
      if (e.detail) setHashtagSheet(e.detail);
    };
    window.addEventListener('spotlight-hashtag-tap', handler);
    return () => window.removeEventListener('spotlight-hashtag-tap', handler);
  }, []);

  /* ─── Auto-advance: scroll to next slide ─────────────────── */
  const scrollToNextPost = useCallback((endedPostId) => {
    if (!autoAdvance) return;
    const container = containerRef.current;
    if (!container) return;
    const currentIdx = posts.findIndex((p) => p.id === endedPostId);
    if (currentIdx < 0) return;
    const nextIdx = currentIdx + 1;
    if (nextIdx >= posts.length) {
      // Wrap to top
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const h = container.clientHeight || 1;
    container.scrollTo({ top: nextIdx * h, behavior: 'smooth' });
  }, [autoAdvance, posts]);

  /* ─── Feed filter pipeline ───────────────────────────────── */
  const applyFilters = useCallback(() => {
    // If we're in a filtered view (author/hashtag), use the pre-loaded list
    let raw;
    if (authorFilter) {
      raw = authorFilterPostsRef.current || [];
    } else if (hashtagFilter) {
      raw = hashtagFilterPostsRef.current || [];
    } else {
      raw = rawPostsRef.current || [];
    }

    const pinnedId = freshPostId || focusPostId;
    const seenForRanking = new Set(seenIdsRef.current);
    if (pinnedId) seenForRanking.delete(pinnedId);

    let ranked = rankFreshFeed(raw, seenForRanking, rotationSeed);
    ranked = rotateArray(ranked, rotationOffset);

    if (pinnedId) {
      const idx = ranked.findIndex((p) => p.id === pinnedId);
      if (idx > 0) {
        const [target] = ranked.splice(idx, 1);
        ranked = [target, ...ranked];
      }
    }

    if (feedTab === 'following' && !authorFilter && !hashtagFilter) {
      const set = new Set(echoing);
      ranked = ranked.filter((p) => set.has(p.uid));
    }

    // Text search filter (only if no author/hashtag filter active)
    const q = searchQuery.trim().toLowerCase();
    if (q && !authorFilter && !hashtagFilter) {
      const clean = q.replace(/^[@#]/, '');
      ranked = ranked.filter((p) => {
        const caption = (p.caption || '').toLowerCase();
        const author = (p.authorName || '').toLowerCase();
        return caption.includes(clean) || author.includes(clean);
      });
    }

    const newestCreatedAt = ranked.reduce((max, p) => Math.max(max, p.createdAt || 0), 0);
    if (
      newestSeenCreatedAtRef.current > 0 &&
      newestCreatedAt > newestSeenCreatedAtRef.current &&
      containerRef.current &&
      containerRef.current.scrollTop > 40 &&
      feedTab === 'foryou' &&
      !q &&
      !authorFilter &&
      !hashtagFilter
    ) {
      setHasNewAbove(true);
    }
    newestSeenCreatedAtRef.current = newestCreatedAt;
    setPosts(ranked);
    setActiveIndex(0);
    setLoading(false);
  }, [feedTab, echoing, searchQuery, freshPostId, focusPostId, rotationSeed, rotationOffset, authorFilter, hashtagFilter]);

  /* ─── Real-time feed (default view) ──────────────────────── */
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
        if (!authorFilter && !hashtagFilter) applyFilters();
      });
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  /* ─── Filter by author ───────────────────────────────────── */
  useEffect(() => {
    if (!authorFilter?.uid) {
      authorFilterPostsRef.current = null;
      return;
    }
    let cancelled = false;
    fetchPostsByAuthor(authorFilter.uid, { maxCount: 80 }).then((list) => {
      if (cancelled) return;
      authorFilterPostsRef.current = list;
      applyFilters();
    });
    return () => { cancelled = true; };
  }, [authorFilter, applyFilters]);

  /* ─── Filter by hashtag ──────────────────────────────────── */
  useEffect(() => {
    if (!hashtagFilter) {
      hashtagFilterPostsRef.current = null;
      return;
    }
    let cancelled = false;
    fetchPostsByHashtag(hashtagFilter, { maxCount: 80 }).then((list) => {
      if (cancelled) return;
      hashtagFilterPostsRef.current = list;
      applyFilters();
    });
    return () => { cancelled = true; };
  }, [hashtagFilter, applyFilters]);

  useEffect(() => {
    if (rawPostsRef.current.length > 0 || authorFilterPostsRef.current || hashtagFilterPostsRef.current) {
      applyFilters();
    }
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
          if (r > bestRatio) { bestRatio = r; bestIdx = i; }
        });
        if (bestRatio > 0.4) setActiveIndex(bestIdx);
      },
      { root: container, threshold: [0, 0.25, 0.5, 0.75, 1.0] }
    );
    const slides = container.querySelectorAll('.spotlight-slide');
    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [posts.length]);

  /* ─── Scroll + pull-to-refresh ───────────────────────────── */
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
        setActiveIndex(0);
        setRotationOffset((n) => n + 1);
        applyFilters();
        const el = containerRef.current;
        if (el) el.scrollTop = 0;
      } catch (_) {}
      setPullY(0);
      setTimeout(() => {
        setRefreshing(false);
        const el = containerRef.current;
        if (el) el.scrollTo({ top: 0, behavior: 'auto' });
        setActiveIndex(0);
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
    try { await softDeleteSpotlightPost(post.id); }
    catch (err) {
      setToast({ message: 'Could not delete', type: 'error' });
      setTimeout(() => setToast(null), 2200);
      return;
    }
    rawPostsRef.current = rawPostsRef.current.filter((p) => p.id !== post.id);
    if (authorFilterPostsRef.current) {
      authorFilterPostsRef.current = authorFilterPostsRef.current.filter((p) => p.id !== post.id);
    }
    if (hashtagFilterPostsRef.current) {
      hashtagFilterPostsRef.current = hashtagFilterPostsRef.current.filter((p) => p.id !== post.id);
    }
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
    setAuthorFilter(null);
    setHashtagFilter(null);
    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) el.scrollTop = 0;
    });
  };

  /* ─── Search helpers ─────────────────────────────────────── */
  const pushRecentSearch = (term) => {
    const clean = String(term || '').trim();
    if (!clean) return;
    const next = [clean, ...recentSearches.filter((x) => x !== clean)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(next);
    saveRecentSearches(next);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    saveRecentSearches([]);
  };

  const applySearch = (raw) => {
    const q = String(raw || '').trim();
    if (!q) return;
    pushRecentSearch(q);

    if (q.startsWith('@')) {
      // find first matching author from suggestions or fire off a fetch
      const handle = q.slice(1).toLowerCase();
      const match = searchSuggestions.authors.find(
        (a) => (a.username || '').toLowerCase() === handle || (a.name || '').toLowerCase() === handle
      );
      if (match) {
        setAuthorFilter({ uid: match.uid, name: match.name });
        setHashtagFilter(null);
        setSearchOpen(false);
        setSearchQuery('');
        return;
      }
    }
    if (q.startsWith('#')) {
      const tag = q.slice(1).toLowerCase();
      if (tag) {
        setHashtagFilter(tag);
        setAuthorFilter(null);
        setSearchOpen(false);
        setSearchQuery('');
        return;
      }
    }
    // Free-text: keep the query and close the panel
    setAuthorFilter(null);
    setHashtagFilter(null);
    setSearchQuery(q);
    setSearchOpen(false);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applySearch(searchQuery);
    }
  };

  const applyAuthorFilter = (author) => {
    pushRecentSearch(`@${author.username || author.name}`);
    setAuthorFilter({ uid: author.uid, name: author.name });
    setHashtagFilter(null);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const applyHashtagFilter = (tag) => {
    pushRecentSearch(`#${tag}`);
    setHashtagFilter(tag);
    setAuthorFilter(null);
    setSearchOpen(false);
    setSearchQuery('');
  };

  const clearFilters = () => {
    setAuthorFilter(null);
    setHashtagFilter(null);
    setSearchQuery('');
  };

  const hasActiveFilter = !!(authorFilter || hashtagFilter);

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
            className={`spotlight-top-btn ${autoAdvance ? 'active' : ''}`}
            onClick={() => setAutoAdvance((v) => !v)}
            aria-label={autoAdvance ? 'Disable auto-advance' : 'Enable auto-advance'}
            title={autoAdvance ? 'Auto-advance: ON' : 'Auto-advance: OFF'}
          >
            <i className={autoAdvance ? 'fas fa-forward' : 'fas fa-pause'} />
          </button>

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

      {/* Active filter chip */}
      {hasActiveFilter && (
        <div className="spotlight-filter-chip-wrap">
          <button
            type="button"
            className="spotlight-filter-chip"
            onClick={clearFilters}
            title="Clear filter"
          >
            <i className="fas fa-times-circle" />
            <span>
              {authorFilter ? `@${authorFilter.name}` : `#${hashtagFilter}`}
            </span>
          </button>
        </div>
      )}

      {/* New search panel */}
      {searchOpen && (
        <div className="spotlight-search-panel">
          <div className="spotlight-search-input-wrap">
            <i className="fas fa-search spotlight-search-icon" />
            <input
              type="text"
              className="spotlight-search-input"
              placeholder="Search captions, @users, #hashtags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="spotlight-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear"
              >
                <i className="fas fa-times" />
              </button>
            )}
          </div>

          <div className="spotlight-search-body">
            {/* Recent searches */}
            {!searchQuery && recentSearches.length > 0 && (
              <div className="spotlight-search-section">
                <div className="spotlight-search-section-head">
                  <span>Recent</span>
                  <button
                    type="button"
                    className="spotlight-search-section-action"
                    onClick={clearRecentSearches}
                  >
                    Clear
                  </button>
                </div>
                <div className="spotlight-search-pill-row">
                  {recentSearches.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="spotlight-search-pill"
                      onClick={() => {
                        setSearchQuery(s);
                        applySearch(s);
                      }}
                    >
                      <i className={s.startsWith('#') ? 'fas fa-hashtag' : s.startsWith('@') ? 'fas fa-at' : 'fas fa-clock'} />
                      <span>{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Trending hashtags */}
            {!searchQuery && trendingTags.length > 0 && (
              <div className="spotlight-search-section">
                <div className="spotlight-search-section-head">
                  <span>Trending</span>
                </div>
                <div className="spotlight-search-pill-row">
                  {trendingTags.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      className="spotlight-search-pill trending"
                      onClick={() => applyHashtagFilter(t.tag)}
                    >
                      <i className="fas fa-hashtag" />
                      <span>{t.tag}</span>
                      <span className="spotlight-search-pill-count">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Live suggestions */}
            {searchQuery && (
              <>
                {searchSuggestions.authors.length > 0 && (
                  <div className="spotlight-search-section">
                    <div className="spotlight-search-section-head"><span>People</span></div>
                    <div className="spotlight-search-suggest-list">
                      {searchSuggestions.authors.map((a) => (
                        <button
                          key={a.uid}
                          type="button"
                          className="spotlight-search-suggest-row"
                          onClick={() => applyAuthorFilter(a)}
                        >
                          <span className="spotlight-search-suggest-avatar">
                            {a.avatar ? <img src={a.avatar} alt="" /> : <span>{(a.name || 'U').charAt(0).toUpperCase()}</span>}
                          </span>
                          <span className="spotlight-search-suggest-text">
                            <span className="spotlight-search-suggest-name">{a.name}</span>
                            {a.username && <span className="spotlight-search-suggest-handle">@{a.username}</span>}
                          </span>
                          <i className="fas fa-arrow-right spotlight-search-suggest-arrow" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchSuggestions.hashtags.length > 0 && (
                  <div className="spotlight-search-section">
                    <div className="spotlight-search-section-head"><span>Hashtags</span></div>
                    <div className="spotlight-search-suggest-list">
                      {searchSuggestions.hashtags.map((h) => (
                        <button
                          key={h.tag}
                          type="button"
                          className="spotlight-search-suggest-row"
                          onClick={() => applyHashtagFilter(h.tag)}
                        >
                          <span className="spotlight-search-suggest-avatar tag">
                            <i className="fas fa-hashtag" />
                          </span>
                          <span className="spotlight-search-suggest-text">
                            <span className="spotlight-search-suggest-name">#{h.tag}</span>
                            <span className="spotlight-search-suggest-handle">{h.count} post{h.count !== 1 ? 's' : ''}</span>
                          </span>
                          <i className="fas fa-arrow-right spotlight-search-suggest-arrow" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchSuggestions.authors.length === 0 && searchSuggestions.hashtags.length === 0 && (
                  <div className="spotlight-search-empty">
                    <i className="fas fa-search" />
                    <p>No matches for "{searchQuery}"</p>
                    <button type="button" onClick={() => applySearch(searchQuery)}>
                      Search captions anyway
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
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
              {hasActiveFilter
                ? 'Nothing here'
                : feedTab === 'following'
                  ? 'Nothing from people you Echo yet'
                  : searchQuery
                    ? 'No matching posts'
                    : 'No Spotlights yet'}
            </h2>
            <p>
              {hasActiveFilter
                ? 'Try clearing the filter or search something else.'
                : feedTab === 'following'
                  ? 'Echo creators you like and their posts show up here.'
                  : searchQuery
                    ? 'Try a different search term.'
                    : 'Be the first to post a video or image.'}
            </p>
            {hasActiveFilter ? (
              <button type="button" className="spotlight-empty-cta" onClick={clearFilters}>
                <i className="fas fa-times" /> Clear filter
              </button>
            ) : (
              <button
                type="button"
                className="spotlight-empty-cta"
                onClick={() => navigate('/spotlight/upload')}
              >
                <i className="fas fa-plus" /> Create Spotlight
              </button>
            )}
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
                autoAdvance={autoAdvance}
                onEnded={scrollToNextPost}
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
        currentProfile={myProfile}
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
        onOpenHistory={() => {
          setNotifsOpen(false);
          navigate('/spotlight/history');
        }}
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
