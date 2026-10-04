// src/pages/Spotlight/SpotlightFeed.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useProfile } from '../../contexts/ProfileContext';
import Toast from '../../components/Toast/Toast';
import SpotlightPost from './SpotlightPost';
import SpotlightComments from './SpotlightComments';
import SpotlightShare from './SpotlightShare';
import {
  fetchSpotlightFeed,
  rankSpotlightFeed,
  fetchSeenSpotlightIds,
} from '../../services/spotlightService';

const SpotlightFeed = () => {
  const { user } = useAuth();
  const { getProfile, fetchProfile } = useProfile();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState(null);
  const [shareFor, setShareFor] = useState(null);
  const [toast, setToast] = useState(null);
  const [myProfile, setMyProfile] = useState(null);

  const containerRef = useRef(null);
  const videoRefs = useRef({});
  const focusPostId = params.get('post');

  /* Load profile of current user for comment authorship */
  useEffect(() => {
    if (!user?.uid) return;
    const cached = getProfile(user.uid);
    if (cached) setMyProfile(cached);
    else fetchProfile(user.uid);
  }, [user?.uid, getProfile, fetchProfile]);

  /* Fetch the feed */
  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const [all, seenSet] = await Promise.all([
        fetchSpotlightFeed({ maxCount: 80 }),
        user?.uid ? fetchSeenSpotlightIds(user.uid) : Promise.resolve(new Set()),
      ]);
      let ranked = rankSpotlightFeed(all, seenSet);

      // If arriving with ?post=ID, put that post first
      if (focusPostId) {
        const idx = ranked.findIndex((p) => p.id === focusPostId);
        if (idx > 0) {
          const [target] = ranked.splice(idx, 1);
          ranked = [target, ...ranked];
        }
      }
      setPosts(ranked);
      setActiveIndex(0);
    } catch (err) {
      console.error('Spotlight feed load failed:', err);
      setToast({ message: 'Could not load Spotlight', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [focusPostId, user?.uid]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  /* Snap-scroll: track which slide is active using IntersectionObserver */
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

  /* Escape closes any sheet */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setCommentsFor(null);
        setShareFor(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleRegisterVideo = useCallback((postId, el) => {
    if (el) videoRefs.current[postId] = el;
    else delete videoRefs.current[postId];
  }, []);

  const scrollToIndex = (i) => {
    const container = containerRef.current;
    if (!container) return;
    const slide = container.querySelector(`.spotlight-slide[data-index="${i}"]`);
    slide?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleOpenProfile = (uid) => {
    navigate(`/spotlight/user/${uid}`);
  };

  return (
    <div className="spotlight-feed-page">
      {/* Top bar */}
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

      {/* Feed */}
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
            <div
              key={post.id}
              className="spotlight-slide"
              data-index={i}
            >
              <SpotlightPost
                post={post}
                isActive={i === activeIndex}
                currentUser={user}
                muted={muted}
                onToggleMute={() => setMuted((m) => !m)}
                onOpenComments={(p) => setCommentsFor(p)}
                onOpenShare={(p) => setShareFor(p)}
                onOpenProfile={handleOpenProfile}
                onRegisterVideo={handleRegisterVideo}
              />
            </div>
          ))
        )}
      </div>

      {/* Floating counter + hint (bottom-left of the feed) */}
      {posts.length > 1 && (
        <div className="spotlight-feed-counter" aria-hidden="true">
          <span>{activeIndex + 1}</span>
          <span className="spotlight-feed-counter-sep">/</span>
          <span>{posts.length}</span>
        </div>
      )}

      {/* Comments sheet */}
      <SpotlightComments
        isOpen={!!commentsFor}
        post={commentsFor}
        currentUser={user}
        currentProfile={myProfile}
        onClose={() => setCommentsFor(null)}
      />

      {/* Share sheet */}
      <SpotlightShare
        isOpen={!!shareFor}
        post={shareFor}
        currentUser={user}
        onClose={() => setShareFor(null)}
        onToast={setToast}
      />

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default SpotlightFeed;
