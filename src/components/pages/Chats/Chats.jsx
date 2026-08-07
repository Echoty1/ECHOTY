// src/components/pages/Chats/Chats.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../services/firebase';
import { useDeletedAccountCheck } from '../../../hooks/useDeletedAccountCheck';
import {
  ref,
  onValue,
  get,
} from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import './Chats.css';
import Spinner from '../../common/Spinner';

const timeAgo = (timestamp) => {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

const Chats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentChats, setRecentChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState({});
  const inputRef = useRef(null);
  const searchTimeout = useRef(null);
  const presenceUnsubRef = useRef(null);

  useDeletedAccountCheck();

  // ─── Real‑time presence listener ────────────────────────────
  useEffect(() => {
    if (!user) return;
    const presenceRef = ref(db, 'presence/online');
    presenceUnsubRef.current = onValue(presenceRef, (snapshot) => {
      const data = snapshot.val() || {};
      setOnlineUsers(data);
    });
    return () => {
      if (presenceUnsubRef.current) {
        presenceUnsubRef.current();
        presenceUnsubRef.current = null;
      }
    };
  }, [user]);

  // ─── Load recent chats ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const userChatsRef = ref(db, `userChats/${user.uid}`);
    const unsubscribe = onValue(userChatsRef, async (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setRecentChats([]);
        return;
      }

      const partnerIds = Object.keys(data);
      const chatPromises = partnerIds.map(async (partnerId) => {
        try {
          const meta = data[partnerId] || {};
          const profileRef = ref(db, `profiles/${partnerId}`);
          const profileSnap = await get(profileRef);
          const profile = profileSnap.val() || {};

          let partnerName;
          let isDeleted = false;

          if (meta.partnerDeleted === true) {
            partnerName = meta.partnerName || 'Deleted Account';
            isDeleted = true;
          } else {
            partnerName = profile.name || profile.username || profile.displayName || partnerId;
          }

          const isSender = meta.lastSenderId === user.uid;
          let displayMessage = meta.lastMessage || 'Start chatting...';
          if (displayMessage !== 'Start chatting...') {
            displayMessage = isSender
              ? `You: ${displayMessage}`
              : `${partnerName}: ${displayMessage}`;
          }

          return {
            id: partnerId,
            name: partnerName,
            lastMessage: displayMessage,
            timestamp: meta.lastUpdated || Date.now(),
            lastSenderId: meta.lastSenderId || '',
            unreadCount: meta.unreadCount || 0,
            isDeleted: isDeleted,
            online: !!onlineUsers[partnerId],
          };
        } catch (err) {
          console.warn('Error loading chat partner:', partnerId, err);
          return null;
        }
      });

      const chatResults = await Promise.all(chatPromises);
      const validChats = chatResults.filter(chat => chat !== null);
      validChats.sort((a, b) => b.timestamp - a.timestamp);
      setRecentChats(validChats);
    });

    return () => unsubscribe();
  }, [user, onlineUsers]);

  // ─── Load all users for search ──────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoadingUsers(true);
    console.log('🔍 Chats: Loading all profiles...');

    const profilesRef = ref(db, 'profiles');
    const unsubscribe = onValue(
      profilesRef,
      (snapshot) => {
        const data = snapshot.val();
        console.log('📦 Chats: Raw profiles data:', data);

        if (data) {
          const usersList = Object.entries(data)
            .map(([uid, profile]) => {
              const name = profile.name || profile.username || profile.displayName || 'Unknown';
              return {
                id: uid,
                name: name,
                username: profile.username || '',
                displayName: profile.displayName || '',
                country: profile.country || '',
                city: profile.city || '',
                interests: Array.isArray(profile.interests) ? profile.interests : [],
                skills: Array.isArray(profile.skills) ? profile.skills : [],
                isOnline: !!onlineUsers[uid],
                status: profile.status || 'Active',
                lastActive: profile.lastActive || 'Just now',
                mutualConnections: 0,
                bio: profile.bio || '',
                avatar: profile.avatar || '',
                mood: profile.mood || 'neutral',
                activeSkin: profile.activeSkin || null,
              };
            })
            .filter(u => u.id !== user.uid);

          console.log(`👥 Chats: Loaded ${usersList.length} other users.`);
          if (usersList.length > 0) {
            console.log('👤 First user:', usersList[0].name);
          }
          setAllUsers(usersList);
        } else {
          console.warn('⚠️ Chats: No profiles found.');
          setAllUsers([]);
        }
        setLoadingUsers(false);
      },
      (error) => {
        console.error('❌ Chats: Error loading profiles:', error);
        setLoadingUsers(false);
      }
    );

    return () => unsubscribe();
  }, [user, onlineUsers]);

  // ─── Search handler ──────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    const query = searchQuery.trim().toLowerCase();
    console.log(`🔎 Chats: Search query: "${query}"`);

    if (query.length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    if (query.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    if (allUsers.length === 0) {
      console.warn('⚠️ Chats: No users to search.');
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeout.current = setTimeout(() => {
      const filtered = allUsers
        .map(user => {
          let score = 0;
          const searchable = [
            user.name,
            user.username,
            user.displayName,
            user.country,
            user.city,
            ...user.interests,
            ...user.skills,
            user.bio,
          ].join(' ').toLowerCase();

          if (user.name.toLowerCase() === query) score += 100;
          else if (user.name.toLowerCase().includes(query)) score += 80;

          if (user.username.toLowerCase().includes(query)) score += 70;
          if (user.displayName.toLowerCase().includes(query)) score += 60;

          if (user.country.toLowerCase().includes(query)) score += 50;
          if (user.city.toLowerCase().includes(query)) score += 40;

          for (const interest of user.interests) {
            if (interest.toLowerCase().includes(query)) score += 30;
          }
          for (const skill of user.skills) {
            if (skill.toLowerCase().includes(query)) score += 25;
          }

          if (user.bio.toLowerCase().includes(query)) score += 20;

          return { ...user, score };
        })
        .filter(user => user.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

      console.log(`🔎 Chats: Found ${filtered.length} results.`);
      setResults(filtered);
      setIsSearching(false);
    }, 300);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery, allUsers]);

  // ─── Start chat ─────────────────────────────────────────────
  const startChat = (selectedUser) => {
    if (!selectedUser) return;
    navigate(`/chat/${selectedUser.id}`, {
      state: {
        userName: selectedUser.name,
        userStatus: selectedUser.status,
        userInterests: selectedUser.interests,
        userAvatar: selectedUser.avatar,
        userMood: selectedUser.mood,
        userActiveSkin: selectedUser.activeSkin,
      },
    });
  };

  // ─── Match reasons ──────────────────────────────────────────
  const getMatchReasons = (user) => {
    if (!user) return [];
    const reasons = [];
    if (user.isOnline) reasons.push('⚡ Active now');
    if (user.mutualConnections > 0) reasons.push(`👥 ${user.mutualConnections} mutual connections`);
    const q = searchQuery.trim().toLowerCase();
    if (q && user.interests.some(i => i.toLowerCase().includes(q))) {
      reasons.push('🤖 Shared interests');
    }
    if (q && user.country.toLowerCase().includes(q)) {
      reasons.push('📍 Same country');
    }
    if (q && user.city.toLowerCase().includes(q)) {
      reasons.push('📍 Same city');
    }
    if (reasons.length === 0) reasons.push('✨ Suggested for you');
    return reasons.slice(0, 3);
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="chats-page">
      {/* ─── Search Bar ────────────────────────────────────────── */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <i className="fas fa-search search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search people, interests, skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => {
                setSearchQuery('');
                setResults([]);
                inputRef.current?.focus();
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ─── Search Results ────────────────────────────────────── */}
      {searchQuery.trim().length > 0 ? (
        <div className="search-results">
          {isSearching ? (
            <div className="search-loading">
              <span className="loading-dot">●</span>
              <span className="loading-dot">●</span>
              <span className="loading-dot">●</span>
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="results-header">
                <span>{results.length} results found</span>
              </div>
              {results.map((person, index) => {
                if (!person) return null;
                return (
                  <div
                    key={person.id}
                    className={`result-item ${index === 0 ? 'top-result' : ''}`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => startChat(person)}
                  >
                    <div className="result-avatar">
                      {person.avatar ? (
                        <img src={person.avatar} alt={person.name} className="avatar-img" />
                      ) : (
                        <span className="avatar-text">{person.name[0]?.toUpperCase() || 'U'}</span>
                      )}
                      <span className={`presence-dot ${person.isOnline ? 'online' : 'offline'}`} />
                    </div>
                    <div className="result-info">
                      <div className="result-name-row">
                        <span className="result-name">{person.name}</span>
                        {person.score > 100 && (
                          <span className="result-badge">★ Top Match</span>
                        )}
                      </div>
                      <div className="result-meta">
                        {person.country} {person.city && `· ${person.city}`}
                      </div>
                      <div className="result-tags">
                        {person.interests.slice(0, 2).map((interest, i) => (
                          <span key={i} className="result-tag">#{interest}</span>
                        ))}
                        {person.skills.slice(0, 1).map((skill, i) => (
                          <span key={i} className="result-tag skill">⚡{skill}</span>
                        ))}
                      </div>
                      <div className="result-reasons">
                        {getMatchReasons(person).map((reason, i) => (
                          <span key={i} className="result-reason">{reason}</span>
                        ))}
                      </div>
                    </div>
                    <div className="result-echomoji">
                      <ECHOMOJI
                        mood={person.mood || 'neutral'}
                        skin={person.activeSkin ? getSkinById(person.activeSkin) : null}
                        size={40}
                        interactive={false}
                      />
                    </div>
                    <div className="result-action">
                      <span className="result-connect">→</span>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="no-results">
              <span>🔍</span>
              <p>No results found</p>
              <span className="no-results-sub">
                {loadingUsers ? 'Loading users...' : 'Try a different search'}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* ─── Recent Chats ────────────────────────────────────── */
        <div className="recent-chats">
          <div className="section-header">
            <span>Recent Conversations</span>
          </div>
          {recentChats.length > 0 ? (
            recentChats.map((chat) => {
              if (!chat) return null;
              return (
                <div
                  key={chat.id}
                  className="chat-item"
                  onClick={() => navigate(`/chat/${chat.id}`)}
                >
                  <div className="chat-avatar">
                    {chat.name?.[0]?.toUpperCase() || 'U'}
                    {chat.unreadCount > 0 && (
                      <span className="unread-badge">{chat.unreadCount}</span>
                    )}
                    {chat.isDeleted && (
                      <span className="archived-badge" title="Account deleted – archived">📁</span>
                    )}
                  </div>
                  <div className="chat-info">
                    <div className="chat-name">
                      {chat.name || 'Unknown'}
                      {chat.isDeleted && <span className="archived-label"> (archived)</span>}
                    </div>
                    <div className="chat-last">{chat.lastMessage || 'Start chatting...'}</div>
                  </div>
                  <div className="chat-time">{timeAgo(chat.timestamp)}</div>
                  <div className="chat-presence-dot-small">
                    <span className={`presence-dot ${chat.online ? 'online' : 'offline'}`} />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="no-chats">
              {loadingUsers ? (
                <Spinner size={48} />
              ) : (
                <>
                  <p>No conversations yet</p>
                  <span>Search for people to start chatting</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Chats;