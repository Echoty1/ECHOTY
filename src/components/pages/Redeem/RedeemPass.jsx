// src/components/pages/Redeem/RedeemPass.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ref, get, update, increment, runTransaction } from 'firebase/database';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useSubscription } from '../../contexts/SubscriptionContext';
import './RedeemPass.css';

const RedeemPass = () => {
  const { user } = useAuth();
  const { upgradeToPlus } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [status, setStatus] = useState('loading'); // loading, success, error, invalid
  const [message, setMessage] = useState('');

  useEffect(() => {
    const redeem = async () => {
      // Get the code from URL (e.g., ?code=SENDER_UID)
      const queryParams = new URLSearchParams(location.search);
      const senderUid = queryParams.get('code');

      if (!senderUid) {
        setStatus('invalid');
        setMessage('No Buddy Pass code found.');
        return;
      }

      if (!user) {
        // If they aren't logged in, save the code and send them to login
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

        if (!senderSnap.exists() || !senderSnap.val().isEchoPlus) {
          setStatus('invalid');
          setMessage('The sender is not an ECHO Plus member.');
          return;
        }

        const senderData = senderSnap.val();
        const passesLeft = senderData.buddyPasses ?? 5; // Default to 5 if not set

        if (passesLeft <= 0) {
          setStatus('invalid');
          setMessage('This Buddy Pass has already been fully used.');
          return;
        }

        // 1. Deduct pass from sender safely
        await runTransaction(ref(db, `profiles/${senderUid}/buddyPasses`), (current) => {
          const count = current ?? 5;
          if (count > 0) return count - 1;
          return 0;
        });

        // 2. Upgrade the receiver
        await update(ref(db, `profiles/${user.uid}`), {
          isEchoPlus: true,
          premiumChatStyle: senderData.premiumChatStyle || 'gold', // Copy sender's style as a gift
          premiumRingStyle: senderData.premiumRingStyle || 'gold',
          upgradedViaBuddyPass: senderUid,
        });

        // 3. Update Local Context
        await upgradeToPlus(); 

        setStatus('success');
        setMessage('Welcome to ECHO Plus! You have unlocked Premium features for free.');
        
        // Clear pending pass
        sessionStorage.removeItem('pending_buddy_pass');
        
        // Redirect after 3 seconds
        setTimeout(() => navigate('/profile'), 3000);

      } catch (err) {
        console.error("Redeem error:", err);
        setStatus('error');
        setMessage('Something went wrong while redeeming your pass.');
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
            <p>{message}</p>
            <button className="redeem-btn" onClick={() => navigate('/')}>Go Home</button>
          </>
        )}
      </div>
    </div>
  );
};

export default RedeemPass;
