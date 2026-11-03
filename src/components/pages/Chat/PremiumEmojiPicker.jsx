// src/components/pages/Chat/PremiumEmojiPicker.jsx
import React, { useState } from 'react';
import Lottie from 'lottie-react';
import { PREMIUM_STICKERS } from './PremiumStickers';
import { REACTION_EMOJIS } from './ReactionEmoji';

export default function PremiumEmojiPicker({ onSelect, onClose, isEchoPlus }) {
  const [activeTab, setActiveTab] = useState('emoji'); // 'emoji' | 'stickers' | 'plus'

  const handlePremiumClick = (key) => {
    if (!isEchoPlus) {
      // Trigger the checkout modal
      onSelect({ type: 'UPGRADE' });
      return;
    }
    onSelect({ type: 'STICKER', key });
  };

  return (
    <div className="premium-picker-overlay" onClick={onClose}>
      <div className="premium-picker-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Header / Tabs */}
        <div className="premium-picker-header">
          <button 
            className={`premium-tab ${activeTab === 'emoji' ? 'active' : ''}`}
            onClick={() => setActiveTab('emoji')}
          >
            Emoji
          </button>
          <button 
            className={`premium-tab ${activeTab === 'stickers' ? 'active' : ''}`}
            onClick={() => setActiveTab('stickers')}
          >
            Stickers
          </button>
          <button 
            className={`premium-tab ${activeTab === 'plus' ? 'active' : ''}`}
            onClick={() => setActiveTab('plus')}
            style={{ color: '#FFD700' }}
          >
            ECHO Plus ✨
          </button>
          <button className="premium-close-btn" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Content Area */}
        <div className="premium-picker-body">
          
          {/* 1. FREE EMOJIS TAB */}
          {activeTab === 'emoji' && (
            <div className="emoji-grid">
              {['😀','😂','🥰','😎','😭','😡','👍','🔥','💯','🎉','❤️','🙏','💀','🤔','👀','✨','🎵','💬','😴','💔'].map(e => (
                <button key={e} className="emoji-item" onClick={() => onSelect({ type: 'EMOJI', value: e })}>
                  {e}
                </button>
              ))}
            </div>
          )}

          {/* 2. FREE STICKERS TAB */}
          {activeTab === 'stickers' && (
            <div className="emoji-grid">
              {REACTION_EMOJIS.map(({ key, Component }) => (
                <button key={key} className="emoji-item" style={{ padding: 8 }} onClick={() => onSelect({ type: 'EMOJI', value: key })}>
                  <Component />
                </button>
              ))}
            </div>
          )}

          {/* 3. ECHO PLUS PREMIUM TAB */}
          {activeTab === 'plus' && (
            <div className="premium-grid">
              {PREMIUM_STICKERS.map(({ key, animation }) => (
                <button 
                  key={key} 
                  className={`premium-sticker-btn ${!isEchoPlus ? 'locked' : ''}`}
                  onClick={() => handlePremiumClick(key)}
                >
                  <div style={{ width: 64, height: 64 }}>
                    <Lottie animationData={animation} loop={true} />
                  </div>
                  {!isEchoPlus && (
                    <div className="lock-overlay">
                      <i className="fas fa-lock" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
