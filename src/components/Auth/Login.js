// src/components/Auth/Login.js
// Phone (Capacitor): native Google via @capacitor-firebase/authentication
// Web/desktop: popup Google
// After login → same app (AuthContext). No Expo handoff.
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
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
const SUPPORT_UID = '5cSp1OLz30d8dghM3wvXUCdMl2QK2';
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

/**
 * Derive a display name from the signup email.
 * "john.doe@x.com" → "John Doe"
 * "sarah_k@x.com"  → "Sarah K"
 */
const deriveNameFromEmail = (rawEmail) => {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!email) return '';
  const local = email.split('@')[0];
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

/* ─── Fake mini chat preview for the hero ─── */
const MiniChatPreview = () => (
  <div className="echo-preview">
    <div className="echo-preview-header">
      <div className="echo-preview-avatar">
        <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="previewAvatarGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDBCB4" />
              <stop offset="100%" stopColor="#C98474" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="22" fill="url(#previewAvatarGrad)" />
          <path d="M 6 20 Q 6 4 24 4 Q 42 4 42 20 Q 38 12 24 12 Q 10 12 6 20 Z" fill="#3A2318" />
          <circle cx="16" cy="21" r="2" fill="#2C1A0E" />
          <circle cx="32" cy="21" r="2" fill="#2C1A0E" />
          <path d="M 18 31 Q 24 35 30 31" stroke="#2C1A0E" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <div className="echo-preview-name">
        <strong>Amina</strong>
        <span className="echo-preview-status">
          <span className="echo-preview-dot" />
          typing…
        </span>
      </div>
    </div>

    <div className="echo-preview-body">
      <div className="echo-preview-bubble them">
        hey! just finished my new avatar ✨
      </div>
      <div className="echo-preview-bubble me">
        no way — send it!
      </div>
      <div className="echo-preview-bubble them">
        <span className="echo-preview-emoji">🎨</span>
      </div>
      <div className="echo-preview-typing">
        <span /><span /><span />
      </div>
    </div>

    <div className="echo-preview-footer">
      <div className="echo-preview-input">
        Message Amina…
      </div>
      <div className="echo-preview-send">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
        </svg>
      </div>
    </div>
  </div>
);

/* ─── Social proof row ─── */
const SocialProof = () => (
  <div className="echo-proof">
    <div className="echo-proof-avatars">
      <div className="echo-proof-avatar" style={{ background: 'linear-gradient(135deg, #FDBCB4, #C98474)' }}>A</div>
      <div className="echo-proof-avatar" style={{ background: 'linear-gradient(135deg, #E8B48C, #A66A32)' }}>L</div>
      <div className="echo-proof-avatar" style={{ background: 'linear-gradient(135deg, #D4A373, #8C5E32)' }}>K</div>
      <div className="echo-proof-avatar more">+</div>
    </div>
    <div className="echo-proof-text">
      <strong>100+</strong>
      <span>people already echoing</span>
    </div>
  </div>
);

