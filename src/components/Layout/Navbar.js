// src/components/Layout/Navbar.js
import React, { useEffect, memo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../../contexts/ProfileContext';
import ECHOMOJI from '../UI/ECHOMOJI';
import { getSkinById } from '../../constants/echomoji';

const Navbar = memo(() => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ─── Parse userId from URL ──────────────────────────────
  const pathParts = location.pathname.split('/');
  const userId = pathParts[1] === 'chat' ? pathParts[2] : undefined;
  const isChatRoute = location.pathname.startsWith('/chat/');

  // ─── Use Profile Context ─────────────────────────────────
  const { profiles, presence, loading, fetchProfile, getProfile, isOnline } = useProfile();

  // ─── Fetch profiles with proper cleanup ────────────────────
  useEffect(() => {
    if (user?.uid) {
      const cleanup = fetchProfile(user.uid);
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    }
  }, [user?.uid, fetchProfile]);

  useEffect(() => {
    if (isChatRoute && userId) {
      const cleanup = fetchProfile(userId);
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    }
  }, [isChatRoute, userId, fetchProfile]);

  // ─── Get fresh data from context ────────────────────────
  const ownProfile = user?.uid ? getProfile(user.uid) : null;
  const partnerProfile = isChatRoute && userId ? getProfile(userId) : null;

  // ─── Compute display values ──────────────────────────────
  const ownName = ownProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'User';
  const partnerName = partnerProfile?.name || userId || 'User';

  // ─── Partner online status (from context) ────────────────
  const partnerOnline = isChatRoute && userId ? isOnline(userId) : false;

  // ─── Partner EchoMoji ─────────────────────────────────────
  const getPartnerEchomoji = () => {
    if (!partnerProfile) return null;
    const mood = partnerProfile.mood || 'neutral';
    const skinId = partnerProfile.activeSkin;
    const skin = skinId ? getSkinById(skinId) : null;
    return { mood, skin };
  };

  const ownSkinId = ownProfile?.activeSkin;
  const ownSkin = ownSkinId ? getSkinById(ownSkinId) : null;

  const echomoji = getPartnerEchomoji();
  const isLoadingOwn = loading && !ownProfile;
  const isLoadingPartner = isChatRoute && loading && !partnerProfile;

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'rgba(10, 10, 15, 0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        height: '60px',
        boxSizing: 'border-box',
      }}
    >
      {/* ─── LEFT ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: '44px',
        }}
      >
        {isChatRoute ? (
          <button
            onClick={() => navigate('/chats')}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#fff',
              fontSize: '16px',
              cursor: 'pointer',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s ease',
            }}
          >
            <i className="fas fa-arrow-left" />
          </button>
        ) : (
          <span
            style={{
              fontWeight: 800,
              fontSize: '20px',
              background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '1px',
            }}
          >
            ECHO
          </span>
        )}
      </div>

      {/* ─── CENTER (Chat partner info) ──────────────────── */}
      {isChatRoute && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            flex: 1,
            justifyContent: 'center',
          }}
          onClick={() => navigate(`/profile/${userId}`)}
        >
          {isLoadingPartner ? (
            <span style={{ color: '#666', fontSize: '13px' }}>Loading...</span>
          ) : (
            <>
              {echomoji?.skin && (
                <div style={{ flexShrink: 0 }}>
                  <ECHOMOJI
                    mood={echomoji.mood}
                    skin={echomoji.skin}
                    size={36}
                    interactive={false}
                  />
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '15px',
                    lineHeight: '1.2',
                  }}
                >
                  {partnerName}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    color: partnerOnline ? '#10B981' : '#6B7280',
                    fontWeight: 500,
                  }}
                >
                  {partnerOnline ? '🟢 Online' : '⚪ Offline'}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── RIGHT ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          minWidth: '44px',
          flexShrink: 0,
          justifyContent: 'flex-end',
        }}
      >
        {!isChatRoute && ownSkin && (
          <ECHOMOJI
            mood={ownProfile?.mood || 'happy'}
            skin={ownSkin}
            size={32}
            interactive={false}
          />
        )}
        <span
          style={{
            fontSize: '13px',
            color: '#888',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            maxWidth: '70px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {isChatRoute ? '' : isLoadingOwn ? '...' : ownName}
        </span>
        <button
          onClick={logout}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            fontSize: '18px',
            cursor: 'pointer',
            padding: '4px',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
        >
          <i className="fas fa-sign-out-alt" />
        </button>
      </div>
    </nav>
  );
});

Navbar.displayName = 'Navbar';
export default Navbar;