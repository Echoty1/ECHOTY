// src/components/common/NetworkStatus.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';

const NetworkStatus = () => {
  const [status, setStatus] = useState('online');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // ─── Browser online/offline events ──────────────────────
    const handleOnline = () => {
      setStatus('online');
      setIsVisible(false);
    };
    const handleOffline = () => {
      setStatus('offline');
      setIsVisible(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // ─── Firebase connection state ──────────────────────────
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => {
      const isConnected = snap.val() === true;
      if (isConnected) {
        setStatus('online');
        setIsVisible(false);
      } else {
        setStatus('connecting');
        setIsVisible(true);
      }
    });

    // ─── Check initial state ──────────────────────────────────
    if (!navigator.onLine) {
      setStatus('offline');
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  if (!isVisible) return null;

  const statusMessages = {
    offline: {
      icon: '⚠️',
      message: 'You are offline. Please check your internet connection.',
      color: '#EF4444',
    },
    connecting: {
      icon: '🔄',
      message: 'Connecting to server... Please wait.',
      color: '#F59E0B',
    },
    slow: {
      icon: '🐢',
      message: 'Network is slow. Some features may take longer to load.',
      color: '#F59E0B',
    },
  };

  const info = statusMessages[status] || statusMessages.connecting;

  return (
    <div
      style={{
        position: 'fixed',
        top: '56px',
        left: 0,
        right: 0,
        zIndex: 9999,
        background: info.color,
        color: '#fff',
        padding: '8px 16px',
        textAlign: 'center',
        fontSize: '13px',
        fontWeight: 500,
        animation: 'slideDown 0.3s ease-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: '18px' }}>{info.icon}</span>
      <span>{info.message}</span>
      {status === 'connecting' && (
        <span
          style={{
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginLeft: '4px',
          }}
        />
      )}
      {/* ✅ Retry button – only for offline state */}
      {status === 'offline' && (
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '20px',
            padding: '4px 16px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        >
          Retry
        </button>
      )}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default NetworkStatus;