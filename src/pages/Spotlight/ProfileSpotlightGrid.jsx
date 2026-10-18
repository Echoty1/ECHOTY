// src/components/Spotlight/ProfileSpotlightGrid.jsx
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
        // Assuming your spotlight posts are stored at `spotlight/posts`
        // and each post has a `uid` field pointing to the creator
        const q = query(ref(db, 'spotlight/posts'), orderByChild('uid'), equalTo(uid));
        const snap = await get(q);
        if (snap.exists()) {
          const data = snap.val();
          const postsArray = Object.keys(data).map(key => ({ id: key, ...data[key] }))
            .sort((a, b) => b.createdAt - a.createdAt);
          setPosts(postsArray);
        }
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
            overflow: 'hidden'
          }}
        >
          {post.mediaUrl?.includes('.mp4') && (
             <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-play" style={{ color: 'white', fontSize: 24, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
             </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ProfileSpotlightGrid;
