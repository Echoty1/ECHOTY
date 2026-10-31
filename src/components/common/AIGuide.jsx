// src/components/common/AIGuide.jsx
import React, { useState, useEffect, useRef } from 'react';

const AIGuide = ({ run, onComplete }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState(false);
  
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  
  const cursorRef = useRef(null);
  const bubbleRef = useRef(null);
  const pos = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const target = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const velocity = useRef({ x: 0, y: 0 });
  const animFrame = useRef(null);

  // ── 0. Check if returning user ──
  useEffect(() => {
    if (run) {
      const hasToured = localStorage.getItem('echo_ai_tour_completed');
      setIsReturningUser(!!hasToured);
      setIsVisible(true);
    } else {
      setIsVisible(false);
      window.speechSynthesis.cancel();
    }
    return () => window.speechSynthesis.cancel();
  }, [run]);

  // ── 1. iOS 27 Fluid Spring Physics ──
  useEffect(() => {
    let lastTime = performance.now();
    const updatePhysics = (time) => {
      const dt = Math.min(32, time - lastTime) / 16.67;
      lastTime = time;

      const dx = target.current.x - pos.current.x;
      const dy = target.current.y - pos.current.y;

      velocity.current.x = (velocity.current.x + dx * 0.06) * 0.75;
      velocity.current.y = (velocity.current.y + dy * 0.06) * 0.75;

      pos.current.x += velocity.current.x * dt;
      pos.current.y += velocity.current.y * dt;

      if (cursorRef.current && bubbleRef.current) {
        cursorRef.current.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0) translate(-50%, -50%) scale(${isClicking ? 0.85 : 1})`;
        bubbleRef.current.style.transform = `translate3d(${pos.current.x + 35}px, ${pos.current.y + 35}px, 0)`;
      }
      animFrame.current = requestAnimationFrame(updatePhysics);
    };
    animFrame.current = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animFrame.current);
  }, [isClicking]);

  // ── 2. Typewriter Effect ──
  const typeText = async (text) => {
    setIsTyping(true);
    setDisplayText('');
    for (let i = 0; i < text.length; i++) {
      setDisplayText((prev) => prev + text[i]);
      await new Promise(r => setTimeout(r, 25)); 
    }
    setIsTyping(false);
  };

  // ── 3. Voice Engine ──
  const speak = (text) => {
    return new Promise((resolve) => {
      const fallbackTimer = setTimeout(resolve, 6000);
      if (!('speechSynthesis' in window)) {
        clearTimeout(fallbackTimer);
        return resolve();
      }
      
      window.speechSynthesis.cancel();
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = voices.find(v => v.name.includes('Google US English')) || 
                        voices.find(v => v.name.includes('Samantha')) || 
                        voices.find(v => v.lang === 'en-US');

      const utterance = new SpeechSynthesisUtterance(text);
      if (bestVoice) utterance.voice = bestVoice;
      utterance.rate = 1.0; 
      utterance.pitch = 1.05;
      
      utterance.onend = () => {
        clearTimeout(fallbackTimer);
        setTimeout(resolve, 1000); 
      };
      utterance.onerror = () => {
        clearTimeout(fallbackTimer);
        resolve();
      };
      
      window.speechSynthesis.speak(utterance);
    });
  };

  // ── 4. Wait for Element (With Smart Timeout) ──
  const waitForElement = (selectorFn, timeout = 3000) => {
    return new Promise((resolve) => {
      let el = typeof selectorFn === 'function' ? selectorFn() : document.querySelector(selectorFn);
      if (el) return resolve(el);

      const start = Date.now();
      const interval = setInterval(() => {
        el = typeof selectorFn === 'function' ? selectorFn() : document.querySelector(selectorFn);
        if (el) {
          clearInterval(interval);
          resolve(el);
        } else if (Date.now() - start > timeout) {
          clearInterval(interval);
          resolve(null);
        }
      }, 200);
    });
  };

  const scrollToElement = async (el) => {
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(r => setTimeout(r, 600)); 
  };

  // ── 5. Execute a Step ──
  const executeStep = async (step) => {
    const el = await waitForElement(step.selector, 3000);

    if (el) {
      await scrollToElement(el);
      const rect = el.getBoundingClientRect();
      target.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    } else {
      target.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    await new Promise(r => setTimeout(r, 800)); 

    typeText(step.text);
    await speak(step.text);

    if (el && step.action) {
      setIsClicking(true);
      el.style.transition = 'box-shadow 0.3s';
      el.style.boxShadow = '0 0 0 4px #6C3CE1, 0 0 20px rgba(108, 60, 225, 0.6)';
      
      await step.action(el);
      
      setTimeout(() => { 
        setIsClicking(false); 
        el.style.boxShadow = 'none'; 
      }, 400);

      await new Promise(r => setTimeout(r, 1500)); 
    }
  };

  // ── 6. The Master Script ──
  const runTour = async () => {
    setHasStarted(true);
    await new Promise(r => setTimeout(r, 800)); 

    const forceClick = async (el) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      const eventOptions = { bubbles: true, cancelable: true, clientX: x, clientY: y };
      el.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
      el.dispatchEvent(new MouseEvent('mousedown', eventOptions));
      el.dispatchEvent(new PointerEvent('pointerup', eventOptions));
      el.dispatchEvent(new MouseEvent('mouseup', eventOptions));
      el.dispatchEvent(new MouseEvent('click', eventOptions));
    };

    const findNav = (text) => () => Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(text) && b.closest('.echo-v-nav'));
    const findBackBtn = () => () => document.querySelector('.chat-back-btn, .back-btn, button[aria-label="Go back"]') || Array.from(document.querySelectorAll('button')).find(b => b.innerHTML.includes('fa-arrow-left'));
    const findInput = (placeholder) => () => document.querySelector(`input[placeholder*="${placeholder}"], textarea[placeholder*="${placeholder}"], input[type="text"]`);

    const script = [
      // ── HOME ──
      { selector: '.home-container', text: "Welcome to ECHO! Let me give you a quick tour." },
      { 
        selector: '.go-live-btn', 
        text: "Here you can go live. I won't click it now, but you can tap it anytime.",
        action: async (el) => {
          el.style.transform = 'scale(1.05)';
          setTimeout(() => el.style.transform = 'scale(1)', 500);
        }
      },
      { selector: 'body', text: "Let's check your messages." },
      { 
        selector: findNav('Chats'), 
        text: "Opening your Chats...",
        action: forceClick
      },

      // ── CHATS ──
      { selector: '.chat-list', text: "This is your inbox." },
      { 
        selector: findInput('Search'), 
        text: "Let me click the search bar.", 
        action: forceClick
      },
      { 
        selector: findInput('Search'), 
        text: "I'm typing Malik now.", 
        action: async (el) => {
          el.focus();
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          nativeSetter.call(el, 'Malik');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      },
      { 
        selector: () => Array.from(document.querySelectorAll('div, a, button')).find(e => e.textContent.includes('Malik') && e.textContent.length < 30), 
        text: "There he is. Opening the chat...", 
        action: forceClick
      },
      
      // --- INSIDE CHAT ---
      { 
        selector: () => document.querySelector('input[placeholder*="Message"], textarea[placeholder*="Message"], .chat-input'), 
        text: "This is where you type your messages and send voice notes or media.", 
        action: async (el) => {
          el.style.transform = 'scale(1.02)';
          setTimeout(() => el.style.transform = 'scale(1)', 500);
        }
      },
      { 
        selector: findBackBtn(), 
        text: "Let's go back and continue the tour.", 
        action: forceClick 
      },

      // ── OTHER / PROFILE ──
      { 
        selector: findNav('Other'), 
        text: "Let's head to the Other tab.", 
        action: forceClick 
      },
      { 
        selector: () => Array.from(document.querySelectorAll('button, div[role="button"]')).find(e => e.textContent.includes('Profile')), 
        text: "Opening your Profile...", 
        action: forceClick 
      },
      { selector: '.snap-avatar', text: "You can change your avatar by tapping here." },
      { 
        selector: '.btn-upgrade-plus', 
        text: "Tap here to get ECHO Plus for premium features.",
        action: async (el) => {
          el.style.transform = 'scale(1.02)';
          setTimeout(() => el.style.transform = 'scale(1)', 500);
        }
      },
      { selector: 'body', text: "That's the tour! Enjoy ECHO." }
    ];

    for (let i = 0; i < script.length; i++) {
      await executeStep(script[i]);
      await new Promise(r => setTimeout(r, 500)); 
    }

    // ★ Mark the user as having completed the tour
    localStorage.setItem('echo_ai_tour_completed', 'true');
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    if (!isReturningUser) return; // Block new users from skipping
    localStorage.setItem('echo_ai_tour_completed', 'true');
    setIsVisible(false);
    onComplete();
  };

  if (!isVisible) return null;

  // ── START SCREEN ──
  if (!hasStarted) {
    return (
      <div 
        style={{ position: 'fixed', inset: 0, zIndex: 999999, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}
        onClick={handleSkip}
      >
        <div 
          style={{ background: 'rgba(30, 30, 35, 0.98)', padding: '40px', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', maxWidth: '400px', width: 'calc(100% - 40px)', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: '56px', marginBottom: '20px', animation: 'float 3s ease-in-out infinite' }}>✨</div>
          <h2 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: '12px', letterSpacing: '-0.5px' }}>
            {isReturningUser ? 'Need a refresher?' : 'Meet Echo'}
          </h2>
          <p style={{ color: '#a0a0ab', fontSize: '15px', lineHeight: 1.5, marginBottom: '30px' }}>
            {isReturningUser 
              ? "I notice you've been here before. Would you like a quick refresher tour of ECHO, or skip to the app?"
              : "I'm your AI buddy. I'll give you a quick tour of ECHO and show you how everything works."}
          </p>
          
          <button 
            onClick={runTour}
            style={{ background: 'linear-gradient(135deg, #6C3CE1, #EC4899)', color: '#fff', border: 'none', padding: '18px 32px', borderRadius: '99px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 10px 25px rgba(108,60,225,0.4)', width: '100%', transition: 'transform 0.2s', marginBottom: isReturningUser ? '10px' : '0' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Start Tour
          </button>

          {isReturningUser && (
            <button 
              onClick={handleSkip}
              style={{ background: 'transparent', color: '#a0a0ab', border: '1px solid rgba(255,255,255,0.1)', padding: '16px 32px', borderRadius: '99px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', width: '100%', transition: 'background 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Skip for now
            </button>
          )}
        </div>
        <style>{`@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
      </div>
    );
  }

  // ── ACTIVE TOUR ──
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999999, overflow: 'hidden' }}>
      
      {/* The AI Cursor */}
      <div
        ref={cursorRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '36px',
          height: '36px',
          background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
          borderRadius: '50%',
          boxShadow: '0 0 25px rgba(108,60,225,0.9), 0 0 50px rgba(236,72,153,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '18px',
          willChange: 'transform',
          zIndex: 1000000
        }}
      >
        ✨
        
        {isClicking && (
          <div style={{
            position: 'absolute',
            inset: -12,
            borderRadius: '50%',
            border: '2px solid #EC4899',
            animation: 'ripple 0.6s cubic-bezier(0.1, 0.8, 0.3, 1) forwards'
          }} />
        )}
      </div>

      {/* The Liquid Glass Speech Bubble */}
      <div
        ref={bubbleRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          background: 'rgba(15, 15, 20, 0.85)',
          backdropFilter: 'blur(30px) saturate(200%)',
          WebkitBackdropFilter: 'blur(30px) saturate(200%)',
          padding: '18px 24px',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#ffffff',
          maxWidth: '320px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          fontSize: '16px',
          fontWeight: 500,
          lineHeight: 1.5,
          letterSpacing: '-0.01em',
          willChange: 'transform',
          zIndex: 1000000
        }}
      >
        {displayText}
        {isTyping && <span className="blinking-cursor">|</span>}
        
        <div style={{ 
          position: 'absolute', 
          bottom: '-8px', 
          left: '20px', 
          width: '16px', 
          height: '16px', 
          background: 'rgba(15, 15, 20, 0.85)', 
          transform: 'rotate(45deg)', 
          borderBottom: '1px solid rgba(255,255,255,0.12)', 
          borderRight: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(30px) saturate(200%)',
          WebkitBackdropFilter: 'blur(30px) saturate(200%)',
        }} />
      </div>
      
      <style>{`
        @keyframes ripple {
          0% { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .blinking-cursor {
          animation: blink 1s step-end infinite;
          font-weight: 200;
          color: #EC4899;
        } 
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}; 

export default AIGuide; 
