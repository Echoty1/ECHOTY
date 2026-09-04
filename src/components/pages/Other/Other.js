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

  const menuItems = [
    { id: 'profile', label: 'Profile', icon: 'fa-user-circle', path: '/profile', color: '#6C3CE1' },
    { id: 'settings', label: 'Settings', icon: 'fa-sliders-h', path: '/settings', color: '#EC4899' },
    { id: 'bookmarks', label: 'Bookmarks', icon: 'fa-bookmark', path: '/bookmarks', color: '#F59E0B' },
    { id: 'coins', label: 'Get Coins', icon: 'fa-coins', path: '/coins', color: '#FBBF24' },
    { id: 'about', label: 'About', icon: 'fa-info-circle', path: '/about', color: '#60A5FA' },
    { id: 'legal', label: 'Legal', icon: 'fa-gavel', path: '/legal', color: '#a78bfa' },
  ];

  return (
    <>
      <SEO title="Other" description="Account, bookmarks, about, and legal pages on ECHO." />
      <StructuredData />
      <div className="other-page">
        <header className="other-header">
          <h1>Other</h1>
          <p>Account tools and the fine print, in one place.</p>
        </header>

        <div className="other-grid">
          {menuItems.map((item) => (
            <button
              key={item.id}
              className="other-card"
              style={{ '--card-color': item.color }}
              onClick={() => navigate(item.path)}
            >
              <span className="other-card-icon" style={{ background: `${item.color}20`, color: item.color }}>
                <i className={`fas ${item.icon}`} />
              </span>
              <span className="other-card-label">{item.label}</span>
            </button>
          ))}
        </div>

        <p className="other-footer">ECHO · echoty.xyz</p>
      </div>
    </>
  );
};

export default Other;