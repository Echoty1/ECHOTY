// src/components/UI/ECHOMOJI.js
import React, { useState, useEffect } from 'react';
import { EXPRESSIONS, MOOD_THEMES, HAIR_STYLES } from '../../constants/echomoji';

const ECHOMOJI = ({
  mood = 'neutral',
  expression,
  size = 48,
  pulse = false,
  interactive = true,
  animated = true,
  skin = null,
  hairStyle = null, // NEW: Allows overriding hair style
  onMoodChange = null,
  onDoubleClick = null,
}) => {
  const [isPulsing, setIsPulsing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState([]);

  const theme = skin || MOOD_THEMES[mood] || MOOD_THEMES.neutral;
  const expr = EXPRESSIONS[expression || mood] || EXPRESSIONS.neutral;
  
  // Determine which hair to use
  const activeHairId = hairStyle || theme.defaultHair || 'short';
  const activeHair = HAIR_STYLES.find(h => h.id === activeHairId) || HAIR_STYLES[0];

  useEffect(() => {
    if (pulse) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 700);
      return () => clearTimeout(timer);
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
    height: size * (72/48),
    position: 'relative',
    cursor: interactive ? 'pointer' : 'default',
    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.3s ease',
    transform: isPulsing ? 'scale(1.15)' : isHovered ? 'scale(1.08)' : 'scale(1)',
    filter: isHovered 
      ? `drop-shadow(0 15px 20px ${theme.glowColor}60)` 
      : `drop-shadow(0 8px 12px rgba(0,0,0,0.3))`,
    animation: animated && !isHovered ? 'echoBounce 3s ease-in-out infinite' : 'none',
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

  // Dynamic Arm Poses based on Mood
  const getArmPaths = () => {
    if (mood === 'sad' || mood === 'cry') {
      return {
        left: "M 12 50 Q 8 56 10 64 Q 12 66 14 64 Q 12 58 16 52 Z",
        right: "M 36 50 Q 40 56 38 64 Q 36 66 34 64 Q 36 58 32 52 Z"
      };
    }
    if (mood === 'happy' || mood === 'excited') {
      return {
        left: "M 12 50 Q 6 46 8 40 Q 10 38 12 40 Q 10 46 14 50 Z",
        right: "M 36 50 Q 42 46 40 40 Q 38 38 36 40 Q 38 46 34 50 Z"
      };
    }
    // Default neutral arms
    return {
      left: "M 12 50 Q 6 55 8 62 Q 10 65 12 62 Q 10 58 14 54 Z",
      right: "M 36 50 Q 42 55 40 62 Q 38 65 36 62 Q 38 58 34 54 Z"
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
      {animated && (
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

      {/* REALISTIC MINI-HUMAN SVG */}
      <svg viewBox="0 0 48 72" style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}>
        <defs>
          <radialGradient id={`faceGradient-${mood}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={theme.skinLight} />
            <stop offset="60%" stopColor={theme.skinBase} />
            <stop offset="100%" stopColor={theme.skinShadow} />
          </radialGradient>
          
          <linearGradient id={`outfitGradient-${mood}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.outfit} />
            <stop offset="100%" stopColor={theme.outfitShadow} />
          </linearGradient>

          <filter id="innerShadow">
            <feOffset dx="0" dy="2"/>
            <feGaussianBlur stdDeviation="3" result="offset-blur"/>
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
            <feFlood floodColor="black" floodOpacity="0.4" result="color"/>
            <feComposite operator="in" in="color" in2="inverse" result="shadow"/>
            <feComposite operator="over" in="shadow" in2="SourceGraphic"/>
          </filter>
        </defs>

        {/* --- BODY & LIMBS --- */}
        
        {/* Left Arm */}
        <path d={arms.left} fill={theme.skinBase} />
        <circle cx={mood === 'happy' || mood === 'excited' ? 9 : 10} cy={mood === 'happy' || mood === 'excited' ? 39 : 63} r="2.5" fill={theme.skinLight} />
        
        {/* Right Arm */}
        <path d={arms.right} fill={theme.skinBase} />
        <circle cx={mood === 'happy' || mood === 'excited' ? 39 : 38} cy={mood === 'happy' || mood === 'excited' ? 39 : 63} r="2.5" fill={theme.skinLight} />

        {/* Torso */}
        <path d="M 14 48 Q 24 46 34 48 L 34 62 Q 24 64 14 62 Z" fill={`url(#outfitGradient-${mood})`} />
        <path d="M 20 48 Q 24 52 28 48" stroke={theme.skinShadow} strokeWidth="1" fill="none" opacity="0.6" />

        {/* Left Leg */}
        <path d="M 15 62 Q 14 68 15 72 L 21 72 Q 22 68 21 62 Z" fill={theme.outfitShadow} />
        <rect x="12" y="71" width="10" height="3" rx="1.5" fill="#1A1A1A" />
        
        {/* Right Leg */}
        <path d="M 27 62 Q 26 68 27 72 L 33 72 Q 34 68 33 62 Z" fill={theme.outfitShadow} />
        <rect x="26" y="71" width="10" height="3" rx="1.5" fill="#1A1A1A" />

        {/* --- HEAD --- */}
        
        {/* Neck */}
        <rect x="20" y="44" width="8" height="6" rx="2" fill={theme.skinShadow} />

        {/* Head Shape */}
        <rect 
          x="4" y="2" width="40" height="44" rx="20" ry="22" 
          fill={`url(#faceGradient-${mood})`} 
          filter="url(#innerShadow)"
        />

        {/* Dynamic Hair */}
        {activeHair.path && (
          <path d={activeHair.path} fill={theme.hair} />
        )}

        {/* Cheek Highlights */}
        <ellipse cx="12" cy="34" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.15" />
        <ellipse cx="36" cy="34" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.15" />

        {/* Eyes */}
        <g>
          <path d={expr.leftEye} fill={theme.skinShadow} />
          <circle cx="14" cy="21" r="1.5" fill="#FFFFFF" opacity="0.9" />
          
          <path d={expr.rightEye} fill={theme.skinShadow} />
          <circle cx="34" cy="21" r="1.5" fill="#FFFFFF" opacity="0.9" />
        </g>

        {/* Eyebrows */}
        <g stroke={theme.skinShadow} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.8">
          <path d={expr.eyebrowLeft} />
          <path d={expr.eyebrowRight} />
        </g>

        {/* Mouth with Interior for Happy */}
        {mood === 'happy' || mood === 'excited' ? (
          <>
            {/* Mouth Interior */}
            <path d={expr.mouth} fill="#4A0E0E" stroke="none" />
            {/* Teeth */}
            <path d="M 17 31 L 31 31 L 31 33 L 17 33 Z" fill="#FFFFFF" opacity="0.9" />
            {/* Tongue */}
            <ellipse cx="24" cy="35" rx="4" ry="2" fill="#E74C3C" opacity="0.7" />
            {/* Mouth Outline */}
            <path d={expr.mouth} stroke={theme.skinShadow} strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <path
            d={expr.mouth}
            stroke={theme.skinShadow}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Nose Shadow */}
        <path d="M 24 24 L 24 30 Q 24 31 25 31" stroke={theme.skinShadow} strokeWidth="1.5" fill="none" opacity="0.4" />
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
            zIndex: 3
          }}
        >
          ✦
        </div>
      )}
    </div>
  );
};

export default React.memo(ECHOMOJI);
