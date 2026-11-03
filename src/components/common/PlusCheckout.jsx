// src/components/pages/Profile/PlusCheckout.jsx
import React, { useState } from 'react';

const PlusCheckout = ({ isOpen, onClose }) => {
  // Default to the yearly plan since it's the best value
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  if (!isOpen) return null;

  // ─── PLAN DATA & SELAR LINKS ───
  const PLANS = {
    monthly: {
      id: 'monthly',
      name: 'Monthly',
      naira: 1000,
      oldNaira: null,
      badge: null,
      link: 'https://selar.com/i73a04310z',
    },
    twoMonths: {
      id: 'twoMonths',
      name: '2 Months',
      naira: 1800,
      oldNaira: 2000,
      badge: '-10%',
      link: 'https://selar.com/gg79759331',
    },
    yearly: {
      id: 'yearly',
      name: 'Annual',
      naira: 10000,
      oldNaira: 12000,
      badge: '-33%', // Matches Telegram's vibe
      link: 'https://selar.com/bl34v391az',
    },
  };

  const handleConfirmPay = () => {
    if (selectedPlan && PLANS[selectedPlan]) {
      window.location.href = PLANS[selectedPlan].link;
    }
  };

  const currentPlan = PLANS[selectedPlan];

  return (
    <>
      {/* ─── MAIN CHECKOUT SHEET ─── */}
      <div className="ios-sheet-overlay" onClick={onClose}>
        <div
          className="ios-sheet-content telegram-style-checkout"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ios-sheet-handle" />

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '48px', marginBottom: '8px', filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.4))' }}>👑</div>
            <h2 style={{ color: '#FFD700', margin: '0 0 4px 0', fontSize: '26px', fontWeight: 800 }}>
              ECHO Plus
            </h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '14px', padding: '0 20px' }}>
              Go beyond the limits and unlock dozens of exclusive features by subscribing to ECHO Plus.
            </p>
          </div>

          {/* ─── PLAN SELECTORS ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', overflow: 'hidden' }}>
            {Object.values(PLANS).map((plan) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '16px 20px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(108, 60, 225, 0.15)' : 'transparent',
                    transition: 'background 0.2s',
                    borderBottom: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  {/* Radio Button */}
                  <div
                    style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      border: `2px solid ${isSelected ? '#6C3CE1' : 'var(--text-muted)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginRight: '16px', flexShrink: 0, transition: 'all 0.2s'
                    }}
                  >
                    {isSelected && <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#6C3CE1', animation: 'scaleUp 0.2s' }} />}
                  </div>

                  {/* Plan Info */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <strong style={{ fontSize: '16px', color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                      {plan.name}
                    </strong>
                    {plan.badge && (
                      <span style={{
                        background: isSelected ? '#6C3CE1' : '#3A3A3C',
                        color: isSelected ? '#fff' : '#a1a1aa',
                        fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '6px',
                        transition: 'all 0.2s'
                      }}>
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  {/* Price Info */}
                  <div style={{ textAlign: 'right' }}>
                    {plan.oldNaira && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        ₦{plan.oldNaira.toLocaleString()}
                      </div>
                    )}
                    <div style={{ fontSize: '16px', fontWeight: 700, color: isSelected ? '#FFD700' : 'var(--text-primary)' }}>
                      ₦{plan.naira.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── FEATURE LIST (Telegram Style) ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            <FeatureItem icon="👀" title="See Who Viewed You" desc="Know exactly who is checking you out." />
            <FeatureItem icon="👻" title="Ghost Mode" desc="View profiles without leaving a trace." />
            <FeatureItem icon="💬" title="Premium Chat Bubbles" desc="Holographic, Neon, and Gold styles." />
            <FeatureItem icon="🎵" title="Custom Profile Music" desc="Set a Spotify track to play on your profile." />
            <FeatureItem icon="✨" title="Animated Glows" desc="Stand out with exclusive avatar rings and badges." />
          </div>

          {/* ─── SUBSCRIBE BUTTON ─── */}
          <button
            onClick={() => setShowConfirmPopup(true)}
            className="telegram-subscribe-btn"
          >
            Subscribe for ₦{currentPlan.naira.toLocaleString()} per {currentPlan.id === 'yearly' ? 'year' : currentPlan.id === 'twoMonths' ? '2 months' : 'month'}
          </button>

        </div>
      </div>

      {/* ─── CONFIRMATION POPUP ─── */}
      {showConfirmPopup && (
        <div className="confirm-overlay" onClick={() => setShowConfirmPopup(false)}>
          <div className="confirm-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Confirm Upgrade
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>
              You are about to subscribe to the <strong>{currentPlan.name}</strong> plan for <strong>₦{currentPlan.naira.toLocaleString()}</strong>.
            </p>
            <button onClick={handleConfirmPay} className="confirm-pay-btn">
              Continue to Payment
            </button>
            <button onClick={() => setShowConfirmPopup(false)} className="confirm-cancel-btn">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Global CSS injection */}
      <style>{`
        .telegram-style-checkout {
          max-height: 92vh;
          overflow-y: auto;
          padding-bottom: 30px;
          background: var(--bg-card, #1c1c1e);
          border-radius: 24px 24px 0 0;
          animation: slideUpSheet 0.3s cubic-bezier(0.2, 1, 0.4, 1);
        }
        .telegram-style-checkout::-webkit-scrollbar {
          width: 0px;
        }
        .telegram-subscribe-btn {
          width: 100%;
          padding: 16px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #6C3CE1, #EC4899);
          color: #fff;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 8px 24px rgba(108, 60, 225, 0.4);
          transition: transform 0.15s, box-shadow 0.2s;
          animation: pulseBtn 2s infinite;
        }
        .telegram-subscribe-btn:active {
          transform: scale(0.97);
        }
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          animation: fadeIn 0.2s ease-out;
        }
        .confirm-content {
          background: #1c1c1e;
          width: 100%;
          max-width: 340px;
          border-radius: 24px;
          padding: 28px 24px;
          text-align: center;
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 20px 40px rgba(0,0,0,0.5);
          animation: scaleUp 0.25s cubic-bezier(0.2, 1.2, 0.4, 1);
        }
        .confirm-pay-btn {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: none;
          background: #FFD700;
          color: #000;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          margin-bottom: 10px;
          transition: transform 0.15s;
        }
        .confirm-pay-btn:active {
          transform: scale(0.97);
        }
        .confirm-cancel-btn {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        @keyframes slideUpSheet {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseBtn {
          0% { box-shadow: 0 0 0 0 rgba(108, 60, 225, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(108, 60, 225, 0); }
          100% { box-shadow: 0 0 0 0 rgba(108, 60, 225, 0); }
        }
      `}</style>
    </>
  );
};

// Helper component for the feature list
const FeatureItem = ({ icon, title, desc }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
    <div style={{
      width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,215,0,0.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0
    }}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '15px', marginBottom: '2px' }}>{title}</strong>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.4, display: 'block' }}>{desc}</span>
    </div>
    <div style={{ color: 'var(--text-muted)', fontSize: '18px' }}>›</div>
  </div>
);

export default PlusCheckout;
