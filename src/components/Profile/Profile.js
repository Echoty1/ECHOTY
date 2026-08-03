import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePresence } from '../../contexts/PresenceContext';
import { db } from '../../services/firebase';
import { ref, onValue, update } from 'firebase/database';
import { cache } from '../../services/cache';

const Profile = () => {
  const { user } = useAuth();
  const { presenceMap, subscribeToUser } = usePresence();
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [avatar, setAvatar] = useState('');
  const [displayName, setDisplayName] = useState('');
  const fileInputRef = useRef(null);

  // Subscribe to own presence
  useEffect(() => {
    if (user) {
      subscribeToUser(user.uid);
    }
  }, [user, subscribeToUser]);

  useEffect(() => {
    if (!user) return;
    const userRef = ref(db, `users/${user.uid}`);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBio(data.bio || '');
        setLocation(data.location || '');
        setAvatar(data.avatar || '');
        setDisplayName(data.username || user.username || '');
        // Update cache for this user
        const allUsers = cache.getUsers() || {};
        allUsers[user.uid] = { ...data, id: user.uid };
        cache.setUsers(allUsers);
      }
    });
  }, [user]);

  const saveProfile = () => {
    if (!user) return;
    const updates = {};
    if (bio) updates.bio = bio;
    if (location) updates.location = location;
    if (displayName) updates.username = displayName;
    update(ref(db, `users/${user.uid}`), updates);
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

  const getInitials = (name) => {
    if (!name) return 'U';
    const words = name.trim().split(' ');
    if (words.length === 0) return 'U';
    if (words.length === 1) return words[0][0].toUpperCase();
    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  };

  // Get presence info
  const myPresence = presenceMap[user?.uid];
  const isOnline = myPresence?.online || false;
  const lastSeen = myPresence?.lastSeen;
  const lastSeenFormatted = lastSeen ? new Date(lastSeen).toLocaleString() : 'Never';

  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '24px 16px 80px',
        height: '100%',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Profile Card */}
      <div
        style={{
          background: 'rgba(18, 18, 26, 0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '20px',
          padding: '24px',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* Avatar section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' }}>
          <div
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '50%',
              border: '2px solid #8B5CF6',
              boxShadow: '0 0 30px rgba(139,92,246,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: !avatar ? 'linear-gradient(135deg, #6C3CE1, #EC4899)' : 'transparent',
              cursor: 'pointer',
              overflow: 'hidden',
              position: 'relative',
            }}
            onClick={() => fileInputRef.current.click()}
          >
            {avatar && avatar.startsWith('data:') ? (
              <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '38px', fontWeight: 700, color: 'white' }}>{getInitials(displayName)}</span>
            )}
          </div>
          <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} accept="image/*" style={{ display: 'none' }} />
          <div style={{ fontSize: '12px', color: '#888', marginTop: '6px', opacity: 0.7 }}>Tap avatar to change</div>
        </div>

        <h2 style={{ fontSize: '24px', fontWeight: 700, textAlign: 'center', color: 'white', marginBottom: '2px' }}>
          {displayName}
        </h2>
        <p style={{ fontSize: '14px', color: '#888', textAlign: 'center', marginBottom: '4px' }}>
          {user?.email}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '20px' }}>
          <span style={{ fontSize: '13px', color: isOnline ? '#10B981' : '#EF4444' }}>
            {isOnline ? '🟢 Online' : `⚪ Last seen: ${lastSeenFormatted}`}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '12px',
              padding: '14px 12px',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>Bio</div>
            <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)' }}>{bio || '—'}</div>
          </div>
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderRadius: '12px',
              padding: '14px 12px',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.04)',
            }}
          >
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>Location</div>
            <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)' }}>{location || '—'}</div>
          </div>
        </div>

        <button
          onClick={() => setEditMode(!editMode)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '50px',
            background: editMode ? 'linear-gradient(135deg, #6C3CE1, #EC4899)' : 'rgba(255,255,255,0.06)',
            border: editMode ? 'none' : '1px solid rgba(255,255,255,0.12)',
            color: 'white',
            fontWeight: 600,
            fontSize: '15px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease',
          }}
        >
          {editMode ? 'Cancel' : 'Edit Profile'}
        </button>

        {editMode && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                marginBottom: '10px',
                fontFamily: 'inherit',
              }}
            />
            <input
              type="text"
              placeholder="Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                marginBottom: '10px',
                fontFamily: 'inherit',
              }}
            />
            <input
              type="text"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                marginBottom: '12px',
                fontFamily: 'inherit',
              }}
            />
            <button
              onClick={saveProfile}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '50px',
                background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                border: 'none',
                color: 'white',
                fontWeight: 600,
                fontSize: '15px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Save Changes
            </button>
          </div>
        )}
      </div>

      {/* Policy Section */}
      <div
        style={{
          background: 'rgba(18, 18, 26, 0.6)',
          borderRadius: '16px',
          padding: '16px 18px',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <p style={{ fontSize: '12px', color: '#888', lineHeight: '1.6', margin: 0 }}>
          📜 By using ECHO, you agree to treat others with respect; no harassment, hate speech, bullying, illegal content, spam, or impersonation. Violations may result in a permanent ban.
        </p>
      </div>
    </div>
  );
};

export default Profile;