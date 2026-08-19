// src/components/pages/CoinPurchase/CoinPurchase.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import { WHATSAPP_NUMBER } from '../../../config';

const CoinPurchase = () => {
  const navigate = useNavigate();

  const [copyStatus, setCopyStatus] = useState({
    accountName: false,
    bankName: false,
    accountNumber: false,
  });

  const bankDetails = {
    accountName: 'AbdulMalik Anjolaoluwa',
    bankName: 'OPAY',
    accountNumber: '9133680404',
  };

  const packages = [
    { coins: 500, price: 1000 },
    { coins: 1000, price: 1500 },
    { coins: 1500, price: 2000 },
    { coins: 2000, price: 2500 },
    { coins: 2500, price: 3000 },
    { coins: 3000, price: 3500 },
    { coins: 4000, price: 4500 },
    { coins: 5000, price: 5500 },
  ];

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus(prev => ({ ...prev, [field]: true }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [field]: false }));
      }, 1000);
    }).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopyStatus(prev => ({ ...prev, [field]: true }));
      setTimeout(() => {
        setCopyStatus(prev => ({ ...prev, [field]: false }));
      }, 1000);
    });
  };

  const handleWhatsApp = () => {
    const message = 'Hello, I just sent payment for ECHO coins. Please verify.';
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <>
      <SEO
        title="Get Coins"
        description="Purchase coins on ECHO to unlock premium features, skins, and GIFs. Express yourself with exclusive content."
      />
      <StructuredData />
      <div style={{
        maxWidth: '480px',
        margin: '0 auto',
        padding: '80px 16px 80px',
        minHeight: '100vh',
        background: '#0A0A0F',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '20px',
            cursor: 'pointer',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fas fa-arrow-left"></i> Back
        </button>

        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
          💰 Get More Coins
        </h2>
        <p style={{ color: '#888', fontSize: '14px', marginBottom: '24px' }}>
          Choose a package and send payment to the details below.
        </p>

        <div style={{
          background: 'rgba(18,18,26,0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.06)',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '14px', color: '#888', marginBottom: '12px' }}>
            💳 Send payment to:
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#888' }}>Account Name</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{bankDetails.accountName}</div>
              </div>
              <button
                onClick={() => handleCopy(bankDetails.accountName, 'accountName')}
                style={{
                  background: copyStatus.accountName ? 'rgba(16,185,129,0.2)' : 'rgba(108,60,225,0.15)',
                  border: 'none',
                  color: copyStatus.accountName ? '#10B981' : '#8B5CF6',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '60px',
                }}
              >
                {copyStatus.accountName ? '✅ Copied!' : 'Copy'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#888' }}>Bank</div>
                <div style={{ fontSize: '16px', fontWeight: 600 }}>{bankDetails.bankName}</div>
              </div>
              <button
                onClick={() => handleCopy(bankDetails.bankName, 'bankName')}
                style={{
                  background: copyStatus.bankName ? 'rgba(16,185,129,0.2)' : 'rgba(108,60,225,0.15)',
                  border: 'none',
                  color: copyStatus.bankName ? '#10B981' : '#8B5CF6',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '60px',
                }}
              >
                {copyStatus.bankName ? '✅ Copied!' : 'Copy'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <div>
                <div style={{ fontSize: '12px', color: '#888' }}>Account Number</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#6C3CE1' }}>{bankDetails.accountNumber}</div>
              </div>
              <button
                onClick={() => handleCopy(bankDetails.accountNumber, 'accountNumber')}
                style={{
                  background: copyStatus.accountNumber ? 'rgba(16,185,129,0.2)' : 'rgba(108,60,225,0.15)',
                  border: 'none',
                  color: copyStatus.accountNumber ? '#10B981' : '#8B5CF6',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  minWidth: '60px',
                }}
              >
                {copyStatus.accountNumber ? '✅ Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(18,18,26,0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.06)',
          marginBottom: '24px',
        }}>
          <div style={{ fontSize: '14px', color: '#888', marginBottom: '12px' }}>
            📦 Choose a package:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {packages.map((pkg) => (
              <div
                key={pkg.coins}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: '12px',
                  padding: '12px',
                  textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = '#6C3CE1'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}
              >
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#F59E0B' }}>
                  🪙 {pkg.coins}
                </div>
                <div style={{ fontSize: '14px', color: '#fff', marginTop: '4px' }}>
                  ₦{pkg.price.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: 'rgba(18,18,26,0.8)',
          backdropFilter: 'blur(8px)',
          borderRadius: '16px',
          padding: '20px',
          border: '1px solid rgba(255,255,255,0.06)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '14px', color: '#888', marginBottom: '8px' }}>
            📤 After payment, send your receipt and UID (you can find it in your profile page) to:
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#10B981', marginBottom: '12px' }}>
            {WHATSAPP_NUMBER}
          </div>
          <button
            onClick={handleWhatsApp}
            style={{
              background: 'linear-gradient(135deg, #25D366, #128C7E)',
              border: 'none',
              color: '#fff',
              padding: '12px 32px',
              borderRadius: '50px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'transform 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <i className="fab fa-whatsapp" style={{ fontSize: '20px' }} />
            Send Receipt and UID on WhatsApp
          </button>
          <div style={{ fontSize: '12px', color: '#555', marginTop: '12px' }}>
            Your coins will be added within 24 hours after verification.
          </div>
        </div>
      </div>
    </>
  );
};

export default CoinPurchase;