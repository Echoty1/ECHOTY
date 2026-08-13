// src/components/pages/Chat/EchoAI.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useCachedImage } from '../../../utils/mediaCache';
import './ChatView.css'; // reuse chat styles

const ECHO_AI_AVATAR = '/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif';

// ─── GIF message component ─────────────────────────────────────
const GifMessage = ({ src, caption }) => {
  const cachedImage = useCachedImage(src, null);
  const displaySrc = cachedImage || src;

  return (
    <div className="gif-message-container">
      <img src={displaySrc} alt="AI GIF" className="gif-message-img" loading="lazy" />
      {caption && <div className="gif-message-caption">{caption}</div>}
    </div>
  );
};

const EchoAI = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ─── Handle sending message ──────────────────────────────────
  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      senderId: user?.uid || 'user',
      text: input.trim(),
      timestamp: Date.now(),
      type: 'text',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI "typing" delay then reply with GIF
    setTimeout(() => {
      const aiMsg = {
        id: `ai_${Date.now()}`,
        senderId: 'echo_ai_assistant',
        type: 'gif',
        gifUrl: '/videos/library/coming soon.gif', // path to your GIF
        caption: 'Coming soon...', // optional caption
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 800);
  };

  // ─── Render message ──────────────────────────────────────────
  const renderMessage = (msg) => {
    const isUser = msg.senderId === (user?.uid || 'user');

    if (msg.type === 'gif') {
      return (
        <div className={`message-bubble ${isUser ? 'own' : 'partner'}`}>
          <GifMessage src={msg.gifUrl} caption={msg.caption} />
        </div>
      );
    }

    // text message
    return (
      <div className={`message-bubble ${isUser ? 'own' : 'partner'}`}>
        <div className="message-text">{msg.text}</div>
      </div>
    );
  };

  return (
    <div className="chat-view">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat-state">
            <img
              src={ECHO_AI_AVATAR}
              alt="ECHO AI"
              style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <p style={{ marginTop: '12px', fontSize: '18px', color: '#fff', fontWeight: 600 }}>
              ECHO AI
            </p>
            <p style={{ color: '#888', fontSize: '14px' }}>Ask me anything and I'll reply with a GIF!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <React.Fragment key={msg.id}>{renderMessage(msg)}</React.Fragment>
          ))
        )}
        {isTyping && (
          <div className="message-bubble partner">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── Input Bar ──────────────────────────────────────────── */}
      <form className="chat-input-container" onSubmit={handleSend}>
        <input
          type="text"
          className="chat-input"
          placeholder="Ask ECHO AI..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="chat-send-btn" disabled={!input.trim() || isTyping}>
          <i className="fas fa-paper-plane" />
        </button>
      </form>
    </div>
  );
};

export default EchoAI;