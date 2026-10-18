// src/pages/Spotlight/ProfileSpotlightGrid.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';

const ProfileSpotlightGrid = ({ uid }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!uid) return;
    const fetchPosts = async () => {
      try {
        let postsArray = [];

        // 1. Try fetching from the user's dedicated posts node (fastest)
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

        // 2. If empty, fall back to querying the global posts node
        if (postsArray.length === 0) {
          const q = query(ref(db, 'spotlight/posts'), orderByChild('uid'), equalTo(uid));
          const snap = await get(q);
          if (snap.exists()) {
            const data = snap.val();
            postsArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
          }
        }

        // Sort by newest
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

  if (loading) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading posts...</div>;

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
            backgroundImage: `url(${post.thumbnailUrl || post.mediaUrl || post.avatar})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            cursor: 'pointer',
            borderRadius: '8px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {(post.mediaUrl?.includes('.mp4') || post.mediaUrl?.includes('.webm') || post.mediaType === 'video') && (
             <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-play" style={{ color: 'white', fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
             </div>
          )}
          {/* Optional: Show view count */}
          <div style={{ position: 'absolute', bottom: 4, left: 6, color: '#fff', fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
            <i className="fas fa-play" style={{ fontSize: 8 }} /> {post.viewCount || 0}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ProfileSpotlightGrid;
