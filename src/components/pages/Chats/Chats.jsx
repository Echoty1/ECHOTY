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
  orderByKey,
  limitToLast,
} from 'firebase/database';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import Modal from '../../common/Modal';
import './Chats.css';
import { getCache, setCache } from '../../../services/cacheService';
import { searchProfiles, prefetchProfilesIndex } from '../../../services/searchService';
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll';
import { SkeletonChatItem } from '../../common/SkeletonLoader';

const CHAT_CHUNK_SIZE = 20;

// ECHO AI Constant Configuration
const ECHO_AI_USER = {
  id: 'echo_ai_assistant',
  name: 'ECHO AI',
  isAi: true,
  online: true,
  mood: 'happy',
  lastMessage: 'Your AI assistant is ready to help!',
  unreadCount: 0,
};

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

// ─── Fetch profile with safe unsub initialization & timeout ───
const fetchProfileWithTimeout = (uid, timeoutMs = 3000) => {
  return new Promise((resolve, reject) => {
    let unsub = null;

    const timeout = setTimeout(() => {
      if (typeof unsub === 'function') unsub();
      reject(new Error('Timeout'));
    }, timeoutMs);

    unsub = onValue(
      ref(db, `profiles/${uid}`),
      (snapshot) => {
        clearTimeout(timeout);
        if (typeof unsub === 'function') unsub();
        const data = snapshot.val();
        if (data) {
          resolve(data);
        } else {
          reject(new Error('Profile not found'));
        }
      },
      (error) => {
        clearTimeout(timeout);
        if (typeof unsub === 'function') unsub();
        reject(error);
      }
    );
  });
};

