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
import { listenToMyEchowers, listenToMyEchowerCount } from '../../../services/echowerService';
import AvatarCustomizer from './AvatarCustomizer';
import UsernameEditor from './UsernameEditor';
import UsernamePill from '../../common/UsernamePill';
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
  'Gaming',
  'Music',
  'Tech',
  'Movies',
  'Art',
  'Anime',
  'Fitness',
  'Photography',
  'Travel',
  'Coding',
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
  const [showUsernameEditor, setShowUsernameEditor] = useState(false);
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

  const [showEchowersModal, setShowEchowersModal] = useState(false);
  const [followerUids, setFollowerUids] = useState([]);
  const [followingUids, setFollowingUids] = useState([]);
  const [activeEchowersTab, setActiveEchowersTab] = useState('followers');

  const cachedProfile = useMemo(() => {
    if (!user?.uid) return null;
    return getFastLocal('profile_' + user.uid);
  }, [user?.uid]);

  const cachedUserSkins = useMemo(() => {
    if (!user?.uid) return null;
    return getFastLocal('echomoji_' + user.uid);
  }, [user?.uid]);

  const [profile, setProfile] = useState(() => cachedProfile);
  const [activeSkinId, setActiveSkinId] = useState(
    () => cachedUserSkins?.active || cachedProfile?.activeSkin || null
  );
  const [activeHairStyle, setActiveHairStyle] = useState(
    () => cachedUserSkins?.hairStyle || 'short'
  );
  const [loading, setLoading] = useState(() => !cachedProfile);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(
    () =>
      cachedProfile || {
        name: '',
        avatar: '',
        videoUrl: '',
        mood: 'happy',
        activeSkin: null,
        bio: '',
        country: '',
        countryCode: '',
        city: '',
      }
  );
  const [unlockedGifs, setUnlockedGifs] = useState([]);

  const imageInputRef = useRef(null);

  const [nameAvailable, setNameAvailable] = useState(true);
  const [nameCheckLoading, setNameCheckLoading] = useState(false);

  const checkNameAvailability = useCallback(
    async (newName) => {
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
        const q = query(
          profilesRef,
          orderByChild('searchName'),
          equalTo(searchTerm),
          limitToFirst(1)
        );
        const snapshot = await get(q);
        setNameAvailable(!snapshot.exists());
      } catch (err) {
        console.warn('Name check failed:', err);
        setNameAvailable(true);
      } finally {
        setNameCheckLoading(false);
      }
    },
    [profile]
  );

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

  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    const profileCacheKey = 'profile_' + user.uid;
    const skinCacheKey = 'echomoji_' + user.uid;

    const skinRef = ref(db, 'userSkins/' + user.uid);
    const unsubSkin = onValue(skinRef, (snap) => {
      if (!isMounted) return;
      const data = snap.val() || {};
      const newActive = data.activeSkin || data.active || null;
      const newHair = data.hairStyle || 'short';
      setActiveSkinId(newActive);
      setActiveHairStyle(newHair);
      setUnlockedGifs(data.unlockedGifs || []);
      const existingSkinCache = getFastLocal(skinCacheKey) || {};
      setFastLocal(skinCacheKey, {
        ...existingSkinCache,
        active: newActive,
        hairStyle: newHair,
      });
    });

    const profileRef = ref(db, 'profiles/' + user.uid);
    const unsubProfile = onValue(
      profileRef,
      async (snapshot) => {
        if (!isMounted) return;
        let safeData;
        if (snapshot.exists()) {
          const data = snapshot.val();
          safeData = {
            ...data,
            name:
              data.name ||
              data.username ||
              data.displayName ||
              user.displayName ||
              'User',
            avatar: data.avatar || '',
            videoUrl: data.videoUrl || '',
          };
        } else {
          safeData = {
            name: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
            avatar: '',
            videoUrl: '',
            mood: 'happy',
            activeSkin: null,
            bio: 'New to ECHO!',
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
      uids.forEach((uid) => fetchProfile(uid));
    });

    const unsubFollowing = listenToMyEchowers(user.uid, (uids) => {
      setFollowingUids(uids);
      uids.forEach((uid) => fetchProfile(uid));
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
      setToast({
        message: 'Name must be ' + NAME_MAX_LENGTH + ' characters or less.',
        type: 'error',
      });
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
        const q = query(
          profilesRef,
          orderByChild('searchName'),
          equalTo(searchTerm),
          limitToFirst(1)
        );
        const snapshot = await get(q);
        if (snapshot.exists()) {
          const foundUid = Object.keys(snapshot.val())[0];
          if (foundUid !== user.uid) {
            setToast({
              message: 'Name already taken. Please choose another.',
              type: 'error',
            });
            return;
          }
        }
      } catch (err) {
        console.warn('Final name check failed:', err);
      }
    }

    const bio = editData.bio?.trim() || '';
    if (bio.length > BIO_MAX_LENGTH) {
      setToast({
        message: 'Bio must be ' + BIO_MAX_LENGTH + ' characters or less.',
        type: 'error',
      });
      return;
    }

    try {
      const cacheKey = 'profile_' + user.uid;
      const profileRef = ref(db, 'profiles/' + user.uid);
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
      const skinRef = ref(db, 'userSkins/' + user.uid);
      const existingData = getFastLocal('echomoji_' + user.uid) || {};
      const updates = {
        ...existingData,
        activeSkin: avatarData.activeSkin,
        hairStyle: avatarData.hairStyle,
      };
      await update(skinRef, updates);
      setFastLocal('echomoji_' + user.uid, updates);
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
      setToast({
        message: 'File size exceeds 5 MB. Choose a smaller file.',
        type: 'error',
      });
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (validTypes.indexOf(file.type) === -1) {
      setToast({
        message: 'Please upload a valid image (PNG, JPEG, WEBP).',
        type: 'error',
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const res = await fetch(
        'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/upload',
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error((data.error && data.error.message) || 'Upload failed');
      }

      const downloadUrl = data.secure_url;
      const updateData = { avatar: downloadUrl, videoUrl: '', activeSkin: null };

      setProfile((prev) => ({ ...prev, ...updateData }));
      setEditData((prev) => ({ ...prev, ...updateData }));

      await update(ref(db, 'profiles/' + user.uid), updateData);
      await refreshProfile(user.uid);

      setToast({ message: 'Image uploaded successfully!', type: 'success' });
      setShowAvatarPicker(false);
    } catch (err) {
      console.error('Upload error:', err);
      setToast({
        message: 'Upload failed. Check Cloudinary preset.',
        type: 'error',
      });
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

      await update(ref(db, 'profiles/' + user.uid), updateData);
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
      await update(ref(db, 'profiles/' + user.uid), { mood });
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
      setToast({
        message: 'Cannot add emoji - limit reached.',
        type: 'error',
      });
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

  const currentMediaUrl =
    (editing ? editData.videoUrl : profile?.videoUrl) ||
    (editing ? editData.avatar : profile?.avatar);
  const cachedMediaUrl = useCachedImage(currentMediaUrl, null);
  const displayMediaUrl = cachedMediaUrl || currentMediaUrl;

  const activeVideoUrl = editing ? editData.videoUrl : profile?.videoUrl;
  const isVideoFormat =
    !!activeVideoUrl &&
    (activeVideoUrl.endsWith('.mp4') || activeVideoUrl.endsWith('.webm'));

  const currentSkinId = activeSkinId || profile?.activeSkin;
  const activeSkinObj = useMemo(
    () => (currentSkinId ? getSkinById(currentSkinId) : null),
    [currentSkinId]
  );

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : 'Recently';

  return (
    <React.Fragment>
      <SEO
        title="Profile - Your Identity"
        description="Manage your profile, mood, and avatar on ECHO. Show the world who you are with your unique ECHOMOJI."
      />
      <StructuredData />
      <div className="profile-page">
        <input
          type="file"
          ref={imageInputRef}
          accept="image/png, image/jpeg, image/webp"
          style={{ display: 'none' }}
          onChange={handleImageFile}
        />

        <div className="profile-card">
          <div className="profile-card-glow" />

          <div className="profile-avatar-wrapper">
            <div className="profile-avatar-ring" />
            <div
              className="profile-avatar"
              onClick={() => (editing || isDemoUser) && setShowAvatarPicker(true)}
              style={{ cursor: editing || isDemoUser ? 'pointer' : 'default' }}
            >
              {loading ? (
                <SkeletonBlock width="100%" height="100%" borderRadius="50%" />
              ) : isVideoFormat ? (
                <video src={displayMediaUrl} autoPlay loop muted playsInline />
              ) : displayMediaUrl ? (
                <img src={displayMediaUrl} alt="Avatar" />
              ) : (
                <Avatar
                  src={null}
                  name={editData?.name || profile?.name || 'User'}
                  size={110}
                />
              )}
              {(editing || isDemoUser) && (
                <div className="avatar-overlay">Tap to change</div>
              )}
            </div>

            <div className="profile-status-badge">
              <span className="status-dot" />
              <span className="status-text">Active</span>
            </div>
          </div>

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
                      borderColor:
                        !nameAvailable && editData.name?.trim()
                          ? '#EF4444'
                          : 'var(--border-color)',
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
                    {(editData.name?.length || 0) + '/' + NAME_MAX_LENGTH}
                  </span>
                </div>
                {!nameAvailable && editData.name?.trim() && (
                  <span className="name-status taken">Taken</span>
                )}
                {nameAvailable &&
                  editData.name?.trim() &&
                  editData.name?.trim() !== profile?.name && (
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

            {!editing && !loading && profile?.username && (
              <div
                style={{
                  marginTop: 4,
                  marginBottom: 6,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <UsernamePill uid={user?.uid} username={profile.username} size="md" />
              </div>
            )}

            {!editing && !loading && (
              <div className="profile-meta">
                <span className="member-since">
                  <i className="fas fa-calendar-alt" /> Member since {memberSince}
                </span>
                {profile?.country && (
                  <span className="location-tag">
                    <i className="fas fa-map-marker-alt" />{' '}
                    {profile.city ? profile.city + ', ' : ''}
                    {profile.country}
                  </span>
                )}
              </div>
            )}
          </div>

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
                {(editData.bio?.length || 0) + '/' + BIO_MAX_LENGTH}
              </span>
            </div>
          ) : (
            profile?.bio && <p className="profile-bio">{profile.bio}</p>
          )}

          {!loading && (
            <div className="mood-customize-card">
              {editing ? (
                <React.Fragment>
                  <div className="mood-label">Choose your mood</div>
                  <MoodPicker
                    currentMood={editData.mood || 'neutral'}
                    onSelect={handleMoodChange}
                  />
                </React.Fragment>
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
                      <span className="mood-value">{profile?.mood || 'happy'}</span>
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

          {showAvatarCustomizer && !editing && (
            <AvatarCustomizer
              currentSkin={activeSkinObj}
              currentHair={activeHairStyle}
              currentMood={profile?.mood}
              onSave={handleSaveAvatar}
              onCancel={() => setShowAvatarCustomizer(false)}
            />
          )}

          <div className="profile-stats-enhanced">
            <div
              className="stat-card"
              onClick={() => {
                setActiveEchowersTab('followers');
                setShowEchowersModal(true);
              }}
            >
              <div className="stat-icon">
                <i className="fas fa-users" />
              </div>
              <div className="stat-info">
                <h4>{followerUids.length}</h4>
                <p>Echowers</p>
              </div>
            </div>
            <div
              className="stat-card"
              onClick={() => {
                setActiveEchowersTab('following');
                setShowEchowersModal(true);
              }}
            >
              <div className="stat-icon">
                <i className="fas fa-broadcast-tower" />
              </div>
              <div className="stat-info">
                <h4>{followingUids.length}</h4>
                <p>Echowing</p>
              </div>
            </div>
          </div>

          <div className="moving-interests-container">
            <div className="moving-interests-track">
              {DEFAULT_INTEREST_TEMPLATES.concat(DEFAULT_INTEREST_TEMPLATES).map(
                (item, idx) => (
                  <span key={idx} className="interest-pill">
                    {item}
                  </span>
                )
              )}
            </div>
          </div>

          <div className="profile-actions">
            {editing ? (
              isDemoUser ? null : (
                <React.Fragment>
                  <button
                    className="save-btn"
                    onClick={handleSave}
                    disabled={!nameAvailable && editData.name?.trim()}
                  >
                    <i className="fas fa-check" /> Save Changes
                  </button>
                  <button
                    className="cancel-btn"
                    onClick={() => {
                      setEditing(false);
                      setEditData(profile);
                    }}
                  >
                    Cancel
                  </button>
                </React.Fragment>
              )
            ) : (
              <React.Fragment>
                <button
                  type="button"
                  className="edit-btn"
                  onClick={() => setShowUsernameEditor(true)}
                  style={{
                    background: 'transparent',
                    border: '1.5px solid #6C3CE1',
                    color: '#6C3CE1',
                  }}
                >
                  <i className="fas fa-at" />{' '}
                  {profile?.username ? 'Change @handle' : 'Set @handle'}
                </button>
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
                    <React.Fragment>
                      <i className="fas fa-image" /> Change Avatar
                    </React.Fragment>
                  ) : (
                    <React.Fragment>
                      <i className="fas fa-pen" /> Edit Profile
                    </React.Fragment>
                  )}
                </button>
              </React.Fragment>
            )}
          </div>
        </div>

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
                  <React.Fragment>
                    <i className="fas fa-check" /> Copied!
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <i className="fas fa-copy" /> Copy
                  </React.Fragment>
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
            if (imageInputRef.current) imageInputRef.current.click();
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

        <UsernameEditor
          uid={user?.uid}
          currentUsername={profile?.username}
          isOpen={showUsernameEditor}
          onClose={() => setShowUsernameEditor(false)}
        />

        {toast && (
          <Toast
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}

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

        {showEchowersModal && (
          <div
            className="echowers-modal-overlay"
            onClick={() => setShowEchowersModal(false)}
          >
            <div
              className="echowers-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="echowers-modal-header">
                <h3>Echowers</h3>
                <button
                  className="close-btn"
                  onClick={() => setShowEchowersModal(false)}
                >
                  X
                </button>
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
                {(activeEchowersTab === 'followers'
                  ? followerUids
                  : followingUids
                ).length === 0 ? (
                  <p className="empty-state">
                    {activeEchowersTab === 'followers'
                      ? 'No one is Echowing you yet.'
                      : 'You are not Echowing anyone yet.'}
                  </p>
                ) : (
                  (activeEchowersTab === 'followers'
                    ? followerUids
                    : followingUids
                  ).map((uid) => {
                    const profileData = profiles[uid];
                    if (!profileData) return null;
                    return (
                      <div
                        key={uid}
                        className="echower-item"
                        onClick={() => navigate('/chat/' + uid)}
                      >
                        <Avatar
                          src={profileData.avatar}
                          name={profileData.name}
                          size={50}
                        />
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
    </React.Fragment>
  );
};

export default Profile;
