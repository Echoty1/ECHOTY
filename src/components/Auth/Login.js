// src/components/Auth/Login.js
// Phone (Capacitor): native Google via @capacitor-firebase/authentication
// Web/desktop: popup Google
// After login → same app (AuthContext). No Expo handoff.
import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { ref, set, get, push, serverTimestamp } from 'firebase/database';
import { friendlyAuthError } from '../../utils/authErrors';
import { armEmailGate } from '../../utils/emailGate';
import { isNativeApp, signInWithGoogle } from '../../utils/nativeAuth';

const DEMO_EMAIL = 'demo@echoty.xyz';
const DEMO_PASSWORD = 'demodemo';
const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';
const DEMO_AVATAR = 'https://echoty.xyz/videos/library/Animation Smile GIF.gif';

const withAuthRetry = async (fn, tries = 3) => {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const code = err?.code || '';
      const retryable =
        code === 'auth/network-request-failed' || code === 'auth/too-many-requests';
      if (!retryable || i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw last;
};

/* ─────────────── Password strength heuristic ─────────────── */
const getPasswordStrength = (pw) => {
  if (!pw) return { score: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw)) score += 1;
  if (/[0-9]/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  if (score <= 1) return { score, label: 'Weak', color: '#EF4444' };
  if (score <= 3) return { score, label: 'Fair', color: '#F59E0B' };
  if (score <= 4) return { score, label: 'Good', color: '#10B981' };
  return { score, label: 'Strong', color: '#10B981' };
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [awaitingVerify, setAwaitingVerify] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorShake, setErrorShake] = useState(false);

  // Focus animation control
  const [focusedField, setFocusedField] = useState(null);

  const native = isNativeApp();
  const passwordStrength = getPasswordStrength(password);

  const errorRef = useRef(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          regs.forEach((reg) => reg.unregister());
        })
        .catch(() => {});
    }
  }, []);

  // Trigger a small shake when an error appears
  useEffect(() => {
    if (error) {
      setErrorShake(true);
      const t = setTimeout(() => setErrorShake(false), 500);
      return () => clearTimeout(t);
    }
  }, [error]);

  const handleGoogle = async () => {
    if (busy || isRedirecting) return;
    setError('');
    setInfo('');
    setBusy(true);
    if (native) setIsRedirecting(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (auth.currentUser) {
        setBusy(false);
        setIsRedirecting(false);
        return;
      }
      const code = err?.code || '';
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'canceled' ||
        /cancel|closed/i.test(String(err?.message || ''))
      ) {
        setError('Google sign-in was cancelled. Tap Continue with Google again.');
      } else {
        setError(friendlyAuthError(err));
      }
    }
    setBusy(false);
    setIsRedirecting(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    // Signup validation
    if (isSignup) {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (!termsAccepted) {
        setError('Please accept the Terms of Service and Privacy Policy.');
        return;
      }
    }

    setBusy(true);
    try {
      if (isSignup) {
        armEmailGate();
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user, {
          url: window.location.origin + '/',
          handleCodeInApp: false,
        });
        await signOut(auth);
        setAwaitingVerify(true);
        setBusy(false);
        return;
      }
      const cred = await withAuthRetry(() =>
        signInWithEmailAndPassword(auth, email.trim(), password)
      );
      const isDemo =
        cred.user.uid === DEMO_UID || email.trim().toLowerCase() === DEMO_EMAIL;
      if (!isDemo && !cred.user.emailVerified) {
        try {
          await sendEmailVerification(cred.user, {
            url: window.location.origin + '/',
            handleCodeInApp: false,
          });
        } catch (_) {}
        await signOut(auth);
        setError(
          'This email is not verified yet. We sent another link. Open it, then log in.'
        );
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    }
    setBusy(false);
  };

  const handleForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!email.trim()) {
      setError('Type your email above, then tap Forgot password.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), {
        url: window.location.origin + '/',
      });
      setInfo('Password reset email sent. Open it and choose a new password, then log in.');
    } catch (err) {
      setError(friendlyAuthError(err));
    }
    setBusy(false);
  };

  const handleDemoLogin = async () => {
    setError('');
    setInfo('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
      await set(ref(db, `profiles/${DEMO_UID}`), {
        name: 'Demo User',
        avatar: DEMO_AVATAR,
        videoUrl: DEMO_AVATAR,
        mood: 'happy',
        bio: 'Trying ECHO!',
        isDemo: true,
        createdAt: Date.now(),
        lastActive: Date.now(),
      });
      const chatId = [SUPPORT_UID, DEMO_UID].sort().join('_');
      const chatMessagesRef = ref(db, `chats/${chatId}/messages`);
      const snapshot = await get(chatMessagesRef);
      if (!snapshot.exists()) {
        const welcomeMsgRef = push(chatMessagesRef);
        await set(welcomeMsgRef, {
          senderId: SUPPORT_UID,
          receiverId: DEMO_UID,
          type: 'text',
          text: 'Welcome to ECHO! How can we help you?',
          timestamp: serverTimestamp(),
          isRead: true,
        });
      }
      await set(ref(db, `userChats/${DEMO_UID}/${SUPPORT_UID}`), {
        id: SUPPORT_UID,
        partnerName: 'ECHO Support',
        partnerAvatar: '',
        lastMessage: 'Welcome to ECHO! How can we help you?',
        lastSenderId: SUPPORT_UID,
        lastUpdated: Date.now(),
        unreadCount: 0,
      });
    } catch (err) {
      setError(friendlyAuthError(err));
      setBusy(false);
    }
  };

  const locked = busy || isRedirecting;

  const switchMode = (signup) => {
    setError('');
    setInfo('');
    setIsSignup(signup);
  };

  return (
    <div className="echo-auth-root">
      <style>{AUTH_STYLES}</style>

      {/* ─── Left branded panel (hidden on mobile) ─── */}
      <aside className="echo-auth-hero" aria-hidden="true">
        <div className="echo-auth-hero-inner">
          <div className="echo-auth-brand">
            <svg viewBox="0 0 48 48" className="echo-auth-logo" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="echoLogoGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6C3CE1" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#echoLogoGrad)" />
              <path d="M 14 14 H 28 V 19 H 19 V 22 H 26 V 27 H 19 V 30 H 28 V 35 H 14 Z" fill="#fff" />
              <path d="M 32 17 A 10 10 0 0 1 32 31" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
            </svg>
            <span className="echo-auth-brand-name">ECHO</span>
          </div>

          <h1 className="echo-auth-hero-title">
            Where every message<br />
            <span className="echo-auth-hero-accent">echoes back.</span>
          </h1>
          <p className="echo-auth-hero-sub">
            Real-time conversations, animated avatars, and a community
            that actually feels alive.
          </p>

          <div className="echo-auth-hero-features">
            <div className="echo-auth-feature">
              <span className="echo-auth-feature-icon">✦</span>
              <span>Custom animated ECHOmojis</span>
            </div>
            <div className="echo-auth-feature">
              <span className="echo-auth-feature-icon">✦</span>
              <span>Live typing indicators & reactions</span>
            </div>
            <div className="echo-auth-feature">
              <span className="echo-auth-feature-icon">✦</span>
              <span>End-to-end privacy by default</span>
            </div>
          </div>
        </div>

        {/* Floating orbs */}
        <div className="echo-auth-orb echo-auth-orb-a" />
        <div className="echo-auth-orb echo-auth-orb-b" />
        <div className="echo-auth-orb echo-auth-orb-c" />
      </aside>

      {/* ─── Right auth panel ─── */}
      <main className="echo-auth-main">
        <div className="echo-auth-card">
          {/* Mobile-only brand header */}
          <div className="echo-auth-mobile-brand">
            <svg viewBox="0 0 48 48" className="echo-auth-logo-sm" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="echoLogoGradSm" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6C3CE1" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
              <rect x="4" y="4" width="40" height="40" rx="12" fill="url(#echoLogoGradSm)" />
              <path d="M 14 14 H 28 V 19 H 19 V 22 H 26 V 27 H 19 V 30 H 28 V 35 H 14 Z" fill="#fff" />
              <path d="M 32 17 A 10 10 0 0 1 32 31" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.85" />
            </svg>
            <span className="echo-auth-brand-name-sm">ECHO</span>
          </div>

          {awaitingVerify ? (
            /* ─── Verification screen ─── */
            <div className="echo-auth-verify">
              <div className="echo-auth-verify-icon">
                <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h2 className="echo-auth-title">Check your email</h2>
              <p className="echo-auth-sub">
                We sent a verification link to <strong>{email || 'your inbox'}</strong>.
                Open it, then come back and log in.
              </p>
              <p className="echo-auth-hint">Didn't get it? Check Spam or Promotions.</p>
              <button
                type="button"
                onClick={() => {
                  setAwaitingVerify(false);
                  setIsSignup(false);
                }}
                className="echo-auth-btn echo-auth-btn-secondary"
              >
                Back to login
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="echo-auth-header">
                <h2 className="echo-auth-title">
                  {isSignup ? 'Create your account' : 'Welcome back'}
                </h2>
                <p className="echo-auth-sub">
                  {isSignup
                    ? 'Join ECHO in less than a minute.'
                    : 'Sign in to continue your conversations.'}
                </p>
              </div>

              {/* Alerts */}
              {error && (
                <div
                  ref={errorRef}
                  className={`echo-auth-alert echo-auth-alert-error ${errorShake ? 'shake' : ''}`}
                >
                  <span className="echo-auth-alert-icon">!</span>
                  <span>{error}</span>
                </div>
              )}
              {info && (
                <div className="echo-auth-alert echo-auth-alert-info">
                  <span className="echo-auth-alert-icon">✓</span>
                  <span>{info}</span>
                </div>
              )}

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={locked}
                className="echo-auth-btn echo-auth-btn-google"
              >
                <svg viewBox="0 0 48 48" width="18" height="18">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="echo-auth-divider">
                <span>or</span>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate>
                <div className="echo-auth-field">
                  <label className="echo-auth-label">Email</label>
                  <div className={`echo-auth-input-wrap ${focusedField === 'email' ? 'focused' : ''}`}>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      disabled={locked}
                      autoComplete="email"
                      required
                      className="echo-auth-input"
                    />
                  </div>
                </div>

                <div className="echo-auth-field">
                  <div className="echo-auth-label-row">
                    <label className="echo-auth-label">Password</label>
                    {!isSignup && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={handleForgotPassword}
                        className="echo-auth-link"
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <div className={`echo-auth-input-wrap ${focusedField === 'password' ? 'focused' : ''}`}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      disabled={locked}
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      required
                      className="echo-auth-input"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="echo-auth-eye"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Password strength bar on signup */}
                  {isSignup && password && (
                    <div className="echo-auth-strength">
                      <div className="echo-auth-strength-bar">
                        <div
                          className="echo-auth-strength-fill"
                          style={{
                            width: `${(passwordStrength.score / 5) * 100}%`,
                            background: passwordStrength.color,
                          }}
                        />
                      </div>
                      <span
                        className="echo-auth-strength-label"
                        style={{ color: passwordStrength.color }}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>
                  )}
                </div>

                {/* Remember me / Terms */}
                {!isSignup ? (
                  <label className="echo-auth-checkbox-row">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      disabled={locked}
                    />
                    <span className="echo-auth-checkbox-mark" />
                    <span>Keep me signed in</span>
                  </label>
                ) : (
                  <label className="echo-auth-checkbox-row">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      disabled={locked}
                    />
                    <span className="echo-auth-checkbox-mark" />
                    <span>
                      I agree to the{' '}
                      <a href="/legal" target="_blank" rel="noopener noreferrer" className="echo-auth-link-inline">
                        Terms
                      </a>{' '}
                      &amp;{' '}
                      <a href="/legal" target="_blank" rel="noopener noreferrer" className="echo-auth-link-inline">
                        Privacy Policy
                      </a>
                    </span>
                  </label>
                )}

                <button
                  type="submit"
                  disabled={locked}
                  className="echo-auth-btn echo-auth-btn-primary"
                >
                  {busy ? (
                    <>
                      <span className="echo-auth-spinner" />
                      <span>Please wait…</span>
                    </>
                  ) : (
                    <span>{isSignup ? 'Create account' : 'Sign in'}</span>
                  )}
                </button>
              </form>

              {/* Mode toggle */}
              <div className="echo-auth-switch">
                {isSignup ? (
                  <>
                    <span>Already have an account?</span>
                    <button type="button" onClick={() => switchMode(false)} className="echo-auth-link">
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    <span>New to ECHO?</span>
                    <button type="button" onClick={() => switchMode(true)} className="echo-auth-link">
                      Create account
                    </button>
                  </>
                )}
              </div>

              {/* Demo */}
              <div className="echo-auth-demo">
                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={locked}
                  className="echo-auth-btn echo-auth-btn-demo"
                >
                  {busy ? 'Loading…' : 'Try the demo →'}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="echo-auth-footer">
          © {new Date().getFullYear()} ECHO · Made with care
        </p>
      </main>

      {/* Redirect overlay */}
      {isRedirecting && (
        <div className="echo-auth-redirect">
          <div className="echo-auth-spinner echo-auth-spinner-lg" />
          <p>{native ? 'Opening Google…' : 'Signing in…'}</p>
        </div>
      )}
    </div>
  );
};

/* ───────────────────────── Styles ───────────────────────── */
const AUTH_STYLES = `
  .echo-auth-root {
    --brand: #6C3CE1;
    --brand-2: #EC4899;
    --bg: var(--bg-primary, #0A0A0F);
    --bg-card: var(--bg-secondary, #12121A);
    --border: var(--border-color, rgba(255,255,255,0.08));
    --text: var(--text-primary, #fff);
    --text-2: var(--text-secondary, #aaa);
    --text-3: var(--text-muted, #666);
    --input-bg: var(--bg-input, rgba(255,255,255,0.05));

    min-height: 100dvh;
    display: grid;
    grid-template-columns: 1fr;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', -apple-system, sans-serif;
    overflow: hidden;
  }

  @media (min-width: 900px) {
    .echo-auth-root {
      grid-template-columns: 1.05fr 1fr;
    }
  }

  /* ─── Left hero panel ─── */
  .echo-auth-hero {
    display: none;
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(circle at 30% 20%, rgba(108,60,225,0.55), transparent 55%),
      radial-gradient(circle at 70% 80%, rgba(236,72,153,0.45), transparent 55%),
      linear-gradient(135deg, #1A0B3D 0%, #0A0A1A 100%);
    padding: 60px 64px;
    color: #fff;
  }
  @media (min-width: 900px) {
    .echo-auth-hero { display: flex; }
  }

  .echo-auth-hero-inner {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 480px;
    margin: auto 0;
  }

  .echo-auth-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 48px;
  }
  .echo-auth-logo { width: 40px; height: 40px; }
  .echo-auth-brand-name {
    font-size: 22px;
    font-weight: 900;
    letter-spacing: 4px;
    color: #fff;
  }

  .echo-auth-hero-title {
    font-size: 44px;
    font-weight: 800;
    letter-spacing: -1px;
    line-height: 1.1;
    margin: 0 0 20px;
    color: #fff;
  }
  .echo-auth-hero-accent {
    background: linear-gradient(135deg, #A78BFA, #F472B6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .echo-auth-hero-sub {
    font-size: 16px;
    line-height: 1.6;
    color: rgba(255,255,255,0.7);
    margin: 0 0 40px;
    max-width: 40ch;
  }

  .echo-auth-hero-features {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .echo-auth-feature {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: rgba(255,255,255,0.85);
  }
  .echo-auth-feature-icon {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.18);
    color: #F472B6;
    font-size: 12px;
    flex-shrink: 0;
  }

  /* Floating orbs */
  .echo-auth-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(60px);
    pointer-events: none;
    opacity: 0.5;
  }
  .echo-auth-orb-a {
    width: 320px; height: 320px;
    background: #6C3CE1;
    top: -60px; right: -60px;
    animation: echoAuthFloat 12s ease-in-out infinite;
  }
  .echo-auth-orb-b {
    width: 260px; height: 260px;
    background: #EC4899;
    bottom: -40px; left: -40px;
    animation: echoAuthFloat 14s ease-in-out infinite reverse;
  }
  .echo-auth-orb-c {
    width: 200px; height: 200px;
    background: #A78BFA;
    top: 45%; left: 55%;
    animation: echoAuthFloat 16s ease-in-out infinite;
  }
  @keyframes echoAuthFloat {
    0%, 100% { transform: translate(0,0) scale(1); }
    50%      { transform: translate(-20px, 30px) scale(1.08); }
  }

  /* ─── Right auth main ─── */
  .echo-auth-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    overflow-y: auto;
    min-height: 100dvh;
  }

  .echo-auth-card {
    width: 100%;
    max-width: 420px;
    background: transparent;
    padding: 8px;
    animation: echoAuthCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes echoAuthCardIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: none; }
  }

  .echo-auth-mobile-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-bottom: 32px;
  }
  .echo-auth-logo-sm { width: 32px; height: 32px; }
  .echo-auth-brand-name-sm {
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 3px;
    background: linear-gradient(135deg, #6C3CE1, #EC4899);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  @media (min-width: 900px) {
    .echo-auth-mobile-brand { display: none; }
  }

  /* Header */
  .echo-auth-header { margin-bottom: 28px; }
  .echo-auth-title {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.4px;
    margin: 0 0 6px;
    color: var(--text);
  }
  .echo-auth-sub {
    font-size: 14px;
    color: var(--text-2);
    margin: 0;
    line-height: 1.5;
  }
  .echo-auth-hint {
    font-size: 13px;
    color: var(--text-3);
    margin: 12px 0 20px;
  }

  /* Alerts */
  .echo-auth-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.45;
    margin-bottom: 18px;
    border: 1px solid transparent;
  }
  .echo-auth-alert-error {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.25);
    color: #F87171;
  }
  .echo-auth-alert-info {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.25);
    color: #34D399;
  }
  .echo-auth-alert-icon {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: currentColor;
    color: var(--bg);
    font-weight: 900;
    font-size: 11px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .echo-auth-alert-error.shake { animation: echoAuthShake 0.4s ease; }
  @keyframes echoAuthShake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-4px); }
    40%, 80% { transform: translateX(4px); }
  }

  /* Buttons */
  .echo-auth-btn {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 13px 16px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: transform 0.15s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
    border: 1px solid transparent;
    min-height: 46px;
  }
  .echo-auth-btn:disabled { cursor: not-allowed; opacity: 0.65; }
  .echo-auth-btn:not(:disabled):active { transform: scale(0.98); }

  .echo-auth-btn-google {
    background: var(--bg-card);
    border-color: var(--border);
    color: var(--text);
    margin-bottom: 0;
  }
  .echo-auth-btn-google:not(:disabled):hover {
    border-color: rgba(108,60,225,0.5);
    box-shadow: 0 6px 20px rgba(108,60,225,0.15);
    transform: translateY(-1px);
  }

  .echo-auth-btn-primary {
    background: linear-gradient(135deg, #6C3CE1, #EC4899);
    color: #fff;
    margin-top: 6px;
    box-shadow: 0 8px 24px rgba(108,60,225,0.35);
  }
  .echo-auth-btn-primary:not(:disabled):hover {
    box-shadow: 0 12px 32px rgba(108,60,225,0.5);
    transform: translateY(-1px);
  }

  .echo-auth-btn-secondary {
    background: transparent;
    border-color: var(--border);
    color: var(--text);
    margin-top: 20px;
  }
  .echo-auth-btn-secondary:not(:disabled):hover {
    background: var(--input-bg);
  }

  .echo-auth-btn-demo {
    background: transparent;
    border: 1px dashed var(--border);
    color: var(--text-2);
    font-size: 13px;
    font-weight: 600;
    padding: 10px 14px;
    min-height: 40px;
    border-radius: 10px;
  }
  .echo-auth-btn-demo:not(:disabled):hover {
    border-color: rgba(108,60,225,0.6);
    color: var(--text);
    background: rgba(108,60,225,0.05);
  }

  /* Divider */
  .echo-auth-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 20px 0;
    color: var(--text-3);
    font-size: 12px;
  }
  .echo-auth-divider::before,
  .echo-auth-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* Fields */
  .echo-auth-field { margin-bottom: 14px; }

  .echo-auth-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .echo-auth-label {
    display: block;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text-2);
    margin-bottom: 6px;
    letter-spacing: 0.2px;
  }
  .echo-auth-label-row .echo-auth-label { margin-bottom: 0; }

  .echo-auth-input-wrap {
    position: relative;
    border-radius: 12px;
    background: var(--input-bg);
    border: 1px solid var(--border);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    display: flex;
    align-items: center;
  }
  .echo-auth-input-wrap.focused {
    border-color: rgba(108,60,225,0.6);
    box-shadow: 0 0 0 3px rgba(108,60,225,0.15);
    background: var(--bg-card);
  }

  .echo-auth-input {
    flex: 1;
    padding: 13px 14px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 14px;
    font-family: inherit;
    border-radius: 12px;
  }
  .echo-auth-input::placeholder { color: var(--text-3); }
  .echo-auth-input:disabled { opacity: 0.6; cursor: not-allowed; }

  .echo-auth-eye {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    margin-right: 4px;
    background: transparent;
    border: none;
    color: var(--text-3);
    cursor: pointer;
    border-radius: 8px;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .echo-auth-eye:hover { color: var(--text); background: var(--input-bg); }

  /* Password strength */
  .echo-auth-strength {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
  }
  .echo-auth-strength-bar {
    flex: 1;
    height: 4px;
    background: var(--input-bg);
    border-radius: 999px;
    overflow: hidden;
  }
  .echo-auth-strength-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease, background 0.3s ease;
  }
  .echo-auth-strength-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.3px;
    min-width: 44px;
    text-align: right;
  }

  /* Checkbox */
  .echo-auth-checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    color: var(--text-2);
    cursor: pointer;
    margin: 8px 0 18px;
    line-height: 1.5;
  }
  .echo-auth-checkbox-row input { display: none; }
  .echo-auth-checkbox-mark {
    position: relative;
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    border-radius: 5px;
    border: 1.5px solid var(--border);
    background: var(--input-bg);
    margin-top: 1px;
    transition: background 0.15s ease, border-color 0.15s ease;
  }
  .echo-auth-checkbox-row input:checked + .echo-auth-checkbox-mark {
    background: linear-gradient(135deg, #6C3CE1, #EC4899);
    border-color: transparent;
  }
  .echo-auth-checkbox-row input:checked + .echo-auth-checkbox-mark::after {
    content: '';
    position: absolute;
    left: 5px;
    top: 1px;
    width: 5px;
    height: 10px;
    border-right: 2px solid #fff;
    border-bottom: 2px solid #fff;
    transform: rotate(45deg);
  }

  /* Links */
  .echo-auth-link {
    background: none;
    border: none;
    color: #A78BFA;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    padding: 0;
    font-family: inherit;
  }
  .echo-auth-link:hover { text-decoration: underline; }
  .echo-auth-link-inline {
    color: #A78BFA;
    text-decoration: none;
    font-weight: 600;
  }
  .echo-auth-link-inline:hover { text-decoration: underline; }

  /* Mode toggle */
  .echo-auth-switch {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 22px;
    font-size: 13.5px;
    color: var(--text-2);
  }

  /* Demo */
  .echo-auth-demo {
    margin-top: 26px;
    padding-top: 22px;
    border-top: 1px solid var(--border);
  }

  /* Spinner */
  .echo-auth-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: echoAuthSpin 0.7s linear infinite;
  }
  .echo-auth-spinner-lg {
    width: 42px;
    height: 42px;
    border-width: 3px;
  }
  @keyframes echoAuthSpin { to { transform: rotate(360deg); } }

  /* Verify screen */
  .echo-auth-verify { text-align: center; padding: 8px 4px; }
  .echo-auth-verify-icon {
    display: grid;
    place-items: center;
    width: 68px;
    height: 68px;
    margin: 0 auto 20px;
    border-radius: 50%;
    background: rgba(108,60,225,0.12);
    border: 1px solid rgba(108,60,225,0.35);
    color: #A78BFA;
  }
  .echo-auth-verify .echo-auth-title { margin-top: 4px; }

  /* Footer */
  .echo-auth-footer {
    margin-top: 32px;
    font-size: 12px;
    color: var(--text-3);
    text-align: center;
  }

  /* Redirect overlay */
  .echo-auth-redirect {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgba(10, 10, 15, 0.92);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 9999;
    color: #fff;
    font-size: 14px;
  }
  .echo-auth-redirect .echo-auth-spinner {
    border-color: rgba(255,255,255,0.2);
    border-top-color: #6C3CE1;
  }

  @media (max-width: 480px) {
    .echo-auth-main { padding: 20px 18px; }
    .echo-auth-title { font-size: 22px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .echo-auth-root *, .echo-auth-root *::before, .echo-auth-root *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }

  html, body { overflow: hidden; }
`;

export default Login;
