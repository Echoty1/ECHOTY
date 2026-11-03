// src/components/pages/Chat/PremiumStickers.jsx
import React from 'react';
import Lottie from 'lottie-react';

// ⚠️ IMPORTANT: Make sure you have downloaded these .json files from lottiefiles.com
// and saved them in src/assets/premium-emoji/ 
import goldStar from '../../../assets/premium-emoji/gold-star.json';
import fire from '../../../assets/premium-emoji/fire.json';
import crown from '../../../assets/premium-emoji/crown.json';

export const PREMIUM_STICKERS = [
  { key: 'plus_star', label: 'Star', animation: goldStar },
  { key: 'plus_fire', label: 'Fire', animation: fire },
  { key: 'plus_crown', label: 'Crown', animation: crown },
];

export const renderPremiumSticker = (key, size = 40) => {
  const sticker = PREMIUM_STICKERS.find((s) => s.key === key);
  if (!sticker) return null;
  return (
    <div style={{ width: size, height: size, display: 'inline-block' }}>
      <Lottie animationData={sticker.animation} loop={true} />
    </div>
  );
};

export const isPremiumSticker = (key) => {
  return key && key.startsWith('plus_');
};
