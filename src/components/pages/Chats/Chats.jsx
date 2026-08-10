// src/components/pages/Chats/Chats.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  orderByKey,
  limitToLast,
} from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import './Chats.css';
import { getCache, setCache } from '../../../services/cacheService';
import { searchProfiles } from '../../../services/searchService';
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll';
import { SkeletonChatItem } from '../../common/SkeletonLoader';

const CHAT_CHUNK_SIZE = 20;

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

// ─── Fetch profile with timeout and retry ──────────────────
const fetchProfileWithTimeout = (uid, timeoutMs) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout'));
    }, timeoutMs);

    const unsub = onValue(
      ref(db, `profiles/${uid}`),
      (snapshot) => {
        clearTimeout(timeout);
        unsub();
        const data = snapshot.val();
        if (data) {
          resolve(data);
        } else {
          reject(new Error('Profile not found'));
        }
      },
      (error) => {
        clearTimeout(timeout);
        unsub();
        reject(error);
      }
    );
  });
};

const loadPartnerData = async (partnerId, retryCount = 0) => {
  try {
    const profile = await fetchProfileWithTimeout(partnerId, 5000);
    return profile;
  } catch (error) {
    console.warn(`⚠️ Error loading partner: ${partnerId}`, error.message);

    if (retryCount < 3) {
      const delay = Math.pow(2, retryCount) * 1000;
      console.log(`🔄 Retrying ${partnerId} in ${delay}ms (attempt ${retryCount + 1}/3)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return loadPartnerData(partnerId, retryCount + 1);
    }

    return {
      name: 'User',
      avatar: '',
      mood: 'neutral',
      isFallback: true,
    };
  }
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
  const [hasMore, setHasMore] = useState(true);
  const [lastChatKey, setLastChatKey] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
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

  // ─── Load chats with pagination ──────────────────────────────
  const loadChats = useCallback(async (loadMore = false) => {
    if (!user) return;
    if (isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const userChatsRef = ref(db, `userChats/${user.uid}`);
      let q;

      if (loadMore && lastChatKey) {
        q = query(
          userChatsRef,
          orderByKey(),
          endAt(lastChatKey),
          limitToLast(CHAT_CHUNK_SIZE + 1)
        );
      } else {
        q = query(
          userChatsRef,
          orderByKey(),
          limitToLast(CHAT_CHUNK_SIZE)
        );
      }

      const snapshot = await get(q);
      const data = snapshot.val();

      if (!data) {
        if (loadMore) setHasMore(false);
        setLoadingChats(false);
        setIsLoadingMore(false);
        return;
      }

      const chatList = Object.entries(data)
        .map(([partnerId, chat]) => ({
          id: partnerId,
          ...chat,
        }))
        .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

      // Check if we have more
      if (chatList.length < CHAT_CHUNK_SIZE) {
        setHasMore(false);
      }

      // Update last key for pagination
      if (chatList.length > 0) {
        setLastChatKey(chatList[chatList.length - 1].id);
      }

      // ─── Process partners in background ────────────────────
      const processedChats = await Promise.all(
        chatList.map(async (chat) => {
          try {
            const profile = await loadPartnerData(chat.id);
            let partnerName;
            let isDeleted = false;

            if (chat.partnerDeleted === true) {
              partnerName = chat.partnerName || 'Deleted Account';
              isDeleted = true;
            } else {
              partnerName = profile.name || profile.username || profile.displayName || chat.partnerName || 'Unknown User';
            }

            const isSender = chat.lastSenderId === user.uid;
            let displayMessage = chat.lastMessage || 'Start chatting...';
            if (displayMessage !== 'Start chatting...') {
              displayMessage = isSender ? `You: ${displayMessage}` : `${partnerName}: ${displayMessage}`;
              if (displayMessage.length > 30) displayMessage = displayMessage.substring(0, 30) + '...';
            }

            return {
              id: chat.id,
              name: partnerName,
              lastMessage: displayMessage,
              timestamp: chat.lastUpdated || Date.now(),
              lastSenderId: chat.lastSenderId || '',
              unreadCount: chat.unreadCount || 0,
              isDeleted,
              online: !!onlineUsers[chat.id],
            };
          } catch (err) {
            return {
              id: chat.id,
              name: chat.partnerName || 'Unknown User',
              lastMessage: chat.lastMessage || 'Start chatting...',
              timestamp: chat.lastUpdated || Date.now(),
              lastSenderId: chat.lastSenderId || '',
              unreadCount: chat.unreadCount || 0,
              isDeleted: false,
              online: !!onlineUsers[chat.id],
            };
          }
        })
      );

      const validItems = processedChats.filter((item) => item !== null);

      if (loadMore) {
        setRecentChats(prev => [...prev, ...validItems]);
      } else {
        setRecentChats(validItems);
        await setCache(cacheKey, validItems, 300);
      }

      setLoadingChats(false);
      setIsLoadingMore(false);
    } catch (error) {
      console.error('Error loading chats:', error);
      setLoadingChats(false);
      setIsLoadingMore(false);
    }
  }, [user, lastChatKey, isLoadingMore, onlineUsers]);

  // ─── Real-time listener for new chats ────────────────────────
  useEffect(() => {
    if (!user) {
      setLoadingChats(false);
      return;
    }

    const userChatsRef = ref(db, `userChats/${user.uid}`);

    if (userChatsUnsubRef.current) {
      userChatsUnsubRef.current();
      userChatsUnsubRef.current = null;
    }

    // Load initial chunk
    loadChats(false);

    // Real-time listener for updates
    userChatsUnsubRef.current = onValue(
      userChatsRef,
      async (snapshot) => {
        // Just refresh the list on any change
        // We'll reload from the listener but keep the cache
        const data = snapshot.val();
        if (!data) {
          setRecentChats([]);
          setCache(cacheKey, []);
          setLoadingChats(false);
          return;
        }

        // Reset pagination state for full refresh
        setHasMore(true);
        setLastChatKey(null);
        await loadChats(false);
      },
      (error) => {
        console.error('❌ userChats listener error:', error);
        const cached = getCache(cacheKey);
        if (cached && cached.length > 0) {
          setRecentChats(cached);
          setLoadingChats(false);
        } else {
          setRecentChats([]);
          setLoadingChats(false);
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

  // ─── Infinite scroll ──────────────────────────────────────────
  const { containerRef, setHasMore: setScrollHasMore } = useInfiniteScroll(
    async () => {
      if (!hasMore || isLoadingMore) return;
      await loadChats(true);
    },
    300,
    [hasMore, isLoadingMore]
  );

  useEffect(() => {
    setScrollHasMore(hasMore);
  }, [hasMore]);

  // ─── Search handler with 2‑character threshold ──────────────
  const performSearch = async (queryText) => {
    const trimmed = queryText.trim().toLowerCase();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const users = await searchProfiles(trimmed, user.uid, 20);
      const withOnline = users.map((u) => ({
        ...u,
        isOnline: !!onlineUsers[u.id],
      }));
      setResults(withOnline);
    } catch (err) {
      console.error('❌ [Search] Search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // ─── Debounced search ──────────────────────────────────────────
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const query = searchQuery.trim().toLowerCase();
    if (query.length === 0) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    searchTimeout.current = setTimeout(() => {
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
    if (q && user.interests.some((i) => i.toLowerCase().includes(q))) {
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
        <div className="recent-chats" ref={containerRef}>
          <div className="section-header">
            <span>Recent Conversations</span>
          </div>
          {loadingChats && recentChats.length === 0 ? (
            <div className="no-chats">
              {[...Array(5)].map((_, i) => (
                <SkeletonChatItem key={i} />
              ))}
            </div>
          ) : recentChats.length > 0 ? (
            <>
              {recentChats.map((chat) => {
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
              })}
              {isLoadingMore && (
                <div className="loading-more-chats">
                  <span>Loading more...</span>
                </div>
              )}
              {!hasMore && recentChats.length > 0 && (
                <div className="no-more-chats">
                  <span>No more conversations</span>
                </div>
              )}
            </>
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