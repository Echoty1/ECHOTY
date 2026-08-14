// src/components/Layout/Navbar.js
import React, { useEffect, memo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../../contexts/ProfileContext';
import ECHOMOJI from '../UI/ECHOMOJI';
import { getSkinById } from '../../constants/echomoji';
import { useCachedImage, preloadMedia } from '../../utils/mediaCache';

// Static direct asset path for ECHO AI
const ECHO_AI_GIF = '/videos/library/Artificial Intelligence Ai GIF by Abdi Slick.gif';

const sanitizeName = (rawName, targetUid) => {
  if (!rawName) return 'User';
  const str = String(rawName).trim();
  if (
    str === targetUid ||
    (str.length >= 20 && !str.includes(' ') && /^[a-zA-Z0-9_-]+$/.test(str))
  ) {
    return 'User';
  }
  return str;
};

const Navbar = memo(() => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [imgError, setImgError] = useState(false);

  const pathParts = location.pathname.split('/');
  const targetUserId = pathParts[1] === 'chat' ? pathParts[2] : undefined;
  const isChatRoute = location.pathname.startsWith('/chat/');
  const isEchoAiRoute = targetUserId === 'echo_ai_assistant';

  const { fetchProfile, getProfile, isOnline } = useProfile();

  useEffect(() => {
    if (user?.uid) {
      const cleanup = fetchProfile(user.uid);
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    }
  }, [user?.uid, fetchProfile]);

  useEffect(() => {
    if (isChatRoute && targetUserId && !isEchoAiRoute) {
      const cleanup = fetchProfile(targetUserId);
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    }
  }, [isChatRoute, targetUserId, isEchoAiRoute, fetchProfile]);

  const targetProfile = isChatRoute && targetUserId && !isEchoAiRoute
    ? getProfile(targetUserId)
    : null;

  const ownProfile = user?.uid ? getProfile(user.uid) : null;

  // Avatar priority: If AI -> GIF; else use cached avatar or fallback
  const chatAvatar = isEchoAiRoute
    ? ECHO_AI_GIF
    : location.state?.userAvatar || targetProfile?.avatar || '';

  const chatName = isEchoAiRoute
    ? 'ECHO AI'
    : sanitizeName(location.state?.userName || targetProfile?.name, targetUserId);

  // ── Preload the avatar for faster display ──
  useEffect(() => {
    if (chatAvatar) {
      preloadMedia(chatAvatar);
    }
  }, [chatAvatar]);

  // ── Reset imgError when avatar changes ──
  useEffect(() => {
    setImgError(false);
  }, [chatAvatar]);

  // ── Use cached avatar image (returns URL if not cached) ──
  const cachedAvatar = useCachedImage(chatAvatar, null);
  const avatarToShow = cachedAvatar || chatAvatar;

  // ── Determine online status for non-AI chat ──
  const isTargetOnline = targetUserId && !isEchoAiRoute ? isOnline(targetUserId) : false;

  const statusText = isEchoAiRoute
    ? 'AI Assistant'
    : isTargetOnline
    ? 'Online'
    : 'Offline';

  const statusColor = isEchoAiRoute
    ? '#a78bfa'
    : isTargetOnline
    ? '#10B981'
    : '#6B7280';

  // ── Partner ECHOMOJI ──
  const partnerMood = targetProfile?.mood || 'happy';
  const partnerSkinId = targetProfile?.activeSkin || null;
  const partnerSkin = partnerSkinId ? getSkinById(partnerSkinId) : null;

  const ownSkin = ownProfile?.activeSkin ? getSkinById(ownProfile.activeSkin) : null;
  const ownName = sanitizeName(ownProfile?.name || ownProfile?.displayName || 'User', user?.uid);

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        backgroundColor: '#0A0A0F',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 1000,
        boxSizing: 'border-box',
      }}
    >
      {/* ── LEFT SECTION ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {isChatRoute ? (
          <button
            onClick={() => navigate('/chats')}
            style={{
              background: 'none',
              border: 'none',
              color: '#fff',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <i className="fas fa-arrow-left" />
          </button>
        ) : (
          <span
            style={{
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '1px',
              color: '#fff',
            }}
          >
            ECHO
          </span>
        )}

        {/* Chat Partner Header Details */}
        {isChatRoute && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {avatarToShow && !imgError ? (
                <img
                  key={chatAvatar}
                  src={avatarToShow}
                  alt={chatName}
                  onError={() => setImgError(true)}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>
                  {chatName[0]?.toUpperCase() || 'E'}
                </span>
              )}
              {partnerSkin && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: '#0A0A0F',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid #0A0A0F',
                  }}
                >
                  <ECHOMOJI
                    mood={partnerMood}
                    skin={partnerSkin}
                    size={18}
                    interactive={false}
                    animated={false}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px', lineHeight: '1.2' }}>
                {chatName}
              </span>
              <span style={{ color: statusColor, fontSize: '11px', marginTop: '2px' }}>
                {statusText}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT SECTION ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {!isChatRoute && ownSkin && (
          <ECHOMOJI
            mood={ownProfile?.mood || 'happy'}
            skin={ownSkin}
            size={30}
            interactive={false}
          />
        )}
        {!isChatRoute && (
          <span
            style={{
              fontSize: '14px',
              color: '#CCCCCC',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              maxWidth: '80px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {ownName}
          </span>
        )}
        <button
          onClick={logout}
          title="Log Out"
          aria-label="Log out"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#EF4444',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '10px',
          }}
        >
          <i className="fas fa-sign-out-alt" />
        </button>
      </div>
    </nav>
  );
});

export default Navbar;