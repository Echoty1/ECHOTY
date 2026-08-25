import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue, get, set, push, runTransaction } from 'firebase/database';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useCommunity } from '../../../contexts/CommunityContext';
import { getCommunityRules, RULES_PENALTY } from '../../../constants/communityRules';
import './Communities.css';

const CACHE_KEY = 'echo_communities_v1';
const MEMBER_CACHE_KEY = 'echo_user_communities_v1';

const getCommunityImage = (name) => {
  const imageMap = {
    General: '/images/communities/default.png',
    Gaming: '/images/communities/gaming.png',
    Movies: '/images/communities/movies.png',
    Music: '/images/communities/music.png',
    Technology: '/images/communities/tech.png',
    Tech: '/images/communities/tech.png',
    Art: '/images/communities/art.png',
    'Book Club': '/images/communities/book.png',
    Fitness: '/images/communities/fitness.png',
  };
  if (!name) return '/images/communities/default.png';
  if (imageMap[name]) return imageMap[name];
  const lower = String(name).toLowerCase();
  for (const [key, value] of Object.entries(imageMap)) {
    if (key.toLowerCase() === lower) return value;
  }
  if (lower.includes('tech')) return '/images/communities/tech.png';
  if (lower.includes('game')) return '/images/communities/gaming.png';
  if (lower.includes('music')) return '/images/communities/music.png';
  if (lower.includes('movie') || lower.includes('film')) return '/images/communities/movies.png';
  if (lower.includes('fit')) return '/images/communities/fitness.png';
  if (lower.includes('art')) return '/images/communities/art.png';
  if (lower.includes('book') || lower.includes('read')) return '/images/communities/book.png';
  return '/images/communities/default.png';
};

const readCache = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
};

