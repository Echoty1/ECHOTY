import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../contexts/SocketContext';
import { db } from '../../services/firebase';
import { ref, onValue, push, set, off } from 'firebase/database';

const ChatView = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const socket = useSocket();
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [online, setOnline] = useState(false);
  const messagesEndRef = useRef(null);
  const chatId = [user?.uid, userId].sort().join('_');

  useEffect(() => {
    if (!userId) return;
    const userRef = ref(db, `users/${userId}`);
    onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setPartner({ ...data, id: userId });
    });
  }, [userId]);

  useEffect(() => {
    if (!chatId) return;
    const chatRef = ref(db, `chats/${chatId}`);
    onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.values(data).sort((a,b) => a.timestamp - b.timestamp);
        setMessages(msgs);
      } else {
        setMessages([]);
      }
    });
    return () => off(chatRef);
  }, [chatId]);

  useEffect(() => {
    if (socket) {
      socket.on('online-users', (ids) => {
        setOnline(ids.includes(userId));
      });
    }
    return () => {
      if (socket) socket.off('online-users');
    };
  }, [socket, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const msgData = {
      userId: user.uid,
      username: user.username,
      message: newMessage,
      timestamp: Date.now(),
      id: Date.now() + '_' + Math.random().toString().replace('.', '_')
    };
    const chatRef = ref(db, `chats/${chatId}/${msgData.id}`);
    set(chatRef, msgData);
    if (socket) socket.emit('chat-message', { ...msgData, chatId });
    setNewMessage('');
  };

  return (
    <div style={{ height: '100vh', paddingTop:0, background:'#0A0A0F' }}>
      <div style={{
        display:'flex', alignItems:'center', gap:'14px',
        padding:'14px 18px', borderBottom:'1px solid rgba(255,255,255,0.06)',
        background:'#12121A'
      }}>
        <button onClick={() => navigate('/chat')} style={{ background:'none', border:'none', color:'#888', fontSize:'22px', cursor:'pointer' }}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <div style={{
          width:'44px', height:'44px', borderRadius:'50%',
          background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontWeight:700, fontSize:'18px', color:'white'
        }}>
          {partner?.avatar || partner?.username?.[0]?.toUpperCase() || 'U'}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'17px', fontWeight:600 }}>{partner?.username || 'User'}</div>
          <div style={{ fontSize:'12px', color: online ? '#10B981' : '#888' }}>
            {online ? '🟢 Online' : 'Offline'}
          </div>
        </div>
      </div>

      <div style={{
        height: 'calc(100vh - 140px)',
        overflowY: 'auto',
        padding: '18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        {messages.length === 0 ? (
          <div style={{ textAlign:'center', color:'#888', padding:'20px' }}>No messages yet</div>
        ) : (
          messages.map((msg, i) => {
            const isSent = msg.userId === user?.uid;
            return (
              <div key={i} style={{
                maxWidth: '80%',
                alignSelf: isSent ? 'flex-end' : 'flex-start',
                animation: 'messageIn 0.3s ease'
              }}>
                <div style={{
                  padding: '10px 16px',
                  borderRadius: '18px',
                  fontSize: '14px',
                  wordWrap: 'break-word',
                  background: isSent ? 'linear-gradient(135deg, #6C3CE1, #EC4899)' : 'rgba(255,255,255,0.06)',
                  color: isSent ? 'white' : 'white',
                  borderBottomRightRadius: isSent ? '4px' : '18px',
                  borderBottomLeftRadius: isSent ? '18px' : '4px'
                }}>
                  {msg.message}
                </div>
                <div style={{
                  fontSize:'10px', color:'#555', marginTop:'2px',
                  textAlign: isSent ? 'right' : 'left'
                }}>
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{
        display:'flex', alignItems:'center', gap:'12px',
        padding:'12px 18px', borderTop:'1px solid rgba(255,255,255,0.06)',
        background:'#12121A'
      }}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          style={{
            flex:1,
            background:'rgba(255,255,255,0.04)',
            border:'1px solid rgba(255,255,255,0.06)',
            borderRadius:'50px',
            padding:'12px 18px',
            color:'white',
            outline:'none',
            fontSize:'15px',
            fontFamily:'inherit'
          }}
        />
        <button onClick={sendMessage} style={{
          background:'linear-gradient(135deg, #6C3CE1, #EC4899)',
          border:'none',
          color:'white',
          width:'44px',
          height:'44px',
          borderRadius:'50%',
          cursor:'pointer',
          fontSize:'18px',
          transition:'all 0.3s ease',
          boxShadow:'0 4px 15px rgba(108,60,225,0.2)'
        }}>
          <i className="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
};

export default ChatView;