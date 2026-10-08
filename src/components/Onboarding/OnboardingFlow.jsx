// src/components/Onboarding/OnboardingFlow.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ECHOMOJI from '../UI/ECHOMOJI';
import { hapticLight, hapticSuccess } from '../../utils/haptics';
import './OnboardingFlow.css';

const SLIDES = [
  {
    id: 'welcome',
    title: 'Welcome to ECHO',
    subtitle: 'A new way to connect with the people who matter.',
    emoji: null,
    cta: 'Get Started',
  },
  {
    id: 'avatar',
    title: 'Create your ECHOMOJI',
    subtitle: 'Your unique avatar. Customize it however you like.',
    emoji: { mood: 'happy', hairStyle: 'shortHairShortFlat' },
    cta: 'Next',
  },
  {
    id: 'notify',
    title: 'Never miss a beat',
    subtitle: 'Turn on notifications to know when someone reaches out.',
    emoji: { mood: 'excited', hairStyle: 'shortHairShortFlat' },
    cta: 'Next',
  },
  {
    id: 'done',
    title: "You're in!",
    subtitle: 'Your ECHO is ready. Start connecting with the world.',
    emoji: { mood: 'love', hairStyle: 'shortHairShortFlat' },
    cta: 'Open ECHO',
  },
];

const OnboardingFlow = ({ onComplete, onCustomizeAvatar }) => {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const goNext = () => {
    hapticLight();
    if (isLast) {
      hapticSuccess();
      onComplete?.();
      return;
    }
    // Special: slide 2 → jump into customizer
    if (slide.id === 'avatar' && onCustomizeAvatar) {
      onCustomizeAvatar();
      // Don't advance — user may come back
    }
    setTransitioning(true);
    setTimeout(() => {
      setIndex((i) => Math.min(i + 1, SLIDES.length - 1));
      setTransitioning(false);
    }, 180);
  };

  const skip = () => {
    hapticLight();
    onComplete?.();
  };

  return (
    <div className="onboarding-root">
      {/* Skip button */}
      <button type="button" className="onboarding-skip" onClick={skip}>
        Skip
      </button>

      {/* Ambient background glow */}
      <div className="onboarding-glow" aria-hidden="true" />

      {/* Content */}
      <div className={`onboarding-content ${transitioning ? 'fading' : ''}`}>
        {/* Visual */}
        <div className="onboarding-visual">
          {slide.emoji ? (
            <ECHOMOJI
              mood={slide.emoji.mood}
              hairStyle={slide.emoji.hairStyle}
              size={160}
              interactive={false}
              animated={true}
              animation="idle"
            />
          ) : (
            <div className="onboarding-logo">
              <span className="onboarding-logo-echo">ECHO</span>
              <div className="onboarding-logo-ring" />
              <div className="onboarding-logo-ring delay-1" />
              <div className="onboarding-logo-ring delay-2" />
            </div>
          )}
        </div>

        {/* Text */}
        <h1 className="onboarding-title">{slide.title}</h1>
        <p className="onboarding-subtitle">{slide.subtitle}</p>
      </div>

      {/* Footer: dots + CTA */}
      <div className="onboarding-footer">
        <div className="onboarding-dots">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`onboarding-dot ${i === index ? 'active' : ''}`}
            />
          ))}
        </div>

        <button
          type="button"
          className="onboarding-cta"
          onClick={goNext}
        >
          {slide.cta}
        </button>
      </div>
    </div>
  );
};

export default OnboardingFlow;
