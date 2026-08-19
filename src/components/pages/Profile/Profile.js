// src/components/pages/Profile/Profile.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { db } from '../../../services/firebase';
import { ref, onValue, update, set } from 'firebase/database';
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
  '🎮 Gaming',
  '🎵 Music',
  '💻 Tech',
  '🍿 Movies',
  '🎨 Art',
  '⛩️ Anime',
  '🏋️ Fitness',
  '📸 Photography',
  '✈️ Travel',
  '🚀 Coding',
];

const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';

const Profile = () => {
  const { user } = useAuth();
  const { refreshProfile } = useProfile();

  const [showGifLibrary, setShowGifLibrary] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
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
  const [loading, setLoading] = useState(() => !cachedProfile);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(() => cachedProfile || {
    name: '',
    avatar: '',
    videoUrl: '',
    mood: 'happy',
    activeSkin: null,
    bio: '',
    country: '',
    countryCode: '',
    city: '',
  });
  const [unlockedGifs, setUnlockedGifs] = useState([]);

  const imageInputRef = useRef(null);

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
      setActiveSkinId(newActive);
      setUnlockedGifs(data.unlockedGifs || []);
      const existingSkinCache = getFastLocal(skinCacheKey) || {};
      setFastLocal(skinCacheKey, { ...existingSkinCache, active: newActive });
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

    return () => {
      isMounted = false;
      unsubSkin();
      unsubProfile();
    };
  }, [user?.uid, editing]);

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

    const bio = editData.bio?.trim() || '';
    if (bio.length > BIO_MAX_LENGTH) {
      setToast({ message: `Bio must be ${BIO_MAX_LENGTH} characters or less.`, type: 'error' });
      return;
    }

    try {
      const cacheKey = `profile_${user.uid}`;
      const profileRef = ref(db, `profiles/${user.uid}`);
      const updates = { ...editData, name, bio };
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

      const updateData = {
        avatar: downloadUrl,
        videoUrl: '',
        activeSkin: null,
      };

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
          <div
            className="profile-avatar"
            onClick={() => (editing || isDemoUser) && setShowAvatarPicker(true)}
            style={{ cursor: (editing || isDemoUser) ? 'pointer' : 'default', position: 'relative' }}
          >
            {loading ? (
              <SkeletonBlock width="100%" height="100%" borderRadius="50%" />
            ) : isVideoFormat ? (
              <video src={displayMediaUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : displayMediaUrl ? (
              <img src={displayMediaUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <Avatar src={null} name={editData?.name || profile?.name || 'User'} size={110} />
            )}
            {(editing || isDemoUser) && <div className="avatar-overlay">Tap to change</div>}
          </div>

          {isDemoUser ? (
            <div className="profile-name" style={{ textAlign: 'center', marginTop: '8px' }}>
              {profile?.name || 'User'}
            </div>
          ) : editing ? (
            <div ref={editingContainerRef} style={{ position: 'relative', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
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
                  style={{ flex: 1, paddingLeft: '40px', paddingRight: '50px' }}
                  onFocus={() => handleInputFocus('name')}
                  onMouseDown={handleInputMouseDown}
                  onTouchStart={handleInputMouseDown}
                />
                <button
                  type="button"
                  onClick={() => openEmojiPicker('name')}
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: '18px',
                    cursor: 'pointer',
                    padding: '4px',
                    zIndex: 2,
                  }}
                  title="Insert emoji"
                >
                  <i className="fas fa-smile" />
                </button>
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  bottom: '6px',
                  fontSize: '11px',
                  color: (editData.name?.length || 0) >= NAME_MAX_LENGTH ? '#EF4444' : '#666',
                  pointerEvents: 'none',
                }}>
                  {editData.name?.length || 0}/{NAME_MAX_LENGTH}
                </span>
              </div>
            </div>
          ) : loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
              <SkeletonBlock width="140px" height="22px" />
            </div>
          ) : (
            <div className="profile-name">{profile?.name || 'User'}</div>
          )}

          {isDemoUser ? (
            <p className="profile-bio" style={{ margin: '12px 0', fontSize: '14px', color: '#ccc' }}>
              {profile?.bio || 'No bio yet.'}
            </p>
          ) : editing ? (
            <div style={{ position: 'relative', width: '100%', marginTop: '12px' }}>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={bioInputRef}
                  className="profile-bio-input"
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
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '8px 60px 8px 40px',
                    resize: 'vertical',
                  }}
                  onFocus={() => handleInputFocus('bio')}
                  onMouseDown={handleInputMouseDown}
                  onTouchStart={handleInputMouseDown}
                />
                <button
                  type="button"
                  onClick={() => openEmojiPicker('bio')}
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '8px',
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    fontSize: '18px',
                    cursor: 'pointer',
                    padding: '4px',
                    zIndex: 2,
                  }}
                  title="Insert emoji"
                >
                  <i className="fas fa-smile" />
                </button>
                <span style={{
                  position: 'absolute',
                  right: '12px',
                  bottom: '6px',
                  fontSize: '11px',
                  color: (editData.bio?.length || 0) >= BIO_MAX_LENGTH ? '#EF4444' : '#666',
                  pointerEvents: 'none',
                }}>
                  {editData.bio?.length || 0}/{BIO_MAX_LENGTH}
                </span>
              </div>
            </div>
          ) : (
            profile?.bio && <p className="profile-bio" style={{ margin: '12px 0', fontSize: '14px', color: '#ccc' }}>{profile.bio}</p>
          )}

          {!loading && (
            <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
              {editing ? (
                <>
                  <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px', fontWeight: 500 }}>Choose your mood</div>
                  <MoodPicker currentMood={editData.mood || 'neutral'} onSelect={handleMoodChange} />
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <ECHOMOJI mood={profile?.mood || 'happy'} skin={activeSkinObj} size={48} interactive={false} animated={true} />
                  <span style={{ fontSize: '13px', color: '#888', fontWeight: 500 }}>
                    Mood: <strong style={{ color: '#FFF', textTransform: 'capitalize' }}>{profile?.mood || 'happy'}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="moving-interests-container" style={{ width: '100%', overflow: 'hidden', padding: '6px 0', marginTop: '12px' }}>
            <div
              className="moving-interests-track"
              style={{
                display: 'flex',
                gap: '8px',
                width: 'max-content',
                animation: 'scrollInterests 18s linear infinite',
              }}
            >
              {[...DEFAULT_INTEREST_TEMPLATES, ...DEFAULT_INTEREST_TEMPLATES].map((item, idx) => (
                <span
                  key={idx}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#AAA',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="profile-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
            {editing ? (
              isDemoUser ? null : (
                <>
                  <button className="save-btn" onClick={handleSave} style={{ background: '#6C3CE1', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}>
                    Save
                  </button>
                  <button className="cancel-btn" onClick={() => { setEditing(false); setEditData(profile); }} style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '20px', cursor: 'pointer' }}>
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
                style={{ background: '#6C3CE1', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}
              >
                {isDemoUser ? 'Change Avatar' : 'Edit Profile'}
              </button>
            )}
          </div>
        </div>

        <div className="account-details">
          <div className="account-details-header">
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
                {copiedUid ? 'Copied! ✓' : 'Copy UID'}
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
      </div>
    </>
  );
};

export default Profile;