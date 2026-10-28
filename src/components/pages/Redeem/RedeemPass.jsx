// src/components/pages/Redeem/RedeemPass.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ref, get, update } from 'firebase/database';
import { db } from '../../../services/firebase'; 
import { useAuth } from '../../../hooks/useAuth'; 
import { useSubscription } from '../../../contexts/SubscriptionContext'; 
import './RedeemPass.css';

const RedeemPass = () => {
  const { user } = useAuth();
  const { upgradeToPlus } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const redeem = async () => {
      const queryParams = new URLSearchParams(location.search);
      const senderUid = queryParams.get('code');

      if (!senderUid) {
        setStatus('invalid');
        setMessage('No Buddy Pass code found in the link.');
        return;
      }

      if (!user) {
        sessionStorage.setItem('pending_buddy_pass', senderUid);
        navigate('/login');
        return;
      }

      if (user.uid === senderUid) {
        setStatus('error');
        setMessage("You can't redeem your own Buddy Pass!");
        return;
      }

      try {
        const senderRef = ref(db, `profiles/${senderUid}`);
        const senderSnap = await get(senderRef);

        if (!senderSnap.exists()) {
           setStatus('invalid');
           setMessage('This link is invalid or the sender account was deleted.');
           return;
        }

        const senderData = senderSnap.val();
        
        if (!senderData.isEchoPlus) {
          setStatus('invalid');
          setMessage('The person who sent this link is not an ECHO Plus member.');
          return;
        }

        const passesLeft = senderData.buddyPasses !== undefined ? senderData.buddyPasses : 5;

        if (passesLeft <= 0) {
          setStatus('invalid');
          setMessage('This Buddy Pass has already been fully used.');
          return;
        }

        await update(ref(db, `profiles/${senderUid}`), {
          buddyPasses: passesLeft - 1
        });

        await update(ref(db, `profiles/${user.uid}`), {
          isEchoPlus: true,
          premiumChatStyle: senderData.premiumChatStyle || 'gold', 
          premiumRingStyle: senderData.premiumRingStyle || 'gold',
          upgradedViaBuddyPass: senderUid,
        });

        await upgradeToPlus(); 

        setStatus('success');
        setMessage('Welcome to ECHO Plus! You have unlocked Premium features for free.');
        
        sessionStorage.removeItem('pending_buddy_pass');
        
        setTimeout(() => navigate('/profile'), 3000);

      } catch (err) {
        console.error("Redeem error detailed:", err);
        setStatus('error');
        setMessage(`Error: ${err.message || 'Something went wrong while redeeming your pass.'}`);
      }
    };

    redeem();
  }, [user, location.search, navigate, upgradeToPlus]);

  return (
    <div className="redeem-page">
      <div className={`redeem-card ${status}`}>
        {status === 'loading' && (
          <>
            <div className="redeem-spinner" />
            <h2>Unlocking ECHO Plus...</h2>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="redeem-icon success">👑</div>
            <h2>Buddy Pass Redeemed!</h2>
            <p>{message}</p>
            <p className="redirect-text">Taking you to your profile...</p>
          </>
        )}

        {(status === 'error' || status === 'invalid') && (
          <>
            <div className="redeem-icon error">✕</div>
            <h2>Redemption Failed</h2>
            <p style={{ fontSize: '13px', color: '#ff6b6b' }}>{message}</p>
            <button className="redeem-btn" onClick={() => navigate('/')}>Go Home</button>
          </>
        )}
      </div>
    </div>
  );
};

export default RedeemPass;
