// src/components/pages/Chat/ReactionEmoji.jsx
import React from 'react';

export const HeartReaction = () => (
  <svg viewBox="0 0 40 40" className="rx-svg">
    <defs>
      <radialGradient id="rx-heart" cx="35%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#FF6B8A" />
        <stop offset="60%" stopColor="#EC1E3F" />
        <stop offset="100%" stopColor="#B21230" />
      </radialGradient>
    </defs>
    <path
      className="rx-heart-path"
      d="M20 34 C 6 24, 4 16, 6 11 C 8 6, 14 5, 18 9 C 19 10, 20 12, 20 12 C 20 12, 21 10, 22 9 C 26 5, 32 6, 34 11 C 36 16, 34 24, 20 34 Z"
      fill="url(#rx-heart)"
      stroke="#8B0D24"
      strokeWidth="0.8"
    />
    <ellipse className="rx-heart-shine" cx="12" cy="13" rx="3" ry="2" fill="#fff" opacity="0.55" />
  </svg>
);

export const LaughReaction = () => (
  <svg viewBox="0 0 40 40" className="rx-svg">
    <defs>
      <linearGradient id="rx-laugh" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFD24A" />
        <stop offset="100%" stopColor="#F5A800" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="16" fill="url(#rx-laugh)" stroke="#C4820A" strokeWidth="0.7" />
    <ellipse className="rx-laugh-eye-left" cx="13.5" cy="17" rx="2.6" ry="2.2" fill="#1a1a1a" />
    <ellipse className="rx-laugh-eye-right" cx="26.5" cy="17" rx="2.6" ry="2.2" fill="#1a1a1a" />
    <path className="rx-laugh-mouth" d="M11 24 Q 20 32, 29 24 Q 20 30, 11 24 Z" fill="#7a1a00" stroke="#3d0a00" strokeWidth="0.6" />
    <path d="M13 25.5 Q 20 29, 27 25.5" stroke="#fff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <path className="rx-laugh-tear" d="M30 15 Q 31.5 17.5, 30 19.5 Q 28.5 17.5, 30 15 Z" fill="#5EC8F2" stroke="#2A8DB8" strokeWidth="0.5" />
  </svg>
);

export const WowReaction = () => (
  <svg viewBox="0 0 40 40" className="rx-svg">
    <defs>
      <linearGradient id="rx-wow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFD24A" />
        <stop offset="100%" stopColor="#F5A800" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="16" fill="url(#rx-wow)" stroke="#C4820A" strokeWidth="0.7" />
    <ellipse className="rx-wow-eye-left" cx="13.5" cy="16" rx="2.5" ry="3" fill="#1a1a1a" />
    <ellipse className="rx-wow-eye-right" cx="26.5" cy="16" rx="2.5" ry="3" fill="#1a1a1a" />
    <ellipse cx="13.5" cy="15.2" rx="0.9" ry="1" fill="#fff" />
    <ellipse cx="26.5" cy="15.2" rx="0.9" ry="1" fill="#fff" />
    <ellipse className="rx-wow-mouth" cx="20" cy="26" rx="4" ry="4.5" fill="#7a1a00" stroke="#3d0a00" strokeWidth="0.6" />
    <ellipse cx="20" cy="27" rx="3" ry="2.8" fill="#B21230" />
    <path d="M10.5 11 Q 13.5 8.5, 16.5 11" stroke="#1a1a1a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <path d="M23.5 11 Q 26.5 8.5, 29.5 11" stroke="#1a1a1a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </svg>
);

export const SadReaction = () => (
  <svg viewBox="0 0 40 40" className="rx-svg">
    <defs>
      <linearGradient id="rx-sad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFD24A" />
        <stop offset="100%" stopColor="#F5A800" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="16" fill="url(#rx-sad)" stroke="#C4820A" strokeWidth="0.7" />
    <ellipse cx="13.5" cy="17" rx="2.5" ry="2.5" fill="#1a1a1a" />
    <ellipse cx="26.5" cy="17" rx="2.5" ry="2.5" fill="#1a1a1a" />
    <ellipse cx="13" cy="16.3" rx="0.8" ry="0.9" fill="#fff" />
    <ellipse cx="26" cy="16.3" rx="0.8" ry="0.9" fill="#fff" />
    <path d="M13 28 Q 20 22, 27 28" stroke="#3d0a00" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    <path className="rx-sad-tear" d="M17 20 Q 18.2 23, 17 25 Q 15.8 23, 17 20 Z" fill="#5EC8F2" stroke="#2A8DB8" strokeWidth="0.5" />
    <path d="M10.5 13 Q 13.5 14, 16.5 12" stroke="#1a1a1a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
    <path d="M23.5 12 Q 26.5 14, 29.5 13" stroke="#1a1a1a" strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </svg>
);

