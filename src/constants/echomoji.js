// src/constants/echomoji.js

// ─── Expressions: eye shapes, mouths, brows per mood ───
export const EXPRESSIONS = {
  neutral: {
    leftEye: 'M 12 20 Q 16 16 20 20 Q 16 24 12 20',
    rightEye: 'M 28 20 Q 32 16 36 20 Q 32 24 28 20',
    mouth: 'M 18 32 Q 24 34 30 32',
    eyebrowLeft: 'M 10 15 Q 14 13 18 14',
    eyebrowRight: 'M 30 14 Q 34 13 38 15',
    eyeStyle: 'open',
    cheeks: false,
    particles: null,
  },
  happy: {
    leftEye: 'M 12 20 Q 16 16 20 20 Q 16 24 12 20',
    rightEye: 'M 28 20 Q 32 16 36 20 Q 32 24 28 20',
    mouth: 'M 16 30 Q 24 38 32 30',
    eyebrowLeft: 'M 10 14 Q 14 12 18 13',
    eyebrowRight: 'M 30 13 Q 34 12 38 14',
    eyeStyle: 'happy',
    cheeks: true,
    particles: 'sparkle',
  },
  sad: {
    leftEye: 'M 12 22 Q 16 18 20 22 Q 16 26 12 22',
    rightEye: 'M 28 22 Q 32 18 36 22 Q 32 26 28 22',
    mouth: 'M 18 34 Q 24 28 30 34',
    eyebrowLeft: 'M 9 14 Q 14 11 19 15',
    eyebrowRight: 'M 29 15 Q 34 11 39 14',
    eyeStyle: 'sad',
    cheeks: false,
    particles: 'tear',
  },
  angry: {
    leftEye: 'M 12 20 L 20 24 L 12 24 Z',
    rightEye: 'M 28 24 L 36 20 L 36 24 Z',
    mouth: 'M 12 32 L 18 28 L 24 32 L 30 28 L 36 32',
    eyebrowLeft: 'M 8 12 L 18 16',
    eyebrowRight: 'M 30 16 L 40 12',
    eyeStyle: 'angry',
    cheeks: false,
    particles: 'anger',
  },
  shocked: {
    leftEye: 'M 14 20 A 4 4 0 1 1 14 20',
    rightEye: 'M 30 20 A 4 4 0 1 1 30 20',
    mouth: 'M 22 30 A 4 4 0 1 1 22 30',
    eyebrowLeft: 'M 10 10 Q 14 8 18 10',
    eyebrowRight: 'M 30 10 Q 34 8 38 10',
    eyeStyle: 'wide',
    cheeks: false,
    particles: 'shock',
  },
  excited: {
    leftEye: 'M 12 20 L 20 20',
    rightEye: 'M 28 20 L 36 20',
    mouth: 'M 16 30 Q 24 40 32 30',
    eyebrowLeft: 'M 10 12 Q 14 10 18 12',
    eyebrowRight: 'M 30 12 Q 34 10 38 12',
    eyeStyle: 'closed',
    cheeks: true,
    particles: 'sparkle',
  },
  love: {
    leftEye: 'M 16 20 C 16 17 12 15 12 19 C 12 22 16 25 16 25 C 16 25 20 22 20 19 C 20 15 16 17 16 20 Z',
    rightEye: 'M 32 20 C 32 17 28 15 28 19 C 28 22 32 25 32 25 C 32 25 36 22 36 19 C 36 15 32 17 32 20 Z',
    mouth: 'M 18 26 Q 24 34 30 26',
    eyebrowLeft: 'M 10 14 Q 14 12 18 13',
    eyebrowRight: 'M 30 13 Q 34 12 38 14',
    eyeStyle: 'heart',
    cheeks: true,
    particles: 'heart',
  },
  sleepy: {
    leftEye: 'M 12 22 L 18 22',
    rightEye: 'M 30 22 L 36 22',
    mouth: 'M 20 32 L 28 32',
    eyebrowLeft: 'M 10 16 Q 14 15 18 16',
    eyebrowRight: 'M 30 16 Q 34 15 38 16',
    eyeStyle: 'closed',
    cheeks: false,
    particles: 'zzz',
  },
  cool: {
    leftEye: 'M 12 20 L 20 20',
    rightEye: 'M 28 20 L 36 20',
    mouth: 'M 14 28 Q 24 36 34 28',
    eyebrowLeft: 'M 10 14 L 18 14',
    eyebrowRight: 'M 30 14 L 38 14',
    eyeStyle: 'cool',
    cheeks: false,
    particles: 'shades',
  },
  cry: {
    leftEye: 'M 12 22 Q 16 18 20 22 Q 16 26 12 22',
    rightEye: 'M 28 22 Q 32 18 36 22 Q 32 26 28 22',
    mouth: 'M 18 34 Q 24 28 30 34',
    eyebrowLeft: 'M 9 14 Q 14 11 19 15',
    eyebrowRight: 'M 29 15 Q 34 11 39 14',
    eyeStyle: 'sad',
    cheeks: false,
    particles: 'tear',
  },
};

