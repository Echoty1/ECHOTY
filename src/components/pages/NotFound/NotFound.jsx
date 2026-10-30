// src/components/pages/NotFound/NotFound.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../../common/SEO';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-primary, #08080C)',
      color: 'var(--text-primary, #fff)',
      textAlign: 'center',
      padding: '24px',
      fontFamily: 'Inter, sans-serif'
    }}>
      <SEO title="404 - Page Not Found" />
      
      {/* Glowing 404 Text */}
      <h1 style={{
        fontSize: 'clamp(80px, 20vw, 160px)',
        fontWeight: '900',
        margin: '0 0 16px',
        lineHeight: '1',
        background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        filter: 'drop-shadow(0 0 40px rgba(108, 60, 225, 0.3))'
      }}>
        404
      </h1>

      <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '12px' }}>
        Lost in the Echo?
      </h2>
      
      <p style={{
        color: 'var(--text-muted, #a1a1aa)',
        fontSize: '16px',
        maxWidth: '400px',
        lineHeight: '1.6',
        marginBottom: '40px'
      }}>
        The page you are looking for doesn't exist, was moved, or you typed the wrong URL.
      </p>

      <button
        onClick={() => navigate('/')}
        style={{
          background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
          color: '#fff',
          border: 'none',
          padding: '14px 32px',
          borderRadius: '99px',
          fontSize: '16px',
          fontWeight: '700',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(108,60,225,0.35)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
      >
        Back to Home
      </button>
    </div>
  );
};

export default NotFound;
