// src/components/UI/ECHOMOJI.js
import React, { useState, useEffect } from 'react';
import {
  EXPRESSIONS, MOOD_THEMES, HAIR_STYLES, OUTFITS,
  EYE_COLORS, EYEBROW_STYLES, MOUTH_STYLES
} from '../../constants/echomoji';

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
  const [ripples, setRipples] = useState([]);

  const theme = skin || MOOD_THEMES[mood] || MOOD_THEMES.neutral;
  const expr = EXPRESSIONS[expression || mood] || EXPRESSIONS.neutral;

  const activeHairId = hairStyle || theme.defaultHair || 'short';
  const activeHair = HAIR_STYLES.find(h => h.id === activeHairId) || HAIR_STYLES[0];

  const activeOutfit = outfitId ? OUTFITS.find(o => o.id === outfitId) : null;
  const finalOutfit = activeOutfit?.color ? activeOutfit.color : theme.outfit;
  const finalOutfitShadow = activeOutfit?.shadow ? activeOutfit.shadow : theme.outfitShadow;

  const activeEyeColor = eyeColorId ? EYE_COLORS.find(e => e.id === eyeColorId)?.color : null;
  const finalEyeColor = activeEyeColor || theme.skinShadow;

  const activeEyebrow = eyebrowStyleId ? EYEBROW_STYLES.find(e => e.id === eyebrowStyleId) : null;

  const activeMouth = mouthStyleId ? MOUTH_STYLES.find(m => m.id === mouthStyleId) : null;
  const finalMouth = activeMouth?.path || expr.mouth;

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
    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s ease',
    transform: isPulsing ? 'scale(1.15)' : isHovered ? 'scale(1.08)' : 'scale(1)',
    filter: isHovered
      ? `drop-shadow(0 15px 20px ${theme.glowColor}60)`
      : `drop-shadow(0 8px 12px rgba(0,0,0,0.3))`,
    animation: animated && animation !== 'none' ? `echomoji-${animation} 2s ease-in-out infinite` : 'none',
  };

  const ringStyle = (delay = 0, scale = 1.2, borderWidth = 3, opacity = 0.4) => ({
    position: 'absolute',
    borderRadius: '50%',
    border: `${borderWidth}px solid ${theme.glowColor}`,
    opacity: opacity,
    pointerEvents: 'none',
    width: size * scale,
    height: size * scale,
    top: (size * (1 - scale)) / 2,
    left: (size * (1 - scale)) / 2,
    animation: `echoRingPulse 3s ease-out infinite ${delay}s`,
    boxShadow: `0 0 20px ${theme.glowColor}60`,
    willChange: 'transform, opacity',
  });

  const getArmPaths = () => {
    if (animation === 'wave') {
      return {
        left: "M 12 50 Q 6 55 8 62 Q 10 65 12 62 Q 10 58 14 54 Z",
        right: "M 36 50 Q 42 42 40 34 Q 38 32 36 34 Q 38 42 34 50 Z",
      };
    }
    if (animation === 'cry' || mood === 'sad' || mood === 'cry') {
      return {
        left: "M 12 50 Q 8 44 12 40 Q 14 40 14 44 Q 12 46 14 50 Z",
        right: "M 36 50 Q 40 44 36 40 Q 34 40 34 44 Q 36 46 34 50 Z",
      };
    }
    if (animation === 'jump' || animation === 'dance' || mood === 'happy' || mood === 'excited') {
      return {
        left: "M 12 50 Q 6 46 8 40 Q 10 38 12 40 Q 10 46 14 50 Z",
        right: "M 36 50 Q 42 46 40 40 Q 38 38 36 40 Q 38 46 34 50 Z",
      };
    }
    return {
      left: "M 12 50 Q 6 55 8 62 Q 10 65 12 62 Q 10 58 14 54 Z",
      right: "M 36 50 Q 42 55 40 62 Q 38 65 36 62 Q 38 58 34 54 Z",
    };
  };

  const arms = getArmPaths();

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
        <>
          <div style={ringStyle(0, 1.2, 4, 0.5)} />
          <div style={ringStyle(0.5, 1.4, 3, 0.35)} />
          <div style={ringStyle(1.0, 1.6, 2, 0.25)} />
        </>
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

      <svg viewBox="0 0 48 72" style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}>
        <defs>
          <radialGradient id={`faceGradient-${mood}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={theme.skinLight} />
            <stop offset="60%" stopColor={theme.skinBase} />
            <stop offset="100%" stopColor={theme.skinShadow} />
          </radialGradient>

          <linearGradient id={`outfitGradient-${mood}-${outfitId || 'default'}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={finalOutfit} />
            <stop offset="100%" stopColor={finalOutfitShadow} />
          </linearGradient>

          <filter id="innerShadow">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="3" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.4" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* Arms */}
        <path d={arms.left} fill={theme.skinBase} />
        <circle
          cx={animation === 'wave' ? 38 : (animation === 'cry' || mood === 'sad' || mood === 'cry' ? 13 : 10)}
          cy={animation === 'wave' ? 33 : (animation === 'cry' || mood === 'sad' || mood === 'cry' ? 42 : 63)}
          r="2.5"
          fill={theme.skinLight}
        />

        <path d={arms.right} fill={theme.skinBase} />
        <circle
          cx={(animation === 'jump' || animation === 'dance' || mood === 'happy' || mood === 'excited') ? 39 : 38}
          cy={(animation === 'jump' || animation === 'dance' || mood === 'happy' || mood === 'excited') ? 39 : 63}
          r="2.5"
          fill={theme.skinLight}
        />

        {/* Torso */}
        <path d="M 14 48 Q 24 46 34 48 L 34 62 Q 24 64 14 62 Z" fill={`url(#outfitGradient-${mood}-${outfitId || 'default'})`} />
        <path d="M 20 48 Q 24 52 28 48" stroke={theme.skinShadow} strokeWidth="1" fill="none" opacity="0.6" />

        {/* Legs */}
        <path d="M 15 62 Q 14 68 15 72 L 21 72 Q 22 68 21 62 Z" fill={finalOutfitShadow} />
        <rect x="12" y="71" width="10" height="3" rx="1.5" fill="#1A1A1A" />
        <path d="M 27 62 Q 26 68 27 72 L 33 72 Q 34 68 33 62 Z" fill={finalOutfitShadow} />
        <rect x="26" y="71" width="10" height="3" rx="1.5" fill="#1A1A1A" />

        {/* Neck */}
        <rect x="20" y="44" width="8" height="6" rx="2" fill={theme.skinShadow} />

        {/* Head */}
        <rect x="4" y="2" width="40" height="44" rx="20" ry="22" fill={`url(#faceGradient-${mood})`} filter="url(#innerShadow)" />

        {/* Hair */}
        {activeHair.path && <path d={activeHair.path} fill={theme.hair} />}

        {/* Cheek highlights */}
        <ellipse cx="12" cy="34" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.15" />
        <ellipse cx="36" cy="34" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.15" />

        {/* Eyes */}
        <g>
          <path d={expr.leftEye} fill={finalEyeColor} />
          <circle cx="14" cy="21" r="1.5" fill="#FFFFFF" opacity="0.9" />
          <path d={expr.rightEye} fill={finalEyeColor} />
          <circle cx="34" cy="21" r="1.5" fill="#FFFFFF" opacity="0.9" />
        </g>

        {/* Eyebrows */}
        <g stroke={theme.skinShadow} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.85">
          <path d={activeEyebrow?.left || expr.eyebrowLeft} />
          <path d={activeEyebrow?.right || expr.eyebrowRight} />
        </g>

        {/* Mouth */}
        {mood === 'happy' || mood === 'excited' ? (
          <>
            <path d={finalMouth} fill="#4A0E0E" stroke="none" />
            <path d="M 17 31 L 31 31 L 31 33 L 17 33 Z" fill="#FFFFFF" opacity="0.9" />
            <ellipse cx="24" cy="35" rx="4" ry="2" fill="#E74C3C" opacity="0.7" />
            <path d={finalMouth} stroke={theme.skinShadow} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <path d={finalMouth} stroke={theme.skinShadow} strokeWidth="2" strokeLinecap="round" fill="none" />
        )}

        {/* Nose */}
        <path d="M 24 24 L 24 30 Q 24 31 25 31" stroke={theme.skinShadow} strokeWidth="1.5" fill="none" opacity="0.4" />

        {/* Tears */}
        {(animation === 'cry' || mood === 'cry') && (
          <>
            <ellipse cx="13" cy="28" rx="1.5" ry="2.5" fill="#4A90E2" opacity="0.8" />
            <ellipse cx="35" cy="28" rx="1.5" ry="2.5" fill="#4A90E2" opacity="0.8" />
          </>
        )}
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
