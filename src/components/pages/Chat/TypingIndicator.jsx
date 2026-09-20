// src/components/pages/Chat/TypingIndicator.jsx
import React from 'react';

const TypingIndicator = ({ name }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 14px',
      background: 'var(--bg-input)',
      borderRadius: '14px',
      alignSelf: 'flex-start',
      maxWidth: '80%',
      marginBottom: '4px',
    }}>
      <div style={{ display: 'flex', gap: '3px' }}>
        <span className="typing-dot" style={{ animationDelay: '0s' }} />
        <span className="typing-dot" style={{ animationDelay: '0.15s' }} />
        <span className="typing-dot" style={{ animationDelay: '0.3s' }} />
      </div>
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
        {name} is typing…
      </span>
    </div>
  );
};

export default TypingIndicator;