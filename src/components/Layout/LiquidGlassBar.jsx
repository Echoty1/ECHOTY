import React from 'react';
import './LiquidGlassBar.css'; // or keep it in Chats.css and skip this import

const TABS = [
  { id: 'chats',    label: 'Chats',    icon: '💬' },
  { id: 'notes',    label: 'Notes',    icon: '📝' },
  { id: 'halo',     label: 'Halo',     icon: '✨' },
  { id: 'profile',  label: 'You',      icon: '👤' },
];

export default function LiquidGlassBar({ active = 'chats', onChange }) {
  return (
    <nav className="lg-bottom-bar" aria-label="Primary">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`lg-tab${active === t.id ? ' is-active' : ''}`}
          aria-current={active === t.id ? 'page' : undefined}
          onClick={() => onChange?.(t.id)}
        >
          <span className="lg-tab-icon" aria-hidden="true">{t.icon}</span>
          <span className="lg-tab-label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}