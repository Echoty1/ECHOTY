// src/components/common/Modal.js
import React, { useEffect } from 'react';

const Modal = ({ isOpen, onClose, title, message, type = 'info', actions }) => {
  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const accentColors = {
    success: '#10B981',
    error: '#EF4444',
    info: '#6C3CE1',
    warning: '#F59E0B',
  };
  const accentColor = accentColors[type] || '#6C3CE1';

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };
  const icon = icons[type] || 'ℹ️';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#1A1A2E',
          borderRadius: '24px',
          padding: '32px 28px',
          maxWidth: '400px',
          width: '100%',
          border: `1px solid ${accentColor}40`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${accentColor}20`,
          textAlign: 'center',
          animation: 'scaleIn 0.25s ease-out',
          position: 'relative',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          }}
        />

        <div style={{ fontSize: '48px', marginBottom: '12px', display: 'block' }}>
          {icon}
        </div>

        <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
          {title}
        </h3>

        <p style={{ fontSize: '15px', color: '#aaa', lineHeight: '1.6', marginBottom: '24px' }}>
          {message}
        </p>

        {/* Render custom actions if provided, else default button */}
        {actions ? (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {actions}
          </div>
        ) : (
          <button
            onClick={onClose}
            style={{
              padding: '10px 32px',
              borderRadius: '50px',
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              border: 'none',
              color: '#fff',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              boxShadow: `0 4px 20px ${accentColor}40`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.04)';
              e.currentTarget.style.boxShadow = `0 6px 30px ${accentColor}60`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = `0 4px 20px ${accentColor}40`;
            }}
          >
            Got it
          </button>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default Modal;