// ─── Eyebrow Styles ───
export const EYEBROW_STYLES = [
  { id: 'natural', name: 'Natural', left: 'M 10 15 Q 14 13 18 14', right: 'M 30 14 Q 34 13 38 15' },
  { id: 'thick',   name: 'Thick',   left: 'M 10 15 L 18 15',         right: 'M 30 15 L 38 15' },
  { id: 'arched',  name: 'Arched',  left: 'M 10 16 Q 14 11 18 15',   right: 'M 30 15 Q 34 11 38 16' },
  { id: 'sad',     name: 'Sad',     left: 'M 10 14 Q 14 12 18 17',   right: 'M 30 17 Q 34 12 38 14' },
  { id: 'angry',   name: 'Angry',   left: 'M 8 13 L 18 17',          right: 'M 30 17 L 40 13' },
];

// ─── Mouth Styles ───
export const MOUTH_STYLES = [
  { id: 'smile',  name: 'Smile',  path: 'M 16 30 Q 24 38 32 30' },
  { id: 'flat',   name: 'Flat',   path: 'M 18 32 L 30 32' },
  { id: 'frown',  name: 'Frown',  path: 'M 18 34 Q 24 28 30 34' },
  { id: 'open',   name: 'Open',   path: 'M 18 30 Q 24 40 30 30 Z' },
  { id: 'smirk',  name: 'Smirk',  path: 'M 16 32 Q 24 30 32 34' },
];

// ─── Eye Colors ───
export const EYE_COLORS = [
  { id: 'brown',  name: 'Brown',  color: '#4A2C1A' },
  { id: 'black',  name: 'Black',  color: '#1A1A1A' },
  { id: 'blue',   name: 'Blue',   color: '#2E86DE' },
  { id: 'green',  name: 'Green',  color: '#2ECC71' },
  { id: 'hazel',  name: 'Hazel',  color: '#8B6F47' },
  { id: 'amber',  name: 'Amber',  color: '#C68A2E' },
  { id: 'violet', name: 'Violet', color: '#8B5CF6' },
];

// ─── Outfits ───
export const OUTFITS = [
  { id: 'default', name: 'Default', color: null },
  { id: 'red',     name: 'Red',     color: '#EF4444', shadow: '#B91C1C' },
  { id: 'blue',    name: 'Blue',    color: '#4A90E2', shadow: '#2C5F8A' },
  { id: 'green',   name: 'Green',   color: '#2ECC71', shadow: '#1E8A4A' },
  { id: 'purple',  name: 'Purple',  color: '#8B5CF6', shadow: '#6D28D9' },
  { id: 'pink',    name: 'Pink',    color: '#EC4899', shadow: '#BE185D' },
  { id: 'orange',  name: 'Orange',  color: '#F59E0B', shadow: '#B45309' },
  { id: 'teal',    name: 'Teal',    color: '#14B8A6', shadow: '#0E8276' },
  { id: 'black',   name: 'Black',   color: '#2C3E50', shadow: '#1A252F' },
  { id: 'gold',    name: 'Gold',    color: '#FFD700', shadow: '#B8860B' },
  { id: 'white',   name: 'White',   color: '#F5F5F5', shadow: '#C0C0C0' },
];

