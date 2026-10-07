// src/constants/echomoji.js

// ─── Mood Expressions ───
export const EXPRESSIONS = {
  neutral: {
    leftEyeShape: 'open',
    rightEyeShape: 'open',
    mouth: 'M 20 38 Q 28 40 36 38',
    eyebrowLeft: 'M 16 27 Q 22 25 28 26',
    eyebrowRight: 'M 36 26 Q 42 25 48 27',
    cheeks: false,
    particles: null,
    eyeScale: 1,
  },
  happy: {
    leftEyeShape: 'happyArc',
    rightEyeShape: 'happyArc',
    mouth: 'M 22 36 Q 28 46 34 36 Q 28 40 22 36',
    eyebrowLeft: 'M 16 25 Q 22 22 28 24',
    eyebrowRight: 'M 36 24 Q 42 22 48 25',
    cheeks: true,
    particles: 'sparkle',
    eyeScale: 1,
  },
  sad: {
    leftEyeShape: 'open',
    rightEyeShape: 'open',
    mouth: 'M 22 42 Q 28 36 34 42',
    eyebrowLeft: 'M 15 26 Q 22 23 29 28',
    eyebrowRight: 'M 35 28 Q 42 23 49 26',
    cheeks: false,
    particles: 'tear',
    eyeScale: 1,
    eyeLook: 'down',
  },
  angry: {
    leftEyeShape: 'open',
    rightEyeShape: 'open',
    mouth: 'M 20 40 L 26 36 L 32 40 L 38 36 L 44 40',
    eyebrowLeft: 'M 14 24 L 28 30',
    eyebrowRight: 'M 36 30 L 50 24',
    cheeks: false,
    particles: 'anger',
    eyeScale: 0.9,
  },
  shocked: {
    leftEyeShape: 'wide',
    rightEyeShape: 'wide',
    mouth: 'M 24 36 Q 24 46 32 46 Q 40 46 40 36 Q 40 30 32 30 Q 24 30 24 36 Z',
    eyebrowLeft: 'M 16 20 Q 22 18 28 20',
    eyebrowRight: 'M 36 20 Q 42 18 48 20',
    cheeks: false,
    particles: 'shock',
    eyeScale: 1.15,
  },
  excited: {
    leftEyeShape: 'happyArc',
    rightEyeShape: 'happyArc',
    mouth: 'M 22 36 Q 28 48 34 36 Q 28 42 22 36',
    eyebrowLeft: 'M 16 22 Q 22 19 28 22',
    eyebrowRight: 'M 36 22 Q 42 19 48 22',
    cheeks: true,
    particles: 'sparkle',
    eyeScale: 1,
  },
  love: {
    leftEyeShape: 'heart',
    rightEyeShape: 'heart',
    mouth: 'M 22 36 Q 28 46 34 36',
    eyebrowLeft: 'M 16 24 Q 22 22 28 24',
    eyebrowRight: 'M 36 24 Q 42 22 48 24',
    cheeks: true,
    particles: 'heart',
    eyeScale: 1,
  },
  sleepy: {
    leftEyeShape: 'closedDown',
    rightEyeShape: 'closedDown',
    mouth: 'M 24 40 Q 28 42 32 40',
    eyebrowLeft: 'M 16 26 Q 22 25 28 26',
    eyebrowRight: 'M 36 26 Q 42 25 48 26',
    cheeks: false,
    particles: 'zzz',
    eyeScale: 1,
  },
  cool: {
    leftEyeShape: 'cool',
    rightEyeShape: 'cool',
    mouth: 'M 18 36 Q 28 44 38 36',
    eyebrowLeft: 'M 16 26 L 28 26',
    eyebrowRight: 'M 36 26 L 48 26',
    cheeks: false,
    particles: null,
    eyeScale: 1,
  },
  cry: {
    leftEyeShape: 'teary',
    rightEyeShape: 'teary',
    mouth: 'M 22 42 Q 28 36 34 42',
    eyebrowLeft: 'M 15 26 Q 22 23 29 28',
    eyebrowRight: 'M 35 28 Q 42 23 49 26',
    cheeks: false,
    particles: 'tear',
    eyeScale: 1,
  },
};

