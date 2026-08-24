import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, get, set, push, runTransaction } from 'firebase/database';

import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useCommunity } from '../../../contexts/CommunityContext';

import './Communities.css';

// ─── Map community names to their specific images ──────────────
const getCommunityImage = (name) => {
  const imageMap = {
    'Gaming': '/images/communities/gaming.png',
    'General': '/images/communities/default.png',
    'Movies': '/images/communities/art.png',
    'Music': '/images/communities/music.png',
    'Art': '/images/communities/art.png',
    'Fitness': '/images/communities/fitness.png',
    'Tech': '/images/communities/tech.png',
  };
  
  const exact = imageMap[name];
  if (exact) return exact;
  
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(imageMap)) {
    if (key.toLowerCase() === lowerName) return value;
  }
  
  return '/images/communities/default.png';
};

const Communities = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setCurrentCommunity } = useCommunity();

  const [communities, setCommunities] = useState([]);
  const [userCommunities, setUserCommunities] = useState({});
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');

  // ─── Get user's display name ───────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    
    const fetchUserName = async () => {
      try {
        const profileRef = ref(db, `profiles/${user.uid}`);
        const snapshot = await get(profileRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserName(data.name || user.displayName || user.email?.split('@')[0] || 'User');
        } else {
          setUserName(user.displayName || user.email?.split('@')[0] || 'User');
        }
      } catch (err) {
        console.warn('Failed to fetch user name:', err);
        setUserName(user.displayName || user.email?.split('@')[0] || 'User');
      }
    };
    
    fetchUserName();
  }, [user]);

  // ─── Load all communities in real time ─────────────────────────
  useEffect(() => {
    const communitiesRef = ref(db, 'communities');

    const unsubscribe = onValue(
      communitiesRef,
      (snapshot) => {
        const data = snapshot.val() || {};

        const communityList = Object.entries(data).map(([id, community]) => ({
          id,
          name: community.name || 'Unnamed Community',
          description: community.description || '',
          image: community.image || getCommunityImage(community.name),
          tags: Array.isArray(community.tags)
            ? community.tags
            : Object.values(community.tags || {}),
          memberCount: Number(community.memberCount || 0),
          createdBy: community.createdBy || '',
        }));

        communityList.sort((a, b) => a.name.localeCompare(b.name));

        setCommunities(communityList);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load communities:', err);
        setError('Could not load communities.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ─── Load current user's memberships ──────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setUserCommunities({});
      return;
    }

    const membershipsRef = ref(db, `userCommunities/${user.uid}`);

    const unsubscribe = onValue(
      membershipsRef,
      (snapshot) => {
        setUserCommunities(snapshot.val() || {});
      },
      (err) => {
        console.error('Failed to load community memberships:', err);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // ─── Open community chat ──────────────────────────────────────
  const openCommunity = (community) => {
    setCurrentCommunity({
      id: community.id,
      name: community.name,
      memberCount: community.memberCount,
      image: community.image,
    });

    navigate(`/community/${community.id}`);
  };

  // ─── Handle join ────────────────────────────────────────────────
  const handleJoin = async (community) => {
    if (!user?.uid) {
      setError('Please sign in to join communities.');
      return;
    }
    
    if (joiningId) return;

    // Already a member: open the community
    if (userCommunities[community.id] === true) {
      openCommunity(community);
      return;
    }

    setJoiningId(community.id);
    setError('');

    try {
      console.log(`🔵 Joining community: ${community.name} (${community.id})`);

      // 1. Add user to community members
      const membershipRef = ref(db, `userCommunities/${user.uid}/${community.id}`);
      await set(membershipRef, true);
      console.log('✅ Added user to members');

      // 2. Increment member count
      const memberCountRef = ref(db, `communities/${community.id}/memberCount`);
      await runTransaction(memberCountRef, (currentCount) => {
        return (Number(currentCount) || 0) + 1;
      });
      console.log('✅ Incremented member count');

      // 3. Add system join message
      const messagesRef = ref(db, `communityChats/${community.id}/messages`);
      const systemMessage = `${userName || 'Someone'} joined the community`;
      await push(messagesRef, {
        senderId: user.uid,
        text: systemMessage,
        timestamp: Date.now(),
        type: 'system',
        system: true,
      });
      console.log('✅ Added system message');

      // 4. Update local state
      setUserCommunities(prev => ({
        ...prev,
        [community.id]: true
      }));

      // 5. Navigate to the community chat
      const updatedCommunity = {
        ...community,
        memberCount: community.memberCount + 1,
      };
      
      setCurrentCommunity(updatedCommunity);
      navigate(`/community/${community.id}`);
      
      console.log('✅ Successfully joined community!');

    } catch (err) {
      console.error('❌ Failed to join community:', err);
      
      // Try to rollback the membership if something failed
      try {
        const membershipRef = ref(db, `userCommunities/${user.uid}/${community.id}`);
        await set(membershipRef, null);
        console.log('↩️ Rolled back membership');
      } catch (rollbackErr) {
        console.warn('⚠️ Could not rollback membership:', rollbackErr);
      }
      
      setError(`Failed to join: ${err.message || 'Please try again.'}`);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <>
      <SEO
        title="Communities"
        description="Join communities and connect with people who share your interests on ECHO."
      />
      <StructuredData />

      <div className="communities-page">
        <div className="communities-header">
          <h1>🌟 Communities</h1>
          <p>Find your people and connect over what you love.</p>
        </div>

        {error && (
          <div className="communities-error">
            <i className="fas fa-exclamation-circle" />
            <span>{error}</span>
            <button 
              className="communities-error-dismiss"
              onClick={() => setError('')}
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="communities-grid communities-skeleton">
            {[1, 2, 3, 4].map((item) => (
              <div className="community-card skeleton" key={item}>
                <div className="community-card-image skeleton-image" />
                <div className="community-card-body">
                  <div className="skeleton-title" />
                  <div className="skeleton-text" />
                  <div className="skeleton-meta" />
                </div>
              </div>
            ))}
          </div>
        ) : communities.length === 0 ? (
          <div className="communities-empty">
            <i className="fas fa-users" />
            <h2>No communities yet</h2>
            <p>New communities will appear here soon.</p>
          </div>
        ) : (
          <div className="communities-grid">
            {communities.map((community, index) => {
              const isMember = userCommunities[community.id] === true;
              const isJoining = joiningId === community.id;

              return (
                <div
                  className="community-card"
                  key={community.id}
                  style={{ animationDelay: `${index * 80}ms` }}
                >
                  {/* ─── Image ─────────────────────────────────────── */}
                  <div className="community-card-image">
                    <img
                      src={community.image}
                      alt={community.name}
                      onError={(e) => {
                        e.currentTarget.src = '/images/communities/default.png';
                      }}
                    />
                    {isMember && (
                      <div className="community-member-badge">
                        <i className="fas fa-check" /> Member
                      </div>
                    )}
                  </div>

                  {/* ─── Body ─────────────────────────────────────── */}
                  <div className="community-card-body">
                    <h3>{community.name}</h3>
                    <p className="community-description">{community.description}</p>

                    <div className="community-meta">
                      <span className="community-member-count">
                        <i className="fas fa-users" />
                        {community.memberCount.toLocaleString()} members
                      </span>
                    </div>

                    <button
                      className={`community-join-btn ${isMember ? 'joined' : ''}`}
                      onClick={() => {
                        if (isMember) {
                          openCommunity(community);
                        } else {
                          handleJoin(community);
                        }
                      }}
                      disabled={isJoining}
                    >
                      {isJoining ? (
                        <>
                          <i className="fas fa-spinner fa-spin" />
                          {isMember ? 'Leaving...' : 'Joining...'}
                        </>
                      ) : isMember ? (
                        <>
                          <i className="fas fa-comment" />
                          Open Chat
                        </>
                      ) : (
                        <>
                          <i className="fas fa-plus" />
                          Join Community
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default Communities;