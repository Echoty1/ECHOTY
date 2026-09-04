// src/components/pages/Communities/Communities.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './Communities.css';

const Communities = () => {
  const [email, setEmail] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isHovered, setIsHovered] = useState(false);

  const cardRef = useRef(null);
  const canvasRef = useRef(null);
  const formRef = useRef(null);
  const inputWrapperRef = useRef(null);

  const API_KEY = 'ba3520abdd284d90a3f237fc4094bd75';
  const API_URL = 'https://emailreputation.abstractapi.com/v1/';
  const FORMSPREE_URL = 'https://formspree.io/f/myeyzgra';
  const CACHE_KEY = 'echo_email_cache';
  const SUBMITTED_KEY = 'echo_submitted_emails';

  // ─── Cache helpers ──────────────────────────────────────────────
  const getCachedEmailStatus = useCallback((email) => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      return cache[email] || null;
    } catch {
      return null;
    }
  }, []);

  const setCachedEmailStatus = useCallback((email, status) => {
    try {
      const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
      cache[email] = { status, checkedAt: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('Failed to write to cache:', e);
    }
  }, []);

  // ─── Check if email has been submitted before ──────────────────
  const isEmailSubmitted = useCallback((email) => {
    try {
      const submitted = JSON.parse(localStorage.getItem(SUBMITTED_KEY) || '[]');
      return submitted.includes(email);
    } catch {
      return false;
    }
  }, []);

  const markEmailSubmitted = useCallback((email) => {
    try {
      const submitted = JSON.parse(localStorage.getItem(SUBMITTED_KEY) || '[]');
      if (!submitted.includes(email)) {
        submitted.push(email);
        localStorage.setItem(SUBMITTED_KEY, JSON.stringify(submitted));
      }
    } catch (e) {
      console.warn('Failed to mark email as submitted:', e);
    }
  }, []);

  // ─── Particles animation ──────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let particles = [];
    let animationId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.opacity = Math.random() * 0.5 + 0.2;
      }
      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
          this.reset();
        }
      }
      draw() {
        ctx.fillStyle = `rgba(168, 85, 247, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < 40; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(); });
      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  // ─── 3D Tilt ──────────────────────────────────────────────────
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const onMove = (e) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      const rotateX = ((clientY - innerHeight / 2) / innerHeight) * -12;
      const rotateY = ((clientX - innerWidth / 2) / innerWidth) * 12;
      card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };
    const onLeave = () => {
      card.style.transform = 'rotateX(0deg) rotateY(0deg)';
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  // ─── Email validation ─────────────────────────────────────────
  const validateEmailWithApi = useCallback(async (email) => {
    try {
      const url = `${API_URL}?api_key=${API_KEY}&email=${encodeURIComponent(email)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.email_deliverability?.status === 'deliverable';
    } catch (err) {
      console.warn('Validation API error, allowing submission:', err.message);
      return true;
    }
  }, []);

  const handleEmailChange = useCallback(async (e) => {
    const value = e.target.value.trim();
    setEmail(value);

    const wrapper = inputWrapperRef.current;
    if (!value) {
      wrapper?.classList.remove('valid', 'invalid');
      setIsValid(false);
      setStatus({ type: '', message: '' });
      return;
    }

    // Quick format check
    const formatOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (!formatOk) {
      wrapper?.classList.add('invalid');
      wrapper?.classList.remove('valid');
      setIsValid(false);
      setStatus({ type: '', message: '' });
      return;
    }

    // ─── Check if already submitted ──────────────────────────────
    if (isEmailSubmitted(value)) {
      wrapper?.classList.add('valid');
      wrapper?.classList.remove('invalid');
      setIsValid(false);
      setStatus({
        type: 'info',
        message: '📩 You\'ve already joined the waitlist! We\'ll keep you posted.'
      });
      return;
    }

    // ─── Check cache first ──────────────────────────────────────
    const cached = getCachedEmailStatus(value);
    if (cached) {
      if (cached.status === 'valid') {
        wrapper?.classList.add('valid');
        wrapper?.classList.remove('invalid');
        setIsValid(true);
        setStatus({ type: '', message: '' });
      } else {
        wrapper?.classList.add('invalid');
        wrapper?.classList.remove('valid');
        setIsValid(false);
        setStatus({ type: '', message: '' });
      }
      return;
    }

    // ─── Not in cache – call API ────────────────────────────────
    setIsVerifying(true);
    wrapper?.classList.remove('valid', 'invalid');
    setStatus({ type: '', message: '' });

    const valid = await validateEmailWithApi(value);
    setIsVerifying(false);

    setCachedEmailStatus(value, valid ? 'valid' : 'invalid');

    if (valid) {
      wrapper?.classList.add('valid');
      wrapper?.classList.remove('invalid');
      setIsValid(true);
    } else {
      wrapper?.classList.add('invalid');
      wrapper?.classList.remove('valid');
      setIsValid(false);
    }
  }, [getCachedEmailStatus, setCachedEmailStatus, validateEmailWithApi, isEmailSubmitted]);

  // ─── Form submission ───────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();

    // Double-check if already submitted
    if (isEmailSubmitted(email)) {
      setStatus({
        type: 'info',
        message: '📩 You\'ve already joined the waitlist! We\'ll keep you posted.'
      });
      return;
    }

    if (!isValid) {
      setStatus({ type: 'error', message: '❌ Please enter a valid email address.' });
      return;
    }

    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      const formData = new FormData();
      formData.append('email', email);

      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }
      });

      if (res.ok) {
        // Mark as submitted so we don't send again
        markEmailSubmitted(email);
        setStatus({
          type: 'success',
          message: "✅ You're on the list! We'll let you know when access opens up."
        });
        setEmail('');
        const wrapper = inputWrapperRef.current;
        wrapper?.classList.remove('valid', 'invalid');
        setIsValid(false);
        formRef.current?.reset();
      } else {
        setStatus({ type: 'error', message: '❌ Something went wrong. Please try again.' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: '❌ Network error. Please check your connection.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [email, isValid, isEmailSubmitted, markEmailSubmitted]);

  // ─── Copy link ─────────────────────────────────────────────────
  const copyLink = useCallback(async () => {
    const url = window.location.href;
    const payload = {
      title: 'Brand Community · ECHO',
      text: 'Check out Brand Community by ECHO!',
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      const toast = document.getElementById('toast');
      toast?.classList.add('active');
      setTimeout(() => toast?.classList.remove('active'), 2500);
    } catch (_) {}
  }, []);

  return (
    <>
      <SEO title="Brand Communities – ECHO" description="Brand communities coming soon on ECHO." />
      <StructuredData />
      <div className="brand-community-page">
        {/* ─── Particles Canvas ────────────────────────────────────── */}
        <canvas ref={canvasRef} id="particleCanvas" className="particle-canvas" />

        {/* ─── Ambient Background ─────────────────────────────────── */}
        <div className="crystal-bg" />
        <div className="rings">
          <span></span>
          <span></span>
          <span></span>
        </div>

        {/* ─── Card ────────────────────────────────────────────────── */}
        <div className="card-wrapper">
          <div
            className="container"
            ref={cardRef}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            {/* Logo */}
            <div className="logo">
              <div className="logo-icon">E</div>
              <span className="logo-text">ECHO</span>
            </div>

            <div className="badge-container">
              <div className="badge">
                <span className="badge-dot" />
                Brand Community · Coming Soon
              </div>
              <div className="counter-badge">✨ 1,420+ joined</div>
            </div>

            <h1>
              Your brand, <br /><span>your community</span>
            </h1>

            <p className="sub">
              We're building a dedicated space for brands to manage their communities — moderate posts, engage members, and grow together. Stay tuned.
            </p>

            {/* ─── Form ────────────────────────────────────────────── */}
            <form ref={formRef} onSubmit={handleSubmit} noValidate>
              <div className="form-wrap">
                <div className="input-box-wrapper" ref={inputWrapperRef}>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="Enter your email to get notified"
                    required
                    autoComplete="email"
                    disabled={isSubmitting}
                  />
                  <span className="input-status input-status-valid">✓</span>
                  <span className="input-status input-status-invalid">✕</span>
                </div>
                <button
                  type="submit"
                  disabled={!isValid || isVerifying || isSubmitting}
                >
                  {isVerifying ? 'Verifying…' : isSubmitting ? 'Submitting…' : 'Notify me'}
                </button>
              </div>

              {status.type === 'success' && (
                <div className="fs-message success visible">{status.message}</div>
              )}
              {status.type === 'error' && (
                <div className="fs-message error visible">{status.message}</div>
              )}
              {status.type === 'info' && (
                <div className="fs-message info visible">{status.message}</div>
              )}
            </form>

            {/* ─── Share Bar ────────────────────────────────────────── */}
            <div className="share-bar">
              <button className="share-btn share-main" type="button" onClick={copyLink} title="Share">
                Share this page
              </button>
            </div>

            <div className="footer">
              <a href="https://echoty.xyz" target="_blank" rel="noopener noreferrer">echoty.xyz</a> · <span>Discover. Connect. Echo.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Communities;
