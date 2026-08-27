// src/components/pages/CommunityChat/CommunityMembers.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../../../services/firebase';
import { useAuth } from '../../../hooks/useAuth';
import { useProfile } from '../../../contexts/ProfileContext';
import Avatar from '../../common/Avatar';
import './CommunityMembers.css';

const CommunityMembers = ({ communityId }) => {
  const { user } = useAuth();
  const { getProfile, fetchProfile, presence } = useProfile();
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef(null);
  const scrollPositionRef = useRef(0);

  // Load members
  useEffect(() => {
    if (!communityId) {
      setLoading(false);
      return;
    }
    const unsub = onValue(
      ref(db, `userCommunities`),
      async (snap) => {
        const data = snap.val() || {};
        const memberUids = [];
        for (const [uid, communities] of Object.entries(data)) {
          if (communities && communities[communityId] === true) {
            memberUids.push(uid);
          }
        }
        const memberProfiles = [];
        for (const uid of memberUids) {
          const profile = getProfile(uid) || (await fetchProfile(uid));
          if (profile) {
            memberProfiles.push({ uid, ...profile });
          }
        }
        // Sort: current user first, then online, then by name
        memberProfiles.sort((a, b) => {
          if (a.uid === user?.uid) return -1;
          if (b.uid === user?.uid) return 1;
          const aOnline = presence[a.uid] ? 1 : 0;
          const bOnline = presence[b.uid] ? 1 : 0;
          if (aOnline !== bOnline) return bOnline - aOnline;
          return (a.name || '').localeCompare(b.name || '');
        });
        setMembers(memberProfiles);
        setLoading(false);
      },
      (error) => {
        console.warn('Members error:', error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [communityId, getProfile, fetchProfile, presence, user?.uid]);

  // Save scroll position on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        scrollPositionRef.current = containerRef.current.scrollTop;
      }
    };
  }, []);

  // Restore scroll position on mount
  useEffect(() => {
    if (containerRef.current && scrollPositionRef.current > 0) {
      containerRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [members]);

  const handleChat = (memberUid, memberName, memberAvatar) => {
    // Store current scroll position before navigating
    if (containerRef.current) {
      scrollPositionRef.current = containerRef.current.scrollTop;
    }
    navigate(`/chat/${memberUid}`, {
      state: {
        fromCommunity: communityId,
        userName: memberName || 'User',
        userAvatar: memberAvatar || '',
        returnTo: 'members',
      },
    });
  };

  if (loading) {
    return <div className="members-loading">Loading members…</div>;
  }

  return (
    <div className="community-members-container" ref={containerRef}>
      <div className="members-header">
        <span className="members-title">👥 Members ({members.length})</span>
      </div>
      <div className="members-list">
        {members.length === 0 ? (
          <div className="members-empty">No members yet.</div>
        ) : (
          members.map((member) => {
            const isOnline = presence[member.uid] === true;
            const isCurrentUser = member.uid === user?.uid;
            return (
              <div key={member.uid} className="members-item">
                <Avatar src={member.avatar} name={member.name} size={56} />
                <div className="members-info">
                  <div className="members-name-row">
                    <span className="members-name">
                      {member.name}
                      {isCurrentUser && <span className="members-you"> (You)</span>}
                    </span>
                    <span className={`members-status ${isOnline ? 'online' : 'offline'}`}>
                      {isOnline ? '🟢 Online' : '⚪ Offline'}
                    </span>
                  </div>
                  {member.bio && <div className="members-bio">{member.bio}</div>}
                </div>
                {!isCurrentUser && (
                  <button
                    className="members-chat-btn"
                    onClick={() => handleChat(member.uid, member.name, member.avatar)}
                  >
                    <i className="fas fa-comment" /> Chat
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CommunityMembers;