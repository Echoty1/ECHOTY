// src/components/pages/Other/Other.js
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import SEO from '../../common/SEO';
import StructuredData from '../../common/StructuredData';
import './Other.css';

const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';

const Other = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSupport = user?.uid === SUPPORT_UID;

  // Base menu for everyone
  const baseMenu = [
    {
      id: 'profile',
      label: 'Profile',
      icon: 'fa-user',
      path: '/profile',
      description: 'View and edit your profile',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'fa-gear',
      path: '/settings',
      description: 'Manage your account and preferences',
    },
    {
      id: 'about',
      label: 'About Us',
      icon: 'fa-info-circle',
      path: '/about',
      description: 'Learn more about ECHO and our mission',
    },
    {
      id: 'terms',
      label: 'Terms of Service',
      icon: 'fa-file-contract',
      path: '/terms',
      description: 'Read our terms and conditions',
    },
    {
      id: 'privacy',
      label: 'Privacy Policy',
      icon: 'fa-shield-alt',
      path: '/privacy',
      description: 'How we handle your data',
    },
    {
      id: 'report',
      label: 'Report a User',
      icon: 'fa-flag',
      path: '/report',
      description: 'Report inappropriate behavior',
    },
  ];

  // Admin: add Shop to the top (after Profile)
  const menuItems = isSupport
    ? [
        baseMenu[0], // Profile
        {
          id: 'shop',
          label: 'Shop',
          icon: 'fa-store',
          path: '/shop',
          description: 'Buy skins and premium GIFs',
        },
        ...baseMenu.slice(1), // rest
      ]
    : baseMenu; // non-admin: no Shop here

  return (
    <>
      <SEO
        title="Settings & Legal"
        description="Manage your ECHO settings, read our terms of service, privacy policy, and learn more about us."
      />
      <StructuredData />
      <div className="other-page">
        <div className="other-header">
          <h2 className="other-title">⚙️ More</h2>
          <p className="other-subtitle">Explore additional features and policies</p>
        </div>
        <div className="other-menu">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className="other-menu-item"
              onClick={() => navigate(item.path)}
            >
              <div className="other-icon-wrapper">
                <i className={`fas ${item.icon}`} />
              </div>
              <div className="other-item-content">
                <div className="other-item-label">{item.label}</div>
                <div className="other-item-desc">{item.description}</div>
              </div>
              <div className="other-item-arrow">
                <i className="fas fa-chevron-right" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Other;