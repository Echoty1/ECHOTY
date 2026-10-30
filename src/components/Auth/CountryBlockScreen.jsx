// src/components/Auth/CountryBlockScreen.jsx
import React from 'react';

const CountryBlockScreen = ({ countryName }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#08080C',
      color: '#fff',
      textAlign: 'center',
      padding: '20px',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '36px',
        marginBottom: '24px'
      }}>
        🌍
      </div>
      
      <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '12px' }}>
        Not Available in Your Region
      </h1>
      
      <p style={{ color: '#a1a1aa', fontSize: '16px', maxWidth: '400px', lineHeight: '1.6', marginBottom: '32px' }}>
        We noticed you're connecting from <strong style={{ color: '#fff' }}>{countryName || 'an unsupported region'}</strong>. 
        Unfortunately, ECHO is not yet available in your country due to local regulations.
      </p>

      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '12px',
        padding: '16px 24px',
        fontSize: '13px',
        color: '#71717a',
        maxWidth: '400px'
      }}>
        If you believe this is an error, or if you are using a VPN, please disconnect the VPN and try again.
      </div>
    </div>
  );
};

export default CountryBlockScreen;