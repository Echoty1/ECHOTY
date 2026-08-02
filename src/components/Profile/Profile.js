import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ref, onValue, update, remove, set } from 'firebase/database';

const Profile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const targetId = userId || user?.uid;

  useEffect(() => {
    if (!targetId) return;
    const userRef = ref(db, `users/${targetId}`);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setProfileUser({ ...data, id: targetId });
    });
  }, [targetId]);

  useEffect(() => {
    if (!targetId) return;
    const postsRef = ref(db, 'posts');
    onValue(postsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
        setPosts(list.filter(p => p.userId === targetId));
      }
    });
  }, [targetId]);

  useEffect(() => {
    if (!targetId) return;
    // Followers
    const followRef = ref(db, 'following');
    onValue(followRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const fol = [];
        Object.keys(data).forEach(key => {
          if (data[key] && data[key][targetId]) fol.push(key);
        });
        setFollowers(fol);
      }
    });
  }, [targetId]);

  useEffect(() => {
    if (!targetId || !user) return;
    const userFollowingRef = ref(db, `following/${user.uid}`);
    onValue(userFollowingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data);
        setFollowing(list);
        setIsFollowing(list.includes(targetId));
      }
    });
  }, [targetId, user]);

  const toggleFollow = () => {
    if (!user) return;
    const refPath = ref(db, `following/${user.uid}/${targetId}`);
    if (isFollowing) {
      remove(refPath);
    } else {
      set(refPath, true);
    }
  };

  const saveProfile = () => {
    const bio = document.getElementById('edit-bio')?.value;
    const location = document.getElementById('edit-location')?.value;
    if (bio || location) {
      const updates = {};
      if (bio) updates.bio = bio;
      if (location) updates.location = location;
      update(ref(db, `users/${user.uid}`), updates);
    }
    setEditMode(false);
  };

  if (!profileUser) return <div style={{ padding:'20px', textAlign:'center', color:'#888' }}>Loading...</div>;

  const isOwnProfile = user?.uid === targetId;

  return (
    <div style={{ maxWidth:'600px', margin:'0 auto', padding:'16px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'24px', padding:'8px 0 20px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{
            width:'96px', height:'96px', borderRadius:'50%', padding:'4px',
            background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
            display:'flex', alignItems:'center', justifyContent:'center',
            animation:'pulseGlow 3s infinite'
          }}>
            <div style={{
              width:'100%', height:'100%', borderRadius:'50%',
              background:'#12121A', display:'flex', alignItems:'center', justifyContent:'center',
              fontWeight:800, fontSize:'40px', color:'white'
            }}>{profileUser.avatar || profileUser.username?.[0]?.toUpperCase() || 'U'}</div>
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'22px', fontWeight:700 }}>{profileUser.username}</span>
          </div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'4px' }}>
            {!isOwnProfile && (
              <button onClick={toggleFollow} className={`follow-btn ${isFollowing ? 'following' : 'not-following'}`}>
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
            {isOwnProfile && (
              <button onClick={() => setEditMode(!editMode)} className="btn-outline btn-sm">
                <i className="fas fa-edit"></i> Edit
              </button>
            )}
          </div>
          <div style={{ display:'flex', gap:'24px', marginTop:'10px' }}>
            <div style={{ textAlign:'center', cursor:'pointer' }}>
              <span style={{ fontSize:'18px', fontWeight:700, display:'block', background:'linear-gradient(135deg, #6C3CE1, #EC4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{posts.length}</span>
              <span style={{ fontSize:'11px', color:'#888' }}>Posts</span>
            </div>
            <div style={{ textAlign:'center', cursor:'pointer' }}>
              <span style={{ fontSize:'18px', fontWeight:700, display:'block', background:'linear-gradient(135deg, #6C3CE1, #EC4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{followers.length}</span>
              <span style={{ fontSize:'11px', color:'#888' }}>Followers</span>
            </div>
            <div style={{ textAlign:'center', cursor:'pointer' }}>
              <span style={{ fontSize:'18px', fontWeight:700, display:'block', background:'linear-gradient(135deg, #6C3CE1, #EC4899)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{following.length}</span>
              <span style={{ fontSize:'11px', color:'#888' }}>Following</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 0 10px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize:'14px', lineHeight:1.7, color:'rgba(255,255,255,0.8)' }}>
          {profileUser.bio || 'No bio yet'}
        </div>
        <div style={{ display:'flex', gap:'16px', marginTop:'6px', fontSize:'12px', color:'#888' }}>
          <span><i className="fas fa-calendar-alt"></i> {profileUser.joined || 'Joined recently'}</span>
          <span><i className="fas fa-map-marker-alt"></i> {profileUser.location || 'Unknown'}</span>
        </div>
      </div>

      {editMode && (
        <div style={{ marginTop:'14px', padding:'20px', background:'#12121A', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.06)' }}>
          <input id="edit-bio" type="text" defaultValue={profileUser.bio || ''} placeholder="Bio" maxLength="150" style={{ width:'100%', padding:'12px 16px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px', color:'white', outline:'none', marginBottom:'12px', fontFamily:'inherit' }} />
          <input id="edit-location" type="text" defaultValue={profileUser.location || ''} placeholder="Location" style={{ width:'100%', padding:'12px 16px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'12px', color:'white', outline:'none', marginBottom:'12px', fontFamily:'inherit' }} />
          <div style={{ display:'flex', gap:'12px' }}>
            <button onClick={saveProfile} className="btn-primary btn-sm">Save</button>
            <button onClick={() => setEditMode(false)} className="btn-outline btn-sm">Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'4px', marginTop:'4px' }}>
        {posts.map(post => (
          <div key={post.id} style={{
            aspectRatio:'1', background:'#12121A', borderRadius:'8px', overflow:'hidden',
            cursor:'pointer', position:'relative', border:'1px solid rgba(255,255,255,0.06)'
          }}>
            {post.image ? <img src={post.image} alt="post" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', background:'#1A1A2E', fontSize:'24px' }}>📝</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Profile;