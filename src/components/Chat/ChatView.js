import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../contexts/SocketContext';
import { usePresence } from '../../contexts/PresenceContext';
import { db } from '../../services/firebase';
import { ref, onValue, push, off, update, remove, serverTimestamp } from 'firebase/database';
import { localDB, getCachedMessages, queueMessage } from '../../services/offlineService';

const ChatView = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();
  const { presenceMap, subscribeToUser } = usePresence();
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const messagesEndRef = useRef(null);
  const chatId = [user?.uid, userId].sort().join('_');

  const [selectedMsg, setSelectedMsg] = useState(null);
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [replyToMsg, setReplyToMsg] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  // Subscribe to partner's presence
  useEffect(() => {
    if (userId) {
      subscribeToUser(userId);
    }
  }, [userId, subscribeToUser]);

  useEffect(() => {
    if (userId) {
      setIsOnline(presenceMap[userId]?.online || false);
    }
  }, [presenceMap, userId]);

  // Load partner info
  useEffect(() => {
    if (userId) {
      const userRef = ref(db, `users/${userId}`);
      onValue(userRef, (snapshot) => {
        const data = snapshot.val();
        if (data) setPartner({ ...data, id: userId });
      });
    }
  }, [userId]);

  // Load messages from IndexedDB and Firebase
  useEffect(() => {
    if (!chatId) return;

    const loadCached = async () => {
      const cached = await getCachedMessages(chatId);
      if (cached.length) {
        cached.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(cached);
      }
    };
    loadCached();

    const chatRef = ref(db, `chats/${chatId}`);
    const unsub = onValue(chatRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.entries(data).map(([key, value]) => ({ ...value, id: key }));
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        setMessages(msgs);
        await localDB.messages.bulkPut(msgs.map(m => ({ ...m, chatId })));
      } else {
        setMessages([]);
      }
    });

    return () => off(chatRef);
  }, [chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (contextMenuVisible) {
      const handleClickOutside = () => setContextMenuVisible(false);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenuVisible]);

  const sendMessage = async (message) => {
    if (!message && !newMessage) return;
    const msgData = {
      userId: user.uid,
      username: user.username,
      message: message || newMessage,
      timestamp: Date.now(),
    };
    if (replyToMsg) {
      msgData.replyTo = {
        id: replyToMsg.id,
        message: replyToMsg.message,
        username: replyToMsg.username,
      };
      setReplyToMsg(null);
    }

    try {
      const chatRef = ref(db, `chats/${chatId}`);
      await push(chatRef, msgData);
      if (socket) {
        socket.emit('chat-message', { ...msgData, chatId });
      }
    } catch (err) {
      await queueMessage({ chatId, ...msgData });
    }

    setNewMessage('');
    setEditingMsgId(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const data = reader.result;
      const msgData = {
        userId: user.uid,
        username: user.username,
        message: file.type.startsWith('image/') ? '📷 Image' : '📎 File',
        timestamp: Date.now(),
        image: file.type.startsWith('image/') ? data : null,
        file: file.type.startsWith('image/') ? null : data,
        fileName: file.name,
      };
      if (replyToMsg) {
        msgData.replyTo = {
          id: replyToMsg.id,
          message: replyToMsg.message,
          username: replyToMsg.username,
        };
        setReplyToMsg(null);
      }

      try {
        const chatRef = ref(db, `chats/${chatId}`);
        await push(chatRef, msgData);
        if (socket) socket.emit('chat-message', { ...msgData, chatId });
      } catch (err) {
        await queueMessage({ chatId, ...msgData });
      }
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleReply = (msg) => {
    if (msg.userId === user?.uid) {
      alert("You can't reply to your own message");
      return;
    }
    setReplyToMsg(msg);
    setContextMenuVisible(false);
    document.getElementById('chat-input')?.focus();
  };

  const handleEdit = (msg) => {
    if (msg.userId !== user?.uid) return;
    setEditingMsgId(msg.id);
    setEditContent(msg.message);
    setContextMenuVisible(false);
  };

  const handleDelete = (msg) => {
    if (msg.userId !== user?.uid) {
      alert("You can only delete your own messages");
      return;
    }
    if (window.confirm('Delete this message for everyone?')) {
      const msgRef = ref(db, `chats/${chatId}/${msg.id}`);
      remove(msgRef);
      setContextMenuVisible(false);
    }
  };

  const saveEdit = () => {
    if (!editContent.trim()) {
      alert('Message cannot be empty');
      return;
    }
    const msgRef = ref(db, `chats/${chatId}/${editingMsgId}`);
    update(msgRef, { message: editContent });
    setEditingMsgId(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingMsgId(null);
    setEditContent('');
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setSelectedMsg(msg);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  };

  const handleLongPress = (msg) => {
    setSelectedMsg(msg);
    setContextMenuPos({ x: window.innerWidth / 2 - 60, y: window.innerHeight / 2 - 40 });
    setContextMenuVisible(true);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const base64Audio = reader.result;
          const msgData = {
            userId: user.uid,
            username: user.username,
            voice: base64Audio,
            timestamp: Date.now(),
          };
          if (replyToMsg) {
            msgData.replyTo = {
              id: replyToMsg.id,
              message: replyToMsg.message,
              username: replyToMsg.username,
            };
            setReplyToMsg(null);
          }
          try {
            const chatRef = ref(db, `chats/${chatId}`);
            await push(chatRef, msgData);
            if (socket) socket.emit('chat-message', { ...msgData, chatId });
          } catch (err) {
            await queueMessage({ chatId, ...msgData });
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.current.start();
      setRecording(true);
    } catch (err) {
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setRecording(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0A0F',
        paddingTop: '56px',
      }}
      onClick={() => setContextMenuVisible(false)}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(18,18,26,0.9)',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '22px',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '20px',
            color: 'white',
            flexShrink: 0,
          }}
        >
          {partner?.avatar && partner.avatar.startsWith('data:') ? (
            <img src={partner.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            partner?.username?.[0]?.toUpperCase() || 'U'
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>
            {partner?.username || 'User'}
          </div>
          <div
            style={{
              fontSize: '13px',
              color: isOnline ? '#10B981' : '#EF4444',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isOnline ? '#10B981' : '#EF4444',
              }}
            />
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      {/* Reply preview bar */}
      {replyToMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 20px',
            background: 'rgba(108,60,225,0.1)',
            borderLeft: '3px solid #6C3CE1',
          }}
        >
          <div style={{ fontSize: '13px', color: '#888' }}>
            Replying to <strong>{replyToMsg.username}</strong>: {replyToMsg.message}
          </div>
          <button
            onClick={() => setReplyToMsg(null)}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: '#0A0A0F',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#888',
              padding: '40px 0',
              fontSize: '16px',
            }}
          >
            No messages yet — say hello!
          </div>
        ) : (
          messages.map((msg) => {
            const isSent = msg.userId === user?.uid;
            const isEditing = editingMsgId === msg.id;
            const msgTimestamp = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';
            return (
              <div
                key={msg.id}
                style={{
                  maxWidth: '75%',
                  alignSelf: isSent ? 'flex-end' : 'flex-start',
                  animation: 'fadeIn 0.2s ease',
                  position: 'relative',
                }}
                onContextMenu={(e) => handleContextMenu(e, msg)}
                onTouchStart={(e) => {
                  let timer = setTimeout(() => handleLongPress(msg), 600);
                  e.currentTarget.ontouchend = () => clearTimeout(timer);
                  e.currentTarget.ontouchmove = () => clearTimeout(timer);
                }}
              >
                {msg.replyTo && (
                  <div
                    style={{
                      fontSize: '12px',
                      color: '#888',
                      padding: '4px 12px',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: '8px 8px 0 0',
                      borderLeft: '3px solid #6C3CE1',
                      marginBottom: '2px',
                    }}
                  >
                    ↩️ {msg.replyTo.username}: {msg.replyTo.message}
                  </div>
                )}
                {isEditing ? (
                  <div
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      borderRadius: '12px',
                      padding: '8px',
                    }}
                  >
                    <input
                      type="text"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        outline: 'none',
                        fontSize: '15px',
                        padding: '4px',
                      }}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button
                        onClick={saveEdit}
                        style={{ background: '#6C3CE1', border: 'none', color: 'white', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#888', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '10px 16px',
                      borderRadius: '18px',
                      fontSize: '15px',
                      lineHeight: '1.5',
                      background: isSent
                        ? 'linear-gradient(135deg, #6C3CE1, #EC4899)'
                        : 'rgba(255,255,255,0.08)',
                      color: 'white',
                      borderBottomRightRadius: isSent ? '6px' : '18px',
                      borderBottomLeftRadius: isSent ? '18px' : '6px',
                      boxShadow: isSent ? '0 2px 12px rgba(108,60,225,0.2)' : 'none',
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.image && msg.image.startsWith('data:image/') ? (
                      <img
                        src={msg.image}
                        alt="Shared image"
                        style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', marginTop: '4px' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : msg.voice ? (
                      <audio controls src={msg.voice} style={{ maxWidth: '200px', height: '36px' }} />
                    ) : (
                      msg.message
                    )}
                  </div>
                )}
                <div
                  style={{
                    fontSize: '11px',
                    color: '#555',
                    marginTop: '4px',
                    padding: '0 4px',
                    textAlign: isSent ? 'right' : 'left',
                  }}
                >
                  {msgTimestamp}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 20px 14px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(18,18,26,0.95)',
          backdropFilter: 'blur(12px)',
          flexShrink: 0,
        }}
      >
        <label
          htmlFor="file-input"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            color: '#888',
            fontSize: '18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i className="fas fa-paperclip" />
        </label>
        <input
          id="file-input"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />
        <button
          onClick={recording ? stopRecording : startRecording}
          style={{
            background: recording ? '#EF4444' : 'rgba(255,255,255,0.06)',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            color: recording ? 'white' : '#888',
            fontSize: '18px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <i className={recording ? 'fas fa-stop' : 'fas fa-microphone'} />
        </button>
        <input
          id="chat-input"
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '30px',
            padding: '10px 16px',
            color: 'white',
            outline: 'none',
            fontSize: '15px',
            fontFamily: 'inherit',
            transition: 'border 0.2s ease',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#6C3CE1')}
          onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
        />
        <button
          onClick={() => sendMessage()}
          style={{
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            border: 'none',
            color: 'white',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(108,60,225,0.3)',
            transition: 'transform 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <i className="fas fa-paper-plane" />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenuVisible && selectedMsg && (
        <div
          style={{
            position: 'fixed',
            top: contextMenuPos.y,
            left: contextMenuPos.x,
            background: '#1A1A2E',
            borderRadius: '12px',
            padding: '6px 0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            zIndex: 1000,
            minWidth: '150px',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {selectedMsg.userId !== user?.uid && (
            <button
              onClick={() => handleReply(selectedMsg)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                color: 'white',
                textAlign: 'left',
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <i className="fas fa-reply" style={{ marginRight: '10px' }} /> Reply
            </button>
          )}
          {selectedMsg.userId === user?.uid && (
            <>
              <button
                onClick={() => handleEdit(selectedMsg)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  textAlign: 'left',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <i className="fas fa-edit" style={{ marginRight: '10px' }} /> Edit
              </button>
              <button
                onClick={() => handleDelete(selectedMsg)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  textAlign: 'left',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                <i className="fas fa-trash" style={{ marginRight: '10px' }} /> Delete for everyone
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatView;