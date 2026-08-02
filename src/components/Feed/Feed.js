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
  const [showCreate, setShowCreate] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);

  // Load following list
  useEffect(() => {
    if (user) {
      const followRef = ref(db, `following/${user.uid}`);
      onValue(followRef, (snap) => {
        const data = snap.val();
        setFollowing(data ? Object.keys(data) : []);
      });
    }
  }, [user]);

  // Load posts
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

  const handleCreatePost = () => {
    if (!newPostContent.trim() && !newPostImage) return;
    const newPost = {
      author: user.username,
      avatar: user.avatar || user.username[0].toUpperCase(),
      content: newPostContent,
      community: 'General',
      echoes: 0,
      comments: 0,
      reposts: 0,
      timestamp: Date.now(),
      userId: user.uid,
      commentList: []
    };
    if (newPostImage) {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPost.image = e.target.result;
        push(ref(db, 'posts'), newPost);
      };
      reader.readAsDataURL(newPostImage);
    } else {
      push(ref(db, 'posts'), newPost);
    }
    setNewPostContent('');
    setNewPostImage(null);
    setShowCreate(false);
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

      {/* Floating Action Button */}
      {user && (
        <button
          onClick={() => setShowCreate(true)}
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            color: 'white',
            border: 'none',
            fontSize: '28px',
            boxShadow: '0 4px 20px rgba(108,60,225,0.4)',
            cursor: 'pointer',
            zIndex: 100,
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <i className="fas fa-plus"></i>
        </button>
      )}

      {/* Create Post Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 200,
          padding: '20px'
        }}>
          <div style={{
            background: '#12121A',
            borderRadius: '20px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '20px' }}>Create Post</h3>
            <textarea
              placeholder="What's on your mind?"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              style={{
                width: '100%',
                minHeight: '120px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '12px',
                color: 'white',
                fontSize: '16px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical'
              }}
            />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setNewPostImage(e.target.files[0])}
              style={{ marginTop: '12px', width: '100%', color: '#888' }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={handleCreatePost} className="btn-primary" style={{ flex: 1 }}>Post</button>
              <button onClick={() => setShowCreate(false)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feed;