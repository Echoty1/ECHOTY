import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, push, update, remove, runTransaction } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';
import StoryBar from './StoryBar';
import PostCard from './PostCard';

const Feed = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [tab, setTab] = useState('global');
  const [following, setFollowing] = useState([]);

  useEffect(() => {
    // Get following list
    if (user) {
      const followRef = ref(db, `following/${user.uid}`);
      onValue(followRef, (snap) => {
        const data = snap.val();
        setFollowing(data ? Object.keys(data) : []);
      });
    }
  }, [user]);

  useEffect(() => {
    const postsRef = ref(db, 'posts');
    onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const postsArray = Object.keys(data).map(key => ({ ...data[key], id: key }));
        postsArray.sort((a, b) => b.timestamp - a.timestamp);
        setPosts(postsArray);
      } else {
        setPosts([]);
      }
    });
  }, []);

  const handleEcho = (postId) => {
    if (!user) return;
    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (currentData) => {
      if (currentData === null) return currentData;
      currentData.echoes = (currentData.echoes || 0) + 1;
      return currentData;
    });
  };

  const filteredPosts = posts.filter(post => {
    if (tab === 'following') {
      return following.includes(post.userId) || post.userId === user?.uid;
    }
    if (tab === 'trending') {
      return (post.echoes || 0) > 5;
    }
    return true;
  });

  return (
    <div>
      <StoryBar />
      <div style={{ display:'flex', borderBottom:'1px solid rgba(255,255,255,0.06)', background:'#12121A', padding:'0 4px' }}>
        {['global','following','trending'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex:1,
              padding:'12px',
              textAlign:'center',
              fontSize:'14px',
              fontWeight:600,
              background:'transparent',
              border:'none',
              borderBottom: tab === t ? '3px solid #6C3CE1' : '3px solid transparent',
              cursor:'pointer',
              color: tab === t ? '#8B5CF6' : '#888',
              transition:'all 0.3s ease'
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div>
        {filteredPosts.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#888' }}>No posts yet</div>
        ) : (
          filteredPosts.map(post => (
            <PostCard key={post.id} post={post} onEcho={handleEcho} />
          ))
        )}
      </div>
    </div>
  );
};

export default Feed;