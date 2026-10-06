Full Updated Profile.js with UI Advancements

Here's the complete updated code with significant UI improvements:

```jsx
// src/components/pages/Profile/Profile.js
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { db } from '../../../services/firebase';
import { ref, onValue, update, set, get, query, orderByChild, equalTo, limitToFirst } from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import GifLibraryModal from '../../GifLibrary/GifLibraryModal';
import AvatarPicker from '../../AvatarPicker/AvatarPicker';
import Toast from '../../Toast/Toast';
import { useCachedImage } from '../../../utils/mediaCache';
import ChatEmojiPicker from '../Chat/ChatEmojiPicker';
import MoodPicker from '../../common/MoodPicker';
import Avatar from '../../common/Avatar';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import { listenToMyEchowers, listenToMyEchowerCount, listenToMyEchowingCount } from '../../../services/echowerService';
import AvatarCustomizer from './AvatarCustomizer';
import './Profile.css';

const STORAGE_PREFIX = 'echo_cache_';

const getFastLocal = (key) => {
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : null;
  } catch (e) {
    return null;
  }
};

const setFastLocal = (key, val) => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val));
  } catch (e) {
    console.error('FastCache write error', e);
  }
};

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

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const DEFAULT_INTEREST_TEMPLATES = [
  '🎮 Gaming', '🎵 Music', '💻 Tech', '🍿 Movies', '🎨 Art', '⛩️ Anime', '🏋️ Fitness', '📸 Photography', '✈️ Travel', '🚀 Coding',
];

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refreshProfile, profiles, fetchProfile } = useProfile();

  const [showGifLibrary, setShowGifLibrary] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showAvatarCustomizer, setShowAvatarCustomizer] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedUid, setCopiedUid] = useState(false);

  const NAME_MAX_LENGTH = 25;
  const BIO_MAX_LENGTH = 130;

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const nameInputRef = useRef(null);
  const bioInputRef = useRef(null);
  const editingContainerRef = useRef(null);

  const isDemoUser = user?.uid === DEMO_UID;

  // ─── Echower States ───
  const [showEchowersModal, setShowEchowersModal] = useState(false);
  const [followerUids, setFollowerUids] = useState([]);
  const [followingUids, setFollowingUids] = useState([]);
  const [activeEchowersTab, setActiveEchowersTab] = useState('followers');

  const cachedProfile = useMemo(() => {
    if (!user?.uid) return null;
    return getFastLocal(`profile_${user.uid}`);
  }, [user?.uid]);

  const cachedUserSkins = useMemo(() => {
    if (!user?.uid) return null;
    return getFastLocal(`echomoji_${user.uid}`);
  }, [user?.uid]);

  const [profile, setProfile] = useState(() => cachedProfile);
  const [activeSkinId, setActiveSkinId] = useState(() => cachedUserSkins?.active || cachedProfile?.activeSkin || null);
  const [activeHairStyle, setActiveHairStyle] = useState(() => cachedUserSkins?.hairStyle || 'short');
  const [loading, setLoading] = useState(() => !cachedProfile);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(() => cachedProfile || {
    name: '', avatar: '', videoUrl: '', mood: 'happy', activeSkin: null, bio: '', country: '', countryCode: '', city: '',
  });
  const [unlockedGifs, setUnlockedGifs] = useState([]);

  const imageInputRef = useRef(null);

  // ─── Name availability state ──────────────────────────────────
  const [nameAvailable, setNameAvailable] = useState(true);
  const [nameCheckLoading, setNameCheckLoading] = useState(false);

  const checkNameAvailability = useCallback(async (newName) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameAvailable(true);
      return;
    }
    if (profile?.name && trimmed.toLowerCase() === profile.name.toLowerCase()) {
      setNameAvailable(true);
      return;
    }

    setNameCheckLoading(true);
    try {
      const searchTerm = trimmed.toLowerCase();
      const profilesRef = ref(db, 'profiles');
      const q = query(profilesRef, orderByChild('searchName'), equalTo(searchTerm), limitToFirst(1));
      const snapshot = await get(q);
      const exists = snapshot.exists();
      setNameAvailable(!exists);
    } catch (err) {
      console.warn('Name check failed:', err);
      setNameAvailable(true);
    } finally {
      setNameCheckLoading(false);
    }
  }, [profile]);

  const debounceTimer = useRef(null);

  useEffect(() => {
    if (!editing) return;
    const newName = editData.name || '';
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      checkNameAvailability(newName);
    }, 400);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [editData.name, editing, checkNameAvailability]);

  // ─── Profile & Echower listeners ──────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    const profileCacheKey = `profile_${user.uid}`;
    const skinCacheKey = `echomoji_${user.uid}`;

    const skinRef = ref(db, `userSkins/${user.uid}`);
    const unsubSkin = onValue(skinRef, (snap) => {
      if (!isMounted) return;
      const data = snap.val() || {};
      const newActive = data.activeSkin || data.active || null;
      const newHair = data.hairStyle || 'short';
      setActiveSkinId(newActive);
      setActiveHairStyle(newHair);
      setUnlockedGifs(data.unlockedGifs || []);
      const existingSkinCache = getFastLocal(skinCacheKey) || {};
      setFastLocal(skinCacheKey, { ...existingSkinCache, active: newActive, hairStyle: newHair });
    });

    const profileRef = ref(db, `profiles/${user.uid}`);
    const unsubProfile = onValue(
      profileRef,
      async (snapshot) => {
        if (!isMounted) return;
        let safeData;
        if (snapshot.exists()) {
          const data = snapshot.val();
          safeData = {
            ...data,
            name: data.name || data.username || data.displayName || user.displayName || 'User',
            avatar: data.avatar || '',
            videoUrl: data.videoUrl || '',
          };
        } else {
          safeData = {
            name: user.displayName || user.email?.split('@')[0] || 'User',
            avatar: '',
            videoUrl: '',
            mood: 'happy',
            activeSkin: null,
            bio: 'New to ECHO! 🌊',
            country: '',
            countryCode: '',
            city: '',
            lastActive: Date.now(),
            createdAt: Date.now(),
          };
          await set(profileRef, safeData);
        }

        setProfile(safeData);
        setFastLocal(profileCacheKey, safeData);
        if (!editing) setEditData(safeData);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to profile:', err);
        setLoading(false);
      }
    );

    const unsubFollowers = listenToMyEchowerCount(user.uid, (uids) => {
      setFollowerUids(uids);
      uids.forEach(uid => fetchProfile(uid));
    });

    const unsubFollowing = listenToMyEchowers(user.uid, (uids) => {
      setFollowingUids(uids);
      uids.forEach(uid => fetchProfile(uid));
    });

    return () => {
      isMounted = false;
      unsubSkin();
      unsubProfile();
      unsubFollowers();
      unsubFollowing();
    };
  }, [user?.uid, editing, fetchProfile]);

  const handleSave = async () => {
    if (!user) return;

    const name = editData.name?.trim() || '';
    if (name.length > NAME_MAX_LENGTH) {
      setToast({ message: `Name must be ${NAME_MAX_LENGTH} characters or less.`, type: 'error' });
      return;
    }
    if (name.length === 0) {
      setToast({ message: 'Name is required.', type: 'error' });
      return;
    }

    const trimmedName = name.trim();
    const searchTerm = trimmedName.toLowerCase();
    if (profile?.name && trimmedName.toLowerCase() !== profile.name.toLowerCase()) {
      try {
        const profilesRef = ref(db, 'profiles');
        const q = query(profilesRef, orderByChild('searchName'), equalTo(searchTerm), limitToFirst(1));
        const snapshot = await get(q);
        if (snapshot.exists()) {
          const foundUid = Object.keys(snapshot.val())[0];
          if (foundUid !== user.uid) {
            setToast({ message: 'Name already taken. Please choose another.', type: 'error' });
            return;
          }
        }
      } catch (err) {
        console.warn('Final name check failed:', err);
      }
    }

    const bio = editData.bio?.trim() || '';
    if (bio.length > BIO_MAX_LENGTH) {
      setToast({ message: `Bio must be ${BIO_MAX_LENGTH} characters or less.`, type: 'error' });
      return;
    }

    try {
      const cacheKey = `profile_${user.uid}`;
      const profileRef = ref(db, `profiles/${user.uid}`);
      const updates = { ...editData, name, bio, searchName: name.toLowerCase() };
      await update(profileRef, updates);
      setFastLocal(cacheKey, updates);
      setProfile(updates);
      await refreshProfile(user.uid);
      setEditing(false);
      setToast({ message: 'Profile saved successfully!', type: 'success' });
    } catch (error) {
      console.error('Error saving profile:', error);
      setToast({ message: 'Failed to save profile.', type: 'error' });
    }
  };

  const handleSaveAvatar = async (avatarData) => {
    if (!user) return;
    try {
      const skinRef = ref(db, `userSkins/${user.uid}`);
      const existingData = getFastLocal(`echomoji_${user.uid}`) || {};
      const updates = { 
        ...existingData,
        activeSkin: avatarData.activeSkin,
        hairStyle: avatarData.hairStyle,
      };
      await update(skinRef, updates);
      setFastLocal(`echomoji_${user.uid}`, updates);
      setActiveSkinId(avatarData.activeSkin);
      setActiveHairStyle(avatarData.hairStyle);
      setShowAvatarCustomizer(false);
      setToast({ message: 'Avatar updated successfully!', type: 'success' });
    } catch (err) {
      console.error('Failed to save avatar:', err);
      setToast({ message: 'Failed to save avatar.', type: 'error' });
    }
  };

  const handleCopyUid = () => {
    if (!user?.uid) return;
    navigator.clipboard.writeText(user.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleUploadImage = async (file) => {
    if (!user) return;

    if (file.size > MAX_FILE_SIZE) {
      setToast({ message: 'File size exceeds 5 MB. Choose a smaller file.', type: 'error' });
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setToast({ message: 'Please upload a valid image (PNG, JPEG, WEBP).', type: 'error' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Upload failed');

      const downloadUrl = data.secure_url;

      const updateData = { avatar: downloadUrl, videoUrl: '', activeSkin: null };

      setProfile((prev) => ({ ...prev, ...updateData }));
      setEditData((prev) => ({ ...prev, ...updateData }));

      await update(ref(db, `profiles/${user.uid}`), updateData);
      await refreshProfile(user.uid);

      setToast({ message: 'Image uploaded successfully!', type: 'success' });
      setShowAvatarPicker(false);
    } catch (err) {
      console.error('Upload error:', err);
      setToast({ message: 'Upload failed. Check Cloudinary preset.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleImageFile = (e) => {
    if (e.target.files[0]) handleUploadImage(e.target.files[0]);
    e.target.value = '';
  };

  const handleGifSelect = async (gif) => {
    try {
      const updateData = { videoUrl: gif.url, avatar: gif.url, activeSkin: null };
      setProfile((prev) => ({ ...prev, ...updateData }));
      setEditData((prev) => ({ ...prev, ...updateData }));

      await update(ref(db, `profiles/${user.uid}`), updateData);
      await refreshProfile(user.uid);
      setShowGifLibrary(false);
      setToast({ message: 'Profile GIF updated!', type: 'success' });
    } catch (err) {
      console.error('Failed to set GIF:', err);
      setToast({ message: 'Failed to set GIF.', type: 'error' });
    }
  };

  const handleMoodChange = async (mood) => {
    if (!user) return;
    try {
      await update(ref(db, `profiles/${user.uid}`), { mood });
      setProfile((prev) => ({ ...prev, mood }));
      setEditData((prev) => ({ ...prev, mood }));
    } catch (err) {
      console.error('Failed to update mood:', err);
    }
  };

  const insertTextAtCursor = (field, text) => {
    const el = field === 'name' ? nameInputRef.current : bioInputRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = el.value;
    const newValue = value.substring(0, start) + text + value.substring(end);
    const newCursor = start + text.length;

    if (field === 'name') {
      setEditData({ ...editData, name: newValue });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(newCursor, newCursor);
      }, 0);
    } else {
      setEditData({ ...editData, bio: newValue });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(newCursor, newCursor);
      }, 0);
    }
  };

  const handleEmojiSelect = (emoji) => {
    if (!activeField) return;
    const field = activeField;
    const currentValue = field === 'name' ? editData.name : editData.bio;
    const maxLength = field === 'name' ? NAME_MAX_LENGTH : BIO_MAX_LENGTH;

    if ((currentValue || '').length + emoji.length > maxLength) {
      setToast({ message: `Cannot add emoji – ${field} limit reached.`, type: 'error' });
      return;
    }

    insertTextAtCursor(field, emoji);
  };

  const openEmojiPicker = (field) => {
    setActiveField(field);
    setShowEmojiPicker(true);
    setTimeout(() => {
      if (field === 'name' && nameInputRef.current) {
        nameInputRef.current.focus();
      } else if (field === 'bio' && bioInputRef.current) {
        bioInputRef.current.focus();
      }
    }, 50);
  };

  const closeEmojiPicker = () => {
    setShowEmojiPicker(false);
    setActiveField(null);
  };

  const handleInputFocus = (field) => {
    if (showEmojiPicker) {
      setActiveField(field);
    }
  };

  const handleInputMouseDown = (e) => {
    e.stopPropagation();
    const field = e.target === nameInputRef.current ? 'name' : 'bio';
    if (showEmojiPicker) {
      setActiveField(field);
    }
  };

  const currentMediaUrl = (editing ? editData.videoUrl : profile?.videoUrl) ||
    (editing ? editData.avatar : profile?.avatar);
  const cachedMediaUrl = useCachedImage(currentMediaUrl, null);
  const displayMediaUrl = cachedMediaUrl || currentMediaUrl;

  const isVideoFormat = (editing ? editData.videoUrl : profile?.videoUrl) &&
    ((editing ? editData.videoUrl : profile?.videoUrl)?.endsWith('.mp4') ||
     (editing ? editData.videoUrl : profile?.videoUrl)?.endsWith('.webm'));

  const currentSkinId = activeSkinId || profile?.activeSkin;
  const activeSkinObj = useMemo(() => (currentSkinId ? getSkinById(currentSkinId) : null), [currentSkinId]);

  // ─── Format member since date ───
  const memberSince = profile?.createdAt 
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  return (
    <>
      <SEO
        title="Profile – Your Identity"
        description="Manage your profile, mood, and avatar on ECHO. Show the world who you are with your unique ECHOMOJI."
      />
      <StructuredData />
      <div className="profile-page">
        <input type="file" ref={imageInputRef} accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} onChange={handleImageFile} />

        <div className="profile-card">
          {/* ─── Decorative Background Glow ─── */}
          <div className="profile-card-glow" />

          {/* ─── Avatar with Ring Animation ─── */}
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar-ring" />
            <div
              className="profile-avatar"
              onClick={() => (editing || isDemoUser) && setShowAvatarPicker(true)}
              style={{ cursor: (editing || isDemoUser) ? 'pointer' : 'default' }}
            >
              {loading ? (
                <SkeletonBlock width="100%" height="100%" borderRadius="50%" />
              ) : isVideoFormat ? (
                <video src={displayMediaUrl} autoPlay loop muted playsInline />
              ) : displayMediaUrl ? (
                <img src={displayMediaUrl} alt="Avatar" />
              ) : (
                <Avatar src={null} name={editData?.name || profile?.name || 'User'} size={110} />
              )}
              {(editing || isDemoUser) && <div className="avatar-overlay">Tap to change</div>}
            </div>

            {/* ─── Online Status Badge ─── */}
            <div className="profile-status-badge">
              <span className="status-dot" />
              <span className="status-text">Active</span>
            </div>
          </div>

          {/* ─── Name Section ─── */}
          <div className="profile-name-section">
            {isDemoUser ? (
              <div className="profile-name">{profile?.name || 'User'}</div>
            ) : editing ? (
              <div ref={editingContainerRef} className="profile-name-edit-wrapper">
                <div className="profile-name-input-wrapper">
                  <input
                    ref={nameInputRef}
                    type="text"
                    className="profile-name-input"
                    value={editData.name || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.length <= NAME_MAX_LENGTH) {
                        setEditData({ ...editData, name: val });
                      }
                    }}
                    placeholder="Your name"
                    maxLength={NAME_MAX_LENGTH}
                    style={{
                      borderColor: (!nameAvailable && editData.name?.trim()) ? '#EF4444' : 'var(--border-color)',
                    }}
                    onFocus={() => handleInputFocus('name')}
                    onMouseDown={handleInputMouseDown}
                    onTouchStart={handleInputMouseDown}
                  />
                  <button
                    type="button"
                    className="emoji-btn"
                    onClick={() => openEmojiPicker('name')}
                    title="Insert emoji"
                  >
                    <i className="fas fa-smile" />
                  </button>
                  <span className="char-counter">
                    {editData.name?.length || 0}/{NAME_MAX_LENGTH}
                  </span>
                </div>
                {!nameAvailable && editData.name?.trim() && (
                  <span className="name-status taken">Taken</span>
                )}
                {nameAvailable && editData.name?.trim() && editData.name?.trim() !== profile?.name && (
                  <span className="name-status available">Available</span>
                )}
                {nameCheckLoading && (
                  <span className="name-status checking">checking...</span>
                )}
              </div>
            ) : loading ? (
              <SkeletonBlock width="140px" height="22px" />
            ) : (
              <div className="profile-name">{profile?.name || 'User'}</div>
            )}

            {/* ─── Member Since Tag ─── */}
            {!editing && !loading && (
              <div className="profile-meta">
                <span className="member-since">
                  <i className="fas fa-calendar-alt" /> Member since {memberSince}
                </span>
                {profile?.country && (
                  <span className="location-tag">
                    <i className="fas fa-map-marker-alt" /> {profile.city ? `${profile.city}, ` : ''}{profile.country}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ─── Bio Section ─── */}
          {isDemoUser ? (
            <p className="profile-bio">{profile?.bio || 'No bio yet.'}</p>
          ) : editing ? (
            <div className="profile-bio-edit-wrapper">
              <textarea
                ref={bioInputRef}
                className="profile-bio-textarea"
                value={editData.bio || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.length <= BIO_MAX_LENGTH) {
                    setEditData({ ...editData, bio: val });
                  }
                }}
                placeholder="Write a short bio..."
                rows={3}
                maxLength={BIO_MAX_LENGTH}
              />
              <button
                type="button"
                className="emoji-btn bio-emoji-btn"
                onClick={() => openEmojiPicker('bio')}
                title="Insert emoji"
              >
                <i className="fas fa-smile" />
              </button>
              <span className="char-counter bio-counter">
                {editData.bio?.length || 0}/{BIO_MAX_LENGTH}
              </span>
            </div>
          ) : (
            profile?.bio && <p className="profile-bio">{profile.bio}</p>
          )}

          {/* ─── Mood & Avatar Customization Card ─── */}
          {!loading && (
            <div className="mood-customize-card">
              {editing ? (
                <>
                  <div className="mood-label">Choose your mood</div>
                  <MoodPicker currentMood={editData.mood || 'neutral'} onSelect={handleMoodChange} />
                </>
              ) : (
                <div className="mood-display">
                  <div className="mood-preview">
                    <ECHOMOJI 
                      mood={profile?.mood || 'happy'} 
                      skin={activeSkinObj} 
                      hairStyle={activeHairStyle}
                      size={56} 
                      interactive={false} 
                      animated={true} 
                    />
                    <div className="mood-info">
                      <span className="mood-label-small">Current Mood</span>
                      <span className="mood-value">
                        {profile?.mood || 'happy'}
                      </span>
                    </div>
                  </div>
                  
                  <button
                    className="customize-avatar-btn"
                    onClick={() => setShowAvatarCustomizer(true)}
                  >
                    <i className="fas fa-palette" /> Customize Avatar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── Avatar Customizer Component ─── */}
          {showAvatarCustomizer && !editing && (
            <AvatarCustomizer
              currentSkin={activeSkinObj}
              currentHair={activeHairStyle}
              currentMood={profile?.mood}
              onSave={handleSaveAvatar}
              onCancel={() => setShowAvatarCustomizer(false)}
            />
          )}

          {/* ─── Echower Stats (Enhanced) ─── */}
          <div className="profile-stats-enhanced">
            <div className="stat-card" onClick={() => { setActiveEchowersTab('followers'); setShowEchowersModal(true); }}>
              <div className="stat-icon">
                <i className="fas fa-users" />
              </div>
              <div className="stat-info">
                <h4>{followerUids.length}</h4>
                <p>Echowers</p>
              </div>
            </div>
            <div className="stat-card" onClick={() => { setActiveEchowersTab('following'); setShowEchowersModal(true); }}>
              <div className="stat-icon">
                <i className="fas fa-broadcast-tower" />
              </div>
              <div className="stat-info">
                <h4>{followingUids.length}</h4>
                <p>Echowing</p>
              </div>
            </div>
          </div>

          {/* ─── Moving Interests Marquee ─── */}
          <div className="moving-interests-container">
            <div className="moving-interests-track">
              {[...DEFAULT_INTEREST_TEMPLATES, ...DEFAULT_INTEREST_TEMPLATES].map((item, idx) => (
                <span key={idx} className="interest-pill">
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* ─── Action Buttons ─── */}
          <div className="profile-actions">
            {editing ? (
              isDemoUser ? null : (
                <>
                  <button
                    className="save-btn"
                    onClick={handleSave}
                    disabled={!nameAvailable && editData.name?.trim()}
                  >
                    <i className="fas fa-check" /> Save Changes
                  </button>
                  <button
                    className="cancel-btn"
                    onClick={() => { setEditing(false); setEditData(profile); }}
                  >
                    Cancel
                  </button>
                </>
              )
            ) : (
              <button
                className="edit-btn"
                onClick={() => {
                  if (isDemoUser) {
                    setShowAvatarPicker(true);
                  } else {
                    setEditing(true);
                  }
                }}
              >
                {isDemoUser ? (
                  <><i className="fas fa-image" /> Change Avatar</>
                ) : (
                  <><i className="fas fa-pen" /> Edit Profile</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ─── Account Details Card ─── */}
        <div className="account-details">
          <div className="account-details-header">
            <i className="fas fa-shield-alt" />
            <span>ACCOUNT DETAILS</span>
          </div>
          <div className="account-details-row">
            <span className="account-details-label">Email</span>
            <span className="account-details-value">{user?.email || 'N/A'}</span>
          </div>
          <div className="account-details-row">
            <span className="account-details-label">User ID (UID)</span>
            <div className="account-details-uid-wrapper">
              <span className="account-details-value uid">{user?.uid}</span>
              <button className="copy-uid-btn" onClick={handleCopyUid}>
                {copiedUid ? (
                  <><i className="fas fa-check" /> Copied!</>
                ) : (
                  <><i className="fas fa-copy" /> Copy</>
                )}
              </button>
            </div>
          </div>
        </div>

        <AvatarPicker
          isOpen={showAvatarPicker}
          onClose={() => setShowAvatarPicker(false)}
          onUploadImage={() => {
            if (isDemoUser) {
              setToast({ message: 'Demo users cannot upload images.', type: 'error' });
              return;
            }
            imageInputRef.current?.click();
          }}
          onChooseLibrary={() => {
            setShowAvatarPicker(false);
            setShowGifLibrary(true);
          }}
          uploading={uploading}
          isDemo={isDemoUser}
        />

        <GifLibraryModal
          isOpen={showGifLibrary}
          onClose={() => setShowGifLibrary(false)}
          onSelect={handleGifSelect}
          ownedGifs={unlockedGifs}
          mode="profile"
        />
        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

        {showEmojiPicker && (
          <ChatEmojiPicker
            onClose={closeEmojiPicker}
            onSelect={handleEmojiSelect}
            excludeRefs={[editingContainerRef]}
            style={{
              position: 'fixed',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '320px',
              maxHeight: '70vh',
            }}
          />
        )}

        {/* ─── Echowers Modal (Followers & Following Tabs) ─── */}
        {showEchowersModal && (
          <div className="echowers-modal-overlay" onClick={() => setShowEchowersModal(false)}>
            <div className="echowers-modal" onClick={(e) => e.stopPropagation()}>
              <div className="echowers-modal-header">
                <h3>Echowers</h3>
                <button className="close-btn" onClick={() => setShowEchowersModal(false)}>✕</button>
              </div>

              <div className="echowers-tabs">
                <button 
                  className={activeEchowersTab === 'followers' ? 'active' : ''} 
                  onClick={() => setActiveEchowersTab('followers')}
                >
                  Echowers ({followerUids.length})
                </button>
                <button 
                  className={activeEchowersTab === 'following' ? 'active' : ''} 
                  onClick={() => setActiveEchowersTab('following')}
                >
                  Echowing ({followingUids.length})
                </button>
              </div>

              <div className="echowers-list">
                {(activeEchowersTab === 'followers' ? followerUids : followingUids).length === 0 ? (
                  <p className="empty-state">
                    {activeEchowersTab === 'followers' ? 'No one is Echowing you yet.' : 'You are not Echowing anyone yet.'}
                  </p>
                ) : (
                  (activeEchowersTab === 'followers' ? followerUids : followingUids).map((uid) => {
                    const profileData = profiles[uid];
                    if (!profileData) return null;
                    return (
                      <div 
                        key={uid} 
                        className="echower-item"
                        onClick={() => navigate(`/chat/${uid}`)}
                      >
                        <Avatar src={profileData.avatar} name={profileData.name} size={50} />
                        <div className="item-info">
                          <strong>{profileData.name}</strong>
                          <span>{profileData.bio || 'No bio yet'}</span>
                        </div>
                        <i className="fas fa-chevron-right" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Profile;
```

