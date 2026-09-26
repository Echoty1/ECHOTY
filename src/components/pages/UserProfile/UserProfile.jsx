// src/components/pages/UserProfile/UserProfile.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import { followUser, unfollowUser, isEchowing, listenToMyEchowerCount } from '../../../services/echowerService';
import Avatar from '../../common/Avatar';
import './UserProfile.css';

const UserProfile = () => {
  const { uid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profiles, fetchProfile } = useProfile();

  const [isFollowing, setIsFollowing] = useState(false);
  const [echowerCount, setEchowerCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    fetchProfile(uid);

    let unsubEchowers = null;

    if (user) {
      isEchowing(user.uid, uid).then(setIsFollowing);
      // FIX: extract `.length` from the array of UIDs
      unsubEchowers = listenToMyEchowerCount(uid, (uids) => {
        setEchowerCount(Array.isArray(uids) ? uids.length : 0);
      });
    }

    const t = setTimeout(() => setLoading(false), 500);

    return () => {
      if (t) clearTimeout(t);
      if (unsubEchowers && typeof unsubEchowers === 'function') {
        try { unsubEchowers(); } catch {}
      }
    };
  }, [uid, user, fetchProfile]);

  const profile = profiles[uid];

  const handleToggleEchower = async () => {
    if (!user || !uid) return;
    if (isFollowing) {
      await unfollowUser(user.uid, uid);
      setIsFollowing(false);
    } else {
      await followUser(user.uid, uid);
      setIsFollowing(true);
    }
  };

  if (loading) {
    return <div className="user-profile-page loading">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="user-profile-page error">User not found.</div>;
  }

  return (
    <div className="user-profile-page">
      <div className="user-profile-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
      </div>

      <div className="user-profile-card">
        <div className="user-profile-avatar">
          <Avatar src={profile.avatar} name={profile.name} size={110} />
        </div>

        <h1 className="user-profile-name">{profile.name || 'User'}</h1>

        <div className="user-profile-stats">
          <div className="stat">
            <h4>{echowerCount}</h4>
            <p>Echowers</p>
          </div>
        </div>

        {profile.bio && <p className="user-profile-bio">{profile.bio}</p>}

        <div className="user-profile-actions">
          {user?.uid !== uid && (
            <button
              className={isFollowing ? 'echower-btn following' : 'echower-btn'}
              onClick={handleToggleEchower}
            >
              {isFollowing ? '✓ Echowing' : '+ Echower'}
            </button>
          )}

          <button
            className="message-btn"
            onClick={() => navigate(`/chat/${uid}`)}
          >
            Message
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
