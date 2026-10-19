// src/pages/Spotlight/ProfileSpotlightGrid.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { ref, get } from 'firebase/database';

const ProfileSpotlightGrid = ({ uid }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid) return;
    
    const fetchPosts = async () => {
      try {
        let postsArray = [];

        // ── 1. Try to fetch from spotlight/users/{uid}/posts (Fastest) ──
        try {
          const userPostsSnap = await get(ref(db, `spotlight/users/${uid}/posts`));
          if (userPostsSnap.exists()) {
            const postIds = Object.keys(userPostsSnap.val());
            // Fetch each post's full data
            for (const id of postIds) {
              const postSnap = await get(ref(db, `spotlight/posts/${id}`));
              if (postSnap.exists()) {
                postsArray.push({ id, ...postSnap.val() });
              }
            }
          }
        } catch (e) {
          console.warn('Could not read spotlight/users path', e);
        }

        // ── 2. If still empty, fetch all global posts and filter by uid ──
        if (postsArray.length === 0) {
          const globalSnap = await get(ref(db, 'spotlight/posts'));
          if (globalSnap.exists()) {
            const data = globalSnap.val();
            Object.keys(data).forEach((key) => {
              const post = data[key];
              // Check if this post belongs to the user
              if (post.uid === uid || post.authorId === uid) {
                postsArray.push({ id: key, ...post });
              }
            });
          }
        }

        // Sort newest first
        postsArray.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setPosts(postsArray);
      } catch (err) {
        console.error('Failed to load spotlight posts:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPosts();
  }, [uid]);

  if (loading) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading Spotlight...</div>;

  if (posts.length === 0) {
    return (
      <div className="empty-tab-state">
        <i className="fas fa-camera" />
        <p>No Spotlight posts yet.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px' }}>
      {posts.map((post) => (
        <div 
          key={post.id} 
          onClick={() => navigate(`/spotlight?focus=${post.id}`)}
          style={{ 
            aspectRatio: '9/16', 
            backgroundImage: `url(${post.thumbnailUrl || post.mediaUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            cursor: 'pointer',
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* Play icon for videos */}
          {(post.mediaUrl?.includes('.mp4') || post.mediaUrl?.includes('.webm') || post.mediaType === 'video') && (
             <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-play" style={{ color: 'white', fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
             </div>
          )}
          {/* View count */}
          <div style={{ position: 'absolute', bottom: 4, left: 6, color: '#fff', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            <i className="fas fa-eye" style={{ fontSize: 9 }} /> {post.viewCount || 0}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProfileSpotlightGrid;
