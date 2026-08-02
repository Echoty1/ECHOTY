import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../contexts/SocketContext';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';
import { Link } from 'react-router-dom';

const ChatList = () => {
  const { user } = useAuth();
  const socket = useSocket();
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(key => ({ ...data[key], id: key }));
        const filtered = list.filter(u => 
          u.id !== user?.uid &&
          u.username &&
          !u.username.toLowerCase().includes('test')
        );
        setUsers(filtered);
      }
    });
  }, [user]);

  useEffect(() => {
    if (socket) {
      socket.on('online-users', (ids) => {
        setOnlineUsers(ids);
      });
    }
    return () => {
      if (socket) socket.off('online-users');
    };
  }, [socket]);

  return (
    <div>
      <div style={{ padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <h2 style={{ fontSize:'20px', fontWeight:700 }}>💬 Messages</h2>
      </div>
      <div>
        {users.length === 0 ? (
          <div style={{ textAlign:'center', padding:'40px 20px', color:'#888' }}>No conversations yet</div>
        ) : (
          users.map(u => {
            const isOnline = onlineUsers.includes(u.id);
            return (
              <Link
                key={u.id}
                to={`/chat/${u.id}`}
                style={{
                  display:'flex',
                  alignItems:'center',
                  gap:'14px',
                  padding:'14px 18px',
                  borderBottom:'1px solid rgba(255,255,255,0.06)',
                  cursor:'pointer',
                  textDecoration:'none',
                  color:'inherit',
                  transition:'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{
                  width:'52px', height:'52px', borderRadius:'50%',
                  background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontWeight:700, fontSize:'20px', color:'white', flexShrink:0,
                  position:'relative'
                }}>
                  {u.avatar || u.username?.[0]?.toUpperCase() || 'U'}
                  {isOnline && <div style={{
                    position:'absolute', bottom:'2px', right:'2px',
                    width:'12px', height:'12px', borderRadius:'50%',
                    background:'#10B981', border:'2px solid #12121A'
                  }} />}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'15px', fontWeight:600 }}>{u.username}</div>
                  <div style={{ fontSize:'13px', color:'#888', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {isOnline ? '🟢 Online' : 'Start chatting...'}
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