const loadPartnerData = async (partnerId, retryCount = 0) => {
  try {
    const profile = await fetchProfileWithTimeout(partnerId, 3000);
    return profile;
  } catch (error) {
    console.warn(`⚠️ Error loading partner: ${partnerId}`, error.message);

    if (retryCount < 2) {
      const delay = Math.pow(2, retryCount) * 1000;
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
  const [showAiModal, setShowAiModal] = useState(false);

  const inputRef = useRef(null);
  const searchTimeout = useRef(null);
  const presenceUnsubRef = useRef(null);
  const userChatsUnsubRef = useRef(null);
  const initialLoadDone = useRef(false);
  const isInitialLoading = useRef(false);

  const cacheKey = `chats_${user?.uid}`;

  // ─── State ─────────────────────────────────────────────────────
  // ✅ Ensure recentChats is ALWAYS an array
  const [recentChats, setRecentChats] = useState(() => {
    const cached = getCache(cacheKey);
    return Array.isArray(cached) ? cached : [];
  });

  const [loadingChats, setLoadingChats] = useState(() => {
    const cached = getCache(cacheKey);
    return !(Array.isArray(cached) && cached.length > 0);
  });
  const [hasMore, setHasMore] = useState(true);
  const [lastChatKey, setLastChatKey] = useState(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useDeletedAccountCheck();

  // ─── Fast Pre-fetch profiles as soon as user enters ─────────
  useEffect(() => {
    if (user) {
      prefetchProfilesIndex(user.uid);
    }
  }, [user]);

  // ─── Online Presence listener ───────────────────────────────
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

  // ─── Sequential initial load ──────────────────────────────────
  const loadInitialChatsSequentially = useCallback(async () => {
    if (!user || isInitialLoading.current) return;
    isInitialLoading.current = true;
    setLoadingChats(true);
    // Reset to empty array to ensure clean state
    setRecentChats([]);

    try {
      const userChatsRef = ref(db, `userChats/${user.uid}`);
      const snapshot = await get(userChatsRef);
      const data = snapshot.val();

      if (!data) {
        setRecentChats([]);
        setLoadingChats(false);
        isInitialLoading.current = false;
        initialLoadDone.current = true;
        return;
      }

      // Convert to array and sort by lastUpdated descending
      const entries = Object.entries(data).map(([id, chat]) => ({ id, ...chat }));
      const sorted = entries.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

      const newChats = [];
      for (const chat of sorted) {
        try {
          const profile = await loadPartnerData(chat.id);
          let partnerName, isDeleted = false;
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
          const item = {
            id: chat.id,
            name: partnerName,
            avatar: profile.avatar || chat.partnerAvatar,
            mood: profile.mood || 'neutral',
            activeSkin: profile.activeSkin,
            lastMessage: displayMessage,
            timestamp: chat.lastUpdated || Date.now(),
            lastSenderId: chat.lastSenderId || '',
            unreadCount: chat.unreadCount || 0,
            isDeleted,
          };
          newChats.push(item);
          // Update state incrementally
          setRecentChats((prev) => [...prev, item]);
        } catch (err) {
          console.warn(`Failed to load chat for ${chat.id}:`, err);
          const fallbackItem = {
            id: chat.id,
            name: chat.partnerName || 'Unknown User',
            lastMessage: chat.lastMessage || 'Start chatting...',
            timestamp: chat.lastUpdated || Date.now(),
            lastSenderId: chat.lastSenderId || '',
            unreadCount: chat.unreadCount || 0,
            isDeleted: false,
          };
          newChats.push(fallbackItem);
          setRecentChats((prev) => [...prev, fallbackItem]);
        }
      }

      // Cache the final list
      await setCache(cacheKey, newChats, 300);
      initialLoadDone.current = true;
    } catch (error) {
      console.error('Error loading initial chats sequentially:', error);
      const cached = getCache(cacheKey);
      if (Array.isArray(cached) && cached.length > 0) {
        setRecentChats(cached);
      } else {
        setRecentChats([]);
      }
    } finally {
      setLoadingChats(false);
      isInitialLoading.current = false;
    }
  }, [user, cacheKey]);

  // ─── Load more chats (pagination) ────────────────────────────
  const loadMoreChats = useCallback(async () => {
    if (!user || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      const userChatsRef = ref(db, `userChats/${user.uid}`);
      let q;
      if (lastChatKey) {
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
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      const chatList = Object.entries(data)
        .map(([partnerId, chat]) => ({
          id: partnerId,
          ...chat,
        }))
        .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));

      if (chatList.length < CHAT_CHUNK_SIZE) {
        setHasMore(false);
      }
      if (chatList.length > 0) {
        setLastChatKey(chatList[chatList.length - 1].id);
      }

      const processed = await Promise.all(
        chatList.map(async (chat) => {
          try {
            const profile = await loadPartnerData(chat.id);
            let partnerName, isDeleted = false;
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
              avatar: profile.avatar || chat.partnerAvatar,
              mood: profile.mood || 'neutral',
              activeSkin: profile.activeSkin,
              lastMessage: displayMessage,
              timestamp: chat.lastUpdated || Date.now(),
              lastSenderId: chat.lastSenderId || '',
              unreadCount: chat.unreadCount || 0,
              isDeleted,
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
            };
          }
        })
      );

      const validItems = processed.filter(Boolean);
      setRecentChats((prev) => [...prev, ...validItems]);
    } catch (error) {
      console.error('Error loading more chats:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user, lastChatKey, hasMore, isLoadingMore]);

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

    // Start sequential load
    loadInitialChatsSequentially();

    userChatsUnsubRef.current = onValue(
      userChatsRef,
      async (snapshot) => {
        if (!initialLoadDone.current || isLoadingMore) return;
        setRecentChats([]);
        initialLoadDone.current = false;
        await loadInitialChatsSequentially();
      },
      (error) => {
        console.error('❌ userChats listener error:', error);
        const cached = getCache(cacheKey);
        if (Array.isArray(cached) && cached.length > 0) {
          setRecentChats(cached);
          setLoadingChats(false);
          initialLoadDone.current = true;
        } else {
          setRecentChats([]);
          setLoadingChats(false);
          initialLoadDone.current = true;
        }
      }
    );

    return () => {
      if (userChatsUnsubRef.current) {
        userChatsUnsubRef.current();
        userChatsUnsubRef.current = null;
      }
    };
  }, [user, loadInitialChatsSequentially, cacheKey, isLoadingMore]);

  // ─── Infinite scroll for older chats ──────────────────────────
  const { containerRef, setHasMore: setScrollHasMore } = useInfiniteScroll(
    async () => {
      if (!hasMore || isLoadingMore || loadingChats) return;
      await loadMoreChats();
    },
    300,
    [hasMore, isLoadingMore, loadingChats]
  );

  useEffect(() => {
    setScrollHasMore(hasMore);
  }, [hasMore, setScrollHasMore]);

  // ─── Fast Search Handler (1-char threshold & 100ms debounce) ───
  const performSearch = async (queryText) => {
    const trimmed = queryText.trim().toLowerCase();
    if (trimmed.length < 1) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const searchRes = await searchProfiles(trimmed, user.uid, 20);
      const withOnline = (searchRes.results || []).map((u) => ({
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
    }, 100);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [searchQuery]);

  // ─── Start chat logic ─────────────────────────────────────────
  const startChat = (selectedUser) => {
    if (!selectedUser) return;
    if (selectedUser.isAi) {
      setShowAiModal(true);
      return;
    }
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

  const getMatchReasons = (userItem) => {
    if (!userItem) return [];
    const reasons = [];
    if (userItem.isOnline) reasons.push('⚡ Active now');
    if (userItem.mutualConnections > 0) reasons.push(`👥 ${userItem.mutualConnections} mutual connections`);
    const q = searchQuery.trim().toLowerCase();
    if (q && userItem.interests?.some((i) => i.toLowerCase().includes(q))) {
      reasons.push('🤖 Shared interests');
    }
    if (q && userItem.country?.toLowerCase().includes(q)) {
      reasons.push('📍 Same country');
    }
    if (q && userItem.city?.toLowerCase().includes(q)) {
      reasons.push('📍 Same city');
    }
    if (reasons.length === 0) reasons.push('✨ Suggested for you');
    return reasons.slice(0, 3);
  };

  // ─── Render ──────────────────────────────────────────────────
  return (
    <div className="chats-page" ref={containerRef}>
      <Modal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        title="ECHO AI Assistant"
        message="Coming Soon 🤖✨"
        type="info"
        actions={
          <button className="btn-edit" onClick={() => setShowAiModal(false)}>
            Close
          </button>
        }
      />

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

      {/* Search Results */}
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
                        <img src={person.avatar} alt={person.name} className="user-profile-img" />
                      ) : (
                        <div className="avatar-placeholder">{person.name?.[0]?.toUpperCase() || 'U'}</div>
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
                        {(person.interests || []).slice(0, 2).map((interest, i) => (
                          <span key={i} className="result-tag">#{interest}</span>
                        ))}
                        {(person.skills || []).slice(0, 1).map((skill, i) => (
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
                        mood={person.mood || 'happy'}
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
        /* Recent Conversations List */
        <div className="recent-chats">
          <div className="section-header">
            <span>Recent Conversations</span>
          </div>

          {/* Global ECHO AI Floating Card */}
          <div className="chat-item ai-item floating-ai-card" onClick={() => startChat(ECHO_AI_USER)}>
            <div className="chat-avatar">
              <div className="chat-avatar-container ai-avatar-frame floating-ai-avatar">
                <div className="echomoji-wrapper">
                  <ECHOMOJI mood="happy" size={52} interactive={false} animated={true} />
                </div>
              </div>
              <span className="presence-dot online" />
            </div>
            <div className="chat-info">
              <div className="chat-title-row">
                <span className="chat-name">{ECHO_AI_USER.name}</span>
                <span className="ai-badge">AI</span>
              </div>
              <div className="chat-last">{ECHO_AI_USER.lastMessage}</div>
            </div>
            <div className="chat-time">Always Active</div>
          </div>

          {/* Render each chat */}
          {recentChats.map((chat) => {
            if (!chat) return null;
            const isOnline = !!onlineUsers[chat.id];
            return (
              <div
                key={chat.id}
                className="chat-item regular-chat-item"
                onClick={() => startChat(chat)}
              >
                {/* Avatar */}
                <div className="chat-avatar">
                  {chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} className="user-profile-img" />
                  ) : (
                    <div className="avatar-placeholder">{chat.name?.[0]?.toUpperCase() || 'U'}</div>
                  )}
                  <span className={`presence-dot ${isOnline ? 'online' : 'offline'}`} />
                  {chat.unreadCount > 0 && (
                    <span className="unread-badge">{chat.unreadCount}</span>
                  )}
                  {chat.isDeleted && (
                    <span className="archived-badge" title="Account deleted – archived">📁</span>
                  )}
                </div>

                {/* Chat Info */}
                <div className="chat-info">
                  <div className="chat-title-row">
                    <span className="chat-name">
                      {chat.name || 'Unknown'}
                      {chat.isDeleted && <span className="archived-label"> (archived)</span>}
                    </span>
                  </div>
                  <div className="chat-last">{chat.lastMessage || 'Start chatting...'}</div>
                </div>

                {/* EchoMoji */}
                <div className="chat-echomoji-middle">
                  <ECHOMOJI
                    mood={chat.mood || 'neutral'}
                    skin={chat.activeSkin ? getSkinById(chat.activeSkin) : null}
                    size={38}
                    interactive={false}
                  />
                </div>

                {/* Timestamp */}
                <div className="chat-time">{timeAgo(chat.timestamp)}</div>
              </div>
            );
          })}

          {/* Sequential Skeleton – stays at bottom while loading initial chats */}
          {loadingChats && <SkeletonChatItem />}

          {/* Loading more indicator for pagination */}
          {isLoadingMore && (
            <div className="loading-more-chats">
              <span>Loading more...</span>
            </div>
          )}

          {/* End of list message */}
          {!hasMore && recentChats.length > 0 && (
            <div className="no-more-chats">
              <span>No more conversations</span>
            </div>
          )}

          {/* Empty state – only when not loading and no chats */}
          {!loadingChats && recentChats.length === 0 && (
            <div className="no-chats">
              <p>No conversations yet</p>
              <span>Search for people to start chatting</span>
            </div>
          )}
        </div>
      )}

      {/* Embedded CSS Overrides for Smooth Floating Animations */}
      <style>{`
        @keyframes floatCard {
          0%, 100% { transform: translateY(0px); box-shadow: 0 4px 20px rgba(108, 60, 225, 0.15); }
          50% { transform: translateY(-5px); box-shadow: 0 10px 25px rgba(108, 60, 225, 0.3); }
        }
        @keyframes floatAvatar {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-3px) scale(1.04); }
        }
        .chat-item.ai-item.floating-ai-card {
          background: rgba(108, 60, 225, 0.08);
          border: 1px solid rgba(124, 58, 237, 0.3);
          border-radius: 14px;
          padding: 10px 14px;
          margin-bottom: 12px;
          animation: floatCard 4s ease-in-out infinite;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .chat-item.ai-item.floating-ai-card:hover {
          background: rgba(108, 60, 225, 0.18);
          border-color: rgba(124, 58, 237, 0.5);
        }
        .chat-avatar-container.ai-avatar-frame.floating-ai-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          overflow: hidden;
          background: radial-gradient(circle, #431d93 0%, #170d38 100%);
          border: 1px solid rgba(138, 92, 246, 0.5);
          box-shadow: 0 0 12px rgba(108, 60, 225, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: floatAvatar 3s ease-in-out infinite;
        }
        .echomoji-wrapper {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: scale(1.15);
        }
        .user-profile-img {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .avatar-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3a2b5c, #231b36);
          color: #ffffff;
          font-weight: 700;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .regular-chat-item {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .chat-echomoji-middle {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          margin-right: 8px;
          flex-shrink: 0;
        }
        .chat-title-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ai-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #7C3AED, #EC4899);
          color: #ffffff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.5px;
          padding: 2px 6px;
          border-radius: 6px;
          line-height: 1;
          height: 16px;
          box-shadow: 0 2px 4px rgba(124, 58, 237, 0.3);
        }
      `}</style>
    </div>
  );
};

export default Chats;