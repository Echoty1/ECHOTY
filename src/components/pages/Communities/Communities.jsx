// src/components/pages/Communities/Communities.jsx
import React from 'react';

const Communities = () => {
  return (
    <div
      style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '80px 16px 100px',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: '#fff',
      }}
    >
      <div
        style={{
          fontSize: '64px',
          marginBottom: '24px',
          opacity: 0.6,
        }}
      >
        🏘️
      </div>
      <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
        Communities
      </h2>
      <p style={{ color: '#888', fontSize: '16px', maxWidth: '320px', lineHeight: '1.6' }}>
        A place to connect with groups of people who share your interests.
      </p>
      <div
        style={{
          marginTop: '24px',
          padding: '8px 20px',
          borderRadius: '30px',
          background: 'rgba(108, 60, 225, 0.15)',
          border: '1px solid rgba(108, 60, 225, 0.2)',
          color: '#8B5CF6',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        Coming Soon
      </div>
    </div>
  );
};

export default Communities;