const Login = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errorShake, setErrorShake] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const native = isNativeApp();
  const passwordStrength = getPasswordStrength(password);

  const errorRef = useRef(null);

  // Redirect if already logged in, UNLESS they clicked "Add account"
  useEffect(() => {
    const isAddingAccount = sessionStorage.getItem('echo_adding_account') === 'true';
    if (user && !isAddingAccount) {
      navigate('/');
    }
  }, [user, navigate]);

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
      // Clear the Add Account flag if they successfully logged in
      sessionStorage.removeItem('echo_adding_account');
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
        const newUid = cred.user.uid;
        const derivedName = deriveNameFromEmail(email);
        try {
          await set(ref(db, `profiles/${newUid}`), {
            name: derivedName,
            username: '',
            avatar: '',
            bio: '',
            mood: 'neutral',
            email: email.trim().toLowerCase(),
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp(),
          });
        } catch (perr) {
          console.warn('[Signup] profile write failed:', perr?.message || perr);
        }
        try {
          await sendEmailVerification(cred.user, {
            url: window.location.origin + '/',
            handleCodeInApp: false,
          });
        } catch (verr) {
          console.warn('[Signup] verification email failed:', verr?.message || verr);
        }
        
        sessionStorage.removeItem('echo_adding_account'); // Clear flag on success
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
      }

      // Clear the Add Account flag on successful login
      sessionStorage.removeItem('echo_adding_account');

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
      sessionStorage.removeItem('echo_adding_account');
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

      {/* ─── LEFT: Hero + Product preview ─── */}
      <aside className="echo-auth-hero">
        <div className="echo-auth-hero-grid" aria-hidden="true" />

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
            <span className="echo-auth-version-badge">v2 · new</span>
          </div>

          <h1 className="echo-auth-hero-title">
            Conversations<br />
            that <span className="echo-auth-hero-accent">echo back.</span>
          </h1>
          <p className="echo-auth-hero-sub">
            Real-time chat, animated avatars, and a community that actually feels alive.
          </p>

          {/* Live product preview */}
          <MiniChatPreview />

          <SocialProof />
        </div>

        <div className="echo-auth-orb echo-auth-orb-a" aria-hidden="true" />
        <div className="echo-auth-orb echo-auth-orb-b" aria-hidden="true" />
        <div className="echo-auth-orb echo-auth-orb-c" aria-hidden="true" />
      </aside>

      {/* ─── RIGHT: Auth card ─── */}
      <main className="echo-auth-main">
        <div className="echo-auth-card">
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
        </div>

        <p className="echo-auth-footer">
          © {new Date().getFullYear()} ECHO · connect now 🌍
        </p>
      </main>

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
    --bg: var(--bg-primary, #08080C);
    --bg-card: var(--bg-secondary, #13131C);
    --border: var(--border-color, rgba(255,255,255,0.08));
    --text: var(--text-primary, #fff);
    --text-2: var(--text-secondary, #a1a1aa);
    --text-3: var(--text-muted, #71717a);
    --input-bg: var(--bg-input, rgba(255,255,255,0.04));

    min-height: 100dvh;
    display: grid;
    grid-template-columns: 1fr;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', -apple-system, sans-serif;
    overflow: hidden;
  }
  @media (min-width: 900px) {
    .echo-auth-root { grid-template-columns: 1.05fr 1fr; }
  }

  /* ─── HERO ─── */
  .echo-auth-hero {
    display: none;
    position: relative;
    overflow: hidden;
    padding: 60px 64px;
    color: #fff;
    background:
      radial-gradient(circle at 25% 15%, rgba(108,60,225,0.55), transparent 55%),
      radial-gradient(circle at 80% 85%, rgba(236,72,153,0.4), transparent 55%),
      linear-gradient(135deg, #150A2E 0%, #08080C 100%);
  }
  @media (min-width: 900px) { .echo-auth-hero { display: flex; } }

  .echo-auth-hero-grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: radial-gradient(circle at center, #000 40%, transparent 90%);
    -webkit-mask-image: radial-gradient(circle at center, #000 40%, transparent 90%);
    pointer-events: none;
  }

  .echo-auth-hero-inner {
    position: relative; z-index: 2;
    display: flex; flex-direction: column;
    justify-content: center;
    max-width: 520px;
    margin: auto 0;
    width: 100%;
  }

  .echo-auth-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 44px; }
  .echo-auth-logo { width: 40px; height: 40px; }
  .echo-auth-brand-name {
    font-size: 20px; font-weight: 900; letter-spacing: 4px; color: #fff;
  }
  .echo-auth-version-badge {
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    background: linear-gradient(135deg, rgba(108,60,225,0.35), rgba(236,72,153,0.35));
    border: 1px solid rgba(167,139,250,0.4);
    color: #E9D5FF;
    margin-left: 6px;
  }

  .echo-auth-hero-title {
    font-size: 48px;
    font-weight: 800;
    letter-spacing: -1.5px;
    line-height: 1.05;
    margin: 0 0 18px;
    color: #fff;
  }
  .echo-auth-hero-accent {
    background: linear-gradient(135deg, #A78BFA, #F472B6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .echo-auth-hero-sub {
    font-size: 15.5px;
    line-height: 1.6;
    color: rgba(255,255,255,0.65);
    margin: 0 0 36px;
    max-width: 42ch;
  }

  /* ─── Mini chat preview ─── */
  .echo-preview {
    width: 100%;
    max-width: 380px;
    border-radius: 22px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 14px;
    box-shadow:
      0 30px 60px rgba(0,0,0,0.45),
      0 0 0 1px rgba(108,60,225,0.15),
      0 0 40px rgba(108,60,225,0.15);
    animation: echoPreviewFloat 6s ease-in-out infinite;
    margin-bottom: 36px;
  }
  @keyframes echoPreviewFloat {
    0%, 100% { transform: translateY(0) rotate(-0.3deg); }
    50%      { transform: translateY(-6px) rotate(0.3deg); }
  }

  .echo-preview-header {
    display: flex; align-items: center; gap: 10px;
    padding-bottom: 12px; margin-bottom: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .echo-preview-avatar {
    width: 38px; height: 38px;
    border-radius: 50%;
    overflow: hidden;
    box-shadow: 0 0 0 2px rgba(167,139,250,0.5);
    position: relative;
  }
  .echo-preview-avatar::after {
    content: '';
    position: absolute; inset: 0;
    border-radius: 50%;
    box-shadow: 0 0 0 0 rgba(167,139,250,0.6);
    animation: echoPreviewPulse 2.4s ease-out infinite;
  }
  @keyframes echoPreviewPulse {
    0%   { box-shadow: 0 0 0 0 rgba(167,139,250,0.6); }
    100% { box-shadow: 0 0 0 10px rgba(167,139,250,0); }
  }
  .echo-preview-avatar svg { width: 100%; height: 100%; display: block; }

  .echo-preview-name {
    display: flex; flex-direction: column; gap: 2px;
    font-size: 13px; color: #fff;
  }
  .echo-preview-name strong { font-weight: 700; }
  .echo-preview-status {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; color: #A78BFA; font-weight: 600;
  }
  .echo-preview-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #10B981;
    box-shadow: 0 0 6px #10B981;
  }

  .echo-preview-body {
    display: flex; flex-direction: column; gap: 8px;
  }
  .echo-preview-bubble {
    max-width: 78%;
    padding: 9px 13px;
    border-radius: 16px;
    font-size: 13px;
    line-height: 1.4;
    color: #fff;
  }
  .echo-preview-bubble.them {
    align-self: flex-start;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.08);
    border-bottom-left-radius: 4px;
  }
  .echo-preview-bubble.me {
    align-self: flex-end;
    background: linear-gradient(135deg, #6C3CE1, #EC4899);
    border-bottom-right-radius: 4px;
    box-shadow: 0 4px 14px rgba(108,60,225,0.35);
  }
  .echo-preview-emoji {
    font-size: 22px;
    display: inline-block;
    line-height: 1;
  }

  .echo-preview-typing {
    align-self: flex-start;
    display: inline-flex; align-items: center; gap: 4px;
    padding: 9px 14px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px 16px 16px 4px;
  }
  .echo-preview-typing span {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #A78BFA;
    animation: echoPreviewDot 1.3s ease-in-out infinite;
  }
  .echo-preview-typing span:nth-child(2) { animation-delay: 0.18s; }
  .echo-preview-typing span:nth-child(3) { animation-delay: 0.36s; }
  @keyframes echoPreviewDot {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30%           { transform: translateY(-4px); opacity: 1; }
  }

  .echo-preview-footer {
    display: flex; align-items: center; gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .echo-preview-input {
    flex: 1;
    padding: 9px 14px;
    border-radius: 999px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    font-size: 12px;
    color: rgba(255,255,255,0.4);
  }
  .echo-preview-send {
    display: grid; place-items: center;
    width: 34px; height: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6C3CE1, #EC4899);
    color: #fff;
    box-shadow: 0 4px 12px rgba(108,60,225,0.4);
  }

  /* ─── Social proof ─── */
  .echo-proof {
    display: flex; align-items: center; gap: 14px;
  }
  .echo-proof-avatars {
    display: flex;
  }
  .echo-proof-avatar {
    width: 30px; height: 30px;
    border-radius: 50%;
    display: grid; place-items: center;
    font-size: 12px; font-weight: 800;
    color: #fff;
    border: 2px solid #0F0824;
    margin-left: -10px;
  }
  .echo-proof-avatar:first-child { margin-left: 0; }
  .echo-proof-avatar.more {
    background: rgba(255,255,255,0.1);
    color: #E9D5FF;
    font-size: 14px;
  }
  .echo-proof-text {
    display: flex; flex-direction: column;
    font-size: 13px;
    color: rgba(255,255,255,0.7);
  }
  .echo-proof-text strong { color: #fff; font-weight: 700; }

  /* ─── Orbs ─── */
  .echo-auth-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(70px);
    pointer-events: none;
    opacity: 0.45;
  }
  .echo-auth-orb-a {
    width: 340px; height: 340px; background: #6C3CE1;
    top: -80px; right: -80px;
    animation: echoAuthFloat 12s ease-in-out infinite;
  }
  .echo-auth-orb-b {
    width: 260px; height: 260px; background: #EC4899;
    bottom: -40px; left: -40px;
    animation: echoAuthFloat 14s ease-in-out infinite reverse;
  }
  .echo-auth-orb-c {
    width: 200px; height: 200px; background: #A78BFA;
    top: 45%; left: 55%;
    animation: echoAuthFloat 16s ease-in-out infinite;
  }
  @keyframes echoAuthFloat {
    0%, 100% { transform: translate(0,0) scale(1); }
    50%      { transform: translate(-20px, 30px) scale(1.08); }
  }

  /* ─── MAIN ─── */
  .echo-auth-main {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 24px;
    overflow-y: auto;
    min-height: 100dvh;
    position: relative;
  }

  .echo-auth-card {
    width: 100%; max-width: 420px;
    animation: echoAuthCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes echoAuthCardIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: none; }
  }

  .echo-auth-mobile-brand {
    display: flex; align-items: center; justify-content: center;
    gap: 10px; margin-bottom: 32px;
  }
  .echo-auth-logo-sm { width: 32px; height: 32px; }
  .echo-auth-brand-name-sm {
    font-size: 18px; font-weight: 900; letter-spacing: 3px;
    background: linear-gradient(135deg, #6C3CE1, #EC4899);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  @media (min-width: 900px) { .echo-auth-mobile-brand { display: none; } }

  .echo-auth-header { margin-bottom: 26px; }
  .echo-auth-title {
    font-size: 26px; font-weight: 800;
    letter-spacing: -0.4px; margin: 0 0 6px;
    color: var(--text);
  }
  .echo-auth-sub {
    font-size: 14px; color: var(--text-2);
    margin: 0; line-height: 1.5;
  }
  .echo-auth-hint { font-size: 13px; color: var(--text-3); margin: 12px 0 20px; }

  /* Alerts */
  .echo-auth-alert {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 12px 14px; border-radius: 12px;
    font-size: 13px; line-height: 1.45;
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
    display: grid; place-items: center;
    width: 18px; height: 18px; border-radius: 50%;
    background: currentColor; color: var(--bg);
    font-weight: 900; font-size: 11px;
    flex-shrink: 0; margin-top: 1px;
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
    display: flex; align-items: center; justify-content: center; gap: 10px;
    padding: 13px 16px;
    border-radius: 12px;
    font-size: 14px; font-weight: 600; font-family: inherit;
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
  }
  .echo-auth-btn-google:not(:disabled):hover {
    border-color: rgba(108,60,225,0.5);
    box-shadow: 0 6px 20px rgba(108,60,225,0.15);
    transform: translateY(-1px);
  }

  .echo-auth-btn-primary {
    background: linear-gradient(135deg, #6C3CE1, #EC4899);
    background-size: 200% 200%;
    color: #fff;
    margin-top: 6px;
    box-shadow: 0 8px 24px rgba(108,60,225,0.35);
    animation: echoBtnGradient 6s ease infinite;
  }
  @keyframes echoBtnGradient {
    0%, 100% { background-position: 0% 50%; }
    50%      { background-position: 100% 50%; }
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
  .echo-auth-btn-secondary:not(:disabled):hover { background: var(--input-bg); }

  .echo-auth-btn-demo {
    background: transparent;
    border: 1px dashed var(--border);
    color: var(--text-2);
    font-size: 13px; font-weight: 600;
    padding: 10px 14px; min-height: 40px; border-radius: 10px;
  }
  .echo-auth-btn-demo:not(:disabled):hover {
    border-color: rgba(108,60,225,0.6);
    color: var(--text);
    background: rgba(108,60,225,0.05);
  }

  .echo-auth-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 20px 0;
    color: var(--text-3);
    font-size: 12px;
  }
  .echo-auth-divider::before,
  .echo-auth-divider::after {
    content: ''; flex: 1; height: 1px; background: var(--border);
  }

  /* Fields */
  .echo-auth-field { margin-bottom: 14px; }
  .echo-auth-label-row {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 6px;
  }
  .echo-auth-label {
    display: block; font-size: 12.5px; font-weight: 600;
    color: var(--text-2); margin-bottom: 6px; letter-spacing: 0.2px;
  }
  .echo-auth-label-row .echo-auth-label { margin-bottom: 0; }

  .echo-auth-input-wrap {
    position: relative; border-radius: 12px;
    background: var(--input-bg);
    border: 1px solid var(--border);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
    display: flex; align-items: center;
  }
  .echo-auth-input-wrap.focused {
    border-color: rgba(108,60,225,0.6);
    box-shadow: 0 0 0 3px rgba(108,60,225,0.15);
    background: var(--bg-card);
  }
  .echo-auth-input {
    flex: 1; padding: 13px 14px;
    background: transparent; border: none; outline: none;
    color: var(--text); font-size: 14px; font-family: inherit;
    border-radius: 12px;
  }
  .echo-auth-input::placeholder { color: var(--text-3); }
  .echo-auth-input:disabled { opacity: 0.6; cursor: not-allowed; }

  .echo-auth-eye {
    display: grid; place-items: center;
    width: 38px; height: 38px; margin-right: 4px;
    background: transparent; border: none;
    color: var(--text-3); cursor: pointer;
    border-radius: 8px;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .echo-auth-eye:hover { color: var(--text); background: var(--input-bg); }

  .echo-auth-strength {
    display: flex; align-items: center; gap: 10px;
    margin-top: 8px;
  }
  .echo-auth-strength-bar {
    flex: 1; height: 4px; background: var(--input-bg);
    border-radius: 999px; overflow: hidden;
  }
  .echo-auth-strength-fill {
    height: 100%; border-radius: 999px;
    transition: width 0.3s ease, background 0.3s ease;
  }
  .echo-auth-strength-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
    min-width: 44px; text-align: right;
  }

  .echo-auth-checkbox-row {
    display: flex; align-items: flex-start; gap: 10px;
    font-size: 13px; color: var(--text-2);
    cursor: pointer; margin: 8px 0 18px;
    line-height: 1.5;
  }
  .echo-auth-checkbox-row input { display: none; }
  .echo-auth-checkbox-mark {
    position: relative;
    width: 18px; height: 18px; flex-shrink: 0;
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
    left: 5px; top: 1px;
    width: 5px; height: 10px;
    border-right: 2px solid #fff;
    border-bottom: 2px solid #fff;
    transform: rotate(45deg);
  }

  .echo-auth-link {
    background: none; border: none;
    color: #A78BFA; cursor: pointer;
    font-size: 13px; font-weight: 600;
    padding: 0; font-family: inherit;
  }
  .echo-auth-link:hover { text-decoration: underline; }
  .echo-auth-link-inline {
    color: #A78BFA; text-decoration: none; font-weight: 600;
  }
  .echo-auth-link-inline:hover { text-decoration: underline; }

  .echo-auth-switch {
    display: flex; align-items: center; justify-content: center;
    gap: 6px; margin-top: 22px;
    font-size: 13.5px; color: var(--text-2);
  }

  .echo-auth-demo {
    margin-top: 26px; padding-top: 22px;
    border-top: 1px solid var(--border);
  }

  .echo-auth-spinner {
    display: inline-block;
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: echoAuthSpin 0.7s linear infinite;
  }
  .echo-auth-spinner-lg { width: 42px; height: 42px; border-width: 3px; }
  @keyframes echoAuthSpin { to { transform: rotate(360deg); } }

  .echo-auth-verify { text-align: center; padding: 8px 4px; }
  .echo-auth-verify-icon {
    display: grid; place-items: center;
    width: 68px; height: 68px;
    margin: 0 auto 20px;
    border-radius: 50%;
    background: rgba(108,60,225,0.12);
    border: 1px solid rgba(108,60,225,0.35);
    color: #A78BFA;
  }
  .echo-auth-verify .echo-auth-title { margin-top: 4px; }

  .echo-auth-footer {
    margin-top: 32px; font-size: 12px;
    color: var(--text-3); text-align: center;
  }

  .echo-auth-redirect {
    position: fixed; inset: 0;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 16px;
    background: rgba(8, 8, 12, 0.92);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 9999;
    color: #fff; font-size: 14px;
  }
  .echo-auth-redirect .echo-auth-spinner {
    border-color: rgba(255,255,255,0.2);
    border-top-color: #6C3CE1;
  }

  @media (max-width: 480px) {
    .echo-auth-main { padding: 20px 18px; }
    .echo-auth-title { font-size: 22px; }
    .echo-auth-hero-title { font-size: 34px; }
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
