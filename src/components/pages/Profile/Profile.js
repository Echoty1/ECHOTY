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
import Avatar from '../../common/Avatar';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import { listenToMyEchowers, listenToMyEchowerCount } from '../../../services/echowerService';
import AvatarCustomizer from './AvatarCustomizer';
import UsernameEditor from './UsernameEditor';
import UsernamePill from '../../common/UsernamePill';
import ProfileSpotlightGrid from '../../../pages/Spotlight/ProfileSpotlightGrid';
import './Profile.css';

const getFastLocal = (key) => { try { const item = localStorage.getItem('echo_cache_' + key); return item ? JSON.parse(item) : null; } catch { return null; } };
const setFastLocal = (key, val) => { try { localStorage.setItem('echo_cache_' + key, JSON.stringify(val)); } catch {} };
const SkeletonBlock = ({ width = '100%', height = '16px', borderRadius = '8px', style = {} }) => (
  <div style={{ width, height, borderRadius, background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s infinite ease-in-out', ...style }} />
);

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const CLOUDINARY_CLOUD_NAME = 'rjlscgan';
const CLOUDINARY_UPLOAD_PRESET = 'echo_uploads';
const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';

const Profile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { refreshProfile, profiles, fetchProfile } = useProfile();

  const [activeTab, setActiveTab] = useState('spotlight');
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

  const cachedProfile = useMemo(() => (user?.uid ? getFastLocal('profile_' + user.uid) : null), [user?.uid]);
  const cachedUserSkins = useMemo(() => (user?.uid ? getFastLocal('echomoji_' + user.uid) : null), [user?.uid]);

  const [profile, setProfile] = useState(() => cachedProfile);
  const [activeSkinId, setActiveSkinId] = useState(() => cachedUserSkins?.active || cachedProfile?.activeSkin || null);
  const [activeHairStyle, setActiveHairStyle] = useState(() => cachedUserSkins?.hairStyle || 'short');
  const [loading, setLoading] = useState(() => !cachedProfile);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(() => cachedProfile || { name: '', avatar: '', videoUrl: '', mood: 'happy', activeSkin: null, bio: '', country: '', city: '' });
  const [unlockedGifs, setUnlockedGifs] = useState([]);
  const imageInputRef = useRef(null);
  const [nameAvailable, setNameAvailable] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    let isMounted = true;
    
    const unsubSkin = onValue(ref(db, 'userSkins/' + user.uid), (snap) => {
      if (!isMounted) return;
      const data = snap.val() || {};
      setActiveSkinId(data.activeSkin || data.active || null);
      setActiveHairStyle(data.hairStyle || 'short');
      setUnlockedGifs(data.unlockedGifs || []);
    });

    const unsubProfile = onValue(ref(db, 'profiles/' + user.uid), async (snapshot) => {
      if (!isMounted) return;
      let safeData;
      if (snapshot.exists()) {
        const data = snapshot.val();
        safeData = { ...data, name: data.name || data.username || user.displayName || 'User', avatar: data.avatar || '', videoUrl: data.videoUrl || '' };
      } else {
        safeData = { name: user.displayName || user.email?.split('@')[0] || 'User', avatar: '', videoUrl: '', mood: 'happy', activeSkin: null, bio: 'New to ECHO!', createdAt: Date.now() };
        await set(ref(db, 'profiles/' + user.uid), safeData);
      }
      setProfile(safeData);
      setFastLocal('profile_' + user.uid, safeData);
      if (!editing) setEditData(safeData);
      setLoading(false);
    });

    const unsubFollowers = listenToMyEchowerCount(user.uid, (uids) => {
      setFollowerUids(uids);
      uids.forEach((uid) => fetchProfile(uid));
    });
    const unsubFollowing = listenToMyEchowers(user.uid, (uids) => {
      setFollowingUids(uids);
      uids.forEach((uid) => fetchProfile(uid));
    });

    return () => { isMounted = false; unsubSkin(); unsubProfile(); unsubFollowers(); unsubFollowing(); };
  }, [user?.uid, editing, fetchProfile]);

  const handleSave = async () => {
    if (!user || !editData.name?.trim() || !nameAvailable) return;
    try {
      const updates = { ...editData, name: editData.name.trim(), searchName: editData.name.trim().toLowerCase() };
      await update(ref(db, 'profiles/' + user.uid), updates);
      setFastLocal('profile_' + user.uid, updates);
      setProfile(updates);
      await refreshProfile(user.uid);
      setEditing(false);
      setToast({ message: 'Profile saved!', type: 'success' });
    } catch { setToast({ message: 'Failed to save profile.', type: 'error' }); }
  };

  const handleSaveAvatar = async (avatarData) => {
    if (!user) return;
    try {
      const updates = { activeSkin: avatarData.activeSkin, hairStyle: avatarData.hairStyle };
      await update(ref(db, 'userSkins/' + user.uid), updates);
      setFastLocal('echomoji_' + user.uid, updates);
      setActiveSkinId(avatarData.activeSkin);
      setActiveHairStyle(avatarData.hairStyle);
      setShowAvatarCustomizer(false);
      setToast({ message: 'Avatar updated!', type: 'success' });
    } catch { setToast({ message: 'Failed to save avatar.', type: 'error' }); }
  };

  const handleUploadImage = async (file) => {
    if (!user || file.size > MAX_FILE_SIZE) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      const updateData = { avatar: data.secure_url, videoUrl: '', activeSkin: null };
      setProfile((prev) => ({ ...prev, ...updateData }));
      setEditData((prev) => ({ ...prev, ...updateData }));
      await update(ref(db, 'profiles/' + user.uid), updateData);
      await refreshProfile(user.uid);
      setShowAvatarPicker(false);
    } catch { setToast({ message: 'Upload failed.', type: 'error' }); } finally { setUploading(false); }
  };

  const handleGifSelect = async (gif) => {
    try {
      const updateData = { videoUrl: gif.url, avatar: gif.url, activeSkin: null };
      setProfile((prev) => ({ ...prev, ...updateData }));
      setEditData((prev) => ({ ...prev, ...updateData }));
      await update(ref(db, 'profiles/' + user.uid), updateData);
      await refreshProfile(user.uid);
      setShowGifLibrary(false);
    } catch {}
  };

  const handleMoodChange = async (mood) => {
    if (!user) return;
    await update(ref(db, 'profiles/' + user.uid), { mood });
    setProfile((prev) => ({ ...prev, mood }));
    setEditData((prev) => ({ ...prev, mood }));
  };

  const currentMediaUrl = (editing ? editData.videoUrl : profile?.videoUrl) || (editing ? editData.avatar : profile?.avatar);
  const cachedMediaUrl = useCachedImage(currentMediaUrl, null);
  const displayMediaUrl = cachedMediaUrl || currentMediaUrl;
  const isVideoFormat = !!currentMediaUrl && (currentMediaUrl.endsWith('.mp4') || currentMediaUrl.endsWith('.webm'));
  const currentSkinId = activeSkinId || profile?.activeSkin;
  const activeSkinObj = useMemo(() => (currentSkinId ? getSkinById(currentSkinId) : null), [currentSkinId]);
  const memberSince = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently';

  return (
    <React.Fragment>
      <SEO title="Profile - ECHO" />
      <StructuredData />
      <div className="profile-page snap-profile">
        <input type="file" ref={imageInputRef} accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} onChange={(e) => e.target.files[0] && handleUploadImage(e.target.files[0])} />

        <div className="snap-hero">
          <div className="snap-hero-bg" style={{ backgroundImage: displayMediaUrl ? `url(${displayMediaUrl})` : 'var(--bg-card)' }} />
          <div className="snap-hero-overlay" />
          
          <div className="snap-avatar-wrapper">
            <div className="snap-avatar-ring" />
            <div className="snap-avatar" onClick={() => (editing || isDemoUser) && setShowAvatarPicker(true)}>
              {loading ? <SkeletonBlock width="100%" height="100%" borderRadius="50%" /> : 
               isVideoFormat ? <video src={displayMediaUrl} autoPlay loop muted playsInline /> : 
               displayMediaUrl ? <img src={displayMediaUrl} alt="Avatar" /> : 
               <Avatar src={null} name={editData?.name || profile?.name || 'User'} size={100} />}
              {(editing || isDemoUser) && <div className="avatar-overlay">Change</div>}
            </div>
          </div>

          <div className="snap-info">
            {editing ? (
              <div className="profile-name-edit-wrapper" ref={editingContainerRef}>
                <div className="profile-name-input-wrapper">
                  <input ref={nameInputRef} type="text" className="profile-name-input" value={editData.name || ''} onChange={(e) => e.target.value.length <= NAME_MAX_LENGTH && setEditData({ ...editData, name: e.target.value })} placeholder="Your name" />
                </div>
                {!nameAvailable && <span className="name-status taken">Taken</span>}
              </div>
            ) : (
              <h1 className="snap-name">{profile?.name || 'User'}</h1>
            )}
            
            {!editing && profile?.username && (
              <div className="snap-username-wrap">
                <UsernamePill uid={user?.uid} username={profile.username} size="md" />
              </div>
            )}

            {!editing && (
              <div className="snap-meta">
                <span><i className="fas fa-calendar-alt" /> {memberSince}</span>
                {profile?.country && <span><i className="fas fa-map-marker-alt" /> {profile.city ? `${profile.city}, ` : ''}{profile.country}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="snap-bio-section">
          {editing ? (
            <div className="profile-bio-edit-wrapper">
              <textarea ref={bioInputRef} className="profile-bio-textarea" value={editData.bio || ''} onChange={(e) => e.target.value.length <= BIO_MAX_LENGTH && setEditData({ ...editData, bio: e.target.value })} placeholder="Write a short bio..." rows={3} />
            </div>
          ) : (
            <p className="snap-bio">{profile?.bio || 'No bio yet.'}</p>
          )}

          <div className="snap-actions-row">
            {editing ? (
              <>
                <button className="snap-btn-primary" onClick={handleSave} disabled={!nameAvailable}><i className="fas fa-check" /> Save</button>
                <button className="snap-btn-secondary" onClick={() => { setEditing(false); setEditData(profile); }}>Cancel</button>
              </>
            ) : (
              <>
                <button className="snap-btn-secondary" onClick={() => setShowUsernameEditor(true)}><i className="fas fa-at" /> {profile?.username ? 'Change handle' : 'Set handle'}</button>
                <button className="snap-btn-primary" onClick={() => setEditing(true)}><i className="fas fa-pen" /> Edit Profile</button>
              </>
            )}
          </div>
        </div>

        <div className="snap-stats-row">
          <button className="snap-stat-btn" onClick={() => { setActiveEchowersTab('followers'); setShowEchowersModal(true); }}>
            <strong>{followerUids.length}</strong><span>Echowers</span>
          </button>
          <button className="snap-stat-btn" onClick={() => { setActiveEchowersTab('following'); setShowEchowersModal(true); }}>
            <strong>{followingUids.length}</strong><span>Echowing</span>
          </button>
          <button className="snap-stat-btn" onClick={() => setShowAvatarCustomizer(true)}>
            <ECHOMOJI mood={profile?.mood || 'happy'} skin={activeSkinObj} hairStyle={activeHairStyle} size={30} interactive={false} animated={true} />
            <span>{profile?.mood || 'happy'}</span>
          </button>
        </div>

        <div className="snap-tabs">
          <button className={`snap-tab ${activeTab === 'spotlight' ? 'active' : ''}`} onClick={() => setActiveTab('spotlight')}><i className="fas fa-bolt" /> Spotlight</button>
          <button className={`snap-tab ${activeTab === 'echoes' ? 'active' : ''}`} onClick={() => setActiveTab('echoes')}><i className="fas fa-bookmark" /> Saved</button>
        </div>

        <div className="snap-content-area">
          {activeTab === 'spotlight' && <ProfileSpotlightGrid uid={user?.uid} />}
          {activeTab === 'echoes' && <div className="empty-tab-state"><i className="fas fa-ghost" /><p>Saved Echoes will appear here.</p></div>}
        </div>

        {/* MODALS */}
        <AvatarPicker isOpen={showAvatarPicker} onClose={() => setShowAvatarPicker(false)} onUploadImage={() => imageInputRef.current?.click()} onChooseLibrary={() => { setShowAvatarPicker(false); setShowGifLibrary(true); }} uploading={uploading} isDemo={isDemoUser} />
        <GifLibraryModal isOpen={showGifLibrary} onClose={() => setShowGifLibrary(false)} onSelect={handleGifSelect} ownedGifs={unlockedGifs} mode="profile" />
        <UsernameEditor uid={user?.uid} currentUsername={profile?.username} isOpen={showUsernameEditor} onClose={() => setShowUsernameEditor(false)} />
        
        {showAvatarCustomizer && (
          <div className="custom-modal-overlay" onClick={() => setShowAvatarCustomizer(false)}>
            <div onClick={e => e.stopPropagation()}>
              <AvatarCustomizer currentSkin={activeSkinObj} currentHair={activeHairStyle} currentMood={profile?.mood} onSave={handleSaveAvatar} onCancel={() => setShowAvatarCustomizer(false)} />
            </div>
          </div>
        )}

        {showEchowersModal && (
          <div className="echowers-modal-overlay" onClick={() => setShowEchowersModal(false)}>
            <div className="echowers-modal" onClick={(e) => e.stopPropagation()}>
              <div className="echowers-modal-header"><h3>Echowers</h3><button className="close-btn" onClick={() => setShowEchowersModal(false)}>✕</button></div>
              <div className="echowers-tabs">
                <button className={activeEchowersTab === 'followers' ? 'active' : ''} onClick={() => setActiveEchowersTab('followers')}>Echowers ({followerUids.length})</button>
                <button className={activeEchowersTab === 'following' ? 'active' : ''} onClick={() => setActiveEchowersTab('following')}>Echowing ({followingUids.length})</button>
              </div>
              <div className="echowers-list">
                {(activeEchowersTab === 'followers' ? followerUids : followingUids).length === 0 ? (
                  <p className="empty-state">No one here yet.</p>
                ) : (
                  (activeEchowersTab === 'followers' ? followerUids : followingUids).map((uid) => {
                    const p = profiles[uid] || { name: 'User', avatar: '' };
                    return (
                      <div key={uid} className="echower-item" onClick={() => navigate('/chat/' + uid)}>
                        <Avatar src={p.avatar} name={p.name} size={50} />
                        <div className="item-info"><strong>{p.name}</strong><span>{p.bio || 'No bio'}</span></div>
                        <i className="fas fa-chevron-right" />
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      </div>
    </React.Fragment>
  );
};

export default Profile;
