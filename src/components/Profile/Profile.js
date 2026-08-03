import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../services/firebase';
import { ref, onValue, update } from 'firebase/database';

const Profile = () => {
  const { user } = useAuth();
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [avatar, setAvatar] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const userRef = ref(db, `users/${user.uid}`);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBio(data.bio || '');
        setLocation(data.location || '');
        setAvatar(data.avatar || '');
      }
    });
  }, [user]);

  const saveProfile = () => {
    if (!user) return;
    update(ref(db, `users/${user.uid}`), { bio, location });
    setEditMode(false);
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      update(ref(db, `users/${user.uid}`), { avatar: base64 });
      setAvatar(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', paddingBottom: '80px' }}>
      <div style={{
        background: 'rgba(18,18,26,0.8)',
        backdropFilter: 'blur(12px)',
        borderRadius: '24px',
        padding: '24px',
        border: '1px solid rgba(255,255,255,0.04)',
        marginBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        <div
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            background: avatar ? `url(${avatar}) center/cover` : 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '40px',
            fontWeight: 700,
            color: 'white',
            cursor: 'pointer',
            border: '3px solid rgba(108,60,225,0.3)',
            boxShadow: '0 8px 32px rgba(108,60,225,0.2)',
            marginBottom: '12px',
          }}
          onClick={() => fileInputRef.current.click()}
        >
          {!avatar && (user?.avatar || user?.username?.[0]?.toUpperCase() || 'U')}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleAvatarUpload}
          accept="image/*"
          style={{ display: 'none' }}
        />
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Tap avatar to change</div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '2px' }}>{user?.username}</h2>
        <p style={{ color: '#888', fontSize: '14px' }}>{user?.email}</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '16px',
        marginBottom: '20px',
      }}>
        <div style={{
          background: 'rgba(18,18,26,0.6)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Bio</div>
          {editMode ? (
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
            />
          ) : (
            <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)' }}>{bio || 'Not set'}</div>
          )}
        </div>
        <div style={{
          background: 'rgba(18,18,26,0.6)',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Location</div>
          {editMode ? (
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', color: 'white', fontSize: '14px' }}
            />
          ) : (
            <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)' }}>{location || 'Not set'}</div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        {editMode ? (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={saveProfile} className="btn-primary" style={{ flex: 1 }}>Save Changes</button>
            <button onClick={() => setEditMode(false)} className="btn-outline" style={{ flex: 1 }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditMode(true)} className="btn-outline" style={{ width: '100%' }}>
            <i className="fas fa-edit"></i> Edit Profile
          </button>
        )}
      </div>

      <div style={{
        background: 'rgba(18,18,26,0.6)',
        borderRadius: '16px',
        padding: '16px',
        border: '1px solid rgba(255,255,255,0.04)',
      }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px', color: '#fff' }}>📜 Community Policy</h3>
        <p style={{ fontSize: '13px', color: '#888', lineHeight: '1.6' }}>
          By using ECHO, you agree to: treat others with respect; no harassment, hate speech, or bullying; no illegal content; no spam or impersonation. Violations may result in permanent ban.
        </p>
      </div>
    </div>
  );
};

export default Profile;