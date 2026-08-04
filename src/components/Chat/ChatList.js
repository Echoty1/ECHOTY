import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { usePresence } from '../../contexts/PresenceContext';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';
import { Link } from 'react-router-dom';
import { localDB, getCachedUsers } from '../../services/offlineService';

const ChatList = () => {
  const { user } = useAuth();
  const { presenceMap, subscribeToUser } = usePresence();
  const [users, setUsers] = useState([]);
  const [lastMessageData, setLastMessageData] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const unsubscribeRefs = useRef([]);

  const getInitials = (name) => {
    if (!name) return 'U';
    const words = name.trim().split(' ');
    if (words.length === 0) return 'U';
    if (words.length === 1) return words[0][0].toUpperCase();
    return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
  };

  // 1. Load from IndexedDB immediately (offline-first)
  useEffect(() => {
    if (!user) return;
    const loadCached = async () => {
      const cached = await getCachedUsers();
      const filtered = cached.filter(u => u.id !== user.uid && u.username && !u.username.toLowerCase().includes('test'));
      if (filtered.length) setUsers(filtered);
    };
    loadCached();
  }, [user]);

  // 2. Listen to Firebase for real-time updates (syncs to IndexedDB via offlineService)
  useEffect(() => {
    if (!user) return;
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({ ...data[key], id: key }));
        const filtered = list.filter(
          (u) =>
            u.id !== user.uid &&
            u.username &&
            !u.username.toLowerCase().includes('test')
        );
        setUsers(filtered);
        // IndexedDB is already updated by syncUsers in offlineService
      } else {
        setUsers([]);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Subscribe to presence for all users
  useEffect(() => {
    if (users.length > 0) {
      users.forEach((u) => {
        if (u.id !== user?.uid) {
          subscribeToUser(u.id);
        }
      });
    }
  }, [users, subscribeToUser, user]);

  // Listen for last messages (unchanged)
  useEffect(() => {
    unsubscribeRefs.current.forEach(unsub => unsub());
    unsubscribeRefs.current = [];

    if (!user || users.length === 0) return;

    const newUnsubscribes = users.map((u) => {
      const chatId = [user.uid, u.id].sort().join('_');
      const chatRef = ref(db, `chats/${chatId}`);
      return onValue(chatRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const msgs = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
          const last = msgs[0];
          if (last) {
            setLastMessageData((prev) => ({
              ...prev,
              [u.id]: {
                message: last.message || (last.voice ? '🎵 Voice note' : ''),
                timestamp: last.timestamp,
              },
            }));
          }
        } else {
          setLastMessageData((prev) => ({
            ...prev,
            [u.id]: { message: '', timestamp: 0 },
          }));
        }
      });
    });

    unsubscribeRefs.current = newUnsubscribes;

    return () => {
      unsubscribeRefs.current.forEach(unsub => unsub());
      unsubscribeRefs.current = [];
    };
  }, [users, user]);

  // Sort users
  const sortedUsers = useMemo(() => {
    return [...users]
      .filter((u) =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        const aOnline = presenceMap[a.id]?.online || false;
        const bOnline = presenceMap[b.id]?.online || false;
        if (aOnline && !bOnline) return -1;
        if (!aOnline && bOnline) return 1;
        const aTime = lastMessageData[a.id]?.timestamp || 0;
        const bTime = lastMessageData[b.id]?.timestamp || 0;
        return bTime - aTime;
      });
  }, [users, presenceMap, lastMessageData, searchQuery]);

  const hasResults = sortedUsers.length > 0;

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#0A0A0F',
      paddingTop: '56px',
    }}>
      {/* Search bar */}
      <div style={{ padding: '16px 16px 8px', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="🔍 Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 18px',
            borderRadius: '50px',
            background: 'rgba(18,18,26,0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.06)',
            color: 'white',
            fontSize: '15px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#6C3CE1')}
          onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.06)')}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }}>
        {!hasResults ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: '#888', 
            padding: '20px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <div>{searchQuery ? 'No users match your search' : 'No users yet — invite friends!'}</div>
          </div>
        ) : (
          sortedUsers.map((u) => {
            const isOnline = presenceMap[u.id]?.online || false;
            const last = lastMessageData[u.id] || { message: '' };
            const lastMsg = last.message || 'Start chatting...';
            const initials = getInitials(u.username);

            return (
              <Link
                key={u.id}
                to={`/chat/${u.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '12px 16px',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s ease',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: '22px',
                    fontWeight: 700,
                    color: 'white',
                  }}
                >
                  {u.avatar && u.avatar.startsWith('data:') ? (
                    <img src={u.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>{u.username}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: isOnline ? '#10B981' : '#EF4444',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isOnline ? '#10B981' : '#EF4444',
                        }}
                      />
                      {isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '14px',
                      color: '#888',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {lastMsg}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatList;