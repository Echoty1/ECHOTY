// src/components/pages/Profile/PlusCheckout.jsx
import React from 'react';

const PlusCheckout = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleUpgrade = () => {
    // Redirect to Stripe Checkout (implement backend endpoint)
    window.location.href = '/api/create-checkout-session';
  };

  return (
    <div className="ios-sheet-overlay" onClick={onClose}>
      <div
        className="ios-sheet-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="ios-sheet-handle" />

        <h2
          style={{
            color: '#FFD700',
            textAlign: 'center',
            margin: '0 0 8px 0',
            fontSize: '24px',
          }}
        >
          ⚡ Upgrade to ECHO Plus
        </h2>
        <p
          style={{
            color: 'var(--text-secondary)',
            textAlign: 'center',
            margin: '0 0 20px 0',
            fontSize: '14px',
          }}
        >
          Unleash your true potential and stand out.
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: 'var(--bg-input)',
              padding: '12px 16px',
              borderRadius: '16px',
            }}
          >
            <span style={{ fontSize: '24px' }}>👀</span>
            <div>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              >
                See Who Viewed You
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Know exactly who is checking you out.
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: 'var(--bg-input)',
              padding: '12px 16px',
              borderRadius: '16px',
            }}
          >
            <span style={{ fontSize: '24px' }}>👻</span>
            <div>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              >
                Ghost Mode
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                View profiles without leaving a trace.
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: 'var(--bg-input)',
              padding: '12px 16px',
              borderRadius: '16px',
            }}
          >
            <span style={{ fontSize: '24px' }}>💬</span>
            <div>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              >
                Premium Chat Bubbles
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Holographic, Neon, and Gold styles.
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: 'var(--bg-input)',
              padding: '12px 16px',
              borderRadius: '16px',
            }}
          >
            <span style={{ fontSize: '24px' }}>🪙</span>
            <div>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              >
                500 Free Coins Monthly
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Spend them on gifts, skins, and auras.
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: 'var(--bg-input)',
              padding: '12px 16px',
              borderRadius: '16px',
            }}
          >
            <span style={{ fontSize: '24px' }}>🎨</span>
            <div>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              >
                Exclusive ECHOMOJI Skins
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Unlock premium looks for your avatar.
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              background: 'var(--bg-input)',
              padding: '12px 16px',
              borderRadius: '16px',
            }}
          >
            <span style={{ fontSize: '24px' }}>✨</span>
            <div>
              <strong
                style={{
                  display: 'block',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                }}
              >
                Golden Rings & Auras
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Flex your status on your profile.
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            textAlign: 'center',
            color: '#fff',
            fontSize: '20px',
            fontWeight: 700,
            marginBottom: '16px',
          }}
        >
          $4.99 / month
        </div>

        <button className="btn-upgrade-plus" onClick={handleUpgrade} style={{ width: '100%' }}>
          Subscribe Now
        </button>

        <button
          className="ios-sheet-cancel"
          onClick={onClose}
          style={{ marginTop: '12px', width: '100%' }}
        >
          Not Now
        </button>
      </div>
    </div>
  );
};

export default PlusCheckout;
