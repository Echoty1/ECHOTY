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

const UserProfile = ({ uid: propUid, onClose }) => {
  const { uid: paramUid } = useParams();
  const uid = propUid || paramUid;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();
  // ★ ECHO Plus — Get the VIEWER'S ghost mode status
  const { ghostMode: myGhostMode, isPlus: amIPlus } = useSubscription();

  const [isFollowing, setIsFollowing] = useState(false);
  const [echowerCount, setEchowerCount] = useState(0);
  const [echowingCount, setEchowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('spotlight');

  // ── Load profile + echower data ──────────────────────────────────────────
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

  // ── ECHO Plus theming (with safe fallbacks) ──────────────────────────────
  const isTargetPlus = profile?.isEchoPlus || false;
  const targetRingStyle = profile?.premiumRingStyle || 'gold';
  const targetProfileBg = profile?.premiumProfileBg || 'default';
  const targetBadgeText = profile?.premiumBadgeText || '';
  const targetAccentColor = profile?.premiumAccentColor || 'default';

  // ── FIXED: view counter uses the VIEWER'S Ghost Mode, not the target's ───
  useEffect(() => {
    if (!uid || !user || user.uid === uid) return; // don't count my own view
    
    // If I am a Plus user AND my Ghost Mode is ON, I am invisible. Do not count.
    const iAmInvisible = amIPlus && myGhostMode === true;
    if (iAmInvisible) return;

    const sessionKey = `echo_viewed_${uid}`;
    try { if (sessionStorage.getItem(sessionKey)) return; } catch {}

    // Use runTransaction to safely increment
    const viewsRef = ref(db, `profiles/${uid}/profileViews`);
    runTransaction(viewsRef, (current) => (Number(current) || 0) + 1)
      .then(() => { try { sessionStorage.setItem(sessionKey, '1'); } catch {} })
      .catch(() => { /* Silently ignore permission/network errors */ });
  }, [uid, user, amIPlus, myGhostMode]);

  // ── Spotify embed helper ─────────────────────────────────────────────────
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

  const musicEmbedUrl = getSpotifyEmbed(profile?.premiumMusic);

  // ── Follow / unfollow ────────────────────────────────────────────────────
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

  // ── Loading / error states ───────────────────────────────────────────────
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
    ? new Date(profile.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : 'Recently';

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className={`profile-page snap-profile ${onClose ? 'profile-overlay-mode' : ''} ${
        isTargetPlus && targetAccentColor !== 'default'
          ? `profile-accent-${targetAccentColor}`
          : ''
      }`}
    >
      <SEO title={`${profile.name} on ECHO`} />

      {/* ── Hero (cover + avatar + name) ─────────────────────────────────── */}
      <div className="snap-hero">
        <button className="snap-back-btn" onClick={handleBack} aria-label="Go back">
          <i className="fas fa-arrow-left" />
        </button>

        {/* FIXED: targetProfileBg fallback to 'default' — matches premium-bg-* CSS classes */}
        <div
          className={`snap-hero-bg ${
            isTargetPlus ? `premium-bg-${targetProfileBg || 'default'}` : ''
          }`}
          style={{
            backgroundImage: !isTargetPlus && coverImage ? `url(${coverImage})` : 'none',
          }}
        />
        <div className="snap-hero-overlay" />

        <div className="snap-avatar-wrapper">
          {/* FIXED: targetRingStyle fallback to 'gold' — matches plus-avatar-ring CSS */}
          <div
            className={`snap-avatar-ring ${
              isTargetPlus ? `plus-avatar-ring ${targetRingStyle || 'gold'}` : ''
            }`}
          />
          <div className="snap-avatar" style={{ cursor: 'default' }}>
            <Avatar src={profile.avatar} name={profile.name} size={100} />
          </div>
        </div>

        <div className="snap-info">
          <h1
            className={`snap-name ${
              isTargetPlus && targetAccentColor !== 'default'
                ? `snap-name-accent-${targetAccentColor}`
                : ''
            }`}
          >
            {profile.name || 'User'}

            {isTargetPlus && targetBadgeText ? (
              <span
                style={{
                  fontSize: '12px',
                  background: 'rgba(255,215,0,0.2)',
                  color: '#FFD700',
                  padding: '2px 8px',
                  borderRadius: '8px',
                  marginLeft: '8px',
                  fontWeight: 'bold',
                  border: '1px solid rgba(255,215,0,0.3)',
                }}
              >
                {targetBadgeText}
              </span>
            ) : isTargetPlus ? (
              <PlusBadge size={22} />
            ) : null}
          </h1>

          {profile.username && (
            <div className="snap-username-wrap">
              <UsernamePill uid={uid} username={profile.username} size="md" />
            </div>
          )}

          <div className="snap-meta">
            <span>
              <i className="fas fa-calendar-alt" /> {memberSince}
            </span>
            {profile.country && (
              <span>
                <i className="fas fa-map-marker-alt" />{' '}
                {profile.city ? `${profile.city}, ` : ''}
                {profile.country}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Bio + actions ────────────────────────────────────────────────── */}
      <div className="snap-bio-section">
        <p className="snap-bio">{profile.bio || 'No bio yet.'}</p>

        {isTargetPlus && musicEmbedUrl && (
          <div
            style={{
              marginTop: '16px',
              marginBottom: '16px',
              borderRadius: '12px',
              overflow: 'hidden',
              width: '100%',
            }}
          >
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
                <>
                  <i className="fas fa-check" /> Echowing
                </>
              ) : (
                <>
                  <i className="fas fa-plus" /> Echower
                </>
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

      {/* ── Stats row ────────────────────────────────────────────────────── */}
      <div className="snap-stats-row">
        <div className="snap-stat-btn">
          <strong>{echowerCount}</strong>
          <span>Echowers</span>
        </div>
        <div className="snap-stat-btn">
          <strong>{echowingCount}</strong>
          <span>Echowing</span>
        </div>
        {/* Show Views only if the target is a Plus user (and it's their own profile or public) */}
        {isTargetPlus && (
          <div className="snap-stat-btn">
            <strong>{profile.profileViews || 0}</strong>
            <span>Views</span>
          </div>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="snap-tabs">
        <button
          className={`snap-tab ${activeTab === 'spotlight' ? 'active' : ''}`}
          onClick={() => setActiveTab('spotlight')}
        >
          <i className="fas fa-bolt" /> Spotlight
        </button>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div className="snap-content-area">
        {activeTab === 'spotlight' && <ProfileSpotlightGrid uid={uid} />}
      </div>
    </div>
  );
};

export default UserProfile;
