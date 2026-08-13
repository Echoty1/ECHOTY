// src/components/pages/Profile/Profile.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { db } from '../../../services/firebase';
import { ref, onValue, update, set } from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import { Country, City } from 'country-state-city';
import GifLibraryModal from '../../GifLibrary/GifLibraryModal';
import AvatarPicker from '../../AvatarPicker/AvatarPicker';
import Toast from '../../Toast/Toast';
import { useCachedImage } from '../../../utils/mediaCache';
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

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── 10 Default Animated Interest Templates ─────────────────────
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

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';

const Profile = () => {
  const { user } = useAuth();
  const { refreshProfile } = useProfile();

  const [showGifLibrary, setShowGifLibrary] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedUid, setCopiedUid] = useState(false);

  // Synchronously initialize profile & skin cache
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

  const imageInputRef = useRef(null);
  const gifInputRef = useRef(null);

  // Synchronized fetch for both profile (mood) and userSkins (activeSkin) together
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

  // Countries & Cities
  const countriesList = useMemo(() => Country.getAllCountries(), []);

  const matchedCountryCode = useMemo(() => {
    if (editData.countryCode) return editData.countryCode;
    if (editData.country) {
      const found = countriesList.find(
        (c) => c.name.toLowerCase() === editData.country.toLowerCase()
      );
      return found ? found.isoCode : '';
    }
    return '';
  }, [editData.country, editData.countryCode, countriesList]);

  const citiesList = useMemo(() => {
    return matchedCountryCode ? City.getCitiesOfCountry(matchedCountryCode) : [];
  }, [matchedCountryCode]);

  const handleCountrySelect = (e) => {
    const selectedIsoCode = e.target.value;
    if (!selectedIsoCode) {
      setEditData({ ...editData, country: '', countryCode: '', city: '' });
      return;
    }
    const countryObj = Country.getCountryByCode(selectedIsoCode);
    setEditData({
      ...editData,
      country: countryObj ? countryObj.name : '',
      countryCode: selectedIsoCode,
      city: '',
    });
  };

  const handleCitySelect = (e) => {
    setEditData({ ...editData, city: e.target.value });
  };

  const handleSave = async () => {
    if (!user) return;

    try {
      const cacheKey = `profile_${user.uid}`;
      const profileRef = ref(db, `profiles/${user.uid}`);

      await update(profileRef, editData);
      setFastLocal(cacheKey, editData);
      setProfile(editData);
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

  const handleUploadMedia = async (file, isGifOnly = false) => {
    if (!user) return;

    if (file.size > MAX_FILE_SIZE) {
      setToast({ message: 'File size exceeds 5 MB. Choose a smaller file.', type: 'error' });
      return;
    }

    if (isGifOnly) {
      if (file.type !== 'image/gif') {
        setToast({ message: 'Only GIF files (.gif) are allowed.', type: 'error' });
        return;
      }
    } else {
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setToast({ message: 'Please upload a valid image (PNG, JPEG, WEBP).', type: 'error' });
        return;
      }
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

      const updateData = {};
      if (file.type === 'image/gif') {
        updateData.videoUrl = downloadUrl;
        updateData.avatar = downloadUrl;
        updateData.activeSkin = null;
      } else {
        updateData.avatar = downloadUrl;
        updateData.videoUrl = '';
        updateData.activeSkin = null;
      }

      // ─── Optimistic update ──────────────────────────────
      setProfile((prev) => ({ ...prev, ...updateData }));
      setEditData((prev) => ({ ...prev, ...updateData }));

      await update(ref(db, `profiles/${user.uid}`), updateData);
      await refreshProfile(user.uid);

      setToast({ message: 'Media uploaded successfully!', type: 'success' });
      setShowAvatarPicker(false);
    } catch (err) {
      console.error('Upload error:', err);
      setToast({ message: 'Upload failed. Check Cloudinary preset.', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleImageFile = (e) => {
    if (e.target.files[0]) handleUploadMedia(e.target.files[0], false);
    e.target.value = '';
  };

  const handleGifFile = (e) => {
    if (e.target.files[0]) handleUploadMedia(e.target.files[0], true);
    e.target.value = '';
  };

  const handleGifSelect = async (gif) => {
    try {
      const updateData = { videoUrl: gif.url, avatar: gif.url, activeSkin: null };
      // ─── Optimistic update ──────────────────────────────
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

  // ─── Cached avatar ──────────────────────────────────────────
  const currentMediaUrl = (editing ? editData.videoUrl : profile?.videoUrl) || 
                          (editing ? editData.avatar : profile?.avatar);
  // Use useCachedImage to get cached version (returns the cached URL or null)
  const cachedMediaUrl = useCachedImage(currentMediaUrl, null);
  // If cachedMediaUrl is not null, use it; otherwise fallback to original URL
  const displayMediaUrl = cachedMediaUrl || currentMediaUrl;

  const isVideoFormat = (editing ? editData.videoUrl : profile?.videoUrl) && 
                        ((editing ? editData.videoUrl : profile?.videoUrl)?.endsWith('.mp4') || 
                         (editing ? editData.videoUrl : profile?.videoUrl)?.endsWith('.webm'));

  const currentSkinId = activeSkinId || profile?.activeSkin;
  const activeSkinObj = useMemo(() => (currentSkinId ? getSkinById(currentSkinId) : null), [currentSkinId]);

  const getInitial = () => {
    const name = (editing ? editData.name : profile?.name) || 'User';
    return name[0]?.toUpperCase() || 'U';
  };

  return (
    <div className="profile-page">
      <input type="file" ref={imageInputRef} accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} onChange={handleImageFile} />
      <input type="file" ref={gifInputRef} accept="image/gif" style={{ display: 'none' }} onChange={handleGifFile} />

      <div className="profile-card">
        {/* Avatar */}
        <div
          className="profile-avatar"
          onClick={() => editing && setShowAvatarPicker(true)}
          style={{ cursor: editing ? 'pointer' : 'default', position: 'relative' }}
        >
          {loading ? (
            <SkeletonBlock width="100%" height="100%" borderRadius="50%" />
          ) : isVideoFormat ? (
            <video src={displayMediaUrl} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : displayMediaUrl ? (
            <img src={displayMediaUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : activeSkinObj ? (
            <ECHOMOJI mood={profile?.mood || 'happy'} skin={activeSkinObj} size={110} />
          ) : (
            <div className="profile-avatar-initial">{getInitial()}</div>
          )}
          {editing && <div className="avatar-overlay">Tap to change</div>}
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

        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '6px' }}>
            <ECHOMOJI mood={profile?.mood || 'happy'} skin={activeSkinObj} size={36} interactive={false} animated={true} />
            <span style={{ fontSize: '13px', color: '#888', fontWeight: 500 }}>
              Mood: <strong style={{ color: '#FFF', textTransform: 'capitalize' }}>{profile?.mood || 'happy'}</strong>
            </span>
          </div>
        )}

        {/* Location */}
        {editing ? (
          <div className="profile-location-inputs" style={{ display: 'flex', gap: '8px', margin: '12px 0' }}>
            <select
              value={matchedCountryCode}
              onChange={handleCountrySelect}
              style={{
                flex: 1,
                background: '#1E1E2A',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '8px',
                fontSize: '13px',
              }}
            >
              <option value="">Select Country</option>
              {countriesList.map((c) => (
                <option key={c.isoCode} value={c.isoCode}>{c.name}</option>
              ))}
            </select>
            <select
              value={editData.city || ''}
              onChange={handleCitySelect}
              disabled={!matchedCountryCode}
              style={{
                flex: 1,
                background: '#1E1E2A',
                color: '#FFFFFF',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '8px',
                fontSize: '13px',
                opacity: matchedCountryCode ? 1 : 0.5,
              }}
            >
              <option value="">Select City</option>
              {citiesList.map((ct, idx) => (
                <option key={`${ct.name}-${idx}`} value={ct.name}>{ct.name}</option>
              ))}
            </select>
          </div>
        ) : (
          (profile?.city || profile?.country) && (
            <div className="profile-location" style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>
              📍 {[profile.city, profile.country].filter(Boolean).join(', ')}
            </div>
          )
        )}

        {/* Bio */}
        {editing ? (
          <textarea
            className="profile-bio-input"
            value={editData.bio || ''}
            onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
            placeholder="Write a short bio..."
            rows={3}
            style={{ width: '100%', marginTop: '12px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '8px' }}
          />
        ) : (
          profile?.bio && <p className="profile-bio" style={{ margin: '12px 0', fontSize: '14px', color: '#ccc' }}>{profile.bio}</p>
        )}

        {/* Moving Interests Templates */}
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

        {/* Actions */}
        <div className="profile-actions" style={{ marginTop: '24px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
          {editing ? (
            <>
              <button className="save-btn" onClick={handleSave} style={{ background: '#6C3CE1', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}>
                Save
              </button>
              <button className="cancel-btn" onClick={() => { setEditing(false); setEditData(profile); }} style={{ background: '#333', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '20px', cursor: 'pointer' }}>
                Cancel
              </button>
            </>
          ) : (
            <button className="edit-btn" onClick={() => setEditing(true)} style={{ background: '#6C3CE1', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '20px', cursor: 'pointer', fontWeight: 600 }}>
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Account Details */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: '16px', border: '1px solid rgba(255,255,255,0.08)', marginTop: '16px' }}>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Account Details</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: '13px', color: '#AAA' }}>Email</span>
          <span style={{ fontSize: '13px', color: '#FFF', fontWeight: 500 }}>{user?.email || 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#AAA' }}>User ID (UID)</div>
            <div style={{ fontSize: '11px', color: '#6C3CE1', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>{user?.uid}</div>
          </div>
          <button onClick={handleCopyUid} style={{ background: copiedUid ? '#10B981' : '#6C3CE1', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, marginLeft: '12px' }}>
            {copiedUid ? 'Copied! ✓' : 'Copy UID'}
          </button>
        </div>
      </div>

      <AvatarPicker
        isOpen={showAvatarPicker}
        onClose={() => setShowAvatarPicker(false)}
        onUploadImage={() => imageInputRef.current?.click()}
        onUploadGif={() => gifInputRef.current?.click()}
        onChooseLibrary={() => { setShowAvatarPicker(false); setShowGifLibrary(true); }}
        uploading={uploading}
      />

      <GifLibraryModal isOpen={showGifLibrary} onClose={() => setShowGifLibrary(false)} onSelect={handleGifSelect} />
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Profile;