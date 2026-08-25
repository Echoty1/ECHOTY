// src/components/pages/CoinPurchase/CoinPurchase.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';

const getApiUrl = () => {
  const base =
    process.env.REACT_APP_API_URL ||
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3000'
      : 'https://echoty-pdcy.onrender.com');
  return base.replace(/\/+$/, '');
};

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
          `${getApiUrl()}/api/payment-status?reference=${encodeURIComponent(pendingRef)}`
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

  const handlePackageClick = async (pkg) => {
    if (!user?.uid) {
      alert('Please log in to purchase coins.');
      return;
    }

    const reference = generateReference(user.uid, pkg.productId);
    sessionStorage.setItem('selar_payment_ref', reference);
    sessionStorage.setItem('selar_payment_uid', user.uid);

    try {
      await fetch(`${getApiUrl()}/api/create-pending-payment`, {
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-primary)',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '600px',
            background: 'var(--bg-secondary)',
            borderRadius: '24px',
            padding: '32px 28px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 40px var(--shadow-color)',
            boxSizing: 'border-box',
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            💰 Get Coins
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: '0 0 24px' }}>
            Pay with <strong>Selar</strong> (card or bank transfer). Coins are added automatically after payment is
            confirmed.
          </p>

          {statusMsg && (
            <div
              style={{
                background:
                  statusOk === true
                    ? 'rgba(16,185,129,0.15)'
                    : statusOk === false
                    ? 'rgba(239,68,68,0.15)'
                    : 'rgba(108,60,225,0.12)',
                border: `1px solid ${
                  statusOk === true ? '#10B981' : statusOk === false ? '#EF4444' : '#6C3CE1'
                }`,
                borderRadius: 12,
                padding: '12px 16px',
                marginBottom: 16,
                textAlign: 'center',
                color: statusOk === true ? '#10B981' : statusOk === false ? '#EF4444' : 'var(--text-primary)',
                fontSize: 14,
              }}
            >
              {polling && statusOk === null ? <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} /> : null}
              {statusMsg}
            </div>
          )}

          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: 20,
              border: '1px solid var(--border-color)',
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>📦 Select a package:</div>
            {/* ─── 3 columns on tablet/desktop ─────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
              {packages.map((pkg) => (
                <div
                  key={pkg.coins}
                  onClick={() => handlePackageClick(pkg)}
                  style={{
                    background: 'var(--bg-input)',
                    borderRadius: 12,
                    padding: 12,
                    textAlign: 'center',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#F59E0B' }}>🪙 {pkg.coins}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 4 }}>
                    ₦{pkg.price.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#6C3CE1', marginTop: 6, fontWeight: 600 }}>Pay with Selar →</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-input)',
              borderRadius: 12,
              padding: 16,
              border: '1px solid var(--border-color)',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              💳 Selar supports <strong>card</strong> and <strong>bank transfer</strong>. After paying, keep this tab
              open briefly or return later — coins credit when our server receives confirmation.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default CoinPurchase;