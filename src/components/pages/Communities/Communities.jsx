// src/components/pages/Communities/Communities.jsx
import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ref, onValue, set, runTransaction, push, get } from 'firebase/database';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useCommunity } from '../../../contexts/CommunityContext';
import { getCommunityRules, RULES_PENALTY } from '../../../constants/communityRules';
import { getCache, setCache } from '../../../services/cacheService';
import './Communities.css';

const FALLBACK_IMAGE = '/images/communities/default.png';
const COMMUNITIES_CACHE_KEY = 'communities_list';
const MEMBERSHIP_CACHE_KEY = 'user_memberships';
const CACHE_TTL = 60; // 1 minute

const guessCategory = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('game')) return 'gaming';
  if (n.includes('music')) return 'music';
  if (n.includes('tech')) return 'tech';
  if (n.includes('movie') || n.includes('film')) return 'movies';
  if (n.includes('art')) return 'art';
  if (n.includes('fit')) return 'fitness';
  if (n.includes('book') || n.includes('read')) return 'books';
  return 'general';
};

const guessIcon = (category) => {
  const map = {
    gaming: '🎮', music: '🎵', tech: '💻', movies: '🎬',
    art: '🎨', fitness: '💪', books: '📚', general: '🌐'
  };
  return map[category] || '🌐';
};

// ─── Memoized Skeleton Card ────────────────────────────────────
const SkeletonCard = memo(() => (
  <div className="community-card skeleton">
    <div className="skeleton-image" />
    <div className="skeleton-body">
      <div className="skeleton-line" style={{ width: '70%' }} />
      <div className="skeleton-line" style={{ width: '90%' }} />
      <div className="skeleton-line" style={{ width: '50%' }} />
    </div>
  </div>
));

