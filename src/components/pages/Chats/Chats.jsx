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
  query,
  orderByChild,
  startAt,
  endAt,
  limitToFirst,
} from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import './Chats.css';
import Skeleton from '../../common/Skeleton';
import { getCache, setCache } from '../../../services/cacheService';
import { searchProfiles } from '../../../services/searchService';

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

// Helper: timeout a promise (8 seconds)
const withTimeout = (promise, ms = 8000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
};

const Chats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState({});
  const inputRef = useRef(null);
  const searchTimeout = useRef(null);
  const presenceUnsubRef = useRef(null);
  const userChatsUnsubRef = useRef(null);

  const cacheKey = `chats_${user?.uid}`;

  // ─── State ─────────────────────────────────────────────────────
  const [recentChats, setRecentChats] = useState(() => {
    const cached = getCache(cacheKey);
    return cached || [];
  });

  const [loadingChats, setLoadingChats] = useState(() => !getCache(cacheKey));
  const [syncing, setSyncing] = useState(false);
  const hasSavedCache = useRef(!!getCache(cacheKey));

  useDeletedAccountCheck();

  // ─── Presence listener ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const presenceRef = ref(db, 'presence/online');
    presenceUnsubRef.current = onValue(
      presenceRef,
      (snapshot) => {
        const data = snapshot.val() || {};
        setOnlineUsers(data);
      },
      (error) => console.error('❌ Presence error:', error)
    );
    return () => {
      if (presenceUnsubRef.current) {
        presenceUnsubRef.current();
        presenceUnsubRef.current = null;
      }
    };
  }, [user]);

  // ─── Load chats ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setLoadingChats(false);
      setSyncing(false);
      return;
    }

    const userChatsRef = ref(db, `userChats/${user.uid}`);

    if (userChatsUnsubRef.current) {
      userChatsUnsubRef.current();
      userChatsUnsubRef.current = null;
    }

    const cachedData = getCache(cacheKey);
    if (cachedData && cachedData.length > 0) {
      setSyncing(true);
    }

    userChatsUnsubRef.current = onValue(
      userChatsRef,
      async (snapshot) => {
        const data = snapshot.val();
        if (!data) {
          setRecentChats([]);
          setCache(cacheKey, []);
          setLoadingChats(false);
          setSyncing(false);
          return;
        }

        const partnerIds = Object.keys(data);
        const cached = getCache(cacheKey);
        const hasCache = cached && cached.length > 0;

        const fetchPartner = async (partnerId) => {
          try {
            const meta = data[partnerId] || {};
            const profileRef = ref(db, `profiles/${partnerId}`);
            const profileSnap = await withTimeout(get(profileRef), 8000);
            const profile = profileSnap.val() || {};

            let partnerName, isDeleted = false;
            if (meta.partnerDeleted === true) {
              partnerName = meta.partnerName || 'Deleted Account';
              isDeleted = true;
            } else {
              partnerName = profile.name || profile.username || profile.displayName || meta.partnerName || 'Unknown User';
            }
            const isSender = meta.lastSenderId === user.uid;
            let displayMessage = meta.lastMessage || 'Start chatting...';
            if (displayMessage !== 'Start chatting...') {
              displayMessage = isSender ? `You: ${displayMessage}` : `${partnerName}: ${displayMessage}`;
            }

            return {
              id: partnerId,
              name: partnerName,
              lastMessage: displayMessage,
              timestamp: meta.lastUpdated || Date.now(),
              lastSenderId: meta.lastSenderId || '',
              unreadCount: meta.unreadCount || 0,
              isDeleted,
              online: !!onlineUsers[partnerId],
            };
          } catch (err) {
            console.warn('⚠️ Error loading partner:', partnerId, err.message);
            const meta = data[partnerId] || {};
            const fallbackName = meta.partnerName || 'Unknown User';
            return {
              id: partnerId,
              name: fallbackName,
              lastMessage: meta.lastMessage || 'Start chatting...',
              timestamp: meta.lastUpdated || Date.now(),
              lastSenderId: meta.lastSenderId || '',
              unreadCount: meta.unreadCount || 0,
              isDeleted: false,
              online: !!onlineUsers[partnerId],
            };
          }
        };

        if (hasCache) {
          const allItems = await Promise.all(partnerIds.map(id => fetchPartner(id)));
          const validItems = allItems.filter(item => item !== null);
          validItems.sort((a, b) => b.timestamp - a.timestamp);

          const cachedMap = new Map(cached.map(item => [item.id, item]));
          let changed = false;
          const updatedItems = validItems.map(newItem => {
            const old = cachedMap.get(newItem.id);
            if (!old) { changed = true; return newItem; }
            if (
              old.name !== newItem.name ||
              old.lastMessage !== newItem.lastMessage ||
              old.timestamp !== newItem.timestamp ||
              old.unreadCount !== newItem.unreadCount ||
              old.isDeleted !== newItem.isDeleted ||
              old.online !== newItem.online
            ) {
              changed = true;
              return newItem;
            }
            return old;
          });

          if (changed) {
            setRecentChats(updatedItems);
            setCache(cacheKey, updatedItems);
          }
          setSyncing(false);
          setLoadingChats(false);

        } else {
          setRecentChats([]);
          setLoadingChats(true);
          const processed = [];
          const total = partnerIds.length;

          for (let i = 0; i < total; i++) {
            const partnerId = partnerIds[i];
            const item = await fetchPartner(partnerId);
            if (item) {
              const newList = [item, ...processed.filter(c => c.id !== item.id)];
              newList.sort((a, b) => b.timestamp - a.timestamp);
              processed.length = 0;
              processed.push(...newList);
              setRecentChats([...processed]);
            }
          }

          processed.sort((a, b) => b.timestamp - a.timestamp);
          setRecentChats(processed);
          setCache(cacheKey, processed);
          setLoadingChats(false);
          setSyncing(false);
          hasSavedCache.current = true;
        }
      },
      (error) => {
        console.error('❌ userChats listener error:', error);
        const cached = getCache(cacheKey);
        if (cached && cached.length > 0) {
          setRecentChats(cached);
          setLoadingChats(false);
          setSyncing(false);
        } else {
          setRecentChats([]);
          setLoadingChats(false);
          setSyncing(false);
        }
      }
    );

    return () => {
      if (userChatsUnsubRef.current) {
        userChatsUnsubRef.current();
        userChatsUnsubRef.current = null;
      }
    };
  }, [user, onlineUsers]);

  // ─── Search handler with detailed logging ──────────────────────
  const performSearch = async (queryText) => {
    const trimmed = queryText.trim().toLowerCase();
    console.log('🔍 [Search] performSearch called with query:', trimmed);

    if (trimmed.length < 2) {
      console.log('🔍 [Search] Query too short, clearing results');
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    console.log('🔍 [Search] Setting isSearching = true');

    try {
      console.log('🔍 [Search] Calling searchProfiles with:', trimmed, 'user.uid:', user?.uid);
      const users = await searchProfiles(trimmed, user.uid, 20);
      console.log('🔍 [Search] searchProfiles returned:', users);

      // Add online status from presence
      const withOnline = users.map(u => ({
        ...u,
        isOnline: !!onlineUsers[u.id],
      }));
      console.log('🔍 [Search] withOnline:', withOnline);

      setResults(withOnline);
      console.log('🔍 [Search] setResults called with', withOnline.length, 'items');
    } catch (err) {
      console.error('❌ [Search] Search failed:', err);
      console.error('❌ [Search] Error details:', err.message, err.stack);
      setResults([]);
    } finally {
      setIsSearching(false);
      console.log('🔍 [Search] setIsSearching(false)');
    }
  };

  // ─── Debounced search ──────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    const query = searchQuery.trim().toLowerCase();
    console.log('🔍 [Search] useEffect triggered, query:', query);

    if (query.length === 0) {
      console.log('🔍 [Search] Empty query, clearing results');
      setResults([]);
      setIsSearching(false);
      return;
    }

    searchTimeout.current = setTimeout(() => {
      console.log('🔍 [Search] Debounce fired, executing performSearch');
      performSearch(query);
    }, 300);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  // ─── Start chat ────────────────────────────────────────────────
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
              <span className="no-results-sub">Try a different search</span>
            </div>
          )}
        </div>
      ) : (
        <div className="recent-chats">
          <div className="section-header">
            <span>Recent Conversations</span>
            {syncing && <span className="sync-indicator">🔄 Syncing...</span>}
          </div>
          {loadingChats ? (
            <div className="no-chats">
              <Skeleton count={5} />
            </div>
          ) : recentChats.length > 0 ? (
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
              <p>No conversations yet</p>
              <span>Search for people to start chatting</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Chats;