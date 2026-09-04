// src/components/pages/CoinPurchase/CoinPurchase.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import { apiUrl } from '../../../utils/api';
import './CoinPurchase.css';

const packages = [
  { coins: 500, price: 1000, productId: '105w82207h' },
  { coins: 1000, price: 1500, productId: '72a169f519' },
  { coins: 1500, price: 2000, productId: '1xc588p2uc' },
  { coins: 2000, price: 2500, productId: 'b5377r174h' },
  { coins: 2500, price: 3000, productId: 'n4s9l3yy02' },
  { coins: 3000, price: 3500, productId: '3x61201c46' },
  { coins: 4000, price: 4500, productId: '2g079jdyyd' },
  { coins: 5000, price: 5500, productId: '3363k13i67' },
];

const generateReference = (uid, productId) => {
  const random = Math.random().toString(36).substring(2, 10);
  return `echo_${uid}_${productId}_${random}`;
};

const CoinPurchase = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [statusMsg, setStatusMsg] = useState('');
  const [statusOk, setStatusOk] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  // ─── Polling for payment status ──────────────────────────────
  useEffect(() => {
    const pendingRef = sessionStorage.getItem('selar_payment_ref');
    const pendingUid = sessionStorage.getItem('selar_payment_uid');
    if (!pendingRef || !pendingUid || !user?.uid || user.uid !== pendingUid) return;

    setPolling(true);
    setStatusMsg('Checking payment status…');
    setStatusOk(null);

    let attempts = 0;
    const maxAttempts = 12;

    const tick = async () => {
      attempts += 1;
      try {
        const res = await fetch(
          apiUrl(`/api/payment-status?reference=${encodeURIComponent(pendingRef)}`)
        );
        const data = await res.json();
        if (data.status === 'completed') {
          setStatusOk(true);
          setStatusMsg(`✅ Payment confirmed! ${data.coinsAdded || ''} coins added.`);
          sessionStorage.removeItem('selar_payment_ref');
          sessionStorage.removeItem('selar_payment_uid');
          setPolling(false);
          if (pollRef.current) clearInterval(pollRef.current);
          setTimeout(() => window.location.reload(), 2000);
          return;
        }
        if (data.status === 'failed') {
          setStatusOk(false);
          setStatusMsg(`❌ ${data.message || 'Payment failed.'}`);
          sessionStorage.removeItem('selar_payment_ref');
          sessionStorage.removeItem('selar_payment_uid');
          setPolling(false);
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
        setStatusMsg('Waiting for Selar payment confirmation… (you can close this and coins will still be added)');
      } catch (e) {
        console.warn('status poll error', e);
      }
      if (attempts >= maxAttempts) {
        setStatusMsg(
          'Still waiting for confirmation. If you already paid, coins will appear shortly via webhook. You can leave this page.'
        );
        setPolling(false);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };

    tick();
    pollRef.current = setInterval(tick, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [user?.uid]);

  // ─── Handle package selection ─────────────────────────────────
  const handlePackageClick = async (pkg) => {
    if (!user?.uid) {
      alert('Please log in to purchase coins.');
      return;
    }

    const reference = generateReference(user.uid, pkg.productId);
    sessionStorage.setItem('selar_payment_ref', reference);
    sessionStorage.setItem('selar_payment_uid', user.uid);

    try {
      await fetch(apiUrl('/api/create-pending-payment'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          uid: user.uid,
          productId: pkg.productId,
          coins: pkg.coins,
          price: pkg.price,
        }),
      });
    } catch (e) {
      console.warn('Could not register pending payment', e);
    }

    const selarUrl = `https://selar.com/${pkg.productId}?ref=${encodeURIComponent(
      reference
    )}&uid=${encodeURIComponent(user.uid)}&echo_ref=${encodeURIComponent(reference)}`;

    window.open(selarUrl, '_blank', 'noopener,noreferrer');
    setStatusMsg('Complete payment on Selar. This page will update when payment is confirmed.');
    setStatusOk(null);
    setPolling(true);
  };

  return (
    <>
      <SEO title="Get Coins" description="Purchase coins on ECHO." />
      <StructuredData />
      <div className="coin-purchase-page">
        <header className="coin-hero">
          <p className="coin-kicker">ECHO</p>
          <h1>Get Coins</h1>
          <p>Buy coins to unlock exclusive skins, GIFs, and more.</p>
        </header>

        <div className="coin-container">
          {statusMsg && (
            <div
              className={`coin-status ${
                statusOk === true ? 'status-success' : statusOk === false ? 'status-error' : 'status-info'
              }`}
            >
              {polling && statusOk === null && <i className="fas fa-spinner fa-spin coin-status-spinner" />}
              <span>{statusMsg}</span>
            </div>
          )}

          <div className="coin-packages">
            {packages.map((pkg) => (
              <div
                key={pkg.coins}
                className="coin-package"
                onClick={() => handlePackageClick(pkg)}
              >
                <div className="coin-package-icon">🪙</div>
                <div className="coin-package-amount">{pkg.coins}</div>
                <div className="coin-package-price">₦{pkg.price.toLocaleString()}</div>
                <div className="coin-package-cta">Pay with Selar →</div>
              </div>
            ))}
          </div>

          <div className="coin-footer-note">
            <i className="fas fa-shield-alt" />
            <span>
              Selar supports <strong>card</strong> and <strong>bank transfer</strong>. After paying, keep this tab
              open briefly or return later — coins credit when our server receives confirmation.
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default CoinPurchase;