export const PrayReaction = () => (
  <svg viewBox="0 0 40 40" className="rx-svg">
    <defs>
      <linearGradient id="rx-hand-left" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFD24A" />
        <stop offset="100%" stopColor="#E89A00" />
      </linearGradient>
      <linearGradient id="rx-hand-right" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#F0B400" />
        <stop offset="100%" stopColor="#D08600" />
      </linearGradient>
    </defs>
    <path className="rx-pray-left" d="M20 6 Q 16 12, 14 20 Q 12 28, 13 34 Q 15 35, 18 33 Q 20 28, 20 22 Z" fill="url(#rx-hand-left)" stroke="#9E6E00" strokeWidth="0.6" />
    <path className="rx-pray-right" d="M20 6 Q 24 12, 26 20 Q 28 28, 27 34 Q 25 35, 22 33 Q 20 28, 20 22 Z" fill="url(#rx-hand-right)" stroke="#9E6E00" strokeWidth="0.6" />
    <rect x="12.5" y="32" width="15" height="4" rx="1" fill="#4A6DD6" stroke="#2C4A99" strokeWidth="0.6" />
    <path className="rx-pray-sparkle" d="M32 10 L32.7 12 L34.7 12.7 L32.7 13.4 L32 15.4 L31.3 13.4 L29.3 12.7 L31.3 12 Z" fill="#FFE87A" />
  </svg>
);

export const FireReaction = () => (
  <svg viewBox="0 0 40 40" className="rx-svg">
    <defs>
      <radialGradient id="rx-fire-outer" cx="50%" cy="70%" r="70%">
        <stop offset="0%" stopColor="#FFD24A" />
        <stop offset="55%" stopColor="#FF8A00" />
        <stop offset="100%" stopColor="#E63900" />
      </radialGradient>
      <radialGradient id="rx-fire-inner" cx="50%" cy="65%" r="60%">
        <stop offset="0%" stopColor="#FFF5B0" />
        <stop offset="100%" stopColor="#FFB300" />
      </radialGradient>
    </defs>
    <path className="rx-fire-outer" d="M20 4 C 15 12, 10 16, 10 24 C 10 32, 16 36, 20 36 C 24 36, 30 32, 30 24 C 30 16, 25 12, 20 4 Z" fill="url(#rx-fire-outer)" stroke="#8A2B00" strokeWidth="0.6" />
    <path className="rx-fire-inner" d="M20 14 C 17 20, 15 22, 15 27 C 15 31, 18 33, 20 33 C 22 33, 25 31, 25 27 C 25 22, 23 20, 20 14 Z" fill="url(#rx-fire-inner)" />
  </svg>
);

export const REACTION_EMOJIS = [
  { key: 'heart',  Component: HeartReaction, label: '❤️' },
  { key: 'laugh',  Component: LaughReaction, label: '😄' },
  { key: 'wow',    Component: WowReaction,   label: '😮' },
  { key: 'sad',    Component: SadReaction,   label: '😢' },
  { key: 'pray',   Component: PrayReaction,  label: '🙏' },
  { key: 'fire',   Component: FireReaction,  label: '🔥' },
];

export const REACTION_LABELS = {
  heart: '❤️',
  laugh: '😄',
  wow: '😮',
  sad: '😢',
  pray: '🙏',
  fire: '🔥',
  // legacy — support old emoji-string reactions
  '❤️': '❤️',
  '😄': '😄',
  '😮': '😮',
  '😢': '😢',
  '🙏': '🙏',
  '🔥': '🔥',
};
