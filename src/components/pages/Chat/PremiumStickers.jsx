// src/components/pages/Chat/PremiumStickers.jsx
import React from 'react';
import Lottie from 'lottie-react';

import goldStar from '../../../assets/premium-emoji/gold-star.json';
import fire from '../../../assets/premium-emoji/fire.json';
import crown from '../../../assets/premium-emoji/crown.json';
import heart from '../../../assets/premium-emoji/heart.json';
import skull from '../../../assets/premium-emoji/skull.json';

export const PREMIUM_STICKERS = [
  { key: 'plus_heart', label: 'Heart', animation: heart },
  { key: 'plus_crown', label: 'Crown', animation: crown },
  { key: 'plus_star', label: 'Star', animation: goldStar },
  { key: 'plus_fire', label: 'Fire', animation: fire },
  { key: 'plus_skull', label: 'Skull', animation: skull },
];

export const renderPremiumSticker = (key, size = 40) => {
  const sticker = PREMIUM_STICKERS.find((s) => s.key === key);
  if (!sticker || !sticker.animation) return null;
  return (
    <div style={{ width: size, height: size, display: 'inline-block' }}>
      <Lottie animationData={sticker.animation} loop />
    </div>
  );
};

export const isPremiumSticker = (key) =>
  typeof key === 'string' && key.startsWith('plus_');
