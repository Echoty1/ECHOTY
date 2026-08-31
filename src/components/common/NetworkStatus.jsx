// src/components/common/NetworkStatus.jsx
import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';

const NetworkStatus = () => {
  const [status, setStatus] = useState('online');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
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
    <div className="network-toast" style={{
      position: 'fixed',
      top: '60px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      background: info.color,
      color: '#fff',
      padding: '12px 20px',
      borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '14px',
      fontWeight: 500,
      width: 'auto',
      maxWidth: '90%',
      backdropFilter: 'blur(4px)',
      flexWrap: 'wrap',
      justifyContent: 'center',
      textAlign: 'center',
      lineHeight: '1.4',
      animation: 'slideDown 0.3s ease-out',
    }}>
      <span style={{ fontSize: '20px', flexShrink: 0 }}>{info.icon}</span>
      <span style={{ flex: 1, minWidth: '120px' }}>{info.message}</span>
      {status === 'connecting' && (
        <span style={{
          display: 'inline-block',
          width: '18px',
          height: '18px',
          border: '2px solid rgba(255,255,255,0.3)',
          borderTopColor: '#fff',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          flexShrink: 0,
        }} />
      )}
      {status === 'offline' && (
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '20px',
            padding: '6px 18px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'background 0.2s',
            pointerEvents: 'auto',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.3)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
        >
          Retry
        </button>
      )}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* ─── Mobile tweaks ──────────────────────────────────── */
        @media (max-width: 480px) {
          .network-toast {
            top: 56px;
            padding: 10px 14px;
            font-size: 13px;
            max-width: 95%;
            gap: 8px;
            flex-wrap: wrap;
          }
          .network-toast span:first-of-type {
            font-size: 18px;
          }
          .network-toast span:last-of-type {
            min-width: 0;
            flex: 1 1 100%;
            text-align: center;
          }
          .network-toast button {
            font-size: 12px;
            padding: 4px 14px;
          }
        }
      `}</style>
    </div>
  );
};

export default NetworkStatus;