// ─── Animations ───
export const ANIMATIONS = {
  idle: 'idle',
  wave: 'wave',
  jump: 'jump',
  cry: 'cry',
  dance: 'dance',
  none: 'none',
};

// ─── Mood Themes ───
export const MOOD_THEMES = {
  neutral: { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#6C3CE1', outfitShadow: '#4A2A9E', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#8B5CF6' },
  happy:   { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#06B6D4', outfitShadow: '#048BA8', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#F5A623' },
  sad:     { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#14B8A6', outfitShadow: '#0E8276', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#4A90E2' },
  angry:   { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#EF4444', outfitShadow: '#B91C1C', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#EF4444' },
  shocked: { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#8B5CF6', outfitShadow: '#6D28D9', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#8B5CF6' },
  excited: { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#F59E0B', outfitShadow: '#B45309', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#F59E0B' },
  love:    { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#EC4899', outfitShadow: '#BE185D', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#EC4899' },
  sleepy:  { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#3B82F6', outfitShadow: '#1D4ED8', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#3B82F6' },
  cool:    { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#FDE047', outfitShadow: '#CA8A04', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#8B5CF6' },
  cry:     { skinLight: '#FDBCB4', skinBase: '#E8A598', skinShadow: '#C98474', outfit: '#6366F1', outfitShadow: '#4338CA', hair: '#3A2318', ledColor: '#FFFFFF', glowColor: '#6366F1' },
};

// ─── Hair Styles ───
export const HAIR_STYLES = [
  { id: 'short',  name: 'Short',  path: 'M 6 20 Q 6 4 24 4 Q 42 4 42 20 Q 38 12 24 12 Q 10 12 6 20 Z' },
  { id: 'long',   name: 'Long',   path: 'M 6 20 Q 6 4 24 4 Q 42 4 42 20 L 44 36 Q 40 30 38 20 Q 38 12 24 12 Q 10 12 10 20 Q 8 30 4 36 Z' },
  { id: 'curly',  name: 'Curly',  path: 'M 6 20 Q 4 4 24 4 Q 44 4 42 20 Q 44 10 36 10 Q 32 6 24 8 Q 16 6 12 10 Q 4 10 6 20 Z' },
  { id: 'bald',   name: 'Bald',   path: '' },
  { id: 'mohawk', name: 'Mohawk', path: 'M 16 20 Q 16 4 24 4 Q 32 4 32 20 Q 28 12 24 12 Q 20 12 16 20 Z' },
  { id: 'buzz',   name: 'Buzz',   path: 'M 7 18 Q 7 6 24 6 Q 41 6 41 18 Q 38 12 24 12 Q 10 12 7 18 Z' },
  { id: 'bob',    name: 'Bob',    path: 'M 5 22 Q 5 4 24 4 Q 43 4 43 22 Q 40 14 34 16 Q 30 8 24 8 Q 18 8 14 16 Q 8 14 5 22 Z' },
  { id: 'ponytail', name: 'Ponytail', path: 'M 6 20 Q 6 4 24 4 Q 42 4 42 20 Q 38 12 24 12 Q 10 12 6 20 Z M 40 22 Q 46 28 44 38 Q 42 40 40 36 Q 40 28 38 24 Z' },
];

// ─── Skins ───
export const SKINS = [
  { id: 'light',   name: 'Light Skin',   skinLight: '#FDE0D0', skinBase: '#F1C27D', skinShadow: '#D19A5C', outfit: '#4A90E2', outfitShadow: '#2C5F8A', hair: '#3A2318', defaultHair: 'short',  ledColor: '#FFFFFF', glowColor: '#F1C27D', isLimited: false, price: 0 },
  { id: 'medium',  name: 'Medium Skin',  skinLight: '#E8B48C', skinBase: '#C68642', skinShadow: '#A66A32', outfit: '#E74C3C', outfitShadow: '#A93226', hair: '#1A1108', defaultHair: 'short',  ledColor: '#FFFFFF', glowColor: '#C68642', isLimited: false, price: 0 },
  { id: 'dark',    name: 'Dark Skin',    skinLight: '#A66A32', skinBase: '#8D5524', skinShadow: '#6B3E1A', outfit: '#2ECC71', outfitShadow: '#1E8A4A', hair: '#0A0502', defaultHair: 'curly',  ledColor: '#FFFFFF', glowColor: '#8D5524', isLimited: false, price: 0 },
  { id: 'pale',    name: 'Pale Skin',    skinLight: '#FFF0E6', skinBase: '#FFDAB9', skinShadow: '#E6B89C', outfit: '#9B59B6', outfitShadow: '#6C3483', hair: '#D4A373', defaultHair: 'long',   ledColor: '#FFFFFF', glowColor: '#FFDAB9', isLimited: false, price: 50 },
  { id: 'olive',   name: 'Olive Skin',   skinLight: '#D4B896', skinBase: '#B08D57', skinShadow: '#8C6B3A', outfit: '#F39C12', outfitShadow: '#B9770E', hair: '#2C1A0E', defaultHair: 'mohawk', ledColor: '#FFFFFF', glowColor: '#B08D57', isLimited: false, price: 75 },
  { id: 'bronze',  name: 'Bronze Skin',  skinLight: '#D4A373', skinBase: '#B07D4F', skinShadow: '#8C5E32', outfit: '#1ABC9C', outfitShadow: '#117A65', hair: '#1A0F08', defaultHair: 'short',  ledColor: '#FFFFFF', glowColor: '#B07D4F', isLimited: false, price: 120 },
  { id: 'ebony',   name: 'Ebony Skin',   skinLight: '#5C3A21', skinBase: '#3E2723', skinShadow: '#2A1A17', outfit: '#E67E22', outfitShadow: '#A85A15', hair: '#050201', defaultHair: 'curly',  ledColor: '#FFFFFF', glowColor: '#3E2723', isLimited: false, price: 150 },
  { id: 'gold',    name: 'Golden Glow',  skinLight: '#FFE082', skinBase: '#FFC107', skinShadow: '#FFA000', outfit: '#FFD700', outfitShadow: '#B8860B', hair: '#B8860B', defaultHair: 'mohawk', ledColor: '#FFFFFF', glowColor: '#FFC107', isLimited: true,  price: 200, expiresInDays: 3 },
  { id: 'alien',   name: 'Alien Green',  skinLight: '#A5D6A7', skinBase: '#4CAF50', skinShadow: '#2E7D32', outfit: '#8E44AD', outfitShadow: '#5B2C6F', hair: '#1B5E20', defaultHair: 'bald',   ledColor: '#FFFFFF', glowColor: '#4CAF50', isLimited: true,  price: 250, expiresInDays: 3 },
  { id: 'vampire', name: 'Vampire Pale', skinLight: '#E0E0E0', skinBase: '#BDBDBD', skinShadow: '#9E9E9E', outfit: '#2C3E50', outfitShadow: '#1A252F', hair: '#000000', defaultHair: 'long',   ledColor: '#FFFFFF', glowColor: '#BDBDBD', isLimited: true,  price: 300, expiresInDays: 3 },
  { id: 'galaxy',  name: 'Galaxy Burst', skinLight: '#CE93D8', skinBase: '#8E24AA', skinShadow: '#4A148C', outfit: '#E91E63', outfitShadow: '#AD1457', hair: '#4A148C', defaultHair: 'curly',  ledColor: '#FFFFFF', glowColor: '#8E24AA', isLimited: true,  price: 350, expiresInDays: 3 },
];

export const getSkinById = (id) => SKINS.find((skin) => skin.id === id) || null;
