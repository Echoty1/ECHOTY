import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ref, onValue, update } from 'firebase/database';

const Profile = () => {
  const { user } = useAuth();
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!user) return;
    const userRef = ref(db, `users/${user.uid}`);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBio(data.bio || '');
        setLocation(data.location || '');
      }
    });
  }, [user]);

  const saveProfile = () => {
    if (!user) return;
    update(ref(db, `users/${user.uid}`), { bio, location });
    setEditMode(false);
  };

  return (
    <div style={{ maxWidth:'600px', margin:'0 auto', padding:'16px' }}>
      <div style={{ textAlign:'center', marginBottom:'24px' }}>
        <div style={{
          width:'100px', height:'100px', borderRadius:'50%',
          background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:'48px', fontWeight:700, color:'white', margin:'0 auto 12px'
        }}>
          {user?.avatar || user?.username?.[0]?.toUpperCase() || 'U'}
        </div>
        <h2 style={{ fontSize:'24px' }}>{user?.username}</h2>
        <p style={{ color:'#888' }}>{user?.email}</p>
      </div>

      <div style={{ background:'#12121A', borderRadius:'16px', padding:'20px', border:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ marginBottom:'12px' }}>
          <label style={{ color:'#888', fontSize:'13px' }}>Bio</label>
          {editMode ? (
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ width:'100%', padding:'10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'8px', color:'white', marginTop:'4px' }}
            />
          ) : (
            <p style={{ color:'rgba(255,255,255,0.8)', marginTop:'4px' }}>{bio || 'No bio yet'}</p>
          )}
        </div>
        <div style={{ marginBottom:'16px' }}>
          <label style={{ color:'#888', fontSize:'13px' }}>Location</label>
          {editMode ? (
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ width:'100%', padding:'10px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:'8px', color:'white', marginTop:'4px' }}
            />
          ) : (
            <p style={{ color:'rgba(255,255,255,0.8)', marginTop:'4px' }}>{location || 'Unknown'}</p>
          )}
        </div>
        {editMode ? (
          <div style={{ display:'flex', gap:'12px' }}>
            <button onClick={saveProfile} className="btn-primary" style={{ flex:1 }}>Save</button>
            <button onClick={() => setEditMode(false)} className="btn-outline" style={{ flex:1 }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditMode(true)} className="btn-outline" style={{ width:'100%' }}>
            <i className="fas fa-edit"></i> Edit Profile
          </button>
        )}
      </div>
    </div>
  );
};

export default Profile;