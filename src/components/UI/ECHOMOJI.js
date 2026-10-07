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

  const activeEyeColorObj = eyeColorId ? EYE_COLORS.find((e) => e.id === eyeColorId) : null;
  const finalEyeColor = activeEyeColorObj ? activeEyeColorObj.color : theme.skinShadow;

  const activeEyebrow = eyebrowStyleId
    ? EYEBROW_STYLES.find((e) => e.id === eyebrowStyleId)
    : null;

  const activeMouth = mouthStyleId ? MOUTH_STYLES.find((m) => m.id === mouthStyleId) : null;
  const finalMouth = activeMouth ? activeMouth.path : expr.mouth;

  // Blink loop — natural eye-blink every 3-5 seconds
  useEffect(() => {
    if (!animated || !interactive) return;
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 2500;
      blinkTimer.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
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
        ? `echomoji-${animation} 2s ease-in-out infinite`
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

  const getArmPaths = () => {
    if (animation === 'wave') {
      return {
        left: 'M 12 50 Q 6 55 8 62 Q 10 65 12 62 Q 10 58 14 54 Z',
        right: 'M 36 50 Q 42 42 40 34 Q 38 32 36 34 Q 38 42 34 50 Z',
      };
    }
    if (animation === 'cry' || mood === 'sad' || mood === 'cry') {
      return {
        left: 'M 12 50 Q 8 44 12 40 Q 14 40 14 44 Q 12 46 14 50 Z',
        right: 'M 36 50 Q 40 44 36 40 Q 34 40 34 44 Q 36 46 34 50 Z',
      };
    }
    if (
      animation === 'jump' ||
      animation === 'dance' ||
      mood === 'happy' ||
      mood === 'excited'
    ) {
      return {
        left: 'M 12 50 Q 6 46 8 40 Q 10 38 12 40 Q 10 46 14 50 Z',
        right: 'M 36 50 Q 42 46 40 40 Q 38 38 36 40 Q 38 46 34 50 Z',
      };
    }
    return {
      left: 'M 12 50 Q 6 55 8 62 Q 10 65 12 62 Q 10 58 14 54 Z',
      right: 'M 36 50 Q 42 55 40 62 Q 38 65 36 62 Q 38 58 34 54 Z',
    };
  };

  const arms = getArmPaths();

  // Render eye based on style, with blink override
  const renderEyes = () => {
    // Blinking overrides normal eye display
    if (isBlinking) {
      return (
        <g>
          <line x1="12" y1="20" x2="20" y2="20" stroke={finalEyeColor} strokeWidth="2" strokeLinecap="round" />
          <line x1="28" y1="20" x2="36" y2="20" stroke={finalEyeColor} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    }

    // Heart eyes
    if (expr.eyeStyle === 'heart') {
      return (
        <g>
          <path d={expr.leftEye} fill="#EC4899" />
          <path d={expr.rightEye} fill="#EC4899" />
        </g>
      );
    }

    // Cool — sunglasses
    if (expr.eyeStyle === 'cool') {
      return (
        <g>
          <rect x="9" y="16" width="13" height="8" rx="3" fill="#1A1A1A" />
          <rect x="26" y="16" width="13" height="8" rx="3" fill="#1A1A1A" />
          <rect x="20" y="19" width="8" height="2" fill="#1A1A1A" />
          <path d="M 10 17 L 12 16 L 14 18" stroke="#FFF" strokeWidth="1" fill="none" opacity="0.5" />
        </g>
      );
    }

    // Wide eyes (shocked)
    if (expr.eyeStyle === 'wide') {
      return (
        <g>
          <circle cx="16" cy="20" r="4" fill="#FFF" stroke={finalEyeColor} strokeWidth="1.2" />
          <circle cx="16" cy="20" r="2" fill={finalEyeColor} />
          <circle cx="32" cy="20" r="4" fill="#FFF" stroke={finalEyeColor} strokeWidth="1.2" />
          <circle cx="32" cy="20" r="2" fill={finalEyeColor} />
        </g>
      );
    }

    // Closed eyes (sleepy / excited)
    if (expr.eyeStyle === 'closed') {
      return (
        <g>
          <path d="M 12 20 Q 16 17 20 20" stroke={finalEyeColor} strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M 28 20 Q 32 17 36 20" stroke={finalEyeColor} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      );
    }

    // Happy — curved up eyes
    if (expr.eyeStyle === 'happy') {
      return (
        <g>
          <path d="M 12 21 Q 16 16 20 21" stroke={finalEyeColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M 28 21 Q 32 16 36 21" stroke={finalEyeColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>
      );
    }

    // Angry — narrow eyes
    if (expr.eyeStyle === 'angry') {
      return (
        <g>
          <path d="M 12 20 L 20 22 L 12 22 Z" fill={finalEyeColor} />
          <path d="M 28 22 L 36 20 L 36 22 Z" fill={finalEyeColor} />
        </g>
      );
    }

    // Default — open eyes
    return (
      <g>
        <path d={expr.leftEye} fill={finalEyeColor} />
        <circle cx="14" cy="21" r="1.5" fill="#FFFFFF" opacity="0.9" />
        <path d={expr.rightEye} fill={finalEyeColor} />
        <circle cx="34" cy="21" r="1.5" fill="#FFFFFF" opacity="0.9" />
      </g>
    );
  };

  // Particles per mood
  const renderParticles = () => {
    if (!expr.particles || !animated) return null;
    const p = expr.particles;

    if (p === 'zzz') {
      return (
        <g opacity="0.85">
          <text x="38" y="14" fontSize="6" fill="#FFF" fontWeight="700" opacity="0.9">Z</text>
          <text x="42" y="10" fontSize="5" fill="#FFF" fontWeight="700" opacity="0.7">z</text>
          <text x="45" y="7" fontSize="4" fill="#FFF" fontWeight="700" opacity="0.5">z</text>
        </g>
      );
    }
    if (p === 'heart') {
      return (
        <g>
          <path d="M 40 8 C 40 6 42 6 42 8 C 42 10 40 11 40 12 C 40 11 38 10 38 8 C 38 6 40 6 40 8 Z" fill="#EC4899" opacity="0.9">
            <animateTransform attributeName="transform" type="translate" values="0,0; 0,-3; 0,0" dur="1.5s" repeatCount="indefinite" />
          </path>
          <path d="M 7 5 C 7 3.5 8.5 3.5 8.5 5 C 8.5 6.5 7 7 7 8 C 7 7 5.5 6.5 5.5 5 C 5.5 3.5 7 3.5 7 5 Z" fill="#EC4899" opacity="0.7">
            <animateTransform attributeName="transform" type="translate" values="0,0; 0,-2; 0,0" dur="2s" repeatCount="indefinite" />
          </path>
        </g>
      );
    }
    if (p === 'sparkle') {
      return (
        <g>
          <path d="M 40 6 L 41 9 L 44 10 L 41 11 L 40 14 L 39 11 L 36 10 L 39 9 Z" fill="#FDE047" opacity="0.9">
            <animateTransform attributeName="transform" type="scale" values="1;1.3;1" dur="1.2s" repeatCount="indefinite" additive="sum" />
          </path>
          <path d="M 6 8 L 7 10 L 9 11 L 7 12 L 6 14 L 5 12 L 3 11 L 5 10 Z" fill="#FDE047" opacity="0.7">
            <animateTransform attributeName="transform" type="scale" values="1;1.3;1" dur="1.5s" repeatCount="indefinite" additive="sum" />
          </path>
        </g>
      );
    }
    if (p === 'tear') {
      return (
        <g>
          <ellipse cx="13" cy="26" rx="1.5" ry="2.5" fill="#4A90E2" opacity="0.85">
            <animate attributeName="cy" values="26;34;40" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0.6;0" dur="1.8s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="35" cy="26" rx="1.5" ry="2.5" fill="#4A90E2" opacity="0.85">
            <animate attributeName="cy" values="26;34;40" dur="1.8s" begin="0.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0.6;0" dur="1.8s" begin="0.4s" repeatCount="indefinite" />
          </ellipse>
        </g>
      );
    }
    if (p === 'anger') {
      return (
        <g>
          <circle cx="10" cy="10" r="1.5" fill="#EF4444" opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="40" cy="10" r="1.5" fill="#EF4444" opacity="0.9">
            <animate attributeName="opacity" values="0.9;0.3;0.9" dur="0.6s" begin="0.3s" repeatCount="indefinite" />
          </circle>
        </g>
      );
    }
    if (p === 'shock') {
      return (
        <g>
          <line x1="6" y1="6" x2="8" y2="8" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="42" y1="6" x2="40" y2="8" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4" y1="20" x2="7" y2="20" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="44" y1="20" x2="41" y2="20" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    }
    return null;
  };

  // Cheek blush
  const renderCheeks = () => {
    if (!expr.cheeks) return null;
    return (
      <g opacity="0.55">
        <ellipse cx="11" cy="30" rx="3.5" ry="2" fill="#FF8FA3" />
        <ellipse cx="37" cy="30" rx="3.5" ry="2" fill="#FF8FA3" />
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

      <svg
        viewBox="0 0 48 72"
        style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}
      >
        <defs>
          <radialGradient id={`faceGradient-${mood}-${activeHairId}`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor={theme.skinLight} />
            <stop offset="60%" stopColor={theme.skinBase} />
            <stop offset="100%" stopColor={theme.skinShadow} />
          </radialGradient>

          <linearGradient
            id={`outfitGradient-${mood}-${outfitId || 'default'}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
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
          cx={
            animation === 'wave'
              ? 38
              : animation === 'cry' || mood === 'sad' || mood === 'cry'
              ? 13
              : 10
          }
          cy={
            animation === 'wave'
              ? 33
              : animation === 'cry' || mood === 'sad' || mood === 'cry'
              ? 42
              : 63
          }
          r="2.5"
          fill={theme.skinLight}
        />

        <path d={arms.right} fill={theme.skinBase} />
        <circle
          cx={
            animation === 'jump' ||
            animation === 'dance' ||
            mood === 'happy' ||
            mood === 'excited'
              ? 39
              : 38
          }
          cy={
            animation === 'jump' ||
            animation === 'dance' ||
            mood === 'happy' ||
            mood === 'excited'
              ? 39
              : 63
          }
          r="2.5"
          fill={theme.skinLight}
        />

        {/* Torso */}
        <path
          d="M 14 48 Q 24 46 34 48 L 34 62 Q 24 64 14 62 Z"
          fill={`url(#outfitGradient-${mood}-${outfitId || 'default'})`}
        />
        <path
          d="M 20 48 Q 24 52 28 48"
          stroke={theme.skinShadow}
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />

        {/* Legs */}
        <path d="M 15 62 Q 14 68 15 72 L 21 72 Q 22 68 21 62 Z" fill={finalOutfitShadow} />
        <rect x="12" y="71" width="10" height="3" rx="1.5" fill="#1A1A1A" />
        <path d="M 27 62 Q 26 68 27 72 L 33 72 Q 34 68 33 62 Z" fill={finalOutfitShadow} />
        <rect x="26" y="71" width="10" height="3" rx="1.5" fill="#1A1A1A" />

        {/* Neck */}
        <rect x="20" y="44" width="8" height="6" rx="2" fill={theme.skinShadow} />

        {/* Head */}
        <rect
          x="4"
          y="2"
          width="40"
          height="44"
          rx="20"
          ry="22"
          fill={`url(#faceGradient-${mood}-${activeHairId})`}
          filter="url(#innerShadow)"
        />

        {/* Hair */}
        {activeHair.path && <path d={activeHair.path} fill={theme.hair} />}

        {/* Cheek highlights */}
        <ellipse cx="12" cy="34" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.15" />
        <ellipse cx="36" cy="34" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.15" />

        {/* Cheek blush */}
        {renderCheeks()}

        {/* Eyes */}
        {renderEyes()}

        {/* Eyebrows */}
        <g
          stroke={theme.skinShadow}
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        >
          <path d={activeEyebrow ? activeEyebrow.left : expr.eyebrowLeft} />
          <path d={activeEyebrow ? activeEyebrow.right : expr.eyebrowRight} />
        </g>

        {/* Mouth */}
        {mood === 'happy' || mood === 'excited' ? (
          <>
            <path d={finalMouth} fill="#4A0E0E" stroke="none" />
            <path d="M 17 31 L 31 31 L 31 33 L 17 33 Z" fill="#FFFFFF" opacity="0.9" />
            <ellipse cx="24" cy="35" rx="4" ry="2" fill="#E74C3C" opacity="0.7" />
            <path
              d={finalMouth}
              stroke={theme.skinShadow}
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          <path
            d={finalMouth}
            stroke={theme.skinShadow}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Nose */}
        <path
          d="M 24 24 L 24 30 Q 24 31 25 31"
          stroke={theme.skinShadow}
          strokeWidth="1.5"
          fill="none"
          opacity="0.4"
        />

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
