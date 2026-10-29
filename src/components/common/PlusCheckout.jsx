// src/components/common/PlusCheckout.jsx
import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const PlusCheckout = ({ isOpen, onClose }) => {
  const { user } = useAuth();

  if (!isOpen) return null;

  // 🔴 YOUR SELAR LINK IS HERE
  const SELAR_BASE_URL = "https://selar.com/i73a04310z"; 
  
  // We pass the user's UID and Email to Selar so we know exactly who paid
  const checkoutUrl = `${SELAR_BASE_URL}?ref=${user?.uid}&email=${encodeURIComponent(user?.email || '')}`;

  const handlePay = () => {
    // Redirect to Selar checkout
    window.location.href = checkoutUrl;
  };

  return (
    <div className="checkout-overlay" onClick={onClose} style={{ zIndex: 999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="checkout-modal" onClick={e => e.stopPropagation()} style={{ padding: '30px', textAlign: 'center', maxWidth: '400px', width: '90%', background: '#1a1a1a', borderRadius: '16px', border: '1px solid #333' }}>
        
        <div style={{ fontSize: '40px', marginBottom: '10px' }}>⚡</div>
        <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#fff' }}>Upgrade to <span style={{ color: '#FFD700' }}>ECHO Plus</span></h2>
        <p style={{ color: '#aaa', marginBottom: '30px', fontSize: '14px' }}>Unlock premium rings, chat styles, and exclusive features.</p>
        
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '20px', borderRadius: '12px', marginBottom: '24px' }}>
          {/* CHANGED PRICE TO 1,000 NAIRA */}
          <h3 style={{ fontSize: '32px', margin: '0', color: '#fff' }}>₦1,000<span style={{ fontSize: '16px', color: '#aaa' }}> / month</span></h3>
          <p style={{ color: '#aaa', fontSize: '12px', marginTop: '5px' }}>(Approx. $5 USD)</p>
        </div>

        <button 
          onClick={handlePay} 
          style={{ 
            width: '100%', padding: '16px', borderRadius: '12px', border: 'none', 
            background: '#FFD700', color: '#000', fontSize: '16px', fontWeight: 'bold', 
            cursor: 'pointer', marginBottom: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
          }}
        >
          Pay with Card or Transfer <i className="fas fa-arrow-right"></i>
        </button>
        
        <p style={{ fontSize: '12px', color: '#666' }}>Secured by Selar. Cancel anytime.</p>
        
        <button 
          onClick={onClose} 
          style={{ marginTop: '20px', background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '14px' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default PlusCheckout;
