// src/components/Auth/Login.js
import React, { useState, useEffect } from 'react';
import {
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth, db } from '../../services/firebase';
import { ref, set, get, push, serverTimestamp } from 'firebase/database';

const DEMO_EMAIL = 'demo@echoty.xyz';
const DEMO_PASSWORD = 'demodemo';
const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';
const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';
const DEMO_AVATAR = 'https://echoty.xyz/videos/library/Animation Smile GIF.gif';

// ─── Native app detection (Capacitor) ────────────────────────────
const isNativeApp = () => {
  return typeof window !== 'undefined' && window.hasOwnProperty('Capacitor') && window.Capacitor.isNative;
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);

  // ─── Handle redirect result on every mount ──────────────────
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    getRedirectResult(auth)
      .then((result) => {
        if (cancelled) return;
        if (result?.user) {
          console.log('✅ Google redirect sign-in OK', result.user.uid);
          // User is signed in; the app will navigate to Home via AuthContext.
        } else {
          // No redirect result – user is not signed in yet.
        }
      })
      .catch((err) => {
        console.error('❌ Redirect sign-in error:', err);
        if (!cancelled) {
          // If the error is because there's no redirect result, ignore it.
          // But if it's a real error (like missing state), show it.
          if (err.code !== 'auth/no-redirect-result') {
            setError(err.message || 'Google sign-in failed');
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBusy(false);
          setIsRedirecting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Google sign-in ─────────────────────────────────────────────
  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      if (isNativeApp()) {
        // On native (Android), use redirect.
        setIsRedirecting(true);
        await signInWithRedirect(auth, provider);
        // The page will redirect; no need to setBusy(false) here.
        // The `getRedirectResult` will handle the return.
        return;
      } else {
        // Web: use popup (works on localhost and production).
        await signInWithPopup(auth, provider);
        // After popup, user is signed in.
        setBusy(false);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Google sign-in failed');
      setBusy(false);
      setIsRedirecting(false);
    }
  };

  // ─── Email/password sign-up/login ──────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  // ─── Demo login ──────────────────────────────────────────────────
  const handleDemoLogin = async () => {
    setError('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);

      await set(ref(db, `profiles/${DEMO_UID}`), {
        name: 'Demo User',
        avatar: DEMO_AVATAR,
        videoUrl: DEMO_AVATAR,
        mood: 'happy',
        bio: 'Trying ECHO! 🌊',
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
      setError('Demo login failed: ' + err.message);
      setBusy(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--bg-primary)',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: '24px',
          padding: '40px 32px',
          maxWidth: '400px',
          width: '100%',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 80px var(--shadow-color)',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontSize: '32px',
              fontWeight: 900,
              background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            ECHO
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            The future of conversations
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.12)',
              color: '#f87171',
              borderRadius: 12,
              padding: '10px 12px',
              marginBottom: 16,
              fontSize: 13,
              textAlign: 'left',
            }}
          >
            {error}
          </div>
        )}

        {/* ─── Loading overlay during redirect ───────────────────── */}
        {isRedirecting && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.7)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                border: '3px solid rgba(255,255,255,0.2)',
                borderTopColor: '#6C3CE1',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p style={{ color: '#fff', marginTop: 16 }}>Signing in…</p>
          </div>
        )}

        <button
          onClick={handleDemoLogin}
          disabled={busy || isRedirecting}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '50px',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            border: 'none',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            cursor: busy || isRedirecting ? 'not-allowed' : 'pointer',
            marginBottom: '16px',
            opacity: busy || isRedirecting ? 0.7 : 1,
          }}
        >
          {busy ? 'Please wait…' : '🚀 Try Demo'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
          <span style={{ padding: '0 12px', color: 'var(--text-muted)', fontSize: '12px' }}>or</span>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border-color)' }} />
        </div>

        <button
          onClick={handleGoogle}
          disabled={busy || isRedirecting}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '50px',
            background: '#ffffff',
            color: '#1a1a2e',
            border: '1px solid #ddd',
            fontSize: '16px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            cursor: busy || isRedirecting ? 'not-allowed' : 'pointer',
            opacity: busy || isRedirecting ? 0.7 : 1,
          }}
        >
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

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy || isRedirecting}
            style={{
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
            }}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy || isRedirecting}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
              marginBottom: '16px',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
            required
          />
          <button
            type="submit"
            disabled={busy || isRedirecting}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '50px',
              background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
              border: 'none',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              cursor: busy || isRedirecting ? 'not-allowed' : 'pointer',
              opacity: busy || isRedirecting ? 0.7 : 1,
            }}
          >
            {busy ? 'Please wait…' : isSignup ? 'Sign Up' : 'Login'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          {isSignup ? 'Already have an account? ' : 'No account? '}
          <span
            style={{ color: '#8B5CF6', cursor: 'pointer' }}
            onClick={() => !busy && !isRedirecting && setIsSignup(!isSignup)}
          >
            {isSignup ? 'Login' : 'Sign up'}
          </span>
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;