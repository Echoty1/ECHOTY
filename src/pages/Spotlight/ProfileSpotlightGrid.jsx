// src/pages/Spotlight/ProfileSpotlightGrid.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { ref, get, remove, update, runTransaction } from 'firebase/database';
import { useAuth } from '../../hooks/useAuth';

const ProfileSpotlightGrid = ({ uid, isOwner }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState(null);
  const [infoModal, setInfoModal] = useState(null);
  const [insightsModal, setInsightsModal] = useState(null);
  const [showContinueToast, setShowContinueToast] = useState(false);

  const pressTimer = useRef(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    if (!uid) return;
    const fetchPosts = async () => {
      try {
        let postsArray = [];
        try {
          const userPostsSnap = await get(ref(db, `spotlight/users/${uid}/posts`));
          if (userPostsSnap.exists()) {
            const postIds = Object.keys(userPostsSnap.val());
            for (const id of postIds) {
              const postSnap = await get(ref(db, `spotlight/posts/${id}`));
              if (postSnap.exists()) postsArray.push({ id, ...postSnap.val() });
            }
          }
        } catch (e) {}

        if (postsArray.length === 0) {
          const globalSnap = await get(ref(db, 'spotlight/posts'));
          if (globalSnap.exists()) {
            Object.keys(globalSnap.val()).forEach((key) => {
              const post = globalSnap.val()[key];
              if (post.uid === uid || post.authorId === uid) postsArray.push({ id: key, ...post });
            });
          }
        }
        postsArray.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setPosts(postsArray);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, [uid]);

  // 7-Second Timer & Real View Count
  useEffect(() => {
    let timer;
    if (activeVideo) {
      if (user && !isOwner) {
        runTransaction(ref(db, `spotlight/posts/${activeVideo.id}/viewCount`), (current) => (current || 0) + 1);
      }

      timer = setTimeout(() => {
        setActiveVideo(null);
        setShowContinueToast(true);
        setTimeout(() => setShowContinueToast(false), 5000);
      }, 7000);
    }
    return () => clearTimeout(timer);
  }, [activeVideo, user, isOwner]);

  const handlePressStart = (post) => {
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (isOwner) setInsightsModal(post);
      else setInfoModal(post);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handlePressEnd = (post) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (!isLongPress.current) {
      setActiveVideo(post);
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm("Delete this Spotlight?")) return;
    try {
      await remove(ref(db, `spotlight/posts/${postId}`));
      setPosts(posts.filter(p => p.id !== postId));
      setInsightsModal(null);
    } catch (err) { alert("Failed to delete"); }
  };

  const handleReport = (postId) => {
    if (user) {
      update(ref(db, `reports/${postId}`), { reportedBy: user.uid, timestamp: Date.now() });
    }
    setInfoModal(null);
    alert('Report submitted');
  };

  const handleContinueWatching = () => {
    if (activeVideo) {
      navigate(`/spotlight?focus=${activeVideo.id}`);
    } else if (posts.length > 0) {
      navigate(`/spotlight?focus=${posts[0].id}`);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>Loading...</div>;
  if (posts.length === 0) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
      <i className="fas fa-camera" style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }} />
      <p>No Spotlights yet.</p>
    </div>
  );

  return (
    <>
      {/* Responsive Grid with a guaranteed 3-column layout on mobile */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '4px', 
        padding: '4px' 
      }}>
        {posts.map((post) => (
          <div
            key={post.id}
            onMouseDown={() => handlePressStart(post)}
            onMouseUp={() => handlePressEnd(post)}
            onMouseLeave={() => clearTimeout(pressTimer.current)}
            onTouchStart={() => handlePressStart(post)}
            onTouchEnd={() => handlePressEnd(post)}
            style={{
              aspectRatio: '9/16',
              backgroundImage: `url(${post.thumbnailUrl || post.mediaUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              cursor: 'pointer',
              borderRadius: '8px',
              overflow: 'hidden',
              position: 'relative',
              WebkitTapHighlightColor: 'transparent',
              userSelect: 'none'
            }}
          >
            {(post.mediaUrl?.includes('.mp4') || post.mediaType === 'video') && (
              <div style={{ width: '100%', height: '100%', background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-play" style={{ color: 'white', fontSize: 20, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 6, left: 6, color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
              <i className="fas fa-eye" style={{ fontSize: 10 }} /> {post.viewCount || 0}
            </div>
          </div>
        ))}
      </div>

      {/* Fullscreen Video Player */}
      {activeVideo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setActiveVideo(null)}>
          <video src={activeVideo.mediaUrl} autoPlay playsInline loop style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          
          <div style={{ position: 'absolute', top: 'max(20px, env(safe-area-inset-top))', left: 20, right: 20, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#EC4899', width: '100%', animation: 'drainTimer 7s linear forwards' }} />
          </div>
          <style>{`@keyframes drainTimer { from { width: 100%; } to { width: 0%; } }`}</style>
          
          <button style={{ position: 'absolute', top: 'max(20px, env(safe-area-inset-top))', right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Continue Watching Toast */}
      {showContinueToast && (
        <div
          onClick={handleContinueWatching}
          style={{
            position: 'fixed', bottom: 'max(100px, env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(30,30,35,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)',
            padding: '12px 20px', borderRadius: 20, color: '#fff', display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)', zIndex: 1000000, animation: 'slideUpToast 0.3s ease', cursor: 'pointer',
            width: 'max-content', maxWidth: 'calc(100vw - 40px)'
          }}
        >
          <i className="fas fa-play-circle" style={{ color: '#EC4899', fontSize: 20 }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Continue watching in Spotlight</span>
          <style>{`@keyframes slideUpToast { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
        </div>
      )}

      {/* Info Modal (Viewer) - Fixed Z-Index and Padding */}
      {infoModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setInfoModal(null)}>
          <div style={{ background: 'rgba(25,25,30,0.95)', backdropFilter: 'blur(30px)', width: '100%', maxWidth: 400, borderRadius: '24px 24px 0 0', padding: 24, paddingBottom: 'calc(100px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.15)', animation: 'slideUpModal 0.3s cubic-bezier(0.2, 1, 0.4, 1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 99, margin: '0 auto 20px' }} />
            <h3 style={{ textAlign: 'center', margin: '0 0 20px', color: '#fff', fontSize: 18 }}>Post Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: 14 }}>
                <span style={{ color: '#aaa', fontSize: 14 }}>Posted</span>
                <strong style={{ color: '#fff', fontSize: 14 }}>{new Date(infoModal.createdAt || Date.now()).toLocaleDateString()}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: 14 }}>
                <span style={{ color: '#aaa', fontSize: 14 }}>Views</span>
                <strong style={{ color: '#fff', fontSize: 14 }}>{infoModal.viewCount || 0}</strong>
              </div>
            </div>
            <button style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontWeight: 700, fontSize: 16, marginTop: 20 }} onClick={() => handleReport(infoModal.id)}>Report Post</button>
            <button style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: 16, marginTop: 10 }} onClick={() => setInfoModal(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Insights Modal (Owner) - Fixed Z-Index and Padding */}
      {insightsModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => setInsightsModal(null)}>
          <div style={{ background: 'rgba(25,25,30,0.95)', backdropFilter: 'blur(30px)', width: '100%', maxWidth: 400, borderRadius: '24px 24px 0 0', padding: 24, paddingBottom: 'calc(100px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.15)', animation: 'slideUpModal 0.3s cubic-bezier(0.2, 1, 0.4, 1)' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 99, margin: '0 auto 20px' }} />
            <h3 style={{ textAlign: 'center', margin: '0 0 8px', color: '#fff', fontSize: 18 }}>Post Insights</h3>
            <p style={{ textAlign: 'center', color: '#aaa', fontSize: 13, marginBottom: 20 }}>Performance for this Spotlight</p>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, padding: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 12, margin: '0 0 20px' }}>
               <div style={{ flex: 1, margin: '0 4px', height: '40%', background: 'linear-gradient(to top, #6C3CE1, #EC4899)', borderRadius: '4px 4px 0 0' }} />
               <div style={{ flex: 1, margin: '0 4px', height: '70%', background: 'linear-gradient(to top, #6C3CE1, #EC4899)', borderRadius: '4px 4px 0 0' }} />
               <div style={{ flex: 1, margin: '0 4px', height: '90%', background: 'linear-gradient(to top, #6C3CE1, #EC4899)', borderRadius: '4px 4px 0 0' }} />
               <div style={{ flex: 1, margin: '0 4px', height: '60%', background: 'linear-gradient(to top, #6C3CE1, #EC4899)', borderRadius: '4px 4px 0 0' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: 14, marginBottom: 20 }}>
              <span style={{ color: '#aaa', fontSize: 14 }}>Total Views</span>
              <strong style={{ color: '#fff', fontSize: 14 }}>{insightsModal.viewCount || 0}</strong>
            </div>
            
            <button style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#EF4444', fontWeight: 700, fontSize: 16 }} onClick={() => handleDelete(insightsModal.id)}>Delete Spotlight</button>
            <button style={{ width: '100%', padding: 16, borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: 16, marginTop: 10 }} onClick={() => setInsightsModal(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
};

export default ProfileSpotlightGrid;
