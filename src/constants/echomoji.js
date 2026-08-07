export const EXPRESSIONS = {
  neutral: {
    eyes: ['M12 18 L18 18', 'M30 18 L36 18'],
    mouth: 'M20 28 L28 28',
  },
  happy: {
    eyes: ['M12 18 L20 18', 'M28 18 L36 18'],
    mouth: 'M12 28 Q24 36 36 28',
  },
  sad: {
    eyes: ['M14 18 Q18 22 22 18', 'M26 18 Q30 22 34 18'],
    mouth: 'M12 34 Q24 24 36 34',
  },
  angry: {
    eyes: ['M12 18 L20 24', 'M28 18 L36 24'],
    mouth: 'M12 32 L18 28 L24 32 L30 28 L36 32',
  },
  shocked: {
    eyes: ['M14 18 A4 4 0 1 1 14 18', 'M30 18 A4 4 0 1 1 30 18'],
    mouth: 'M22 28 A4 4 0 1 1 22 28',
  },
  excited: {
    eyes: ['M12 18 L20 18', 'M28 18 L36 18'],
    mouth: 'M18 30 Q24 38 30 30',
  },
};

export const MOOD_THEMES = {
  neutral: { bgStart: '#0A0A1A', bgEnd: '#6C3CE1', ledColor: '#FFFFFF', glowColor: '#6C3CE1' },
  happy:   { bgStart: '#1A0A2A', bgEnd: '#06B6D4', ledColor: '#06B6D4', glowColor: '#06B6D4' },
  sad:     { bgStart: '#0A0A1A', bgEnd: '#14B8A6', ledColor: '#14B8A6', glowColor: '#14B8A6' },
  angry:   { bgStart: '#2A0A0A', bgEnd: '#EF4444', ledColor: '#EF4444', glowColor: '#EF4444' },
  shocked: { bgStart: '#0A0A2A', bgEnd: '#8B5CF6', ledColor: '#FFFFFF', glowColor: '#8B5CF6' },
  excited: { bgStart: '#2A1A0A', bgEnd: '#F59E0B', ledColor: '#F59E0B', glowColor: '#F59E0B' },
};

export const ACCESSORIES = {
  happy: { emoji: '❤️', size: 14, top: -10, right: -10 },
  excited: { emoji: '⭐', size: 16, top: -12, right: -12 },
  sad: { emoji: '💧', size: 12, top: -8, right: -8 },
  angry: { emoji: '⚡', size: 14, top: -12, right: -12 },
  shocked: { emoji: '❗', size: 16, top: -14, right: -14 },
  neutral: null,
};

// ─── All Skins (removed the 5 biggest) ─────────────────────────────

export const SKINS = [
  // ─── Basic Skins ────────────────────────────────────────────────
  {
    id: 'midnight',
    name: 'Midnight Pulse',
    bgStart: '#1A1A2E',
    bgEnd: '#16213E',
    ledColor: '#00D2FF',
    glowColor: '#00D2FF',
    isLimited: true,
    price: 500,
    expiresInDays: 3,
  },
  {
    id: 'pastel',
    name: 'Pastel Dream',
    bgStart: '#FFB6C1',
    bgEnd: '#FF69B4',
    ledColor: '#FFFFFF',
    glowColor: '#FF69B4',
    isLimited: true,
    price: 500,
    expiresInDays: 3,
  },
  {
    id: 'rosegold',
    name: 'Rose Gold',
    bgStart: '#EECDA3',
    bgEnd: '#EF629F',
    ledColor: '#FFFFFF',
    glowColor: '#EF629F',
    isLimited: true,
    price: 500,
    expiresInDays: 3,
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    bgStart: '#0F0C29',
    bgEnd: '#302B63',
    ledColor: '#00FFAA',
    glowColor: '#00FFAA',
    isLimited: true,
    price: 500,
    expiresInDays: 3,
  },
  {
    id: 'neon',
    name: 'Neon Dreams',
    bgStart: '#00FFAA',
    bgEnd: '#FF00FF',
    ledColor: '#FFFFFF',
    glowColor: '#FF00FF',
    isLimited: false,
    price: 300,
  },
  {
    id: 'halloween',
    name: 'Halloween Glow',
    bgStart: '#FF4500',
    bgEnd: '#8B0000',
    ledColor: '#FFD700',
    glowColor: '#FF4500',
    isLimited: true,
    price: 500,
    expiresInDays: 3,
  },
  {
    id: 'ocean',
    name: 'Ocean Deep',
    bgStart: '#2193B0',
    bgEnd: '#6DD5ED',
    ledColor: '#FFFFFF',
    glowColor: '#2193B0',
    isLimited: false,
    price: 300,
  },
  {
    id: 'forest',
    name: 'Forest Whisper',
    bgStart: '#134E5E',
    bgEnd: '#71B280',
    ledColor: '#FFFFFF',
    glowColor: '#71B280',
    isLimited: false,
    price: 300,
  },
  {
    id: 'sunset',
    name: 'Sunset Blaze',
    bgStart: '#FF512F',
    bgEnd: '#DD2475',
    ledColor: '#FFD700',
    glowColor: '#FF512F',
    isLimited: false,
    price: 300,
  },
  {
    id: 'galaxy',
    name: 'Galaxy Burst',
    bgStart: '#1A0A2A',
    bgEnd: '#6C3CE1',
    ledColor: '#FFFFFF',
    glowColor: '#8B5CF6',
    isLimited: true,
    price: 500,
    expiresInDays: 3,
  },
];

export const getSkinById = (id) => SKINS.find(skin => skin.id === id) || null;