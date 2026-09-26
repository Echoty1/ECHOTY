// src/components/Auth/VerifyEmailScreen.jsx
import React, { useEffect, useState, useRef } from 'react';
import { auth } from '../../services/firebase';
import { sendEmailVerification, signOut } from 'firebase/auth';

const RESEND_COOLDOWN_SECONDS = 60;

const VerifyEmailScreen = () => {
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const cooldownRef = useRef(null);

  const user = auth.currentUser;
  const email = user?.email || 'your email';

  // Start cooldown timer
  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current);
          cooldownRef.current = null;
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  // Check verification status now
  const checkNow = async () => {
    if (!auth.currentUser) return;
    setChecking(true);
    setError('');
    try {
      await auth.currentUser.reload();
      // Force-refresh the user so AuthContext gets the latest emailVerified
      await auth.currentUser.getIdToken(true);
      if (auth.currentUser.emailVerified) {
        // The onAuthStateChanged listener in AuthContext will fire
        // and the app will automatically route to Home.
        setInfo('Verified! Taking you in…');
      } else {
        setInfo("Not verified yet. Check your inbox (and spam).");
      }
    } catch (err) {
      setError('Could not check status. Try again.');
    } finally {
      setChecking(false);
    }
  };

  // Auto-poll every 4 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!auth.currentUser) return;
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          clearInterval(interval);
          // Trigger auth state refresh
          await auth.currentUser.getIdToken(true);
        }
      } catch (_) {}
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Also check when tab regains focus (user clicked the link and came back)
  useEffect(() => {
    const onFocus = async () => {
      if (!auth.currentUser) return;
      try {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          await auth.currentUser.getIdToken(true);
        }
      } catch (_) {}
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  const resend = async () => {
    if (cooldown > 0 || sending) return;
    setSending(true);
    setError('');
    setInfo('');
    try {
      await sendEmailVerification(auth.currentUser, {
        url: window.location.origin + '/',
        handleCodeInApp: false,
      });
      setInfo('Verification email sent again. Check your inbox.');
      startCooldown();
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a few minutes.');
      } else {
        setError('Could not resend. Try again in a minute.');
      }
    } finally {
      setSending(false);
    }
  };

  const cancelSignup = async () => {
    if (!window.confirm('Cancel signup and sign out?')) return;
    await signOut(auth);
  };

  return (
    <div className="echo-verify-root">
      <style>{VERIFY_STYLES}</style>

      <div className="echo-verify-card">
        <div className="echo-verify-icon">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        <h1 className="echo-verify-title">Verify your email</h1>
        <p className="echo-verify-sub">
          We sent a confirmation link to
        </p>
        <p className="echo-verify-email">{email}</p>
        <p className="echo-verify-hint">
          Open the link on this device or any other — you'll be signed in automatically once confirmed.
        </p>

        {info && <div className="echo-verify-info">{info}</div>}
        {error && <div className="echo-verify-error">{error}</div>}

        <div className="echo-verify-actions">
          <button
            className="echo-verify-btn-primary"
            onClick={checkNow}
            disabled={checking}
          >
            {checking ? (
              <>
                <span className="echo-verify-spinner" />
                Checking…
              </>
            ) : (
              "I've verified my email"
            )}
          </button>

          <button
            className="echo-verify-btn-secondary"
            onClick={resend}
            disabled={sending || cooldown > 0}
          >
            {sending
              ? 'Sending…'
              : cooldown > 0
              ? `Resend in ${cooldown}s`
              : 'Resend verification email'}
          </button>
        </div>

        <div className="echo-verify-footer">
          <span>Wrong email?</span>
          <button className="echo-verify-link" onClick={cancelSignup}>
            Use a different email
          </button>
        </div>

        <div className="echo-verify-tips">
          <strong>Didn't get it?</strong>
          <ul>
            <li>Check your Spam or Promotions folder</li>
            <li>Wait a minute and try Resend</li>
            <li>Make sure the email address is correct</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const VERIFY_STYLES = `
  .echo-verify-root {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background:
      radial-gradient(circle at 20% 20%, rgba(108,60,225,0.25), transparent 55%),
      radial-gradient(circle at 80% 80%, rgba(236,72,153,0.2), transparent 55%),
      var(--bg-primary, #08080C);
    color: var(--text-primary, #fff);
    font-family: 'Inter', -apple-system, sans-serif;
  }

  .echo-verify-card {
    width: 100%;
    max-width: 440px;
    background: var(--bg-secondary, #13131C);
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
    border-radius: 20px;
    padding: 36px 28px;
    text-align: center;
    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
    animation: echoVerifyIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes echoVerifyIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: none; }
  }

  .echo-verify-icon {
    display: grid;
    place-items: center;
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(108,60,225,0.18), rgba(236,72,153,0.18));
    border: 1px solid rgba(167,139,250,0.4);
    color: #A78BFA;
  }

  .echo-verify-title {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.4px;
    margin: 0 0 8px;
  }
  .echo-verify-sub {
    font-size: 14px;
    color: var(--text-secondary, #a1a1aa);
    margin: 0 0 4px;
  }
  .echo-verify-email {
    font-size: 15px;
    font-weight: 700;
    color: #A78BFA;
    word-break: break-all;
    margin: 0 0 12px;
  }
  .echo-verify-hint {
    font-size: 13px;
    color: var(--text-muted, #71717a);
    line-height: 1.5;
    margin: 0 0 20px;
  }

  .echo-verify-info {
    background: rgba(16,185,129,0.1);
    border: 1px solid rgba(16,185,129,0.3);
    color: #34D399;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
    margin-bottom: 16px;
  }
  .echo-verify-error {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.3);
    color: #F87171;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
    margin-bottom: 16px;
  }

  .echo-verify-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 22px;
  }

  .echo-verify-btn-primary,
  .echo-verify-btn-secondary {
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
    transition: transform 0.15s ease, opacity 0.15s ease, box-shadow 0.2s ease;
    min-height: 46px;
  }
  .echo-verify-btn-primary {
    background: linear-gradient(135deg, #6C3CE1, #EC4899);
    color: #fff;
    border: none;
    box-shadow: 0 8px 24px rgba(108,60,225,0.35);
  }
  .echo-verify-btn-primary:not(:disabled):hover {
    box-shadow: 0 12px 32px rgba(108,60,225,0.5);
    transform: translateY(-1px);
  }
  .echo-verify-btn-secondary {
    background: transparent;
    color: var(--text-primary, #fff);
    border: 1px solid var(--border-color, rgba(255,255,255,0.08));
  }
  .echo-verify-btn-secondary:not(:disabled):hover {
    background: rgba(255,255,255,0.04);
    border-color: rgba(108,60,225,0.5);
  }
  .echo-verify-btn-primary:disabled,
  .echo-verify-btn-secondary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .echo-verify-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: #fff;
    border-radius: 50%;
    animation: echoVerifySpin 0.7s linear infinite;
  }
  @keyframes echoVerifySpin { to { transform: rotate(360deg); } }

  .echo-verify-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted, #71717a);
    padding-top: 18px;
    border-top: 1px solid var(--border-color, rgba(255,255,255,0.06));
  }
  .echo-verify-link {
    background: none;
    border: none;
    color: #A78BFA;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }
  .echo-verify-link:hover { text-decoration: underline; }

  .echo-verify-tips {
    margin-top: 22px;
    text-align: left;
    font-size: 12.5px;
    color: var(--text-muted, #71717a);
  }
  .echo-verify-tips strong {
    display: block;
    margin-bottom: 6px;
    color: var(--text-secondary, #a1a1aa);
  }
  .echo-verify-tips ul {
    margin: 0;
    padding-left: 18px;
    line-height: 1.7;
  }
`;

export default VerifyEmailScreen;
