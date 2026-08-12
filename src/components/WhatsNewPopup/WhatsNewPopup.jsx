// src/components/WhatsNewPopup/WhatsNewPopup.jsx
import React, { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../../services/firebase';

const WhatsNewPopup = ({ uid }) => {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(null);
  const [messageHtml, setMessageHtml] = useState('');

  useEffect(() => {
    const fetchAndCheck = async () => {
      try {
        const snapshot = await get(ref(db, 'appConfig/changelog'));
        if (snapshot.exists()) {
          const data = snapshot.val();
          const currentVersion = data.version || '1.0.0';
          const storedVersion = localStorage.getItem('echo_changelog_version');
          if (storedVersion !== currentVersion) {
            // Show popup
            setVersion(currentVersion);
            setMessageHtml(data.messageHtml || '<p>Welcome to the new version!</p>');
            setVisible(true);
          } else {
            setVisible(false);
          }
        } else {
          // No changelog – don't show
          setVisible(false);
        }
      } catch (err) {
        console.error('Failed to fetch changelog:', err);
        setVisible(false);
      } finally {
        setLoading(false);
      }
    };

    fetchAndCheck();
  }, []);

  const handleGotIt = () => {
    if (version) {
      localStorage.setItem('echo_changelog_version', version);
    }
    setVisible(false);
  };

  if (!visible || loading) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <span style={styles.icon}>🎉</span>
          <h2>What's New</h2>
        </div>
        <div style={styles.body} dangerouslySetInnerHTML={{ __html: messageHtml }} />
        <div style={styles.footer}>
          <button style={styles.button} onClick={handleGotIt}>
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#1a1a24',
    borderRadius: '20px',
    padding: '32px',
    maxWidth: '420px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
  },
  icon: {
    fontSize: '32px',
  },
  body: {
    color: '#ccc',
    fontSize: '15px',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  button: {
    background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
    border: 'none',
    color: '#fff',
    padding: '12px 32px',
    borderRadius: '50px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
};

export default WhatsNewPopup;