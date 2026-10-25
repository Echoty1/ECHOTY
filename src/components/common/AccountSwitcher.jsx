import React, { useEffect, useRef } from 'react';
import './AccountSwitcher.css';

const AccountSwitcher = ({ 
  currentUser, 
  savedAccounts, 
  onSwitchAccount, 
  onAddAccount, 
  onSignOutAll,
  isOpen,
  onClose
}) => {
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="account-switcher-backdrop" onClick={onClose}>
      <div className="account-switcher-dropdown" ref={wrapperRef} onClick={(e) => e.stopPropagation()}>
        
        {/* Active Account */}
        <div className="account-item active">
          <div className="account-avatar-wrapper">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="Avatar" />
            ) : (
              <div className="account-avatar-fallback" style={{ background: '#E65C00' }}>
                {(currentUser?.name || 'E').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="account-edit-badge">
              <i className="fas fa-pencil-alt" />
            </div>
          </div>
          <div className="account-info">
            <span className="account-name">{currentUser?.name || 'ECHO'}</span>
            <span className="account-email">{currentUser?.email || 'user@echoty.xyz'}</span>
          </div>
          <button className="account-collapse-btn" onClick={onClose}>
            <i className="fas fa-chevron-up" />
          </button>
        </div>

        <div className="account-divider" />

        {/* Saved Accounts */}
        {savedAccounts.map((acc) => {
          const isExpired = acc.sessionExpired;
          return (
            <div 
              key={acc.uid} 
              className={`account-item ${isExpired ? 'expired' : 'clickable'}`}
              onClick={() => !isExpired && onSwitchAccount(acc)}
            >
              <div className="account-avatar-wrapper">
                {acc.avatar ? (
                  <img src={acc.avatar} alt="Avatar" />
                ) : (
                  <div className="account-avatar-fallback">
                    {(acc.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="account-info">
                <span className="account-name">{acc.name}</span>
                <span className="account-email">{acc.email}</span>
              </div>
              {isExpired && <span className="account-session-badge">Session expired</span>}
            </div>
          );
        })}

        <div className="account-divider" />

        <button className="account-action-btn" onClick={onAddAccount}>
          <div className="action-icon-circle">
            <i className="fas fa-plus" />
          </div>
          <span>Add another account</span>
        </button>

        <div className="account-divider" />

        <button className="account-action-btn sign-out" onClick={onSignOutAll}>
          <div className="action-icon-circle">
            <i className="fas fa-sign-out-alt" />
          </div>
          <span>Sign out of all accounts</span>
        </button>
      </div>
    </div>
  );
};

export default AccountSwitcher;
