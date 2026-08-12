// src/components/pages/Chat/EchoAI.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import Modal from '../../common/Modal';
import './ChatView.css';

const ECHO_AI_USER = {
  id: 'echo_ai_assistant',
  name: 'ECHO AI',
  isAi: true,
  online: true,
  mood: 'happy',
  avatar: '/vidoes/library/Artificial Intelligence Ai GIF by Abdi Slick.gif',
  lastMessage: 'Your AI assistant is ready to help!',
};

const EchoAI = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      senderId: 'echo_ai_assistant',
      text: "Hello! I am ECHO AI. How can I help you today?",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = {
      id: `user_${Date.now()}`,
      senderId: user?.uid || 'user',
      text: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const aiReply = {
        id: `ai_${Date.now()}`,
        senderId: 'echo_ai_assistant',
        text: `ECHO AI: Received "${userMsg.text}". How else can I assist you?`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiReply]);
      setIsTyping(false);
    }, 1000);
  };

  return (
    <div className="chat-view">
      <div className="messages-container">
        {messages.map((msg) => {
          const isUser = msg.senderId === (user?.uid || 'user');
          return (
            <div
              key={msg.id}
              className={`message-item ${isUser ? 'sent' : 'received'}`}
            >
              <div className="message-bubble">{msg.text}</div>
              <div className="message-meta">
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="message-item received">
            <div className="message-bubble" style={{ fontStyle: 'italic', opacity: 0.8 }}>
              ECHO AI is thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-wrapper" onSubmit={handleSend}>
        <input
          type="text"
          className="chat-input"
          placeholder="Ask ECHO AI..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={!input.trim() || isTyping}
        >
          <i className="fas fa-paper-plane" />
        </button>
      </form>
    </div>
  );
};

export default EchoAI;