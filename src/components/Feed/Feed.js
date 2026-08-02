import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue, push, runTransaction } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../contexts/SocketContext';
import PostCard from './PostCard';
import { Link } from 'react-router-dom';

const Feed = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const [posts, setPosts] = useState([]);
  const [storyUsers, setStoryUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

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

  // Load users who have posted (story circles)
  useEffect(() => {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const userList = Object.keys(data).map(key => ({ ...data[key], id: key }));
        // Filter: only users who have at least one post
        const usersWithPosts = userList.filter(u =>
          posts.some(p => p.userId === u.id)
        );
        setStoryUsers(usersWithPosts);
      }
    });
  }, [posts]);

  // Listen for online users
  useEffect(() => {
    if (socket) {
      socket.on('online-users', (ids) => {
        setOnlineUsers(ids);
      });
    }
    return () => {
      if (socket) socket.off('online-users');
    };
  }, [socket]);

  const handleEcho = (postId) => {
    if (!user) return;
    const postRef = ref(db, `posts/${postId}`);
    runTransaction(postRef, (currentData) => {
      if (currentData === null) return currentData;
      currentData.echoes = (currentData.echoes || 0) + 1;
      return currentData;
    });
  };

  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* Story Circles - Horizontal Scroll */}
      <div style={{
        display: 'flex',
        gap: '20px',
        padding: '20px 16px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: '#12121A',
        alignItems: 'center',
      }}>
        {/* Your own story circle */}
        {user && (
          <Link to="/profile" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              padding: '4px',
              background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(108,60,225,0.3)',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: '#12121A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 700,
                color: 'white',
                textTransform: 'uppercase',
              }}>
                {user.avatar || user.username?.[0] || 'U'}
              </div>
              <div style={{
                position: 'absolute',
                bottom: '2px',
                right: '2px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#6C3CE1',
                color: 'white',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #12121A',
              }}>+</div>
            </div>
            <span style={{ fontSize: '11px', color: '#888', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
              Your Story
            </span>
          </Link>
        )}

        {/* Other users' story circles */}
        {storyUsers
          .filter(u => u.id !== user?.uid)
          .slice(0, 10) // limit to 10 to avoid clutter
          .map(u => {
            const isOnline = onlineUsers.includes(u.id);
            return (
              <Link
                key={u.id}
                to={`/profile/${u.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0 }}
              >
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  padding: '4px',
                  background: isOnline
                    ? 'linear-gradient(135deg, #10B981, #34D399)'
                    : 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  cursor: 'pointer',
                  boxShadow: isOnline ? '0 0 30px rgba(16,185,129,0.2)' : '0 4px 20px rgba(108,60,225,0.2)',
                  transition: 'transform 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: '#12121A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: 700,
                    color: 'white',
                    textTransform: 'uppercase',
                  }}>
                    {u.avatar || u.username?.[0] || 'U'}
                  </div>
                  {isOnline && (
                    <div style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: '#10B981',
                      border: '2px solid #12121A',
                    }} />
                  )}
                </div>
                <span style={{ fontSize: '11px', color: '#888', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                  {u.username}
                </span>
              </Link>
            );
          })}
      </div>

      {/* Posts Feed */}
      <div>
        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#888' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <p>No posts yet. Be the first to share!</p>
          </div>
        ) : (
          posts.map(post => (
            <PostCard key={post.id} post={post} onEcho={handleEcho} />
          ))
        )}
      </div>
    </div>
  );
};

export default Feed;