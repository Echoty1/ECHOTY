// src/components/Layout/Navbar.js
import React, { useEffect, memo } from 'react';
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

  // ─── Fetch profiles ──────────────────────────────────────
  useEffect(() => {
    if (user?.uid) fetchProfile(user.uid);
  }, [user?.uid, fetchProfile]);

  useEffect(() => {
    if (isChatRoute && userId) fetchProfile(userId);
  }, [isChatRoute, userId, fetchProfile]);

  // ─── Get fresh data from context ────────────────────────
  const ownProfile = user?.uid ? getProfile(user.uid) : null;
  const partnerProfile = isChatRoute && userId ? getProfile(userId) : null;
  const partnerIsOnline = isChatRoute && userId ? isOnline(userId) : false;

  // ─── Compute display values ──────────────────────────────
  const ownName = ownProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'User';
  const partnerName = partnerProfile?.name || userId || 'User';

  // ─── Partner EchoMoji ─────────────────────────────────────
  const getPartnerEchomoji = () => {
    if (!partnerProfile) return null;
    const mood = partnerProfile.mood || 'neutral';
    const skinId = partnerProfile.activeSkin;
    const skin = skinId ? getSkinById(skinId) : null;
    return { mood, skin };
  };
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
        background: 'rgba(10,10,15,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '10px 16px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
      }}
    >
      {/* ─── LEFT ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '44px', flexShrink: 0 }}>
        {isChatRoute ? (
          <button
            onClick={() => navigate('/chats')}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px 6px',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#888')}
          >
            ←
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                color: 'white',
              }}
            >
              E
            </span>
            <span
              style={{
                background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: '20px',
                fontWeight: 900,
              }}
            >
              ECHO
            </span>
          </div>
        )}
      </div>

      {/* ─── CENTER ────────────────────────────────────────── */}
      {isChatRoute && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            minWidth: 0,
            padding: '0 6px',
            overflow: 'hidden',
          }}
        >
          {isLoadingPartner ? (
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
          ) : (
            <>
              {/* ─── Avatar ─────────────────────────────────── */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                {partnerProfile?.avatar ? (
                  <img
                    src={partnerProfile.avatar}
                    alt={partnerProfile.name}
                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '16px',
                      color: '#fff',
                    }}
                  >
                    {partnerName[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <span
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    border: '2px solid #0A0A0F',
                    background: partnerIsOnline ? '#10B981' : '#EF4444',
                  }}
                />
              </div>

              {/* ─── Name & Status ─────────────────────────── */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  lineHeight: 1.2,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {partnerName}
                </span>
                <span style={{ fontSize: '11px', color: '#666' }}>
                  {partnerIsOnline ? '🟢 Online' : '🔴 Offline'}
                </span>
              </div>

              {/* ─── EchoMoji ───────────────────────────────── */}
              {echomoji && (
                <div style={{ flexShrink: 0, marginLeft: '4px' }}>
                  <ECHOMOJI
                    key={`${echomoji.mood}-${echomoji.skin?.id || 'default'}`}
                    mood={echomoji.mood}
                    skin={echomoji.skin}
                    size={36}
                    interactive={false}
                  />
                </div>
              )}
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
          {isLoadingOwn ? '...' : ownName}
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