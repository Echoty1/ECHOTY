// src/components/common/SpotlightHomeCard.jsx
// ─────────────────────────────────────────────────────────────
// What this is:
//   A compact, reusable Spotlight card used on the Home page
//   (below the "Live Now" strip). The full SpotlightFeed page
//   keeps its own immersive full-screen player — we do NOT
//   touch that. This is just a lighter presentation for Home.
// ─────────────────────────────────────────────────────────────
import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SpotlightHomeCard.css';

const SpotlightHomeCard = ({ post }) => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [isVideo, setIsVideo] = useState(false);
  const [failed, setFailed] = useState(false);

  // Detect if the post media is a video by URL extension.
  // Spotlight posts store either an image or a video URL.
  useEffect(() => {
    if (!post) return;
    const url = post.videoUrl || post.mediaUrl || post.imageUrl || '';
    setIsVideo(/\.(mp4|webm|mov|m3u8)(\?|#|$)/i.test(url));
  }, [post]);

  const handleOpen = () => {
    if (!post?.id) return;
    // Open the full Spotlight feed focused on this post
    navigate(`/spotlight?focus=${post.id}`);
  };

  if (!post) return null;

  const mediaUrl = post.videoUrl || post.mediaUrl || post.imageUrl || '';
  const authorName = post.authorName || post.name || 'User';
  const authorAvatar = post.authorAvatar || post.avatar || '';
  const caption = (post.caption || '').trim();
  const initials = authorName.trim().charAt(0).toUpperCase() || 'U';

  return (
    <button
      type="button"
      className="spot-home-card"
      onClick={handleOpen}
      aria-label={`Open Spotlight by ${authorName}`}
    >
      <div className="spot-home-media">
        {!failed && isVideo ? (
          <video
            ref={videoRef}
            src={mediaUrl}
            muted
            loop
            playsInline
            preload="metadata"
            onError={() => setFailed(true)}
            onMouseEnter={() => videoRef.current?.play().catch(() => {})}
            onMouseLeave={() => {
              if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
              }
            }}
          />
        ) : !failed ? (
          <img
            src={mediaUrl}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="spot-home-media-fallback">
            <i className="fas fa-video" aria-hidden="true" />
          </div>
        )}

        {isVideo && !failed && (
          <span className="spot-home-play" aria-hidden="true">
            <i className="fas fa-play" />
          </span>
        )}
      </div>

      <div className="spot-home-meta">
        <div className="spot-home-author">
          {authorAvatar ? (
            <img
              src={authorAvatar}
              alt=""
              className="spot-home-avatar"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <span className="spot-home-avatar-fallback">{initials}</span>
          )}
          <span className="spot-home-author-name">{authorName}</span>
        </div>
        {caption && <p className="spot-home-caption">{caption}</p>}
      </div>
    </button>
  );
};

export default SpotlightHomeCard;
