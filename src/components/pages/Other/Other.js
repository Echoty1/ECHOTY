// src/components/pages/Other/Other.js
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../contexts/ThemeContext';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './Other.css';

const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

const Other = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { themePreference, setTheme } = useTheme();
  const isSupport = user?.uid === SUPPORT_UID;

  // ─── Load Myhappr widget script ──────────────────────────────
  useEffect(() => {
    if (document.querySelector('script[src="https://myhappr.com/widget.js"]')) return;

    const script = document.createElement('script');
    script.src = 'https://myhappr.com/widget.js';
    script.async = true;
    script.setAttribute('data-username', 'echoty');
    script.setAttribute('data-color', '#9D5EFF');
    script.setAttribute('data-button-color', '#9D5EFF');
    script.setAttribute('data-text-color', '#FFFFFF');
    script.setAttribute('data-radius', '8px');
    script.setAttribute('data-text', 'Support ECHO ☕');
    script.setAttribute('data-title', 'Keep the Echo Alive');
    script.setAttribute('data-theme', 'light');
    script.setAttribute('data-card-bg', '#FFFFFF');
    script.setAttribute('data-card-text', '#09090b');
    document.body.appendChild(script);
  }, []);

  // ─── Quick action items ──────────────────────────────────────
  const primaryActions = [
    {
      id: 'profile',
      label: 'Profile',
      icon: 'fa-user-circle',
      path: '/profile',
      description: 'Manage your identity',
      color: '#6C3CE1',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'fa-sliders-h',
      path: '/settings',
      description: 'App & account preferences',
      color: '#EC4899',
    },
  ];

  // ─── Secondary Actions – Shop only for admin ──────────────────
  const secondaryActions = [
    {
      id: 'coins',
      label: 'Get Coins',
      icon: 'fa-coins',
      path: '/coins',
      description: 'Purchase virtual currency',
      color: '#FBBF24',
    },
  ];

  // Admin gets Shop
  if (isSupport) {
    secondaryActions.unshift({
      id: 'shop',
      label: 'Shop',
      icon: 'fa-store',
      path: '/shop',
      description: 'Manage skins & GIFs',
      color: '#F59E0B',
    });
  }

  // ─── Legal – consolidated into single page ────────────────────
  const legalActions = [
    {
      id: 'legal',
      label: 'Legal & Policies',
      icon: 'fa-gavel',
      path: '/legal',
      description: 'Terms, Privacy, and Report',
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const MYHAPPR_URL = 'https://myhappr.co/@echoty';

  return (
    <>
      <SEO title="More" description="Explore additional features and policies on ECHO." />
      <StructuredData />
      <div className="other-page">
        {/* ─── Header ────────────────────────────────────────────── */}
        <div className="other-header">
          <div className="other-header-icon">
            <i className="fas fa-ellipsis-h" />
          </div>
          <h1>More</h1>
          <p>Explore everything ECHO has to offer</p>
        </div>

        {/* ─── Quick Settings ────────────────────────────────────── */}
        <div className="other-quick-settings">
          <div
            className="other-quick-card theme-toggle"
            onClick={() => setTheme(themePreference === 'dark' ? 'light' : 'dark')}
          >
            <i className={`fas ${themePreference === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
            <span>{themePreference === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </div>
          <div className="other-quick-card logout" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt" />
            <span>Logout</span>
          </div>
        </div>

        {/* ─── Primary Actions ───────────────────────────────────── */}
        <div className="other-section">
          <div className="other-section-title">Account</div>
          <div className="other-grid primary-grid">
            {primaryActions.map((item) => (
              <div
                key={item.id}
                className="other-grid-item primary"
                style={{ '--item-color': item.color }}
                onClick={() => navigate(item.path)}
              >
                <div className="other-grid-icon" style={{ background: `${item.color}20`, color: item.color }}>
                  <i className={`fas ${item.icon}`} />
                </div>
                <div className="other-grid-content">
                  <div className="other-grid-label">{item.label}</div>
                  <div className="other-grid-desc">{item.description}</div>
                </div>
                <i className="fas fa-chevron-right other-grid-arrow" />
              </div>
            ))}
          </div>
        </div>

        {/* ─── Secondary Actions ────────────────────────────────── */}
        <div className="other-section">
          <div className="other-section-title">Explore</div>
          <div className="other-grid secondary-grid">
            {secondaryActions.map((item) => (
              <div
                key={item.id}
                className="other-grid-item secondary"
                style={{ '--item-color': item.color }}
                onClick={() => navigate(item.path)}
              >
                <div className="other-grid-icon" style={{ background: `${item.color}20`, color: item.color }}>
                  <i className={`fas ${item.icon}`} />
                </div>
                <div className="other-grid-content">
                  <div className="other-grid-label">{item.label}</div>
                  <div className="other-grid-desc">{item.description}</div>
                </div>
                <i className="fas fa-chevron-right other-grid-arrow" />
              </div>
            ))}
          </div>
        </div>

        {/* ─── Legal Actions ────────────────────────────────────── */}
        <div className="other-section">
          <div className="other-section-title">Legal</div>
          <div className="other-legal-grid">
            {legalActions.map((item) => (
              <div
                key={item.id}
                className="other-legal-item"
                onClick={() => navigate(item.path)}
              >
                <i className={`fas ${item.icon}`} />
                <span>{item.label}</span>
                <i className="fas fa-chevron-right other-legal-arrow" />
              </div>
            ))}
          </div>
        </div>

        {/* ─── Footer ────────────────────────────────────────────── */}
        <div className="other-footer">
          <span>ECHO v{process.env.REACT_APP_VERSION || '2.0'}</span>
          <span>•</span>
          <span>Made with ❤️</span>
        </div>
      </div>
    </>
  );
};

export default Other;