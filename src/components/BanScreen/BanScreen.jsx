// src/components/BanScreen/BanScreen.jsx
import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import './BanScreen.css';

const BanScreen = () => {
  const { user, banInfo, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="ban-screen">
      <div className="ban-card">
        <div className="ban-icon">
          <i className="fas fa-ban" />
        </div>
        <h1>Account Suspended</h1>
        <p className="ban-reason">
          <strong>Reason:</strong> {banInfo.reason || 'Violation of our terms of service.'}
        </p>
        <p className="ban-message">
          Your account has been suspended by the ECHO admin team. If you believe this is a mistake, please contact support.
        </p>
        <button className="ban-logout-btn" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt" /> Log Out
        </button>
      </div>
    </div>
  );
};

export default BanScreen;