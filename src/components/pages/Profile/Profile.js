// src/components/pages/Profile/Profile.js
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { db } from '../../../services/firebase';
import { ref, onValue, update, set } from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import './Profile.css';

// Reusable Pulse Skeleton Block
const SkeletonBlock = ({ width = '100%', height = '16px', borderRadius = '8px', style = {} }) => (
  <div
    style={{
      width,
      height,
      borderRadius,
      background: 'rgba(255,255,255,0.08)',
      animation: 'pulse 1.5s infinite ease-in-out',
      ...style,
    }}
  />
);

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    avatar: '',
    mood: 'neutral',
    activeSkin: null,
    bio: '',
    interests: [],
    skills: [],
    country: '',
    city: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const fileInputRef = useRef(null);
  const tagInputRef = useRef(null);
  const skillInputRef = useRef(null);

  // Real-time Profile Listener
  useEffect(() => {
    if (!user?.uid) return;

    const profileRef = ref(db, `profiles/${user.uid}`);
    const unsubscribe = onValue(
      profileRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const safeData = {
            ...data,
            name: data.name || data.username || data.displayName || user.displayName || 'User',
            interests: data.interests || [],
            skills: data.skills || [],
          };
          setProfile(safeData);
          setEditData((prev) => (editing ? prev : safeData));
        } else {
          const defaultProfile = {
            name: user.displayName || user.email?.split('@')[0] || 'User',
            avatar: '',
            mood: 'neutral',
            activeSkin: null,
            bio: 'New to ECHO! 🌊',
            interests: [],
            skills: [],
            country: '',
            city: '',
            lastActive: Date.now(),
            createdAt: Date.now(),
          };
          await set(profileRef, defaultProfile);
          setProfile(defaultProfile);
          setEditData(defaultProfile);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to profile:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, editing]);

  const handleSave = async () => {
    if (!user) return;
    try {
      const profileRef = ref(db, `profiles/${user.uid}`);
      await update(profileRef, editData);
      setProfile(editData);
      setEditing(false);
    } catch (err) {
      console.error('Error saving profile:', err);
    }
  };

  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditData({ ...editData, avatar: reader.result });
    };
    reader.readAsDataURL(file);
  };

  // ─── Interests ──────────────────────────────────────────────
  const handleTagInputChange = (e) => {
    const value = e.target.value;
    if (value.includes(',')) {
      const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length) {
        setEditData({ ...editData, interests: [...(editData.interests || []), ...parts] });
        setTagInput('');
      }
    } else {
      setTagInput(value);
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim();
      if (!(editData.interests || []).includes(newTag)) {
        setEditData({ ...editData, interests: [...(editData.interests || []), newTag] });
      }
      setTagInput('');
    }
  };

  const removeTag = (index) => {
    const newInterests = (editData.interests || []).filter((_, i) => i !== index);
    setEditData({ ...editData, interests: newInterests });
  };

  // ─── Skills ──────────────────────────────────────────────────
  const handleSkillInputChange = (e) => {
    const value = e.target.value;
    if (value.includes(',')) {
      const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length) {
        setEditData({ ...editData, skills: [...(editData.skills || []), ...parts] });
        setSkillInput('');
      }
    } else {
      setSkillInput(value);
    }
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === 'Enter' && skillInput.trim()) {
      e.preventDefault();
      const newSkill = skillInput.trim();
      if (!(editData.skills || []).includes(newSkill)) {
        setEditData({ ...editData, skills: [...(editData.skills || []), newSkill] });
      }
      setSkillInput('');
    }
  };

  const removeSkill = (index) => {
    const newSkills = (editData.skills || []).filter((_, i) => i !== index);
    setEditData({ ...editData, skills: newSkills });
  };

  const activeSkinObj = profile?.activeSkin ? getSkinById(profile.activeSkin) : null;
  const skinForPreview = activeSkinObj
    ? {
        bgStart: activeSkinObj.bgStart,
        bgEnd: activeSkinObj.bgEnd,
        ledColor: activeSkinObj.ledColor,
        glowColor: activeSkinObj.glowColor,
      }
    : null;

  const currentMood = profile?.mood || 'neutral';
  const initials = ((profile?.name || user?.displayName || 'U')[0] || 'U').toUpperCase();

  return (
    <div className="profile-page">
      <div className="profile-card">
        {/* Avatar Section */}
        <div className="profile-avatar" onClick={() => editing && fileInputRef.current?.click()}>
          {loading ? (
            <SkeletonBlock width="100%" height="100%" borderRadius="50%" />
          ) : editData.avatar ? (
            <img src={editData.avatar} alt="Avatar" />
          ) : (
            <span>{initials}</span>
          )}
          {editing && <div className="avatar-overlay">Tap to change</div>}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />
        </div>

        {/* Name */}
        {editing ? (
          <input
            type="text"
            className="profile-name-input"
            value={editData.name || ''}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            placeholder="Your name"
          />
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
            <SkeletonBlock width="140px" height="22px" />
          </div>
        ) : (
          <div className="profile-name">{profile?.name || 'User'}</div>
        )}

        {/* Location */}
        {editing ? (
          <div className="profile-location-inputs">
            <input
              type="text"
              value={editData.country || ''}
              onChange={(e) => setEditData({ ...editData, country: e.target.value })}
              placeholder="Country"
            />
            <input
              type="text"
              value={editData.city || ''}
              onChange={(e) => setEditData({ ...editData, city: e.target.value })}
              placeholder="City"
            />
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}>
            <SkeletonBlock width="100px" height="14px" />
          </div>
        ) : (
          <div className="profile-location">
            {profile?.country && profile?.city
              ? `${profile.country} · ${profile.city}`
              : profile?.country || profile?.city || '📍 Location not set'}
          </div>
        )}

        {/* EchoMoji Preview Section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            margin: '12px 0',
          }}
        >
          {loading ? (
            <SkeletonBlock width="56px" height="56px" borderRadius="12px" />
          ) : (
            <ECHOMOJI mood={currentMood} skin={skinForPreview} size={56} interactive={false} animated={false} />
          )}

          <div style={{ textAlign: 'left' }}>
            {loading ? (
              <>
                <SkeletonBlock width="80px" height="14px" style={{ marginBottom: 4 }} />
                <SkeletonBlock width="60px" height="12px" />
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, color: '#888' }}>
                  Mood: <span style={{ textTransform: 'capitalize', color: '#fff' }}>{currentMood}</span>
                </div>
                {activeSkinObj && (
                  <div style={{ fontSize: 12, color: '#6C3CE1' }}>✦ {activeSkinObj.name}</div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bio Section */}
        {editing ? (
          <textarea
            className="profile-bio-textarea"
            value={editData.bio || ''}
            onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
            placeholder="Tell the world about yourself..."
          />
        ) : loading ? (
          <div style={{ margin: '12px 0' }}>
            <SkeletonBlock width="80%" height="14px" style={{ margin: '0 auto 6px' }} />
            <SkeletonBlock width="60%" height="14px" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <div className="profile-bio">{profile?.bio || 'No bio yet.'}</div>
        )}

        {/* ─── INTERESTS ────────────────────────────────────── */}
        <div style={{ marginTop: 12 }}>
          {editing ? (
            <div>
              <div className="profile-tag-input-wrapper">
                {(editData.interests || []).map((tag, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(108,60,225,0.2)',
                      color: '#8B5CF6',
                      padding: '4px 10px 4px 14px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    #{tag}
                    <button
                      onClick={() => removeTag(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8B5CF6',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '0 2px',
                        opacity: 0.7,
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInput}
                  onChange={handleTagInputChange}
                  onKeyDown={handleTagKeyDown}
                  placeholder={!editData.interests?.length ? 'Add interests (press Enter or comma)' : ''}
                  className="profile-tag-input"
                />
              </div>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '8px 0' }}>
              <SkeletonBlock width="60px" height="24px" borderRadius="20px" />
              <SkeletonBlock width="75px" height="24px" borderRadius="20px" />
              <SkeletonBlock width="50px" height="24px" borderRadius="20px" />
            </div>
          ) : (
            <div className="profile-tags-container">
              {(profile?.interests || []).length > 0 ? (
                profile.interests.map((interest, idx) => (
                  <span key={idx} className="profile-tag">
                    #{interest}
                  </span>
                ))
              ) : (
                <span style={{ color: '#555', fontSize: 12 }}>No interests added yet</span>
              )}
            </div>
          )}
        </div>

        {/* ─── SKILLS ────────────────────────────────────────── */}
        <div style={{ marginTop: 12 }}>
          {editing ? (
            <div>
              <div className="profile-tag-input-wrapper">
                {(editData.skills || []).map((skill, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      background: 'rgba(236,72,153,0.15)',
                      color: '#EC4899',
                      padding: '4px 10px 4px 14px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    ⚡{skill}
                    <button
                      onClick={() => removeSkill(idx)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EC4899',
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '0 2px',
                        opacity: 0.7,
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <input
                  ref={skillInputRef}
                  type="text"
                  value={skillInput}
                  onChange={handleSkillInputChange}
                  onKeyDown={handleSkillKeyDown}
                  placeholder={!editData.skills?.length ? 'Add skills (press Enter or comma)' : ''}
                  className="profile-tag-input"
                />
              </div>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, margin: '8px 0' }}>
              <SkeletonBlock width="70px" height="24px" borderRadius="20px" />
              <SkeletonBlock width="65px" height="24px" borderRadius="20px" />
            </div>
          ) : (
            <div className="profile-tags-container">
              {(profile?.skills || []).length > 0 ? (
                profile.skills.map((skill, idx) => (
                  <span key={idx} className="profile-tag skill">
                    ⚡{skill}
                  </span>
                ))
              ) : (
                <span style={{ color: '#555', fontSize: 12 }}>No skills added yet</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="profile-edit-actions">
          {editing ? (
            <>
              <button className="btn-save" onClick={handleSave}>
                Save Profile
              </button>
              <button
                className="btn-cancel"
                onClick={() => {
                  setEditData(profile);
                  setEditing(false);
                  setTagInput('');
                  setSkillInput('');
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button className="btn-edit" onClick={() => setEditing(true)} disabled={loading}>
              ✎ Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* UID & Email */}
      <div
        style={{
          background: 'rgba(18,18,26,0.6)',
          borderRadius: 16,
          padding: '16px 20px',
          border: '1px solid rgba(255,255,255,0.04)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 12, color: '#555', fontFamily: 'monospace' }}>
          UID: {user?.uid || '...'}
        </div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{user?.email}</div>
      </div>

      {/* Policy */}
      <div
        style={{
          background: 'rgba(18,18,26,0.3)',
          borderRadius: 12,
          padding: '12px 16px',
          border: '1px solid rgba(255,255,255,0.03)',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 11, color: '#555', lineHeight: 1.5, margin: 0 }}>
          By using ECHO, you agree to treat others with respect.
        </p>
      </div>
    </div>
  );
};

export default Profile;