import React, { useState } from 'react';
import { db } from '../../services/firebase';
import { ref, push } from 'firebase/database';

const BanScreen = ({ user }) => {
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const sendLastMessage = () => {
    if (!message.trim()) return;
    push(ref(db, 'banMessages'), {
      userId: user.uid,
      username: user.username,
      message: message,
      timestamp: Date.now()
    });
    setSent(true);
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0A0A0F',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚫</div>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#EF4444' }}>You have been banned</h1>
      <p style={{ color: '#888', maxWidth: '400px', margin: '10px 0 20px' }}>
        This account has been permanently suspended for violating our community policy.
        If you believe this is a mistake, you can send a message to our team below.
      </p>
      {!sent ? (
        <>
          <textarea
            placeholder="Your message to the team..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '400px',
              minHeight: '100px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '12px',
              color: 'white',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical'
            }}
          />
          <button
            onClick={sendLastMessage}
            className="btn-primary"
            style={{ marginTop: '12px', maxWidth: '400px', width: '100%' }}
          >
            Send Message
          </button>
        </>
      ) : (
        <p style={{ color: '#10B981' }}>✅ Message sent. We'll review your case.</p>
      )}
      <p style={{ color: '#555', fontSize: '12px', marginTop: '20px' }}>ECHO - Premium Chat</p>
    </div>
  );
};

export default BanScreen;