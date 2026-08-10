// src/components/common/MobileLanding.jsx
import React, { useState } from 'react';
import { isAndroid, isIOS } from 'react-device-detect';

const MobileLanding = ({ onContinueToWeb }) => {
  const [showWebOption, setShowWebOption] = useState(false);

  const handleDownload = () => {
    if (isAndroid) {
      // Replace with your actual Play Store link or APK URL
      window.open('https://play.google.com/store/apps/details?id=com.yourcompany.echo', '_blank');
    } else if (isIOS) {
      // For iOS, you might link to App Store or show instructions
      alert('📱 Add ECHO to your Home Screen:\n\nTap the Share button and select "Add to Home Screen".');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#0A0A0F',
      padding: '40px 20px',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Echo rings (decorative) */}
      <div style={{
        position: 'absolute',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        border: '2px solid rgba(108,60,225,0.08)',
        animation: 'echoRingPulse 3s ease-out infinite',
      }} />
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        border: '2px solid rgba(236,72,153,0.06)',
        animation: 'echoRingPulse 4s ease-out infinite 0.8s',
      }} />

      {/* Logo */}
      <div style={{
        width: '100px',
        height: '100px',
        marginBottom: '24px',
        animation: 'echoFloat 2.5s ease-in-out infinite',
        position: 'relative',
        zIndex: 2,
      }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" style={{ width: '100%', height: '100%' }}>
          <rect width="512" height="512" rx="96" fill="#182830" />
          <path d="M 120 120 H 280 V 176 H 180 V 228 H 260 V 284 H 180 V 336 H 280 V 392 H 120 Z" fill="#6C3CE1" />
          <path d="M 320 160 A 140 140 0 0 1 320 352" stroke="#6C3CE1" strokeWidth="36" fill="none" strokeLinecap="round" />
          <path d="M 370 200 A 90 90 0 0 1 370 312" stroke="#EC4899" strokeWidth="32" strokeOpacity="0.6" fill="none" strokeLinecap="round" />
        </svg>
      </div>

      <h1 style={{
        fontSize: '32px',
        fontWeight: 900,
        background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '4px',
        marginBottom: '8px',
        zIndex: 2,
      }}>ECHO</h1>

      <p style={{
        color: 'rgba(255,255,255,0.5)',
        fontSize: '14px',
        letterSpacing: '2px',
        marginBottom: '40px',
        zIndex: 2,
      }}>
        The Future of Conversations
      </p>

      <div style={{
        background: 'rgba(255,255,255,0.04)',
        padding: '30px 24px',
        borderRadius: '20px',
        maxWidth: '360px',
        width: '100%',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.06)',
        zIndex: 2,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        <p style={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '15px',
          lineHeight: '1.6',
          marginBottom: '24px',
        }}>
          Get the best experience with the native ECHO app.
        </p>

        <button
          onClick={handleDownload}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            border: 'none',
            borderRadius: '12px',
            color: '#fff',
            fontSize: '18px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            boxShadow: '0 4px 20px rgba(108,60,225,0.3)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isAndroid ? '📲 Download for Android' : '📱 Get ECHO for iOS'}
        </button>

        <div style={{ marginTop: '16px' }}>
          <button
            onClick={() => setShowWebOption(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '13px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: '8px',
            }}
          >
            I'll use the web version
          </button>
        </div>

        {showWebOption && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginBottom: '12px' }}>
              Continue to the web app?
            </p>
            <button
              onClick={onContinueToWeb}
              style={{
                width: '100%',
                padding: '12px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              Continue to Web
            </button>
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute',
        bottom: '20px',
        color: 'rgba(255,255,255,0.1)',
        fontSize: '11px',
        letterSpacing: '1px',
        zIndex: 2,
      }}>
        ECHO v2.0 • Discover. Connect. Echo.
      </div>
    </div>
  );
};

export default MobileLanding;