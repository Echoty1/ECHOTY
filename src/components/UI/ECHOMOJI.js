// src/components/UI/ECHOMOJI.js
import React, { useState, useEffect, useRef } from 'react';
import {
  EXPRESSIONS,
  MOOD_THEMES,
  HAIR_STYLES,
  OUTFITS,
  EYE_COLORS,
  EYEBROW_STYLES,
  MOUTH_STYLES,
} from '../../constants/echomoji';

// ─── Injected Keyframes ───
const ECHOMOJI_KEYFRAMES = `
@keyframes echoRingPulse {
  0% { transform: scale(0.9); opacity: 0.6; }
  100% { transform: scale(1.6); opacity: 0; }
}
@keyframes echomoji-idle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
@keyframes echomoji-wave {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
}
@keyframes echomoji-jump {
  0%, 100% { transform: translateY(0); }
  30% { transform: translateY(-10px); }
  50% { transform: translateY(0); }
  70% { transform: translateY(-5px); }
}
@keyframes echomoji-cry {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(3px); }
}
@keyframes echomoji-dance {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  25% { transform: rotate(-6deg) translateY(-4px); }
  50% { transform: rotate(0deg) translateY(0); }
  75% { transform: rotate(6deg) translateY(-4px); }
}
@keyframes echomojiParticleFloat {
  0%, 100% { transform: translateY(0); opacity: 0.9; }
  50% { transform: translateY(-6px); opacity: 0.4; }
}
@keyframes echomojiHeartFloat {
  0% { transform: translateY(0) scale(1); opacity: 0.9; }
  100% { transform: translateY(-20px) scale(1.3); opacity: 0; }
}
@keyframes echomojiTearDrop {
  0% { transform: translateY(0); opacity: 0.9; }
  100% { transform: translateY(20px); opacity: 0; }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('echomoji-keyframes')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'echomoji-keyframes';
  styleEl.innerHTML = ECHOMOJI_KEYFRAMES;
  document.head.appendChild(styleEl);
}

// ─── Eye Renderer — Bitmoji-style detailed eyes ───
const renderEye = (cx, cy, eyeColor, style, side = 'left', eyeScale = 1, look = 'center') => {
  const w = 7 * eyeScale;
  const h = 9 * eyeScale;
  const rx = w / 2;
  const ry = h / 2;

  if (style === 'happyArc') {
    return (
      <g key={side}>
        <path
          d={`M ${cx - rx} ${cy} Q ${cx} ${cy - ry * 1.3} ${cx + rx} ${cy}`}
          stroke={eyeColor.color}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }

  if (style === 'closedDown' || style === 'closed') {
    return (
      <g key={side}>
        <path
          d={`M ${cx - rx} ${cy} Q ${cx} ${cy + ry * 0.6} ${cx + rx} ${cy}`}
          stroke={eyeColor.color}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={`M ${cx - rx - 1} ${cy + 1} L ${cx - rx + 2} ${cy + 2}`}
          stroke={eyeColor.color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (style === 'cool') {
    return (
      <g key={side}>
        <rect
          x={cx - rx - 1.5}
          y={cy - ry * 0.7}
          width={w + 3}
          height={ry * 1.4}
          rx={ry * 0.5}
          fill="#141414"
        />
        <path
          d={`M ${cx - rx + 1} ${cy - ry * 0.3} L ${cx - rx + 3} ${cy - ry * 0.5} L ${cx - rx + 5} ${cy - ry * 0.2}`}
          stroke="#FFF"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />
      </g>
    );
  }

  if (style === 'heart') {
    const hs = 5 * eyeScale;
    return (
      <g key={side}>
        <path
          d={`M ${cx} ${cy + hs * 0.9} C ${cx - hs} ${cy - hs * 0.2} ${cx - hs * 0.9} ${cy - hs * 1.2} ${cx} ${cy - hs * 0.3} C ${cx + hs * 0.9} ${cy - hs * 1.2} ${cx + hs} ${cy - hs * 0.2} ${cx} ${cy + hs * 0.9} Z`}
          fill="#EC4899"
        />
        <circle cx={cx - 1.5} cy={cy - 2} r="0.8" fill="#FFF" opacity="0.8" />
      </g>
    );
  }

  if (style === 'teary') {
    return (
      <g key={side}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#FFF" stroke="#E8E8E8" strokeWidth="0.5" />
        <circle cx={cx} cy={cy} r={rx * 0.85} fill={eyeColor.iris} />
        <circle cx={cx} cy={cy} r={rx * 0.55} fill={eyeColor.color} />
        <circle cx={cx} cy={cy} r={rx * 0.3} fill="#000" />
        <circle cx={cx - rx * 0.35} cy={cy - ry * 0.35} r="1.3" fill="#FFF" />
        <circle cx={cx + rx * 0.3} cy={cy + ry * 0.3} r="0.7" fill="#FFF" opacity="0.7" />
        <ellipse cx={cx} cy={cy + ry * 0.6} rx={rx * 0.6} ry={ry * 0.2} fill="#4A90E2" opacity="0.6" />
        <path
          d={`M ${cx - rx} ${cy - ry * 0.3} Q ${cx} ${cy - ry * 1.2} ${cx + rx} ${cy - ry * 0.3}`}
          fill="none"
          stroke={eyeColor.color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
    );
  }

  if (style === 'wide') {
    return (
      <g key={side}>
        <ellipse cx={cx} cy={cy} rx={rx * 1.1} ry={ry * 1.1} fill="#FFF" stroke="#E8E8E8" strokeWidth="0.5" />
        <circle cx={cx} cy={cy} r={rx * 0.7} fill={eyeColor.iris} />
        <circle cx={cx} cy={cy} r={rx * 0.45} fill={eyeColor.color} />
        <circle cx={cx} cy={cy} r={rx * 0.25} fill="#000" />
        <circle cx={cx - rx * 0.3} cy={cy - ry * 0.3} r="1.6" fill="#FFF" />
      </g>
    );
  }

  // Default 'open' — Bitmoji-style layered eye
  const lookOffset = look === 'down' ? ry * 0.15 : 0;
  return (
    <g key={side}>
      {/* Eye white */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#FFF" stroke="#E8E8E8" strokeWidth="0.5" />
      {/* Shadow under lid */}
      <ellipse cx={cx} cy={cy - ry * 0.5} rx={rx * 0.9} ry={ry * 0.4} fill="#000" opacity="0.08" />
      {/* Iris */}
      <circle cx={cx} cy={cy + lookOffset} r={rx * 0.75} fill={eyeColor.iris} />
      {/* Iris shading */}
      <circle cx={cx} cy={cy + lookOffset} r={rx * 0.75} fill="url(#irisShade)" />
      {/* Pupil */}
      <circle cx={cx} cy={cy + lookOffset} r={rx * 0.4} fill="#000" />
      {/* Primary highlight */}
      <circle cx={cx - rx * 0.3} cy={cy - ry * 0.35 + lookOffset} r={rx * 0.28} fill="#FFF" />
      {/* Secondary highlight */}
      <circle cx={cx + rx * 0.3} cy={cy + ry * 0.25 + lookOffset} r={rx * 0.15} fill="#FFF" opacity="0.7" />
      {/* Eyelid line (top) */}
      <path
        d={`M ${cx - rx - 0.5} ${cy - ry * 0.7} Q ${cx} ${cy - ry * 1.3} ${cx + rx + 0.5} ${cy - ry * 0.7}`}
        fill="none"
        stroke={eyeColor.color}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* Lashes */}
      <path
        d={`M ${cx - rx - 1} ${cy - ry * 0.9} L ${cx - rx - 2} ${cy - ry * 1.3}`}
        stroke={eyeColor.color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d={`M ${cx + rx + 1} ${cy - ry * 0.9} L ${cx + rx + 2} ${cy - ry * 1.3}`}
        stroke={eyeColor.color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {/* Bottom lash line */}
      <path
        d={`M ${cx - rx * 0.8} ${cy + ry * 0.9} Q ${cx} ${cy + ry * 1.1} ${cx + rx * 0.8} ${cy + ry * 0.9}`}
        fill="none"
        stroke={eyeColor.color}
        strokeWidth="0.8"
        strokeLinecap="round"
        opacity="0.6"
      />
    </g>
  );
};

const ECHOMOJI = ({
  mood = 'neutral',
  expression,
  size = 48,
  pulse = false,
  interactive = true,
  animated = true,
  skin = null,
  hairStyle = null,
  outfitId = null,
  eyeColorId = null,
  eyebrowStyleId = null,
  mouthStyleId = null,
  animation = 'idle',
  onMoodChange = null,
  onDoubleClick = null,
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [ripples, setRipples] = useState([]);
  const blinkTimer = useRef(null);

  const theme = skin || MOOD_THEMES[mood] || MOOD_THEMES.neutral;
  const expr = EXPRESSIONS[expression || mood] || EXPRESSIONS.neutral;

  const activeHairId = hairStyle || theme.defaultHair || 'short';
  const activeHair = HAIR_STYLES.find((h) => h.id === activeHairId) || HAIR_STYLES[0];

  const activeOutfit = outfitId ? OUTFITS.find((o) => o.id === outfitId) : null;
  const finalOutfit = activeOutfit && activeOutfit.color ? activeOutfit.color : theme.outfit;
  const finalOutfitShadow =
    activeOutfit && activeOutfit.shadow ? activeOutfit.shadow : theme.outfitShadow;

  const activeEyeColorObj =
    (eyeColorId && EYE_COLORS.find((e) => e.id === eyeColorId)) || EYE_COLORS[0];
  const finalEyeColor = activeEyeColorObj;

  const activeEyebrow = eyebrowStyleId
    ? EYEBROW_STYLES.find((e) => e.id === eyebrowStyleId)
    : null;

  const activeMouth = mouthStyleId ? MOUTH_STYLES.find((m) => m.id === mouthStyleId) : null;
  const finalMouth = activeMouth ? activeMouth.path : expr.mouth;

  // Blink loop
  useEffect(() => {
    if (!animated || !interactive) return;
    const scheduleBlink = () => {
      const delay = 3200 + Math.random() * 2400;
      blinkTimer.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 130);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(blinkTimer.current);
  }, [animated, interactive]);

  useEffect(() => {
    if (pulse) {
      setIsPulsing(true);
      const t = setTimeout(() => setIsPulsing(false), 700);
      return () => clearTimeout(t);
    }
  }, [pulse]);

  const handleClick = (e) => {
    if (interactive && onMoodChange) onMoodChange();
    if (interactive) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left - size / 4;
      const y = e.clientY - rect.top - size / 4;
      const id = Date.now();
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 800);
      setIsPulsing(true);
      setTimeout(() => setIsPulsing(false), 700);
    }
  };

  const baseStyle = {
    width: size,
    height: size * (72 / 48),
    position: 'relative',
    cursor: interactive ? 'pointer' : 'default',
    transition:
      'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s ease',
    transform: isPulsing
      ? 'scale(1.15)'
      : isHovered
      ? 'scale(1.08)'
      : 'scale(1)',
    filter: isHovered
      ? `drop-shadow(0 15px 20px ${theme.glowColor}60)`
      : 'drop-shadow(0 8px 12px rgba(0,0,0,0.3))',
    animation:
      animated && animation !== 'none'
        ? `echomoji-${animation} 2.4s ease-in-out infinite`
        : 'none',
  };

  const ringStyle = (delay = 0, scale = 1.2, borderWidth = 3, opacity = 0.4) => ({
    position: 'absolute',
    borderRadius: '50%',
    border: `${borderWidth}px solid ${theme.glowColor}`,
    opacity,
    pointerEvents: 'none',
    width: size * scale,
    height: size * scale,
    top: (size * (1 - scale)) / 2,
    left: (size * (1 - scale)) / 2,
    animation: `echoRingPulse 3s ease-out infinite ${delay}s`,
    boxShadow: `0 0 20px ${theme.glowColor}60`,
    willChange: 'transform, opacity',
  });

  // Arm shapes for various animations
  const getArmPaths = () => {
    if (animation === 'wave') {
      return {
        left: 'M 14 62 Q 8 68 10 76 Q 12 80 14 77 Q 12 72 16 68 Z',
        right: 'M 42 62 Q 50 52 48 42 Q 46 38 43 41 Q 46 50 40 60 Z',
      };
    }
    if (animation === 'cry' || mood === 'sad' || mood === 'cry') {
      return {
        left: 'M 14 62 Q 10 54 14 48 Q 16 46 17 50 Q 14 54 16 62 Z',
        right: 'M 42 62 Q 46 54 42 48 Q 40 46 39 50 Q 42 54 40 62 Z',
      };
    }
    if (
      animation === 'jump' ||
      animation === 'dance' ||
      mood === 'happy' ||
      mood === 'excited'
    ) {
      return {
        left: 'M 14 62 Q 6 56 8 48 Q 10 44 12 48 Q 10 56 16 62 Z',
        right: 'M 42 62 Q 50 56 48 48 Q 46 44 44 48 Q 46 56 40 62 Z',
      };
    }
    return {
      left: 'M 14 62 Q 8 68 10 76 Q 12 80 14 77 Q 12 72 16 68 Z',
      right: 'M 42 62 Q 48 68 46 76 Q 44 80 42 77 Q 44 72 40 68 Z',
    };
  };

  const arms = getArmPaths();

  const renderEyes = () => {
    const eyeStyle = isBlinking ? 'closedDown' : expr.leftEyeShape;
    const eyeStyleR = isBlinking ? 'closedDown' : expr.rightEyeShape;
    const eyeScale = expr.eyeScale || 1;
    const look = expr.eyeLook || 'center';
    return (
      <React.Fragment>
        {renderEye(22, 36, finalEyeColor, eyeStyle, 'left', eyeScale, look)}
        {renderEye(42, 36, finalEyeColor, eyeStyleR, 'right', eyeScale, look)}
      </React.Fragment>
    );
  };

  const renderParticles = () => {
    if (!expr.particles || !animated) return null;
    const p = expr.particles;

    if (p === 'zzz') {
      return (
        <g>
          <text x="54" y="18" fontSize="8" fill="#FFF" fontWeight="800" opacity="0.95" style={{ animation: 'echomojiParticleFloat 2s infinite' }}>Z</text>
          <text x="60" y="12" fontSize="6" fill="#FFF" fontWeight="800" opacity="0.7" style={{ animation: 'echomojiParticleFloat 2s 0.3s infinite' }}>z</text>
          <text x="64" y="7" fontSize="4.5" fill="#FFF" fontWeight="800" opacity="0.5" style={{ animation: 'echomojiParticleFloat 2s 0.6s infinite' }}>z</text>
        </g>
      );
    }
    if (p === 'heart') {
      return (
        <g>
          <path d="M 56 10 C 56 6 60 6 60 10 C 60 14 56 16 56 18 C 56 16 52 14 52 10 C 52 6 56 6 56 10 Z" fill="#EC4899" style={{ animation: 'echomojiHeartFloat 2s infinite' }} />
          <path d="M 6 8 C 6 5 9 5 9 8 C 9 11 6 12.5 6 14 C 6 12.5 3 11 3 8 C 3 5 6 5 6 8 Z" fill="#EC4899" opacity="0.8" style={{ animation: 'echomojiHeartFloat 2s 0.7s infinite' }} />
        </g>
      );
    }
    if (p === 'sparkle') {
      return (
        <g>
          <path d="M 58 8 L 59.5 12 L 63 13 L 59.5 14 L 58 18 L 56.5 14 L 53 13 L 56.5 12 Z" fill="#FDE047" style={{ animation: 'echomojiParticleFloat 1.5s infinite' }} />
          <path d="M 6 10 L 7 13 L 10 14 L 7 15 L 6 18 L 5 15 L 2 14 L 5 13 Z" fill="#FDE047" opacity="0.8" style={{ animation: 'echomojiParticleFloat 1.5s 0.5s infinite' }} />
        </g>
      );
    }
    if (p === 'tear') {
      return (
        <g>
          <ellipse cx="19" cy="44" rx="1.8" ry="3" fill="#4A90E2" style={{ animation: 'echomojiTearDrop 1.6s infinite' }} />
          <ellipse cx="45" cy="44" rx="1.8" ry="3" fill="#4A90E2" style={{ animation: 'echomojiTearDrop 1.6s 0.6s infinite' }} />
        </g>
      );
    }
    if (p === 'anger') {
      return (
        <g>
          <path d="M 10 12 L 12 8 L 14 12" stroke="#EF4444" strokeWidth="2" fill="none" strokeLinecap="round" style={{ animation: 'echomojiParticleFloat 0.8s infinite' }} />
          <path d="M 54 12 L 56 8 L 58 12" stroke="#EF4444" strokeWidth="2" fill="none" strokeLinecap="round" style={{ animation: 'echomojiParticleFloat 0.8s 0.3s infinite' }} />
        </g>
      );
    }
    if (p === 'shock') {
      return (
        <g stroke="#FDE047" strokeWidth="2" strokeLinecap="round">
          <line x1="8" y1="10" x2="10" y2="13" />
          <line x1="56" y1="10" x2="54" y2="13" />
          <line x1="4" y1="26" x2="8" y2="26" />
          <line x1="60" y1="26" x2="56" y2="26" />
        </g>
      );
    }
    return null;
  };

  const renderCheeks = () => {
    if (!expr.cheeks) return null;
    return (
      <g opacity="0.55">
        <ellipse cx="15" cy="46" rx="4.5" ry="2.5" fill={theme.blush || '#F5A8A0'} />
        <ellipse cx="49" cy="46" rx="4.5" ry="2.5" fill={theme.blush || '#F5A8A0'} />
      </g>
    );
  };

  return (
    <div
      className="echomoji"
      style={baseStyle}
      onMouseEnter={() => interactive && setIsHovered(true)}
      onMouseLeave={() => interactive && setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
    >
      {animated && animation === 'idle' && (
        <React.Fragment>
          <div style={ringStyle(0, 1.2, 4, 0.4)} />
          <div style={ringStyle(0.5, 1.4, 3, 0.28)} />
          <div style={ringStyle(1.0, 1.6, 2, 0.18)} />
        </React.Fragment>
      )}

      {ripples.map((r) => (
        <div
          key={r.id}
          style={{
            position: 'absolute',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.glowColor}40, transparent)`,
            width: size * 0.5,
            height: size * 0.5,
            left: r.x - size * 0.25,
            top: r.y - size * 0.25,
            pointerEvents: 'none',
            animation: 'echoRingPulse 0.8s ease-out forwards',
          }}
        />
      ))}

      <svg
        viewBox="0 0 64 88"
        style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}
      >
        <defs>
          <radialGradient id={`faceGradient-${mood}-${activeHairId}`} cx="35%" cy="28%" r="75%">
            <stop offset="0%" stopColor={theme.skinLight} />
            <stop offset="55%" stopColor={theme.skinBase} />
            <stop offset="100%" stopColor={theme.skinShadow} />
          </radialGradient>
          <linearGradient id={`outfitGradient-${mood}-${outfitId || 'default'}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={finalOutfit} />
            <stop offset="100%" stopColor={finalOutfitShadow} />
          </linearGradient>
          <linearGradient id={`hairGradient-${activeHairId}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={theme.hair} stopOpacity="1" />
            <stop offset="100%" stopColor={theme.hair} stopOpacity="0.75" />
          </linearGradient>
          <radialGradient id="irisShade" cx="50%" cy="35%" r="50%">
            <stop offset="0%" stopColor="#FFF" stopOpacity="0.3" />
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
          </radialGradient>
          <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
            <feOffset dx="0" dy="2" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.35" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Hair Back Layer */}
        {activeHair.back && <path d={activeHair.back} fill={`url(#hairGradient-${activeHairId})`} />}

        {/* Arms */}
        <path d={arms.left} fill={theme.skinBase} />
        <ellipse cx="12" cy="77" rx="3" ry="3.2" fill={theme.skinLight} />
        <path d={arms.right} fill={theme.skinBase} />
        <ellipse cx="44" cy="77" rx="3" ry="3.2" fill={theme.skinLight} />

        {/* Torso / Shirt */}
        <path d="M 20 60 Q 32 56 44 60 L 46 80 Q 32 83 18 80 Z" fill={`url(#outfitGradient-${mood}-${outfitId || 'default'})`} filter="url(#softShadow)" />
        {/* Collar */}
        <path d="M 22 60 Q 32 66 42 60" stroke={theme.skinShadow} strokeWidth="1.2" fill="none" opacity="0.5" />
        {/* Sleeve shadow */}
        <path d="M 20 62 Q 22 68 24 72" stroke={finalOutfitShadow} strokeWidth="1.5" fill="none" opacity="0.35" />
        <path d="M 44 62 Q 42 68 40 72" stroke={finalOutfitShadow} strokeWidth="1.5" fill="none" opacity="0.35" />

        {/* Legs */}
        <path d="M 22 80 L 22 86 L 28 86 L 28 80 Z" fill={finalOutfitShadow} />
        <path d="M 36 80 L 36 86 L 42 86 L 42 80 Z" fill={finalOutfitShadow} />
        <rect x="20" y="85" width="10" height="3" rx="1.5" fill="#1A1A1A" />
        <rect x="34" y="85" width="10" height="3" rx="1.5" fill="#1A1A1A" />

        {/* Neck */}
        <path d="M 26 54 L 26 62 Q 32 64 38 62 L 38 54 Z" fill={theme.skinShadow} />

        {/* Head (Bitmoji-style, slightly rounded square) */}
        <path
          d="M 8 26 Q 8 6 32 4 Q 56 6 56 26 L 56 46 Q 56 62 32 64 Q 8 62 8 46 Z"
          fill={`url(#faceGradient-${mood}-${activeHairId})`}
          filter="url(#softShadow)"
        />

        {/* Ears */}
        <ellipse cx="6" cy="40" rx="3" ry="4" fill={theme.skinBase} />
        <ellipse cx="6" cy="40" rx="1.8" ry="2.5" fill={theme.skinShadow} opacity="0.5" />
        <ellipse cx="58" cy="40" rx="3" ry="4" fill={theme.skinBase} />
        <ellipse cx="58" cy="40" rx="1.8" ry="2.5" fill={theme.skinShadow} opacity="0.5" />

        {/* Face highlights */}
        <ellipse cx="20" cy="22" rx="6" ry="4" fill="#FFF" opacity="0.18" />
        <ellipse cx="44" cy="22" rx="6" ry="4" fill="#FFF" opacity="0.12" />

        {/* Forehead shine */}
        <ellipse cx="32" cy="12" rx="10" ry="3" fill="#FFF" opacity="0.15" />

        {/* Hair Front Layer */}
        {activeHair.front && <path d={activeHair.front} fill={`url(#hairGradient-${activeHairId})`} filter="url(#softShadow)" />}

        {/* Cheeks */}
        {renderCheeks()}

        {/* Eyes */}
        {renderEyes()}

        {/* Eyebrows */}
        <g
          stroke={theme.hair}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        >
          <path d={activeEyebrow ? activeEyebrow.left : expr.eyebrowLeft} />
          <path d={activeEyebrow ? activeEyebrow.right : expr.eyebrowRight} />
        </g>

        {/* Mouth */}
        {expr.mouth.includes('Q') && (mood === 'happy' || mood === 'excited' || mood === 'love') ? (
          <React.Fragment>
            <path d={finalMouth} fill="#4A0E0E" />
            <path d="M 24 38 Q 32 40 40 38" stroke="#FFF" strokeWidth="1" fill="none" opacity="0.7" />
            <path d={finalMouth} stroke="#3A0A0A" strokeWidth="0.8" fill="none" />
          </React.Fragment>
        ) : mood === 'shocked' ? (
          <React.Fragment>
            <path d={finalMouth} fill="#4A0E0E" />
            <ellipse cx="32" cy="42" rx="3" ry="2" fill="#E74C3C" opacity="0.7" />
          </React.Fragment>
        ) : (
          <path d={finalMouth} stroke="#5A2818" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        )}

        {/* Nose (subtle) */}
        <path d="M 32 32 Q 33 36 31 38" stroke={theme.skinShadow} strokeWidth="1.2" fill="none" opacity="0.45" strokeLinecap="round" />
        <ellipse cx="31.5" cy="37.5" rx="1.2" ry="0.6" fill={theme.skinShadow} opacity="0.35" />

        {/* Particles */}
        {renderParticles()}
      </svg>

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
            zIndex: 3,
          }}
        >
          ✦
        </div>
      )}
    </div>
  );
};

export default React.memo(ECHOMOJI);
