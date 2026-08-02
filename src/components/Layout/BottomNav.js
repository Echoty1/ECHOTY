import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', icon: 'fa-home', label: 'Feed' },
  { to: '/search', icon: 'fa-search', label: 'Search' },
  { to: '/chat', icon: 'fa-comment-dots', label: 'Chat' },
  { to: '/events', icon: 'fa-calendar', label: 'Events' },
  { to: '/groups', icon: 'fa-users', label: 'Groups' },
  { to: '/marketplace', icon: 'fa-store', label: 'Market' },
  { to: '/profile', icon: 'fa-user', label: 'Profile' },
  { to: '/donations', icon: 'fa-heart', label: 'Donate' },
];

const BottomNav = () => {
  return (
    <nav style={{
      position: 'fixed',
      bottom: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      background: 'rgba(10,10,15,0.95)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: '20px',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '6px 8px',
      height: '60px',
      width: 'calc(100% - 32px)',
      maxWidth: '550px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    }}>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => 
            `nav-item ${isActive ? 'active' : ''}`
          }
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: isActive ? 'white' : '#555',
            fontSize: '10px',
            transition: 'all 0.3s ease',
            padding: '4px 8px',
            borderRadius: '14px',
            cursor: 'pointer',
            background: isActive ? 'rgba(108,60,225,0.15)' : 'transparent',
            border: 'none',
            gap: '1px',
            position: 'relative',
            minWidth: '40px',
            flex: 1,
            textDecoration: 'none'
          })}
        >
          <i className={`fas ${item.icon}`} style={{ fontSize: '20px', transition: 'all 0.3s ease' }} />
          <span style={{ fontSize: '8px', opacity: 0.7 }}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default BottomNav;