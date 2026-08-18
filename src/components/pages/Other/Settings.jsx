// src/components/pages/Other/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../../../services/firebase';
import { ref, remove } from 'firebase/database';
import {
  deleteUser,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  EmailAuthProvider,
} from 'firebase/auth';
import { removeAllReferencesToUser } from '../../../services/accountCleanup';
import './Settings.css';

// ─── Demo constants ────────────────────────────────────────────
const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';

const Settings = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState('idle');
  const [typedName, setTypedName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isReauthing, setIsReauthing] = useState(false);

  const userName = user?.name || user?.displayName || user?.email?.split('@')[0] || '';
  const isGoogleUser = user?.providerData?.some(p => p.providerId === 'google.com');
  const isDemoUser = user?.uid === DEMO_UID;

  // Redirect after deletion animation
  useEffect(() => {
    if (step === 'done') {
      const timer = setTimeout(() => {
        navigate('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [step, navigate]);

  const handleDeleteRequest = () => {
    if (isDemoUser) {
      setError('Demo accounts cannot be deleted.');
      return;
    }
    setStep('verify');
    setError('');
  };

  const handleVerify = () => {
    if (typedName.trim() === userName) {
      setStep('reauth');
      setError('');
    } else {
      setError('Name does not match. Please type your exact name.');
    }
  };

  const handleReauth = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setError('No user found. Please sign in again.');
      return;
    }

    setIsReauthing(true);
    setError('');

    try {
      if (isGoogleUser) {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(currentUser, provider);
      } else {
        if (!password.trim()) {
          setError('Please enter your password.');
          setIsReauthing(false);
          return;
        }
        const credential = EmailAuthProvider.credential(currentUser.email, password);
        await reauthenticateWithCredential(currentUser, credential);
      }
      setStep('confirm');
    } catch (err) {
      console.error('Re-auth error:', err);
      if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Re-authentication cancelled. Please try again.');
      } else {
        setError(`Re-authentication failed: ${err.message}`);
      }
    } finally {
      setIsReauthing(false);
    }
  };

  const handleConfirmDelete = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError('No user found. Please sign in again.');
      return;
    }

    setStep('deleting');

    try {
      const uid = currentUser.uid;

      // 1. Delete essential data from Realtime Database
      const nodesToDelete = ['profiles', 'userChats', 'userSkins'];
      const deletePromises = nodesToDelete.map(node => {
        const nodeRef = ref(db, `${node}/${uid}`);
        return remove(nodeRef).catch(err => {
          console.warn(`Failed to delete ${node}:`, err);
        });
      });
      await Promise.all(deletePromises);

      // 2. Remove all references to this user from other users' userChats
      await removeAllReferencesToUser(uid);

      // 3. Delete the user's authentication account
      await deleteUser(currentUser);

      // 4. Show success animation
      setStep('done');
    } catch (err) {
      console.error('Error deleting account:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Please re-authenticate again and try.');
        setStep('reauth');
      } else {
        setError(`Failed to delete account: ${err.message}`);
        setStep('idle');
      }
    }
  };

  const handleCancel = () => {
    setStep('idle');
    setTypedName('');
    setPassword('');
    setError('');
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="settings-back" onClick={() => navigate('/other')}>
          ← Back
        </button>
        <h1>Settings</h1>
      </div>

      <div className="settings-content">
        <div className="settings-card danger-zone">
          <h2><i className="fas fa-exclamation-triangle" /> Danger Zone</h2>
          <p>This action is irreversible. Deleting your account will permanently remove all your data, including messages, profile, and Echoes.</p>

          {isDemoUser && (
            <p style={{ color: '#f59e0b', marginBottom: '12px' }}>
              <i className="fas fa-info-circle" /> Demo accounts cannot be deleted.
            </p>
          )}

          {step === 'idle' && (
            <button 
              className="btn-danger" 
              onClick={handleDeleteRequest}
              disabled={isDemoUser}
              style={{ opacity: isDemoUser ? 0.5 : 1, cursor: isDemoUser ? 'not-allowed' : 'pointer' }}
            >
              <i className="fas fa-trash-alt" /> Delete Account
            </button>
          )}

          {step === 'verify' && (
            <div className="verify-section">
              <p>Please type your name <strong>"{userName}"</strong> to confirm:</p>
              <input
                type="text"
                className="verify-input"
                placeholder="Type your name..."
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                autoFocus
              />
              {error && <p className="error-text">{error}</p>}
              <div className="verify-actions">
                <button className="btn-verify" onClick={handleVerify}>Verify</button>
                <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
              </div>
            </div>
          )}

          {step === 'reauth' && (
            <div className="reauth-section">
              <p>
                For security, please re-authenticate your account.
                {isGoogleUser ? (
                  ' Click the button below to re-authenticate with Google.'
                ) : (
                  ' Enter your password to continue.'
                )}
              </p>
              {!isGoogleUser && (
                <input
                  type="password"
                  className="verify-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
              {error && <p className="error-text">{error}</p>}
              <div className="verify-actions">
                <button className="btn-verify" onClick={handleReauth} disabled={isReauthing}>
                  {isReauthing ? 'Authenticating...' : 'Continue'}
                </button>
                <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="confirm-section">
              <p><i className="fas fa-exclamation-circle" /> This action <strong>cannot be undone</strong>. All your data will be permanently deleted.</p>
              <div className="confirm-actions">
                <button className="btn-danger" onClick={handleConfirmDelete}>
                  Yes, Delete My Account
                </button>
                <button className="btn-cancel" onClick={handleCancel}>No, Keep It</button>
              </div>
            </div>
          )}

          {step === 'deleting' && (
            <div className="deleting-section">
              <div className="spinner"></div>
              <p>Deleting your account...</p>
            </div>
          )}

          {step === 'done' && (
            <div className="done-section">
              <div className="echo-animation">
                <div className="ripple"></div>
                <div className="ripple"></div>
                <div className="ripple"></div>
              </div>
              <p>Account deleted successfully. Goodbye! 👋</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;