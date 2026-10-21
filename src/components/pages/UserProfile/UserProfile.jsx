// src/components/pages/UserProfile/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { followUser, unfollowUser, isEchowing, listenToMyEchowerCount, listenToMyEchowers } from '../../../services/echowerService';
import Avatar from '../../common/Avatar';
import UsernamePill from '../../common/UsernamePill';
import SEO from '../../common/SEO';
import ProfileSpotlightGrid from '../../../pages/Spotlight/ProfileSpotlightGrid';
import './UserProfile.css';

const UserProfile = ({ uid: propUid, onClose }) => {
  const { uid: paramUid } = useParams();
  const uid = propUid || paramUid;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();

  const [isFollowing, setIsFollowing] = useState(false);
  const [echowerCount, setEchowerCount] = useState(0);
  const [echowingCount, setEchowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('spotlight');

  useEffect(() => {
    if (!uid) return;
    fetchProfile(uid);
    let unsubEchowers = null;
    let unsubFollowing = null;

    if (user) {
      isEchowing(user.uid, uid).then(setIsFollowing);
      unsubEchowers = listenToMyEchowerCount(uid, (uids) => setEchowerCount(Array.isArray(uids) ? uids.length : 0));
      unsubFollowing = listenToMyEchowers(uid, (uids) => setEchowingCount(Array.isArray(uids) ? uids.length : 0));
    }

    const t = setTimeout(() => setLoading(false), 500);
    return () => {
      if (t) clearTimeout(t);
      if (unsubEchowers) unsubEchowers();
      if (unsubFollowing) unsubFollowing();
    };
  }, [uid, user, fetchProfile]);

  const profile = profiles[uid];

  const handleToggleEchower = async () => {
    if (!user || !uid) return;
    if (isFollowing) {
      await unfollowUser(user.uid, uid);
      setIsFollowing(false);
      setEchowerCount(c => Math.max(0, c - 1));
    } else {
      await followUser(user.uid, uid);
      setIsFollowing(true);
      setEchowerCount(c => c + 1);
    }
  };

  const handleBack = () => {
    if (onClose) onClose();
    else navigate(-1);
  };

  if (loading) return <div className={`user-profile-page loading ${onClose ? 'is-overlay' : ''}`}>Loading...</div>;
  if (!profile) return <div className={`user-profile-page error ${onClose ? 'is-overlay' : ''}`}>User not found.</div>;

  const coverImage = profile.avatar || profile.videoUrl;
  const memberSince = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently';

  return (
    <div className={`profile-page snap-profile ${onClose ? 'profile-overlay-mode' : ''}`}>
      <SEO title={`${profile.name} on ECHO`} />
      
      <div className="snap-hero">
        <button className="snap-back-btn" onClick={handleBack}>
          <i className={`fas ${onClose ? 'fa-times' : 'fa-arrow-left'}`} />
        </button>
        
        <div className="snap-hero-bg" style={{ backgroundImage: coverImage ? `url(${coverImage})` : 'var(--bg-card)' }} />
        <div className="snap-hero-overlay" />
        
        <div className="snap-avatar-wrapper">
          <div className="snap-avatar-ring" />
          <div className="snap-avatar" style={{ cursor: 'default' }}>
            <Avatar src={profile.avatar} name={profile.name} size={100} />
          </div>
        </div>

        <div className="snap-info">
          <h1 className="snap-name">{profile.name || 'User'}</h1>
          {profile.username && (
            <div className="snap-username-wrap">
              <UsernamePill uid={uid} username={profile.username} size="md" />
            </div>
          )}
          <div className="snap-meta">
            <span><i className="fas fa-calendar-alt" /> {memberSince}</span>
            {profile.country && <span><i className="fas fa-map-marker-alt" /> {profile.city ? `${profile.city}, ` : ''}{profile.country}</span>}
          </div>
        </div>
      </div>

      <div className="snap-bio-section">
        <p className="snap-bio">{profile.bio || 'No bio yet.'}</p>
        
        {user?.uid !== uid && (
          <div className="snap-actions-row">
            <button 
              className={`snap-btn-secondary ${isFollowing ? 'following' : ''}`} 
              onClick={handleToggleEchower}
            >
              {isFollowing ? '✓ Echowing' : '+ Echower'}
            </button>
            <button 
              className="snap-btn-primary" 
              onClick={() => { if(onClose) onClose(); navigate(`/chat/${uid}`); }}
            >
              <i className="fas fa-comment" /> Message
            </button>
          </div>
        )}
      </div>

      <div className="snap-stats-row">
        <div className="snap-stat-btn">
          <strong>{echowerCount}</strong><span>Echowers</span>
        </div>
        <div className="snap-stat-btn">
          <strong>{echowingCount}</strong><span>Echowing</span>
        </div>
      </div>

      <div className="snap-tabs">
        <button className={`snap-tab ${activeTab === 'spotlight' ? 'active' : ''}`} onClick={() => setActiveTab('spotlight')}>
          <i className="fas fa-bolt" /> Spotlight
        </button>
      </div>

      <div className="snap-content-area">
        {activeTab === 'spotlight' && <ProfileSpotlightGrid uid={uid} />}
      </div>
    </div>
  );
};

export default UserProfile;
