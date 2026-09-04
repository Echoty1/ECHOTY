// src/components/Auth/Login.js
import React, { useState, useEffect } from 'react';
import {
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
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

const DEMO_EMAIL = 'demo@echoty.xyz';
const DEMO_PASSWORD = 'demodemo';
const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';
const DEMO_AVATAR = 'https://echoty.xyz/videos/library/Animation Smile GIF.gif';

const isNativeApp = () => {
  try {
    return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

const withAuthRetry = async (fn, tries = 3) => {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const code = err?.code || '';
      const retryable = code === 'auth/network-request-failed' || code === 'auth/too-many-requests';
      if (!retryable || i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw last;
};

const fieldStyle = {
  width: '100%',
  padding: '12px 16px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  color: 'var(--text-primary)',
  fontSize: '14px',
  outline: 'none',
  marginBottom: '12px',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [awaitingVerify, setAwaitingVerify] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      }).catch(() => {});
    }
    if (!isNativeApp()) return undefined;
    let cancelled = false;
    getRedirectResult(auth)
      .then(() => {})
      .catch((err) => {
        const code = err?.code || '';
        if (cancelled) return;
        if (code === 'auth/no-redirect-result' || code === 'auth/invalid-credential') return;
        setError(friendlyAuthError(err));
      });
    return () => { cancelled = true; };
  }, []);

  const handleGoogle = async () => {
    if (busy || isRedirecting) return;
    setError('');
    setInfo('');
    setBusy(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      if (isNativeApp()) {
        setIsRedirecting(true);
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (err) {
      if (auth.currentUser) {
        setBusy(false);
        return;
      }
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('The Google window closed. Tap Continue with Google once and wait.');
      } else {
        setError(friendlyAuthError(err));
      }
      setIsRedirecting(false);
    }
    setBusy(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
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
      const cred = await withAuthRetry(() => signInWithEmailAndPassword(auth, email.trim(), password));
      const isDemo = cred.user.uid === DEMO_UID || email.trim().toLowerCase() === DEMO_EMAIL;
      if (!isDemo && !cred.user.emailVerified) {
        try {
          await sendEmailVerification(cred.user, { url: window.location.origin + '/', handleCodeInApp: false });
        } catch (_) {}
        await signOut(auth);
        setError('This email is not verified yet. We sent another link. Open it, then log in.');
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
      await sendPasswordResetEmail(auth, email.trim(), { url: window.location.origin + '/' });
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

  return (
    <div style={{ minHeight: '100dvh', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-primary)', padding: '16px', boxSizing: 'border-box' }}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '24px', padding: '28px 24px', maxWidth: '400px', width: '100%', border: '1px solid var(--border-color)', boxShadow: '0 24px 80px var(--shadow-color)', textAlign: 'center', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto' }}>
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '32px', fontWeight: 900, background: 'linear-gradient(135deg, #6C3CE1, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ECHO</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>The future of conversations</p>
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', borderRadius: 12, padding: '10px 12px', marginBottom: 16, fontSize: 13, textAlign: 'left' }}>{error}</div>}
        {info && <div style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', borderRadius: 12, padding: '10px 12px', marginBottom: 16, fontSize: 13, textAlign: 'left' }}>{info}</div>}

        {isRedirecting && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#6C3CE1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: '#fff', marginTop: 16 }}>Signing in…</p>
          </div>
        )}

        <button type="button" onClick={handleDemoLogin} disabled={locked} style={{ width: '100%', padding: '12px', borderRadius: '50px', background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: '#fff', fontSize: '16px', fontWeight: 600, cursor: locked ? 'not-allowed' : 'pointer', marginBottom: '16px', opacity: locked ? 0.7 : 1 }}>
          {busy ? 'Please wait…' : 'Try Demo'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
          <span style={{ padding: '0 12px', color: 'var(--text-muted)', fontSize: '12px' }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
        </div>

        <button type="button" onClick={handleGoogle} disabled={locked} style={{ width: '100%', padding: '12px', borderRadius: '50px', background: '#ffffff', color: '#1a1a2e', border: '1px solid #ddd', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.7 : 1 }}>
          <svg viewBox="0 0 48 48" width="20" height="20">
            <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
            <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
            <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
            <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
          <span style={{ padding: '0 12px', color: 'var(--text-muted)', fontSize: '12px' }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
        </div>

        {awaitingVerify ? (
          <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
            <p style={{ fontWeight: 800, fontSize: 18, margin: '0 0 8px' }}>Check your email</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.55, margin: 0 }}>
              We sent a verification link to <strong>{email || 'your inbox'}</strong>. Open it, then come back and log in. Check Spam if it is not in Inbox.
            </p>
            <button type="button" onClick={() => { setAwaitingVerify(false); setIsSignup(false); }}
              style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: 50, border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 700, cursor: 'pointer' }}>
              Back to login
            </button>
          </div>
        ) : (
        <>
        <form onSubmit={handleSubmit}>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={locked} required style={fieldStyle} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={locked} required style={{ ...fieldStyle, marginBottom: '8px' }} />
          {!isSignup && (
            <button type="button" disabled={busy} onClick={handleForgotPassword}
              style={{ width: '100%', marginBottom: 12, background: 'none', border: 'none', color: '#8B5CF6', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
              Forgot password?
            </button>
          )}
          <button type="submit" disabled={locked} style={{ width: '100%', padding: '12px', borderRadius: '50px', background: 'linear-gradient(135deg, #6C3CE1, #EC4899)', border: 'none', color: 'white', fontSize: '16px', fontWeight: 600, cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.7 : 1 }}>
            {busy ? 'Please wait…' : isSignup ? 'Sign Up' : 'Login'}
          </button>
        </form>

        {!isSignup ? (
          <button type="button" disabled={locked} onClick={() => { setIsSignup(true); setError(''); setInfo(''); }} style={{ width: '100%', marginTop: '12px', padding: '12px', borderRadius: '50px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, cursor: locked ? 'not-allowed' : 'pointer' }}>
            Sign up
          </button>
        ) : (
          <button type="button" disabled={locked} onClick={() => { setIsSignup(false); setError(''); setInfo(''); }} style={{ width: '100%', marginTop: '12px', padding: '12px', borderRadius: '50px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, cursor: locked ? 'not-allowed' : 'pointer' }}>
            Back to login
          </button>
        )}
        </>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } html, body { overflow: hidden; }`}</style>
    </div>
  );
};

export default Login;