// ─── Eyebrow Styles ───
export const EYEBROW_STYLES = [
  { id: 'natural', name: 'Natural', left: 'M 16 27 Q 22 25 28 26', right: 'M 36 26 Q 42 25 48 27' },
  { id: 'thick',   name: 'Thick',   left: 'M 16 26 L 28 26',         right: 'M 36 26 L 48 26' },
  { id: 'arched',  name: 'Arched',  left: 'M 15 28 Q 22 22 29 26',   right: 'M 35 26 Q 42 22 49 28' },
  { id: 'sad',     name: 'Sad',     left: 'M 15 26 Q 22 24 29 29',   right: 'M 35 29 Q 42 24 49 26' },
  { id: 'angry',   name: 'Angry',   left: 'M 14 24 L 28 30',         right: 'M 36 30 L 50 24' },
  { id: 'straight',name: 'Straight',left: 'M 16 26 L 28 26',         right: 'M 36 26 L 48 26' },
];

// ─── Mouth Styles ───
export const MOUTH_STYLES = [
  { id: 'smile',  name: 'Smile',  path: 'M 22 36 Q 28 44 34 36' },
  { id: 'flat',   name: 'Flat',   path: 'M 22 38 L 34 38' },
  { id: 'frown',  name: 'Frown',  path: 'M 22 42 Q 28 36 34 42' },
  { id: 'open',   name: 'Open',   path: 'M 22 36 Q 28 48 34 36 Q 28 40 22 36' },
  { id: 'smirk',  name: 'Smirk',  path: 'M 20 38 Q 28 36 36 42' },
  { id: 'laugh',  name: 'Laugh',  path: 'M 20 34 Q 28 48 36 34 Q 28 40 20 34' },
];

// ─── Eye Colors ───
export const EYE_COLORS = [
  { id: 'brown',  name: 'Brown',  color: '#5C3A1E', iris: '#8B5A2B' },
  { id: 'black',  name: 'Black',  color: '#1A1A1A', iris: '#333333' },
  { id: 'blue',   name: 'Blue',   color: '#1E5A8E', iris: '#4A90E2' },
  { id: 'green',  name: 'Green',  color: '#1E6B3A', iris: '#2ECC71' },
  { id: 'hazel',  name: 'Hazel',  color: '#6B4A2A', iris: '#A57C4A' },
  { id: 'amber',  name: 'Amber',  color: '#B8802A', iris: '#E0A93A' },
  { id: 'violet', name: 'Violet', color: '#5A3A8E', iris: '#8B5CF6' },
  { id: 'gray',   name: 'Gray',   color: '#5A5A5A', iris: '#9E9E9E' },
];

// ─── Outfits ───
export const OUTFITS = [
  { id: 'default', name: 'Default', color: null },
  { id: 'red',     name: 'Red',     color: '#E74C3C', shadow: '#B03A2E' },
  { id: 'blue',    name: 'Blue',    color: '#4A90E2', shadow: '#2C5F8A' },
  { id: 'green',   name: 'Green',   color: '#2ECC71', shadow: '#1E8A4A' },
  { id: 'purple',  name: 'Purple',  color: '#8B5CF6', shadow: '#6D28D9' },
  { id: 'pink',    name: 'Pink',    color: '#EC4899', shadow: '#BE185D' },
  { id: 'orange',  name: 'Orange',  color: '#F59E0B', shadow: '#B45309' },
  { id: 'teal',    name: 'Teal',    color: '#14B8A6', shadow: '#0E8276' },
  { id: 'black',   name: 'Black',   color: '#2C3E50', shadow: '#1A252F' },
  { id: 'gold',    name: 'Gold',    color: '#FFD700', shadow: '#B8860B' },
  { id: 'white',   name: 'White',   color: '#F5F5F5', shadow: '#C0C0C0' },
  { id: 'navy',    name: 'Navy',    color: '#1E3A8A', shadow: '#0F1F4A' },
  { id: 'mint',    name: 'Mint',    color: '#6EE7B7', shadow: '#3F9E73' },
];

