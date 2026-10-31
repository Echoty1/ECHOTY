// src/pages/Spotlight/SpotlightAdSlide.jsx
import React from 'react';

const SpotlightAdSlide = ({ adUrl, title, description, ctaText, imageUrl }) => {
  // This opens your Monetag link in a new tab when clicked
  const handleAdClick = () => {
    if (adUrl && adUrl !== 'YOUR_MONETAG_DIRECT_LINK_HERE') {
      window.open(adUrl, '_blank', 'noopener,noreferrer');
    } else {
      console.warn("Ad URL is missing. Please paste your Monetag Direct Link.");
    }
  };

  return (
    <div className="spotlight-ad-slide" style={{
      width: '100%',
      height: '100dvh',
      position: 'relative',
      scrollSnapAlign: 'start',
      scrollSnapStop: 'always',
      overflow: 'hidden',
      background: '#000',
      display: 'flex',
      alignItems: 'flex-end',
      padding: '20px',
      paddingBottom: '100px' // Space for bottom nav
    }}>
      {/* Background Image */}
      <div 
        className="ad-background" 
        style={{ 
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          zIndex: 1,
          transition: 'transform 0.3s ease'
        }}
      />
      
      {/* Dark gradient overlay for text readability */}
      <div 
        className="ad-gradient-overlay" 
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
          zIndex: 2
        }}
      />

      {/* The Ad Content */}
      <div 
        className="ad-content" 
        style={{
          position: 'relative',
          zIndex: 3,
          width: '100%',
          maxWidth: '500px',
          margin: '0 auto',
          color: '#fff',
          animation: 'slideUpAd 0.5s cubic-bezier(0.2, 1, 0.4, 1)'
        }}
      >
        {/* Sponsored Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(255, 215, 0, 0.2)',
          border: '1px solid rgba(255, 215, 0, 0.4)',
          color: '#FFD700',
          padding: '4px 12px',
          borderRadius: '99px',
          fontSize: '11px',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '16px',
          backdropFilter: 'blur(10px)'
        }}>
          <i className="fas fa-bullhorn" />
          <span>Sponsored</span>
        </div>

        <h2 style={{
          fontSize: '28px',
          fontWeight: 800,
          margin: '0 0 8px',
          lineHeight: 1.2,
          textShadow: '0 2px 10px rgba(0,0,0,0.5)'
        }}>
          {title}
        </h2>
        
        <p style={{
          fontSize: '15px',
          color: 'rgba(255, 255, 255, 0.85)',
          margin: '0 0 24px',
          lineHeight: 1.5,
          maxWidth: '90%'
        }}>
          {description}
        </p>

        <button 
          className="ad-cta-btn" 
          onClick={handleAdClick}
          style={{
            background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
            color: '#fff',
            border: 'none',
            padding: '16px 32px',
            borderRadius: '99px',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 10px 30px rgba(108,60,225,0.4)',
            transition: 'transform 0.2s ease'
          }}
        >
          {ctaText || 'Learn More'} <i className="fas fa-arrow-right" />
        </button>
      </div>

      <style>{`
        @keyframes slideUpAd {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ad-cta-btn:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};

export default SpotlightAdSlide;
