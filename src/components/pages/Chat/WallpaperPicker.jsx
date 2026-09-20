import React from 'react';
import { WALLPAPERS } from '../../../constants/wallpapers';

const WallpaperPicker = ({ current, onSelect, onClose }) => {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)', zIndex: 99999,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px', background: 'var(--bg-card)',
          borderRadius: '20px 20px 0 0', padding: '20px 16px 28px',
          maxHeight: '70vh', overflowY: 'auto',
          animation: 'wallpaperSlideUp 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        <div style={{ width: '40px', height: '4px', background: 'var(--text-muted)', opacity: 0.3, borderRadius: '2px', margin: '0 auto 16px' }} />
        <h3 style={{ margin: 0, marginBottom: '16px', fontSize: '16px', color: 'var(--text-primary)' }}>
          Chat Wallpaper
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '12px' }}>
          {WALLPAPERS.map((wp) => {
            const isActive = current === wp.id;
            return (
              <button
                key={wp.id}
                onClick={() => { onSelect(wp.id); onClose(); }}
                style={{
                  position: 'relative', width: '100%', aspectRatio: '1 / 1',
                  borderRadius: '12px',
                  border: isActive ? '3px solid #6C3CE1' : '1px solid var(--border-color)',
                  background: wp.type === 'color'
                    ? (wp.value === 'transparent' ? 'var(--bg-primary)' : wp.value)
                    : wp.value,
                  backgroundSize: wp.type === 'pattern' ? '20px 20px' : 'cover',
                  cursor: 'pointer', overflow: 'hidden', padding: 0, minHeight: 'auto',
                }}
              >
                {isActive && (
                  <div style={{ position: 'absolute', top: '4px', right: '4px', background: '#6C3CE1', color: '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>✓</div>
                )}
                <div style={{ position: 'absolute', bottom: '4px', left: '4px', right: '4px', fontSize: '10px', fontWeight: 600, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.8)', textAlign: 'center' }}>
                  {wp.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WallpaperPicker;