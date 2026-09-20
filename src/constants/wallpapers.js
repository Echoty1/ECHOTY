export const WALLPAPERS = [
  { id: 'default',  name: 'Default',    type: 'color',    value: 'transparent' },
  { id: 'midnight', name: 'Midnight',   type: 'gradient', value: 'linear-gradient(135deg, #0F0C29, #302B63, #24243E)' },
  { id: 'peach',    name: 'Peach',      type: 'gradient', value: 'linear-gradient(135deg, #FFB88C, #DE6262)' },
  { id: 'ocean',    name: 'Ocean',      type: 'gradient', value: 'linear-gradient(135deg, #2193B0, #6DD5ED)' },
  { id: 'forest',   name: 'Forest',     type: 'gradient', value: 'linear-gradient(135deg, #134E5E, #71B280)' },
  { id: 'sunset',   name: 'Sunset',     type: 'gradient', value: 'linear-gradient(135deg, #FF512F, #DD2475)' },
  { id: 'purple',   name: 'Purple',     type: 'gradient', value: 'linear-gradient(135deg, #6C3CE1, #EC4899)' },
  { id: 'dark',     name: 'Pure Dark',  type: 'color',    value: '#0A0A0F' },
  { id: 'paper',    name: 'Paper',      type: 'color',    value: '#F5F5F5' },
  { id: 'dots',     name: 'Polka Dots', type: 'pattern',  value: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)' },
  { id: 'grid',     name: 'Grid',       type: 'pattern',  value: 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)' },
];

export const getWallpaperById = (id) =>
  WALLPAPERS.find((w) => w.id === id) || WALLPAPERS[0];