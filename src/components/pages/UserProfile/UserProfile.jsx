// src/components/pages/UserProfile/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import {
  followUser,
  unfollowUser,
  isEchowing,
  listenToMyEchowerCount,
  listenToMyEchowers,
} from '../../../services/echowerService';
import Avatar from '../../common/Avatar';
import UsernamePill from '../../common/UsernamePill';
import SEO from '../../common/SEO';
import ProfileSpotlightGrid from '../../../pages/Spotlight/ProfileSpotlightGrid';
import PlusBadge from '../../common/PlusBadge';
import { useSubscription } from '../../../contexts/SubscriptionContext';
import { db } from '../../../services/firebase';
import { ref, get, update, runTransaction } from 'firebase/database';
import './UserProfile.css';
import '../Profile/Profile.css'; // Ensure Profile.css is loaded for premium styles

const UserProfile = ({ uid: propUid, onClose }) => {
  const { uid: paramUid } = useParams();
  const uid = propUid || paramUid;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();
  const { ghostMode: myGhostMode, isPlus: amIPlus } = useSubscription();

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
      unsubEchowers = listenToMyEchowerCount(uid, (uids) =>
        setEchowerCount(Array.isArray(uids) ? uids.length : 0)
      );
      unsubFollowing = listenToMyEchowers(uid, (uids) =>
        setEchowingCount(Array.isArray(uids) ? uids.length : 0)
      );
    }

    const t = setTimeout(() => setLoading(false), 500);

    return () => {
      if (t) clearTimeout(t);
      if (unsubEchowers) unsubEchowers();
      if (unsubFollowing) unsubFollowing();
    };
  }, [uid, user, fetchProfile]);

  const profile = profiles[uid];

  // ── ECHO Plus Theming & Features ──
  const isTargetPlus = profile?.isEchoPlus || false;
  const targetRingStyle = profile?.premiumRingStyle || 'gold';
  const targetProfileBg = profile?.premiumProfileBg || 'default';
  const targetBadgeText = profile?.premiumBadgeText || '';
  const targetAccentColor = profile?.premiumAccentColor || 'default';
  
  const targetGlow = profile?.premiumProfileGlow || 'none';
  const targetAura = profile?.premiumProfileAura || 'none';
  const targetEmoji = profile?.premiumStatusEmoji || '';
  const targetMusic = profile?.premiumMusic || '';

  // ── Ghost Mode View Counter ───
  useEffect(() => {
    if (!uid || !user || user.uid === uid) return; // Don't count own views
    const iAmInvisible = amIPlus && myGhostMode === true;
    if (iAmInvisible) return; // Ghost mode active

    const sessionKey = `echo_viewed_${uid}`;
    try { if (sessionStorage.getItem(sessionKey)) return; } catch {}

    const viewsRef = ref(db, `profiles/${uid}/profileViews`);
    runTransaction(viewsRef, (current) => (Number(current) || 0) + 1)
      .then(() => { try { sessionStorage.setItem(sessionKey, '1'); } catch {} })
      .catch(() => {});
  }, [uid, user, amIPlus, myGhostMode]);

  // ── Spotify Embed Helper ───
  const getSpotifyEmbed = (url) => {
    if (!url) return null;
    try {
      if (url.includes('spotify.com/track/')) {
        const trackId = url.split('track/')[1].split('?')[0];
        return `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;
      }
      return null;
    } catch { return null; }
  };

  const musicEmbedUrl = getSpotifyEmbed(targetMusic);

  const handleToggleEchower = async () => {
    if (!user || !uid) return;
    if (isFollowing) {
      await unfollowUser(user.uid, uid);
      setIsFollowing(false);
      setEchowerCount((c) => Math.max(0, c - 1));
    } else {
      await followUser(user.uid, uid);
      setIsFollowing(true);
      setEchowerCount((c) => c + 1);
    }
  };

  const handleBack = () => { if (onClose) onClose(); else navigate(-1); };

  if (loading) {
    return (
      <div className={`user-profile-page loading ${onClose ? 'is-overlay' : ''}`}>
        <div className="user-profile-spinner" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={`user-profile-page error ${onClose ? 'is-overlay' : ''}`}>
        User not found.
      </div>
    );
  }

  const coverImage = profile.avatar || profile.videoUrl;
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : 'Recently';

  return (
    <div
      className={`profile-page snap-profile ${onClose ? 'profile-overlay-mode' : ''} ${
        isTargetPlus && targetAccentColor !== 'default' ? `profile-accent-${targetAccentColor}` : ''
      } ${isTargetPlus ? 'is-plus-premium-view' : ''}`}
    >
      <SEO title={`${profile.name} on ECHO`} />

      {/* ★ Premium Cosmic Background for Plus Users */}
      {isTargetPlus && (
        <div className="plus-cosmic-bg">
          <div className="cosmic-orb orb-1" />
          <div className="cosmic-orb orb-2" />
          <div className="cosmic-orb orb-3" />
        </div>
      )}

      {/* Glass Wrapper for Plus Users */}
      <div className={isTargetPlus ? 'plus-profile-glass-wrapper' : ''}>
        
        <div className="snap-hero">
          <button className="snap-back-btn" onClick={handleBack} aria-label="Go back">
            <i className="fas fa-arrow-left" />
          </button>

          <div
            className={`snap-hero-bg ${isTargetPlus ? `premium-bg-${targetProfileBg || 'default'}` : ''}`}
            style={{ backgroundImage: !isTargetPlus && coverImage ? `url(${coverImage})` : 'none' }}
          />
          <div className="snap-hero-overlay" />

          <div className="snap-avatar-wrapper">
            <div
              className={`snap-avatar-ring ${
                isTargetPlus ? `plus-avatar-ring ${targetRingStyle || 'gold'}` : ''
              }`}
            />
            
            {/* Animated Glow & Aura */}
            {isTargetPlus && targetGlow !== 'none' && (
              <div className={`plus-avatar-glow ${targetGlow}`} />
            )}
            {isTargetPlus && targetAura !== 'none' && (
              <div className={`plus-avatar-aura ${targetAura}`} />
            )}

            <div className="snap-avatar" style={{ cursor: 'default' }}>
              <Avatar src={profile.avatar} name={profile.name} size={100} />
            </div>
          </div>

          <div className="snap-info">
            <h1
              className={`snap-name ${
                isTargetPlus && targetAccentColor !== 'default' ? `snap-name-accent-${targetAccentColor}` : ''
              }`}
            >
              {profile.name || 'User'}
              
              {isTargetPlus && targetEmoji && targetEmoji !== 'none' && (
                <span style={{ fontSize: '22px', marginLeft: '8px' }}>{targetEmoji}</span>
              )}

              {isTargetPlus && targetBadgeText ? (
                <span className="premium-custom-badge">{targetBadgeText}</span>
              ) : isTargetPlus ? (
                <PlusBadge size={26} />
              ) : null}
            </h1>

            {/* The "Verified" Flex Banner */}
            {isTargetPlus && (
              <div className="plus-member-banner">
                <i className="fas fa-crown" style={{ color: '#FFD700' }} />
                <span>ECHO Plus Member</span>
              </div>
            )}

            {profile.username && (
              <div className="snap-username-wrap">
                <UsernamePill uid={uid} username={profile.username} size="md" />
              </div>
            )}

            <div className="snap-meta">
              <span><i className="fas fa-calendar-alt" /> {memberSince}</span>
              {profile.country && (
                <span>
                  <i className="fas fa-map-marker-alt" />{' '}
                  {profile.city ? `${profile.city}, ` : ''}{profile.country}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="snap-bio-section">
          <p className="snap-bio">{profile.bio || 'No bio yet.'}</p>

          {isTargetPlus && musicEmbedUrl && (
            <div style={{ marginTop: '16px', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', width: '100%' }}>
              <iframe
                style={{ borderRadius: '12px' }}
                src={musicEmbedUrl}
                width="100%"
                height="80"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                title="Profile Music"
              ></iframe>
            </div>
          )}

          {user?.uid !== uid && (
            <div className="snap-actions-row">
              <button
                className={`snap-btn-secondary ${isFollowing ? 'following' : ''}`}
                onClick={handleToggleEchower}
              >
                {isFollowing ? (
                  <><i className="fas fa-check" /> Echowing</>
                ) : (
                  <><i className="fas fa-plus" /> Echower</>
                )}
              </button>
              <button
                className="snap-btn-primary"
                onClick={() => {
                  if (onClose) onClose();
                  navigate(`/chat/${uid}`);
                }}
              >
                <i className="fas fa-comment" /> Message
              </button>
            </div>
          )}
        </div>

        <div className="snap-stats-row">
          <div className="snap-stat-btn">
            <strong>{echowerCount}</strong>
            <span>Echowers</span>
          </div>
          <div className="snap-stat-btn">
            <strong>{echowingCount}</strong>
            <span>Echowing</span>
          </div>
          {isTargetPlus && (
            <div className="snap-stat-btn">
              <strong>{profile.profileViews || 0}</strong>
              <span>Views</span>
            </div>
          )}
        </div>

        <div className="snap-tabs">
          <button
            className={`snap-tab ${activeTab === 'spotlight' ? 'active' : ''}`}
            onClick={() => setActiveTab('spotlight')}
          >
            <i className="fas fa-bolt" /> Spotlight
          </button>
        </div>

        <div className={`snap-content-area ${isTargetPlus ? 'plus-spotlight-frame' : ''}`}>
          {/* ★ Crucial: isOwner={false} means viewers see the Report/Info modals, not the Delete modal */}
          {activeTab === 'spotlight' && <ProfileSpotlightGrid uid={uid} isOwner={false} />}
        </div>

      </div> {/* End of Plus Glass Wrapper */}
    </div>
  );
};

export default UserProfile;
