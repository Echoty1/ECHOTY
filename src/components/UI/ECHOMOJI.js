// src/components/UI/ECHOMOJI.js
import React, { useState, useEffect } from 'react';
import { EXPRESSIONS, MOOD_THEMES } from '../../constants/echomoji';

const ECHOMOJI = ({
  mood = 'neutral',
  expression,
  size = 48,
  pulse = false,
  interactive = true,
  animated = true,
  skin = null,
  onMoodChange = null,
  onDoubleClick = null,
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState([]);

  const theme = skin || MOOD_THEMES[mood] || MOOD_THEMES.neutral;
  const expr = expression || mood;

  // External pulse trigger
  useEffect(() => {
    if (pulse) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 700);
      return () => clearTimeout(timer);
    }
  }, [pulse]);

  const handleClick = (e) => {
    if (interactive && onMoodChange) {
      onMoodChange();
    }
    if (interactive) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - size / 4;
      const y = e.clientY - rect.top - size / 4;
      const id = Date.now();
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 800);

      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 700);
    }
  };

  const handleDoubleClick = () => {
    if (onDoubleClick) onDoubleClick();
  };

  const baseStyle = {
    width: size,
    height: size,
    borderRadius: '20%',
    background: `linear-gradient(135deg, ${theme.bgStart}, ${theme.bgEnd})`,
    boxShadow: isHovered
      ? `0 8px 30px ${theme.glowColor}80`
      : `0 4px 16px ${theme.glowColor}40`,
    backdropFilter: animated ? 'blur(12px)' : 'none',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    cursor: interactive ? 'pointer' : 'default',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    willChange: animated ? 'transform' : 'auto',
    transform: isPulsing ? 'scale(1.08)' : isHovered ? 'scale(1.05)' : 'scale(1)',
    animation: animated ? 'echoFloat 3s ease-in-out infinite' : 'none',
  };

  // Ring styling helper
  const ringStyle = (delay = 0, scale = 1.2) => ({
    position: 'absolute',
    borderRadius: '50%',
    border: `2px solid ${theme.ledColor}`,
    opacity: 0.3,
    pointerEvents: 'none',
    width: size * scale,
    height: size * scale,
    top: (size * (1 - scale)) / 2,
    left: (size * (1 - scale)) / 2,
    animation: `echoRingPulse 3s ease-out infinite ${delay}s`,
  });

  return (
    <div
      className="echomoji"
      style={baseStyle}
      onMouseEnter={() => interactive && setIsHovered(true)}
      onMouseLeave={() => interactive && setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Echo Rings only rendered when animated flag is true */}
      {animated && (
        <>
          <div style={ringStyle(0, 1.2)} />
          <div style={ringStyle(0.5, 1.4)} />
          <div style={ringStyle(1.0, 1.6)} />
        </>
      )}

      {/* Click ripples */}
      {ripples.map((r) => (
        <div
          key={r.id}
          style={{
            position: 'absolute',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.ledColor}40, transparent)`,
            width: size * 0.5,
            height: size * 0.5,
            left: r.x - size * 0.25,
            top: r.y - size * 0.25,
            pointerEvents: 'none',
            animation: 'echoRingPulse 0.8s ease-out forwards',
          }}
        />
      ))}

      {/* SVG Face Expression */}
      <svg viewBox="0 0 48 48" style={{ width: '80%', height: '80%' }}>
        <g stroke={theme.ledColor} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d={EXPRESSIONS[expr]?.eyes[0] || EXPRESSIONS.neutral.eyes[0]} />
          <path d={EXPRESSIONS[expr]?.eyes[1] || EXPRESSIONS.neutral.eyes[1]} />
        </g>
        <path
          d={EXPRESSIONS[expr]?.mouth || EXPRESSIONS.neutral.mouth}
          stroke={theme.ledColor}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* ─── Removed accessory rendering ─────────────────────────── */}

      {/* Skin badge */}
      {skin && (
        <div
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            fontSize: 10,
            background: 'rgba(0,0,0,0.6)',
            borderRadius: '50%',
            padding: '2px 4px',
            color: '#fff',
          }}
        >
          ✦
        </div>
      )}
    </div>
  );
};

export default React.memo(ECHOMOJI);