const Communities = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setCurrentCommunity } = useCommunity();

  const [communities, setCommunities] = useState(() => readCache(CACHE_KEY, []));
  const [userCommunities, setUserCommunities] = useState(() =>
    user?.uid ? readCache(`${MEMBER_CACHE_KEY}_${user.uid}`, {}) : {}
  );
  const [loading, setLoading] = useState(() => !(readCache(CACHE_KEY, []).length));
  const [joiningId, setJoiningId] = useState(null);
  const [leavingId, setLeavingId] = useState(null);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [rulesModal, setRulesModal] = useState(null);
  const [leaveModal, setLeaveModal] = useState(null);
  const [acceptingRules, setAcceptingRules] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const snapshot = await get(ref(db, `profiles/${user.uid}`));
        const data = snapshot.exists() ? snapshot.val() : {};
        setUserName(data.name || user.displayName || user.email?.split('@')[0] || 'User');
      } catch {
        setUserName(user.displayName || user.email?.split('@')[0] || 'User');
      }
    })();
  }, [user]);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'communities'),
      (snapshot) => {
        const data = snapshot.val() || {};
        const list = Object.entries(data).map(([id, c]) => {
          const mapped = getCommunityImage(c.name);
          const raw = c.image || '';
          const image =
            !raw || String(raw).includes('default.png')
              ? mapped
              : raw.startsWith('http') || raw.startsWith('/')
              ? raw
              : mapped;
          return {
            id,
            name: c.name || 'Unnamed Community',
            description: c.description || '',
            image: image || mapped,
            tags: Array.isArray(c.tags) ? c.tags : Object.values(c.tags || {}),
            memberCount: Number(c.memberCount || 0),
            createdBy: c.createdBy || '',
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setCommunities(list);
        writeCache(CACHE_KEY, list);
        setLoading(false);
      },
      () => {
        setError('Could not load communities.');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setUserCommunities({});
      return;
    }
    const unsub = onValue(ref(db, `userCommunities/${user.uid}`), (snap) => {
      const val = snap.val() || {};
      setUserCommunities(val);
      writeCache(`${MEMBER_CACHE_KEY}_${user.uid}`, val);
    });
    return () => unsub();
  }, [user?.uid]);

  const openCommunity = (community) => {
    setCurrentCommunity({
      id: community.id,
      name: community.name,
      memberCount: community.memberCount,
      image: community.image,
    });
    navigate(`/community/${community.id}`);
  };

  const handleJoin = async (community) => {
    if (!user?.uid) {
      setError('Please sign in to join communities.');
      return;
    }
    if (joiningId || leavingId) return;
    if (userCommunities[community.id] === true) {
      openCommunity(community);
      return;
    }
    setJoiningId(community.id);
    setError('');
    try {
      await set(ref(db, `userCommunities/${user.uid}/${community.id}`), true);
      await runTransaction(ref(db, `communities/${community.id}/memberCount`), (n) =>
        (Number(n) || 0) + 1
      );
      await push(ref(db, `communityChats/${community.id}/messages`), {
        senderId: user.uid,
        text: `${userName || 'Someone'} joined the community`,
        timestamp: Date.now(),
        type: 'system',
        system: true,
      });
      setUserCommunities((p) => ({ ...p, [community.id]: true }));
      setCurrentCommunity({ ...community, memberCount: community.memberCount + 1 });
      navigate(`/community/${community.id}`);
    } catch (err) {
      try {
        await set(ref(db, `userCommunities/${user.uid}/${community.id}`), null);
      } catch (_) {}
      setError(`Failed to join: ${err.message || 'Please try again.'}`);
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeave = async (community) => {
    if (!user?.uid || !userCommunities[community.id]) return;
    setLeavingId(community.id);
    setError('');
    try {
      // 1️⃣ Write system message FIRST (while still a member)
      await push(ref(db, `communityChats/${community.id}/messages`), {
        senderId: 'system',
        type: 'system',
        text: `${userName || 'Someone'} left the community`,
        timestamp: Date.now(),
        system: true,
      });

      // 2️⃣ Remove membership
      await set(ref(db, `userCommunities/${user.uid}/${community.id}`), null);

      // 3️⃣ Decrement memberCount
      await runTransaction(ref(db, `communities/${community.id}/memberCount`), (n) =>
        Math.max(0, (Number(n) || 0) - 1)
      );

      setUserCommunities((p) => {c
        const next = { ...p };
        delete next[community.id];
        return next;
      });
    } catch (err) {
      setError(`Failed to leave: ${err.message || 'Please try again.'}`);
    } finally {
      setLeavingId(null);
      setLeaveModal(null);
    }
  };

  return (
    <>
      <SEO title="Communities" description="Join communities on ECHO." />
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
            <button type="button" className="communities-error-dismiss" onClick={() => setError('')}>
              ✕
            </button>
          </div>
        )}

        {loading && communities.length === 0 ? (
          <div className="communities-grid communities-skeleton">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div className="community-card skeleton" key={i}>
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
            <p>Seed communities in Firebase to get started.</p>
          </div>
        ) : (
          <div className="communities-grid">
            {communities.map((community, index) => {
              const isMember = userCommunities[community.id] === true;
              const isJoining = joiningId === community.id;
              const isLeaving = leavingId === community.id;
              const busy = isJoining || isLeaving;

              return (
                <div
                  className="community-card"
                  key={community.id}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="community-card-image">
                    <img
                      src={community.image}
                      alt={community.name}
                      onError={(e) => {
                        e.currentTarget.src = getCommunityImage(community.name);
                      }}
                    />
                    {isMember && (
                      <div className="community-member-badge">
                        <i className="fas fa-check" /> Member
                      </div>
                    )}
                  </div>
                  <div className="community-card-body">
                    <h3>{community.name}</h3>
                    <p className="community-description">{community.description}</p>
                    <div className="community-meta">
                      <span className="community-member-count">
                        <i className="fas fa-users" />
                        {community.memberCount.toLocaleString()} member
                        {community.memberCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="community-btn-row">
                      <button
                        type="button"
                        className={`community-join-btn ${isMember ? 'joined' : ''}`}
                        disabled={busy}
                        onClick={() => {
                          if (isMember) openCommunity(community);
                          else setRulesModal({ community });
                        }}
                      >
                        {isJoining ? (
                          <>
                            <i className="fas fa-spinner fa-spin" /> Joining…
                          </>
                        ) : isMember ? (
                          <>
                            <i className="fas fa-comment" /> Open Chat
                          </>
                        ) : (
                          <>
                            <i className="fas fa-plus" /> Join Community
                          </>
                        )}
                      </button>
                      {isMember && (
                        <button
                          type="button"
                          className="community-leave-btn"
                          disabled={busy}
                          onClick={() => setLeaveModal({ community })}
                        >
                          {isLeaving ? (
                            <>
                              <i className="fas fa-spinner fa-spin" /> Leaving…
                            </>
                          ) : (
                            <>
                              <i className="fas fa-sign-out-alt" />
                              <span className="leave-text">Leave</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {rulesModal && (
          <div className="community-rules-overlay" role="dialog" aria-modal="true">
            <div className="community-rules-modal">
              <h2>Rules · {rulesModal.community.name}</h2>
              <p className="community-rules-intro">Please read and accept these rules before joining.</p>
              <ul className="community-rules-list">
                {getCommunityRules(rulesModal.community.name).map((rule, i) => (
                  <li key={i}>{rule}</li>
                ))}
              </ul>
              <p className="community-rules-penalty">{RULES_PENALTY}</p>
              <div className="community-rules-actions">
                <button
                  type="button"
                  className="community-rules-cancel"
                  disabled={acceptingRules}
                  onClick={() => setRulesModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="community-rules-accept"
                  disabled={acceptingRules}
                  onClick={async () => {
                    setAcceptingRules(true);
                    try {
                      await handleJoin(rulesModal.community);
                      setRulesModal(null);
                    } finally {
                      setAcceptingRules(false);
                    }
                  }}
                >
                  {acceptingRules ? 'Joining…' : 'I agree · Join'}
                </button>
              </div>
            </div>
          </div>
        )}

        {leaveModal && (
          <div className="community-rules-overlay" role="dialog" aria-modal="true">
            <div className="community-rules-modal">
              <h2>Leave {leaveModal.community.name}?</h2>
              <p className="community-rules-intro">
                You can rejoin anytime. Your past messages will stay in the community.
              </p>
              <div className="community-rules-actions">
                <button
                  type="button"
                  className="community-rules-cancel"
                  disabled={!!leavingId}
                  onClick={() => setLeaveModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="community-leave-confirm"
                  disabled={!!leavingId}
                  onClick={() => handleLeave(leaveModal.community)}
                >
                  {leavingId ? 'Leaving…' : 'Leave community'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Communities;