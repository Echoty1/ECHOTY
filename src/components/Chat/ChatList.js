import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../contexts/SocketContext';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';
import { Link } from 'react-router-dom';

const ChatList = () => {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const [users, setUsers] = useState([]);
  const [lastMessageData, setLastMessageData] = useState({});

  // Load users
  useEffect(() => {
    if (!user) return;
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
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
      }
    });
  }, [user]);

  // Fetch last message for each chat
  useEffect(() => {
    if (!user || users.length === 0) return;
    users.forEach((u) => {
      const chatId = [user.uid, u.id].sort().join('_');
      const chatRef = ref(db, `chats/${chatId}`);
      onValue(
        chatRef,
        (snapshot) => {
          const data = snapshot.val();
          if (data) {
            const msgs = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
            const last = msgs[0];
            if (last) {
              setLastMessageData((prev) => ({
                ...prev,
                [u.id]: {
                  message: last.message || (last.voice ? '🎙️ Voice note' : ''),
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
        },
        { onlyOnce: true }
      );
    });
  }, [users, user]);

  // Sort users by most recent message timestamp (descending)
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const aTime = lastMessageData[a.id]?.timestamp || 0;
      const bTime = lastMessageData[b.id]?.timestamp || 0;
      return bTime - aTime;
    });
  }, [users, lastMessageData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingTop: '56px' }}>
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(18,18,26,0.8)',
          backdropFilter: 'blur(10px)',
          flexShrink: 0,
        }}
      >
        <h2 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px' }}>
          💬 Messages
        </h2>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {sortedUsers.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#888',
              fontSize: '16px',
            }}
          >
            No users yet — invite friends!
          </div>
        ) : (
          sortedUsers.map((u) => {
            const isOnline = onlineUsers.includes(u.id);
            const last = lastMessageData[u.id] || { message: '', timestamp: 0 };
            const lastMsg = last.message || 'Start chatting...';
            return (
              <Link
                key={u.id}
                to={`/chat/${u.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px 24px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.2s ease',
                  background: 'transparent',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '22px',
                    color: 'white',
                    flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  {u.avatar || u.username[0].toUpperCase()}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '2px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: isOnline ? '#10B981' : '#EF4444',
                      border: '2px solid #12121A',
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '2px',
                    }}
                  >
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>
                      {u.username}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        color: isOnline ? '#10B981' : '#EF4444',
                        fontWeight: 500,
                      }}
                    >
                      {isOnline ? '● Online' : '● Offline'}
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