import React from 'react';
import './StoriesBar.css';

const InstantsIntro = ({ onStart }) => {
  return (
    <div className="viewer-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px', marginBottom: '8px' }}>Introducing</p>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <div style={{ 
            width: '48px', height: '48px', borderRadius: '14px', border: '4px solid transparent',
            background: 'linear-gradient(#000, #000) padding-box, linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%) border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px' 
          }}>
            <i className="fas fa-star" />
          </div>
          <h1 style={{ fontSize: '42px', fontWeight: '800', letterSpacing: '-1px', margin: 0, color: '#fff' }}>Instants</h1>
        </div>

        <div style={{ position: 'relative', width: '220px', height: '260px', marginBottom: '40px' }}>
          <img src="https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=800" alt="" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', borderRadius: '30px', border: '4px solid #1a1a1a', transform: 'rotate(-15deg) translate(-20px, 10px) scale(0.9)', opacity: 0.5 }} />
          <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800" alt="" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', borderRadius: '30px', border: '4px solid #1a1a1a', transform: 'rotate(8deg) translate(15px, 5px) scale(0.95)', opacity: 0.8 }} />
          <img src="https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=800" alt="" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover', borderRadius: '30px', border: '4px solid #1a1a1a', transform: 'rotate(0deg)', zIndex: 10 }} />
        </div>

        <p style={{ color: '#fff', fontSize: '20px', lineHeight: 1.4, fontWeight: '500', marginBottom: '40px' }}>
          A new way to share in<br/>the moment with friends.
        </p>

        <button 
          onClick={onStart}
          style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', padding: '14px 32px', borderRadius: '999px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}
        >
          Explore Instants
        </button>
      </div>
    </div>
  );
};

export default InstantsIntro;
