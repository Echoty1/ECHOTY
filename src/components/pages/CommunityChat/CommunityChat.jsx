import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../../services/firebase';
import {
  ref,
  onValue,
  push,
  set,
  get,
  serverTimestamp,
  off,
} from 'firebase/database';
import { useAuth } from '../../../hooks/useAuth';
import { useCommunity } from '../../../contexts/CommunityContext';
import { useProfile } from '../../../contexts/ProfileContext';
import Avatar from '../../common/Avatar';
import ECHOMOJI from '../../UI/ECHOMOJI';
import { getSkinById } from '../../../constants/echomoji';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './CommunityChat.css';

const CommunityChat = () => {
  const { communityId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentCommunity } = useCommunity();
  const { getProfile } = useProfile();

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [community, setCommunity] = useState(currentCommunity || null);
  const [userName, setUserName] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  // ─── Fetch community details ────────────────────────────────────
  useEffect(() => {
    if (!communityId) return;

    const communityRef = ref(db, `communities/${communityId}`);
    const unsubscribe = onValue(communityRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setCommunity({
          id: communityId,
          name: data.name || 'Community',
          description: data.description || '',
          image: data.image || '/images/communities/default.png',
          memberCount: data.memberCount || 0,
        });
      } else {
        // Community doesn't exist
        navigate('/communities');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [communityId, navigate]);

  // ─── Get user's name ────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;

    const fetchUserName = async () => {
      try {
        const profileRef = ref(db, `profiles/${user.uid}`);
        const snapshot = await get(profileRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setUserName(data.name || user.displayName || user.email?.split('@')[0] || 'User');
        } else {
          setUserName(user.displayName || user.email?.split('@')[0] || 'User');
        }
      } catch (err) {
        console.warn('Failed to fetch user name:', err);
        setUserName(user.displayName || user.email?.split('@')[0] || 'User');
      }
    };

    fetchUserName();
  }, [user]);

  // ─── Load messages ──────────────────────────────────────────────
  useEffect(() => {
    if (!communityId) return;

    const messagesRef = ref(db, `communityChats/${communityId}/messages`);
    
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const messageList = Object.entries(data)
          .map(([id, msg]) => ({
            id,
            ...msg,
          }))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setMessages(messageList);
      } else {
        setMessages([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Failed to load messages:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [communityId]);

  // ─── Scroll to bottom ───────────────────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ─── Send message ──────────────────────────────────────────────
  const handleSend = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text || !user?.uid || !communityId || sending) return;

    setSending(true);

    try {
      const messagesRef = ref(db, `communityChats/${communityId}/messages`);
      await push(messagesRef, {
        senderId: user.uid,
        text: text,
        timestamp: Date.now(),
        type: 'text',
      });
      setNewMessage('');
      inputRef.current?.focus();
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  // ─── Handle Enter key ───────────────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // ─── Format timestamp ───────────────────────────────────────────
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (msgDate.getTime() === today.getTime()) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ─── Render message ─────────────────────────────────────────────
  const renderMessage = (msg) => {
    const isOwn = msg.senderId === user?.uid;
    const isSystem = msg.type === 'system';
    const senderProfile = getProfile(msg.senderId);
    const senderName = senderProfile?.name || msg.senderName || 'Unknown User';
    const senderAvatar = senderProfile?.avatar || '';
    const senderMood = senderProfile?.mood || 'neutral';
    const senderSkin = senderProfile?.activeSkin ? getSkinById(senderProfile.activeSkin) : null;

    // System message (join/leave events)
    if (isSystem) {
      return (
        <div className="community-system-message">
          <span className="system-icon">📢</span>
          <span>{msg.text}</span>
        </div>
      );
    }

    return (
      <div className={`community-message ${isOwn ? 'own' : 'other'}`}>
        {!isOwn && (
          <div className="community-message-avatar">
            <Avatar src={senderAvatar} name={senderName} size={36} />
          </div>
        )}
        <div className="community-message-content">
          {!isOwn && (
            <div className="community-message-sender">
              {senderName}
              <ECHOMOJI 
                mood={senderMood} 
                skin={senderSkin} 
                size={16} 
                interactive={false} 
                animated={true} 
              />
            </div>
          )}
          <div className={`community-message-bubble ${isOwn ? 'own' : 'other'}`}>
            {msg.text}
          </div>
          <div className={`community-message-time ${isOwn ? 'own' : 'other'}`}>
            {formatTime(msg.timestamp)}
          </div>
        </div>
      </div>
    );
  };

  // ─── Loading state ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="community-chat-loading">
        <div className="loading-spinner" />
        <p>Loading community...</p>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="community-chat-not-found">
        <h2>Community not found</h2>
        <button onClick={() => navigate('/communities')}>Back to Communities</button>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={`${community.name} – Community Chat`}
        description={`Chat with the ${community.name} community on ECHO.`}
      />
      <StructuredData />

      <div className="community-chat">
        {/* ─── Header ──────────────────────────────────────────────── */}
        <div className="community-chat-header">
          <button 
            className="community-chat-back"
            onClick={() => navigate('/communities')}
          >
            <i className="fas fa-arrow-left" />
          </button>
          
          <div className="community-chat-info">
            <img 
              src={community.image} 
              alt={community.name}
              className="community-chat-avatar"
              onError={(e) => {
                e.currentTarget.src = '/images/communities/default.png';
              }}
            />
            <div>
              <h2>{community.name}</h2>
              <span className="community-chat-members">
                <i className="fas fa-users" />
                {community.memberCount} members
              </span>
            </div>
          </div>
        </div>

        {/* ─── Messages ────────────────────────────────────────────── */}
        <div className="community-messages-container" ref={messagesContainerRef}>
          {messages.length === 0 ? (
            <div className="community-empty-state">
              <i className="fas fa-comments" />
              <h3>No messages yet</h3>
              <p>Be the first to say hello! 👋</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <React.Fragment key={msg.id}>
                  {renderMessage(msg)}
                </React.Fragment>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* ─── Input ────────────────────────────────────────────────── */}
        <form className="community-chat-input" onSubmit={handleSend}>
          <input
            ref={inputRef}
            type="text"
            className="community-chat-input-field"
            placeholder={`Message #${community.name}...`}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button 
            type="submit" 
            className="community-chat-send-btn"
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <i className="fas fa-spinner fa-spin" />
            ) : (
              <i className="fas fa-paper-plane" />
            )}
          </button>
        </form>
      </div>
    </>
  );
};

export default CommunityChat;