// ─── Memoized Community Card ────────────────────────────────────
const CommunityCard = memo(({ community, isMember, isJoining, isLeaving, onJoin, onLeave, onOpen }) => {
  const busy = isJoining || isLeaving;

  return (
    <motion.div
      className="community-card"
      whileHover="hover"
      style={{
        '--card-bg': community.bgColor || '#12121a',
      }}
    >
      <div className="community-card-image">
        <img
          src={community.image}
          alt={community.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = FALLBACK_IMAGE;
          }}
        />
        <div className="community-card-overlay" />
        {isMember && (
          <span className="community-card-member">Member</span>
        )}
      </div>

      <div className="community-card-body">
        <h3>{community.name}</h3>
        <p className="community-description">{community.description}</p>
        <div className="community-card-meta">
          <span className="community-member-count">
            <i className="fas fa-users" />
            {community.memberCount.toLocaleString()}
          </span>
        </div>

        <div className="community-card-actions">
          {isMember ? (
            <>
              <button
                className="community-join-btn joined"
                onClick={() => onOpen(community)}
              >
                <i className="fas fa-comment" /> Open
              </button>
              <button
                className="community-leave-btn"
                onClick={() => onLeave(community)}
                disabled={busy}
              >
                {isLeaving ? (
                  <i className="fas fa-spinner fa-spin" />
                ) : (
                  <i className="fas fa-sign-out-alt" />
                )}
                <span>Leave</span>
              </button>
            </>
          ) : (
            <button
              className="community-join-btn"
              onClick={() => onJoin(community)}
              disabled={busy}
            >
              {isJoining ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Joining…
                </>
              ) : (
                <>
                  <i className="fas fa-plus" /> Join
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ─── Rules Modal ────────────────────────────────────────────────
const RulesModal = memo(({ community, onAccept, onCancel, accepting }) => (
  <div className="community-rules-overlay" role="dialog" aria-modal="true">
    <div className="community-rules-modal">
      <h2>Rules · {community.name}</h2>
      <p className="community-rules-intro">Please read and accept these rules before joining.</p>
      <ul className="community-rules-list">
        {getCommunityRules(community.name).map((rule, i) => (
          <li key={i}>{rule}</li>
        ))}
      </ul>
      <p className="community-rules-penalty">{RULES_PENALTY}</p>
      <div className="community-rules-actions">
        <button
          className="community-rules-cancel"
          disabled={accepting}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="community-rules-accept"
          disabled={accepting}
          onClick={onAccept}
        >
          {accepting ? 'Joining…' : 'I agree · Join'}
        </button>
      </div>
    </div>
  </div>
));

// ─── Leave Modal ────────────────────────────────────────────────
const LeaveModal = memo(({ community, onLeave, onCancel, leaving }) => (
  <div className="community-rules-overlay" role="dialog" aria-modal="true">
    <div className="community-rules-modal">
      <h2>Leave {community.name}?</h2>
      <p className="community-rules-intro">
        You can rejoin anytime. Your past messages will stay in the community.
      </p>
      <div className="community-rules-actions">
        <button
          className="community-rules-cancel"
          disabled={leaving}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="community-leave-confirm"
          disabled={leaving}
          onClick={onLeave}
        >
          {leaving ? 'Leaving…' : 'Leave community'}
        </button>
      </div>
    </div>
  </div>
));

// ─── Main Communities Component ────────────────────────────────
const Communities = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setCurrentCommunity } = useCommunity();

  const [communities, setCommunities] = useState([]);
  const [userCommunities, setUserCommunities] = useState({});
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [leavingId, setLeavingId] = useState(null);
  const [error, setError] = useState('');
  const [userName, setUserName] = useState('');
  const [rulesModal, setRulesModal] = useState(null);
  const [leaveModal, setLeaveModal] = useState(null);
  const [acceptingRules, setAcceptingRules] = useState(false);

  // ─── Load user name ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const loadName = async () => {
      try {
        const snapshot = await get(ref(db, `profiles/${user.uid}`));
        const data = snapshot.exists() ? snapshot.val() : {};
        setUserName(data.name || user.displayName || user.email?.split('@')[0] || 'User');
      } catch {
        setUserName(user.displayName || user.email?.split('@')[0] || 'User');
      }
    };
    loadName();
  }, [user]);

  // ─── Load communities with caching ────────────────────────────
  useEffect(() => {
    let isMounted = true;
    let communitiesUnsub = null;
    let membershipUnsub = null;

    const loadData = async () => {
      try {
        // ─── Try cache first ──────────────────────────────────────
        const cachedCommunities = await getCache(COMMUNITIES_CACHE_KEY);
        if (cachedCommunities && cachedCommunities.length > 0) {
          if (isMounted) {
            setCommunities(cachedCommunities);
            setLoading(false);
          }
        }

        // ─── Listen to communities ────────────────────────────────
        const communitiesRef = ref(db, 'communities');
        communitiesUnsub = onValue(
          communitiesRef,
          (snapshot) => {
            if (!isMounted) return;
            const data = snapshot.val() || {};
            const list = Object.entries(data).map(([id, c]) => {
              const category = c.category || guessCategory(c.name);
              return {
                id,
                name: c.name || 'Unnamed Community',
                description: c.description || '',
                image: c.image || FALLBACK_IMAGE,
                memberCount: Number(c.memberCount || 0),
                category,
                icon: c.icon || guessIcon(category),
                bgColor: c.bgColor || '#12121a',
              };
            });
            list.sort((a, b) => a.name.localeCompare(b.name));
            setCommunities(list);
            setLoading(false);
            // Cache the list
            setCache(COMMUNITIES_CACHE_KEY, list, CACHE_TTL).catch(() => {});
          },
          () => {
            if (isMounted) {
              setError('Could not load communities.');
              setLoading(false);
            }
          }
        );

        // ─── Listen to user memberships ────────────────────────────
        if (user?.uid) {
          const membershipRef = ref(db, `userCommunities/${user.uid}`);
          membershipUnsub = onValue(membershipRef, (snap) => {
            if (isMounted) {
              const data = snap.val() || {};
              setUserCommunities(data);
              // Cache memberships
              setCache(`${MEMBERSHIP_CACHE_KEY}_${user.uid}`, data, CACHE_TTL).catch(() => {});
            }
          });
        } else {
          setUserCommunities({});
        }
      } catch (err) {
        console.warn('Communities load error:', err);
        if (isMounted) {
          setError('Failed to load communities.');
          setLoading(false);
        }
      }
    };

    // ─── Try cached memberships ──────────────────────────────────
    if (user?.uid) {
      getCache(`${MEMBERSHIP_CACHE_KEY}_${user.uid}`).then((cached) => {
        if (cached && isMounted) {
          setUserCommunities(cached);
        }
      });
    }

    loadData();

    return () => {
      isMounted = false;
      if (communitiesUnsub) communitiesUnsub();
      if (membershipUnsub) membershipUnsub();
    };
  }, [user?.uid]);

  // ─── Handlers ──────────────────────────────────────────────────
  const openCommunity = useCallback((community) => {
    setCurrentCommunity({
      id: community.id,
      name: community.name,
      memberCount: community.memberCount,
      image: community.image,
    });
    navigate(`/community/${community.id}/wall`);
  }, [navigate, setCurrentCommunity]);

  const handleJoin = useCallback(async (community) => {
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
      navigate(`/community/${community.id}/wall`);
    } catch (err) {
      try {
        await set(ref(db, `userCommunities/${user.uid}/${community.id}`), null);
      } catch (_) {}
      setError(`Failed to join: ${err.message || 'Please try again.'}`);
    } finally {
      setJoiningId(null);
    }
  }, [user, joiningId, leavingId, userCommunities, userName, navigate, setCurrentCommunity, openCommunity]);

  const handleLeave = useCallback(async (community) => {
    if (!user?.uid || !userCommunities[community.id]) return;
    setLeavingId(community.id);
    setError('');

    try {
      await push(ref(db, `communityChats/${community.id}/messages`), {
        senderId: 'system',
        type: 'system',
        text: `${userName || 'Someone'} left the community`,
        timestamp: Date.now(),
        system: true,
      });
      await set(ref(db, `userCommunities/${user.uid}/${community.id}`), null);
      await runTransaction(ref(db, `communities/${community.id}/memberCount`), (n) =>
        Math.max(0, (Number(n) || 0) - 1)
      );
      setUserCommunities((p) => {
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
  }, [user, userCommunities, userName]);

  // ─── Render ────────────────────────────────────────────────────
  if (loading && communities.length === 0) {
    return (
      <div className="communities-page">
        <div className="communities-header">
          <h1>🌍 Communities</h1>
          <p>Loading realms…</p>
        </div>
        <div className="communities-grid skeleton-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO title="ECHO – Communities" description="Explore communities on ECHO." />
      <StructuredData />

      <div className="communities-page">
        <div className="communities-header">
          <h1>🌍 Communities</h1>
          <p>Find your people. Explore realms.</p>
        </div>

        <a
          className="echo-brand-banner"
          href="https://brand.echoty.xyz"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="echo-brand-orb o1" aria-hidden="true" />
          <span className="echo-brand-orb o2" aria-hidden="true" />
          <span className="echo-brand-orb o3" aria-hidden="true" />
          <div className="echo-brand-inner">
            <p className="echo-brand-kicker">ECHO Brand</p>
            <h3 className="echo-brand-title">Want your own community?</h3>
            <p className="echo-brand-sub">Create it on brand.echoty.xyz</p>
            <span className="echo-brand-cta">Visit brand.echoty.xyz</span>
          </div>
        </a>

        {error && (
          <div className="communities-error">
            <i className="fas fa-exclamation-circle" />
            <span>{error}</span>
            <button className="communities-error-dismiss" onClick={() => setError('')}>
              ✕
            </button>
          </div>
        )}

        {communities.length === 0 ? (
          <div className="communities-empty">
            <i className="fas fa-users" />
            <h2>No communities yet</h2>
            <p>Seed communities in Firebase to get started.</p>
          </div>
        ) : (
          <div className="communities-grid">
            {communities.map((community) => {
              const isMember = userCommunities[community.id] === true;
              const isJoining = joiningId === community.id;
              const isLeaving = leavingId === community.id;

              return (
                <CommunityCard
                  key={community.id}
                  community={community}
                  isMember={isMember}
                  isJoining={isJoining}
                  isLeaving={isLeaving}
                  onJoin={() => setRulesModal({ community })}
                  onLeave={() => setLeaveModal({ community })}
                  onOpen={openCommunity}
                />
              );
            })}
          </div>
        )}


        {rulesModal && (
          <RulesModal
            community={rulesModal.community}
            accepting={acceptingRules}
            onAccept={async () => {
              setAcceptingRules(true);
              try {
                await handleJoin(rulesModal.community);
                setRulesModal(null);
              } finally {
                setAcceptingRules(false);
              }
            }}
            onCancel={() => setRulesModal(null)}
          />
        )}

        {leaveModal && (
          <LeaveModal
            community={leaveModal.community}
            leaving={!!leavingId}
            onLeave={() => handleLeave(leaveModal.community)}
            onCancel={() => setLeaveModal(null)}
          />
        )}
      </div>
    </>
  );
};

export default Communities;