---

Updated Profile.css (Complete)

```css
/* src/components/pages/Profile/Profile.css */

.profile-page {
  padding: 16px;
  max-width: 600px;
  margin: 0 auto;
  min-height: 100vh;
  padding-bottom: 100px;
}

/* ─── Profile Card ─── */
.profile-card {
  background: var(--bg-card);
  border-radius: 24px;
  padding: 32px 24px 24px;
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
  position: relative;
  overflow: hidden;
}

.profile-card-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: radial-gradient(circle at 50% 0%, rgba(108, 60, 225, 0.15), transparent 60%);
  pointer-events: none;
  z-index: 0;
}

.profile-card > * {
  position: relative;
  z-index: 1;
}

/* ─── Avatar Wrapper with Ring ─── */
.profile-avatar-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.profile-avatar-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #6C3CE1, #EC4899, #6C3CE1);
  animation: rotateRing 4s linear infinite;
  z-index: 0;
}

@keyframes rotateRing {
  from { transform: translate(-50%, -50%) rotate(0deg); }
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

.profile-avatar {
  position: relative;
  width: 110px;
  height: 110px;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid var(--bg-card);
  z-index: 1;
  background: var(--bg-input);
}

.profile-avatar img,
.profile-avatar video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s;
}

.profile-avatar:hover .avatar-overlay {
  opacity: 1;
}

/* ─── Online Status Badge ─── */
.profile-status-badge {
  position: absolute;
  bottom: 4px;
  right: calc(50% - 60px);
  background: var(--bg-card);
  border: 2px solid var(--bg-card);
  border-radius: 20px;
  padding: 4px 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #10B981;
  z-index: 2;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10B981;
  animation: pulseDot 2s infinite;
}

@keyframes pulseDot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.2); }
}

/* ─── Name Section ─── */
.profile-name-section {
  text-align: center;
  margin-bottom: 16px;
}

.profile-name {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  text-align: center;
}

.profile-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  font-size: 12px;
  color: var(--text-muted);
}

.member-since,
.location-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.member-since i,
.location-tag i {
  font-size: 10px;
}

/* ─── Name Edit Wrapper ─── */
.profile-name-edit-wrapper {
  width: 100%;
  position: relative;
}

.profile-name-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.profile-name-input {
  width: 100%;
  padding: 12px 16px 12px 44px;
  border-radius: 12px;
  border: 2px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
  outline: none;
  transition: border-color 0.2s;
}

.profile-name-input:focus {
  border-color: #6C3CE1;
}

.emoji-btn {
  position: absolute;
  left: 12px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  z-index: 2;
  transition: color 0.2s;
}

.emoji-btn:hover {
  color: #6C3CE1;
}

.char-counter {
  position: absolute;
  right: 12px;
  bottom: 4px;
  font-size: 10px;
  color: var(--text-muted);
  pointer-events: none;
}

.name-status {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  font-weight: 600;
}

.name-status.taken {
  color: #EF4444;
}

.name-status.available {
  color: #10B981;
}

.name-status.checking {
  color: var(--text-muted);
}

/* ─── Bio Section ─── */
.profile-bio {
  font-size: 14px;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.5;
  margin: 0 0 16px;
  padding: 0 8px;
}

.profile-bio-edit-wrapper {
  position: relative;
  margin-bottom: 16px;
}

.profile-bio-textarea {
  width: 100%;
  padding: 12px 16px 24px 44px;
  border-radius: 12px;
  border: 2px solid var(--border-color);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  min-height: 80px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
}

.profile-bio-textarea:focus {
  border-color: #6C3CE1;
}

.bio-emoji-btn {
  top: 12px;
  left: 12px;
}

.bio-counter {
  bottom: 8px;
}

/* ─── Mood & Customize Card ─── */
.mood-customize-card {
  margin: 16px 0;
  padding: 16px;
  background: var(--bg-input);
  border-radius: 16px;
  border: 1px solid var(--border-color);
}

.mood-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  font-weight: 600;
}

.mood-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.mood-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  justify-content: center;
}

.mood-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mood-label-small {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.mood-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: capitalize;
}

.customize-avatar-btn {
  background: transparent;
  border: 1.5px solid #6C3CE1;
  color: #6C3CE1;
  padding: 10px 24px;
  border-radius: 24px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  width: 100%;
  justify-content: center;
}

.customize-avatar-btn:hover {
  background: rgba(108, 60, 225, 0.1);
  transform: translateY(-1px);
}

/* ─── Enhanced Stats ─── */
.profile-stats-enhanced {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 16px 0;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: var(--bg-input);
  border-radius: 14px;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 0.2s;
}

.stat-card:hover {
  border-color: #6C3CE1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(108, 60, 225, 0.15);
}

.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(108, 60, 225, 0.15), rgba(236, 72, 153, 0.15));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6C3CE1;
  font-size: 16px;
  flex-shrink: 0;
}

.stat-info h4 {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.2;
}

.stat-info p {
  font-size: 11px;
  color: var(--text-muted);
  margin: 2px 0 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

/* ─── Moving Interests ─── */
.moving-interests-container {
  width: 100%;
  overflow: hidden;
  padding: 8px 0;
  margin-top: 16px;
  mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
}

.moving-interests-track {
  display: flex;
  gap: 8px;
  width: max-content;
  animation: scrollInterests 18s linear infinite;
}

.interest-pill {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 12px;
  white-space: nowrap;
  font-weight: 500;
}

@keyframes scrollInterests {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

/* ─── Action Buttons ─── */
.profile-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
  justify-content: center;
}

.edit-btn,
.save-btn {
  background: linear-gradient(135deg, #6C3CE1, #EC4899);
  color: #fff;
  border: none;
  padding: 12px 28px;
  border-radius: 24px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
  box-shadow: 0 4px 16px rgba(108, 60, 225, 0.3);
}

.edit-btn:hover,
.save-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(108, 60, 225, 0.4);
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.cancel-btn {
  background: var(--bg-input);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  padding: 12px 28px;
  border-radius: 24px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.2s;
}

.cancel-btn:hover {
  background: var(--bg-card);
}

/* ─── Account Details ─── */
.account-details {
  background: var(--bg-card);
  border-radius: 20px;
  padding: 20px;
  border: 1px solid var(--border-color);
}

.account-details-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.account-details-header i {
  color: #6C3CE1;
}

.account-details-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.account-details-row:last-child {
  border-bottom: none;
}

.account-details-label {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.account-details-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
  max-width: 60%;
  text-align: right;
  word-break: break-all;
}

.account-details-uid-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 70%;
}

.account-details-value.uid {
  font-family: monospace;
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-uid-btn {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  color: #6C3CE1;
  padding: 6px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  transition: all 0.2s;
}

.copy-uid-btn:hover {
  background: rgba(108, 60, 225, 0.1);
}

/* ─── Echowers Modal ─── */
.echowers-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}

.echowers-modal {
  background: var(--bg-card);
  border-radius: 20px;
  width: 100%;
  max-width: 420px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.echowers-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.echowers-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
}

.echowers-tabs {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-color);
}

.echowers-tabs button {
  flex: 1;
  background: none;
  border: none;
  padding: 14px 8px;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.echowers-tabs button.active {
  color: #6C3CE1;
  border-bottom-color: #6C3CE1;
}

.echowers-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.echower-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.echower-item:hover {
  background: var(--bg-input);
}

.echower-item .item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.echower-item .item-info strong {
  font-size: 14px;
  color: var(--text-primary);
}

.echower-item .item-info span {
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.echower-item > i {
  color: var(--text-muted);
  font-size: 12px;
}

.empty-state {
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
  padding: 32px 16px;
}

/* ─── Pulse Animation ─── */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ─── Responsive ─── */
@media (max-width: 480px) {
  .profile-page {
    padding: 12px;
  }

  .profile-card {
    padding: 24px 16px 20px;
    border-radius: 20px;
  }

  .profile-name {
    font-size: 20px;
  }

  .profile-stats-enhanced {
    gap: 8px;
  }

  .stat-card {
    padding: 12px;
  }

  .stat-icon {
    width: 36px;
    height: 36px;
    font-size: 14px;
  }

  .stat-info h4 {
    font-size: 16px;
  }
}
```

---

Key UI Advancements Made:

1. Animated Avatar Ring

· Gradient conic ring that rotates continuously around the avatar
· Creates a premium, dynamic feel

2. Online Status Badge

· Green pulsing dot with "Active" label
· Positioned on the avatar edge

3. Enhanced Name Section

· Member since date with calendar icon
· Location tag with map pin
· Better spacing and centering

4. Mood & Customize Card

· Preview of current ECHOMOJI with mood label
· Full-width "Customize Avatar" button with palette icon
· Cleaner layout with mood value displayed prominently

5. Enhanced Stats Cards

· Icon-based stat cards with gradient backgrounds
· Hover lift effect
· Better visual hierarchy

6. Interests Marquee

· Gradient fade masks on edges
· Smoother animation
· Better pill styling

7. Improved Buttons

· Gradient backgrounds with shadow
· Icon + text combinations
· Hover lift effects

8. Account Details

· Shield icon header
· Better UID display with monospace font
· Copy button with icon states

9. Echowers Modal

· Chevron indicators on items
· Better hover states
· Improved spacing

10. Responsive Refinements

· Mobile-optimized padding and font sizes
· Grid adjustments for small screens
