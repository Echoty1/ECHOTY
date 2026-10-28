import React, { useState } from 'react';
import { useSubscription } from '../../contexts/SubscriptionContext';

const PlusCheckout = () => {
  const { showUpgradeModal, setShowUpgradeModal, upgradeToPlus } = useSubscription();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!showUpgradeModal) return null;

  const handlePayment = (e) => {
    e.preventDefault();
    setIsProcessing(true);
    // Simulate Stripe processing delay
    setTimeout(() => {
      setIsProcessing(false);
      upgradeToPlus();
      alert("Payment Successful! Welcome to ECHO Plus ⚡");
    }, 2000);
  };

  return (
    <div className="checkout-overlay" onClick={() => !isProcessing && setShowUpgradeModal(false)}>
      <div className="checkout-modal" onClick={e => e.stopPropagation()}>
        
        <div className="checkout-header" style={{ textAlign: 'center' }}>
          <h2>⚡ Subscribe to <span className="gold-text">ECHO Plus</span></h2>
          <p style={{ color: '#aaa', marginTop: '5px' }}>$4.99 / month</p>
        </div>

        <form onSubmit={handlePayment} className="payment-form">
          <div className="input-group">
            <label>Email Address</label>
            <input type="email" placeholder="you@example.com" required />
          </div>
          
          <div className="input-group">
            <label>Card Information</label>
            <input type="text" placeholder="Card number" maxLength="16" required />
            <div className="card-row">
              <input type="text" placeholder="MM / YY" maxLength="5" required />
              <input type="text" placeholder="CVC" maxLength="3" required />
            </div>
          </div>

          <div className="input-group">
            <label>Name on Card</label>
            <input type="text" placeholder="Name" required />
          </div>

          <button type="submit" className="btn-pay" disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Pay $4.99"}
          </button>
          <p className="secure-text">🔒 Payments secured by Stripe</p>
        </form>
        <button className="btn-close" onClick={() => setShowUpgradeModal(false)}>Cancel</button>
      </div>
    </div>
  );
};

export default PlusCheckout;
