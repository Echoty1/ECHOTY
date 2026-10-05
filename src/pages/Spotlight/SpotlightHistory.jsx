// src/pages/Spotlight/SpotlightHistory.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Toast from '../../components/Toast/Toast';
import EchoLoader from '../../components/common/EchoLoader';
import {
  fetchWatchHistory,
  clearWatchHistory,
} from '../../services/spotlightService';
import './Spotlight.css';

const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 4) return `${wk}w ago`;
  return new Date(ts).toLocaleDateString();
};

const SpotlightHistory = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = async () => {
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);
    const list = await fetchWatchHistory(user.uid, { maxCount: 60 });
    setPosts(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.uid]);

  const handleClear = async () => {
    if (!user?.uid) return;
    try {
      await clearWatchHistory(user.uid);
      setPosts([]);
      setConfirmClear(false);
      setToast({ message: 'History cleared', type: 'success' });
      setTimeout(() => setToast(null), 2000);
    } catch (_) {
      setToast({ message: 'Could not clear history', type: 'error' });
      setTimeout(() => setToast(null), 2200);
    }
  };

  return (
    <div className="spotlight-history-page">
      <div className="spotlight-history-topbar">
        <button
          type="button"
          className="spotlight-profile-back"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <i className="fas fa-arrow-left" />
        </button>
        <h1 className="spotlight-history-title">Watch history</h1>
        {posts.length > 0 && (
          <button
            type="button"
            className="spotlight-history-clear"
            onClick={() => setConfirmClear(true)}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="spotlight-history-loading"><EchoLoader size="md" /></div>
      ) : posts.length === 0 ? (
        <div className="spotlight-history-empty">
          <i className="fas fa-history" />
          <h2>No watch history yet</h2>
          <p>Spotlights you view will show up here.</p>
          <button
            type="button"
            className="spotlight-empty-cta"
            onClick={() => navigate('/spotlight')}
          >
            <i className="fas fa-play" /> Watch Spotlights
          </button>
        </div>
      ) : (
        <div className="spotlight-history-grid">
          {posts.map((p) => {
            const thumb = p.mediaType === 'video' ? (p.posterUrl || '') : (p.mediaUrl || '');
            return (
              <button
                key={p.id}
                type="button"
                className="spotlight-history-tile"
                onClick={() => navigate(`/spotlight?focus=${p.id}`)}
              >
                {thumb ? (
                  <img src={thumb} alt="" loading="lazy" />
                ) : (
                  <div className="spotlight-history-tile-fallback">
                    <i className={p.mediaType === 'video' ? 'fas fa-video' : 'fas fa-image'} />
                  </div>
                )}
                {p.mediaType === 'video' && (
                  <span className="spotlight-history-tile-play" aria-hidden="true">
                    <i className="fas fa-play" />
                  </span>
                )}
                <span className="spotlight-history-tile-meta">
                  {timeAgo(p.viewedAt)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {confirmClear && (
        <div className="spotlight-confirm-backdrop" onClick={() => setConfirmClear(false)}>
          <div className="spotlight-confirm" onClick={(e) => e.stopPropagation()}>
            <h3>Clear watch history?</h3>
            <p>This will remove all {posts.length} viewed Spotlights from your history.</p>
            <div className="spotlight-confirm-actions">
              <button type="button" onClick={() => setConfirmClear(false)}>Cancel</button>
              <button type="button" className="danger" onClick={handleClear}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default SpotlightHistory;
