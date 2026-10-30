// src/components/pages/Profile/PlusCheckout.jsx (or src/components/common/PlusCheckout.jsx)
import React, { useState } from 'react';

const PlusCheckout = ({ isOpen, onClose }) => {
  // State to track which plan the user selected
  const [selectedPlan, setSelectedPlan] = useState(null);
  
  // State to control the confirmation popup
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);

  if (!isOpen) return null;

  // ─── PLAN DATA & SELAR LINKS ───
  const PLANS = {
    monthly: {
      id: 'monthly',
      name: '1 Month',
      naira: '₦1,000',
      oldNaira: '',
      usd: '$5.00',
      link: 'https://selar.com/i73a04310z',
    },
    twoMonths: {
      id: 'twoMonths',
      name: '2 Months',
      naira: '₦1,800',
      oldNaira: '₦2,000', // Slashed out price
      usd: '$9.00',
      link: 'https://selar.com/gg79759331',
    },
    yearly: {
      id: 'yearly',
      name: '1 Year',
      naira: '₦10,000',
      oldNaira: '₦12,000', // Slashed out price
      usd: '$49.00',
      link: 'https://selar.com/bl34v391az',
    },
  };

  const handlePlanClick = (planId) => {
    setSelectedPlan(planId);
    setShowConfirmPopup(true);
  };

  const handleConfirmPay = () => {
    if (selectedPlan && PLANS[selectedPlan]) {
      window.location.href = PLANS[selectedPlan].link;
    }
  };

  return (
    <>
      {/* ─── MAIN CHECKOUT SHEET ─── */}
      <div className="ios-sheet-overlay" onClick={onClose}>
        <div
          className="ios-sheet-content"
          onClick={(e) => e.stopPropagation()}
          style={{ maxHeight: '90vh', overflowY: 'auto', paddingBottom: '30px' }}
        >
          <div className="ios-sheet-handle" />

          <h2
            style={{
              color: '#FFD700',
              textAlign: 'center',
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontWeight: 800
            }}
          >
            ⚡ Upgrade to ECHO Plus
          </h2>
          <p
            style={{
              color: 'var(--text-secondary)',
              textAlign: 'center',
              margin: '0 0 24px 0',
              fontSize: '14px',
            }}
          >
            Unleash your true potential and stand out.
          </p>

          {/* ─── BENEFITS ─── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-input)', padding: '12px 16px', borderRadius: '16px' }}>
              <span style={{ fontSize: '24px' }}>👀</span>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>See Who Viewed You</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Know exactly who is checking you out.</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-input)', padding: '12px 16px', borderRadius: '16px' }}>
              <span style={{ fontSize: '24px' }}>👻</span>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>Ghost Mode</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>View profiles without leaving a trace.</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-input)', padding: '12px 16px', borderRadius: '16px' }}>
              <span style={{ fontSize: '24px' }}>💬</span>
              <div>
                <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>Premium Chat Bubbles</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Holographic, Neon, and Gold styles.</span>
              </div>
            </div>
          </div>

          {/* ─── NEW PLAN CARDS ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            
            {/* 1 Month Plan */}
            <div
              onClick={() => handlePlanClick('monthly')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div>
                <strong style={{ display: 'block', fontSize: '16px', color: 'var(--text-primary)' }}>1 Month</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Billed monthly</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>₦1,000</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>$5.00</div>
              </div>
            </div>

            {/* 2 Months Plan */}
            <div
              onClick={() => handlePlanClick('twoMonths')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ display: 'block', fontSize: '16px', color: 'var(--text-primary)' }}>2 Months</strong>
                  <span style={{ fontSize: '10px', background: '#EC4899', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>SAVE 10%</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Billed bi-monthly</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₦2,000</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>₦1,800</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>$9.00</div>
              </div>
            </div>

            {/* 1 Year Plan */}
            <div
              onClick={() => handlePlanClick('yearly')}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderRadius: '16px',
                border: '2px solid #FFD700',
                background: 'rgba(255,215,0,0.05)',
                cursor: 'pointer',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ position: 'absolute', top: 0, right: 0, background: '#FFD700', color: '#000', fontSize: '10px', fontWeight: 800, padding: '4px 10px', borderBottomLeftRadius: '12px' }}>
                BEST VALUE
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ display: 'block', fontSize: '16px', color: '#FFD700' }}>1 Year</strong>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Billed annually</span>
              </div>
              <div style={{ textAlign: 'right', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>₦12,000</span>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: '#FFD700' }}>₦10,000</div>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>$49.00</div>
              </div>
            </div>

          </div>

          <button
            className="ios-sheet-cancel"
            onClick={onClose}
            style={{ width: '100%' }}
          >
            Not Now
          </button>
        </div>
      </div>

      {/* ─── CONFIRMATION POPUP ─── */}
      {showConfirmPopup && selectedPlan && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(5px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setShowConfirmPopup(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card, #1c1c1e)',
              width: '100%',
              maxWidth: '340px',
              borderRadius: '24px',
              padding: '24px',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              animation: 'scaleUp 0.25s cubic-bezier(0.2, 1.2, 0.4, 1)',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Confirm Upgrade
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              You are about to subscribe to the <strong>{PLANS[selectedPlan].name}</strong> plan for <strong>{PLANS[selectedPlan].naira}</strong> ({PLANS[selectedPlan].usd}).
            </p>

            <button
              onClick={handleConfirmPay}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: '#FFD700',
                color: '#000',
                fontWeight: 800,
                fontSize: '16px',
                cursor: 'pointer',
                marginBottom: '10px',
                boxShadow: '0 4px 12px rgba(255,215,0,0.3)',
              }}
            >
              Accept & Pay
            </button>
            <button
              onClick={() => setShowConfirmPopup(false)}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '14px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Global CSS injection for animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
};

export default PlusCheckout;
