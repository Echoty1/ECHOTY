// src/pages/Spotlight/SpotlightHashtagSheet.jsx
import React, { useEffect, useState } from 'react';
import EchoLoader from '../../components/common/EchoLoader';
import { fetchPostsByHashtag } from '../../services/spotlightService';

const SpotlightHashtagSheet = ({ isOpen, tag, onClose, onPickPost }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !tag) return;
    setLoading(true);
    fetchPostsByHashtag(tag)
      .then((list) => { setPosts(list); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isOpen, tag]);

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

  return (
    <div className="spotlight-hashtag-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="spotlight-hashtag-sheet" role="dialog" aria-modal="true">
        <div className="spotlight-hashtag-handle" aria-hidden="true" />
        <div className="spotlight-hashtag-header">
          <div>
            <div className="spotlight-hashtag-title">#{tag}</div>
            <div className="spotlight-hashtag-sub">
              {loading ? 'Loading…' : `${posts.length} post${posts.length === 1 ? '' : 's'}`}
            </div>
          </div>
          <button type="button" className="spotlight-hashtag-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="spotlight-hashtag-grid">
          {loading ? (
            <div className="spotlight-hashtag-loading"><EchoLoader size="sm" /></div>
          ) : posts.length === 0 ? (
            <div className="spotlight-hashtag-empty">
              <i className="fas fa-hashtag" />
              <p>No posts with this hashtag yet</p>
            </div>
          ) : (
            posts.map((p) => (
              <button
                key={p.id}
                type="button"
                className="spotlight-hashtag-tile"
                onClick={() => { onPickPost?.(p.id); onClose?.(); }}
              >
                {p.mediaType === 'video' ? (
                  <>
                    <video src={p.mediaUrl} muted playsInline preload="metadata" poster={p.posterUrl || ''} />
                    <span className="spotlight-hashtag-tile-play"><i className="fas fa-play" /></span>
                  </>
                ) : (
                  <img src={p.mediaUrl} alt="" loading="lazy" />
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SpotlightHashtagSheet;
