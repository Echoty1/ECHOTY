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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const MYHAPPR_URL = 'https://myhappr.co/@echoty';

  // ─── Menu items – simplified list ─────────────────────────────
  const menuItems = [
    {
      id: 'profile',
      label: 'Profile',
      icon: 'fa-user-circle',
      path: '/profile',
      description: 'Manage your identity',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'fa-sliders-h',
      path: '/settings',
      description: 'App & account preferences',
    },
    {
      id: 'coins',
      label: 'Get Coins',
      icon: 'fa-coins',
      path: '/coins',
      description: 'Purchase virtual currency',
    },
    {
      id: 'legal',
      label: 'Legal & Policies',
      icon: 'fa-gavel',
      path: '/legal',
      description: 'Terms, Privacy, and Report',
    },
  ];

  // ─── Theme toggle and logout buttons (quick settings) ─────────
  const quickSettings = [
    {
      id: 'theme',
      label: themePreference === 'dark' ? 'Light Mode' : 'Dark Mode',
      icon: themePreference === 'dark' ? 'fa-sun' : 'fa-moon',
      onClick: () => setTheme(themePreference === 'dark' ? 'light' : 'dark'),
      color: '#FBBF24',
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: 'fa-sign-out-alt',
      onClick: handleLogout,
      color: '#EF4444',
    },
  ];

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

        {/* ─── Quick Settings (Theme + Logout) ──────────────────── */}
        <div className="other-quick-settings">
          {quickSettings.map((item) => (
            <div
              key={item.id}
              className="other-quick-card"
              onClick={item.onClick}
              style={{ '--item-color': item.color }}
            >
              <i className={`fas ${item.icon}`} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {/* ─── Menu List ─────────────────────────────────────────── */}
        <div className="other-menu-list">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="other-menu-item"
              onClick={() => navigate(item.path)}
            >
              <div className="other-menu-icon">
                <i className={`fas ${item.icon}`} />
              </div>
              <div className="other-menu-content">
                <div className="other-menu-label">{item.label}</div>
                <div className="other-menu-desc">{item.description}</div>
              </div>
              <i className="fas fa-chevron-right other-menu-arrow" />
            </div>
          ))}
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