// src/components/pages/Chat/MessageReceipt.jsx
import React from 'react';

const MessageReceipt = ({ status }) => {
  if (status === 'read') {
    return (
      <span style={{ color: '#3B82F6', fontSize: '12px', fontWeight: 600, letterSpacing: '-2px' }}>
        ✓✓
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span style={{ color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '-2px' }}>
        ✓✓
      </span>
    );
  }
  return (
    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
      ✓
    </span>
  );
};

export default MessageReceipt;