// ─── Mood Themes ───
export const MOOD_THEMES = {
  neutral: { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#6C3CE1', outfitShadow: '#4A2A9E', hair: '#3A2318', glowColor: '#8B5CF6' },
  happy:   { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#06B6D4', outfitShadow: '#048BA8', hair: '#3A2318', glowColor: '#F5A623' },
  sad:     { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#14B8A6', outfitShadow: '#0E8276', hair: '#3A2318', glowColor: '#4A90E2' },
  angry:   { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#E74C3C', outfitShadow: '#B03A2E', hair: '#3A2318', glowColor: '#EF4444' },
  shocked: { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#8B5CF6', outfitShadow: '#6D28D9', hair: '#3A2318', glowColor: '#8B5CF6' },
  excited: { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#F59E0B', outfitShadow: '#B45309', hair: '#3A2318', glowColor: '#F59E0B' },
  love:    { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#EC4899', outfitShadow: '#BE185D', hair: '#3A2318', glowColor: '#EC4899' },
  sleepy:  { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#3B82F6', outfitShadow: '#1D4ED8', hair: '#3A2318', glowColor: '#3B82F6' },
  cool:    { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#FDE047', outfitShadow: '#CA8A04', hair: '#3A2318', glowColor: '#8B5CF6' },
  cry:     { skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', blush: '#F5A8A0', outfit: '#6366F1', outfitShadow: '#4338CA', hair: '#3A2318', glowColor: '#6366F1' },
};

// ─── Hair Styles (richer SVG paths for a Bitmoji-like look) ───
// Each returns a "back" layer (behind the head) and a "front" layer (on top)
export const HAIR_STYLES = [
  {
    id: 'short',
    name: 'Short',
    back: '',
    front: 'M 8 30 Q 6 10 32 6 Q 58 10 56 30 Q 56 22 48 20 Q 44 14 32 14 Q 20 14 16 20 Q 8 22 8 30 Z M 8 30 Q 6 26 10 22 Q 12 26 14 28 Z',
  },
  {
    id: 'buzz',
    name: 'Buzz',
    back: '',
    front: 'M 9 28 Q 8 12 32 8 Q 56 12 55 28 Q 52 18 42 16 Q 32 14 22 16 Q 12 18 9 28 Z',
  },
  {
    id: 'wavy',
    name: 'Wavy',
    back: 'M 6 30 Q 4 8 32 4 Q 60 8 58 30 L 60 44 Q 56 36 54 28 Q 54 14 32 12 Q 10 14 10 28 Q 8 36 4 44 Z',
    front: 'M 8 26 Q 10 10 32 6 Q 54 10 56 26 Q 50 16 32 14 Q 14 16 8 26 Z',
  },
  {
    id: 'curly',
    name: 'Curly',
    back: '',
    front: 'M 6 32 Q 4 12 18 8 Q 22 4 32 6 Q 42 4 46 8 Q 60 12 58 32 Q 60 20 50 16 Q 46 10 38 12 Q 32 8 26 12 Q 18 10 14 16 Q 4 20 6 32 Z',
  },
  {
    id: 'long',
    name: 'Long',
    back: 'M 4 32 Q 4 10 32 6 Q 60 10 60 32 L 62 60 Q 58 50 56 40 L 56 30 Q 54 14 32 12 Q 10 14 8 30 L 8 40 Q 6 50 2 60 Z',
    front: 'M 8 30 Q 8 12 32 8 Q 56 12 56 30 Q 50 18 32 16 Q 14 18 8 30 Z',
  },
  {
    id: 'bob',
    name: 'Bob',
    back: 'M 6 34 Q 4 12 32 6 Q 60 12 58 34 L 60 50 Q 56 42 54 34 Q 54 14 32 12 Q 10 14 10 34 Q 8 42 4 50 Z',
    front: 'M 8 28 Q 8 12 32 8 Q 56 12 56 28 Q 50 18 32 16 Q 14 18 8 28 Z',
  },
  {
    id: 'ponytail',
    name: 'Ponytail',
    back: 'M 56 32 Q 68 36 72 52 Q 70 58 64 56 Q 60 44 54 38 Z',
    front: 'M 8 30 Q 8 12 32 8 Q 56 12 56 30 Q 50 18 32 16 Q 14 18 8 30 Z',
  },
  {
    id: 'mohawk',
    name: 'Mohawk',
    back: '',
    front: 'M 20 30 Q 20 4 32 2 Q 44 4 44 30 Q 40 14 32 12 Q 24 14 20 30 Z',
  },
  {
    id: 'bald',
    name: 'Bald',
    back: '',
    front: '',
  },
  {
    id: 'afro',
    name: 'Afro',
    back: '',
    front: 'M 4 34 Q 0 12 20 6 Q 28 0 36 4 Q 44 0 52 6 Q 68 12 60 34 Q 62 22 52 18 Q 46 12 40 16 Q 32 10 26 14 Q 20 10 14 16 Q 4 20 4 34 Z',
  },
  {
    id: 'spiky',
    name: 'Spiky',
    back: '',
    front: 'M 8 28 L 12 14 L 18 22 L 22 10 L 28 20 L 32 8 L 36 20 L 42 10 L 46 22 L 52 14 L 56 28 Q 52 18 42 16 Q 32 12 22 16 Q 12 18 8 28 Z',
  },
];

// ─── Skins ───
export const SKINS = [
  { id: 'light',   name: 'Light',     skinLight: '#FFE0CE', skinBase: '#F0BC96', skinShadow: '#C99470', hair: '#3A2318', defaultHair: 'short',    glowColor: '#F1C27D', isLimited: false, price: 0 },
  { id: 'fair',    name: 'Fair',      skinLight: '#FFF0E6', skinBase: '#F8D5B8', skinShadow: '#D8A982', hair: '#8B5A2B', defaultHair: 'wavy',     glowColor: '#F8D5B8', isLimited: false, price: 0 },
  { id: 'medium',  name: 'Medium',    skinLight: '#F0C8A0', skinBase: '#D9A373', skinShadow: '#A87C52', hair: '#1A1108', defaultHair: 'short',    glowColor: '#D9A373', isLimited: false, price: 0 },
  { id: 'olive',   name: 'Olive',     skinLight: '#D4B896', skinBase: '#B08D57', skinShadow: '#8C6B3A', hair: '#2C1A0E', defaultHair: 'curly',    glowColor: '#B08D57', isLimited: false, price: 0 },
  { id: 'bronze',  name: 'Bronze',    skinLight: '#D4A373', skinBase: '#B07D4F', skinShadow: '#8C5E32', hair: '#1A0F08', defaultHair: 'short',    glowColor: '#B07D4F', isLimited: false, price: 60 },
  { id: 'tan',     name: 'Tan',       skinLight: '#C99B6E', skinBase: '#A67746', skinShadow: '#7E572E', hair: '#2C1A0E', defaultHair: 'buzz',     glowColor: '#A67746', isLimited: false, price: 60 },
  { id: 'dark',    name: 'Dark',      skinLight: '#A66A32', skinBase: '#8D5524', skinShadow: '#6B3E1A', hair: '#0A0502', defaultHair: 'curly',    glowColor: '#8D5524', isLimited: false, price: 90 },
  { id: 'deep',    name: 'Deep',      skinLight: '#7A4A28', skinBase: '#5C3A21', skinShadow: '#3E2615', hair: '#050201', defaultHair: 'afro',     glowColor: '#5C3A21', isLimited: false, price: 120 },
  { id: 'ebony',   name: 'Ebony',     skinLight: '#5C3A21', skinBase: '#3E2723', skinShadow: '#2A1A17', hair: '#050201', defaultHair: 'buzz',     glowColor: '#3E2723', isLimited: false, price: 150 },
  { id: 'gold',    name: 'Golden',    skinLight: '#FFE082', skinBase: '#FFC107', skinShadow: '#FFA000', hair: '#B8860B', defaultHair: 'mohawk',   glowColor: '#FFC107', isLimited: true,  price: 200, expiresInDays: 3 },
  { id: 'alien',   name: 'Alien',     skinLight: '#A5D6A7', skinBase: '#4CAF50', skinShadow: '#2E7D32', hair: '#1B5E20', defaultHair: 'bald',     glowColor: '#4CAF50', isLimited: true,  price: 250, expiresInDays: 3 },
  { id: 'vampire', name: 'Vampire',   skinLight: '#E0E0E0', skinBase: '#BDBDBD', skinShadow: '#9E9E9E', hair: '#000000', defaultHair: 'wavy',     glowColor: '#BDBDBD', isLimited: true,  price: 300, expiresInDays: 3 },
  { id: 'galaxy',  name: 'Galaxy',    skinLight: '#CE93D8', skinBase: '#8E24AA', skinShadow: '#4A148C', hair: '#4A148C', defaultHair: 'spiky',    glowColor: '#8E24AA', isLimited: true,  price: 350, expiresInDays: 3 },
  { id: 'zombie',  name: 'Zombie',    skinLight: '#B8CC9E', skinBase: '#8FA86F', skinShadow: '#6B824D', hair: '#3A2A18', defaultHair: 'spiky',    glowColor: '#8FA86F', isLimited: true,  price: 400, expiresInDays: 3 },
];

export const getSkinById = (id) => SKINS.find((skin) => skin.id === id) || null;
