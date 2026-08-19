// src/components/Layout/Navbar.js
import React, { useEffect, memo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../../contexts/ProfileContext';
import { db } from '../../services/firebase';
import { ref, onValue } from 'firebase/database';
import ECHOMOJI from '../UI/ECHOMOJI';
import { getSkinById } from '../../constants/echomoji';
import Avatar from '../common/Avatar';
import { preloadMedia } from '../../utils/mediaCache';
import { getProfile as getCachedProfile } from '../../services/cacheService';

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
  const { fetchProfile, getProfile, isOnline } = useProfile();

  // ─── State for partner's active skin (from userSkins) ──────
  const [partnerActiveSkin, setPartnerActiveSkin] = useState(null);

  const pathParts = location.pathname.split('/');
  const targetUserId = pathParts[1] === 'chat' ? pathParts[2] : undefined;
  const isChatRoute = location.pathname.startsWith('/chat/');
  const isEchoAiRoute = targetUserId === 'echo_ai_assistant';

  // ─── Load cached profile + skin immediately ──────────────────
  useEffect(() => {
    if (!targetUserId || isEchoAiRoute) return;
    const cached = getCachedProfile(targetUserId);
    if (cached && cached.activeSkin) {
      setPartnerActiveSkin(cached.activeSkin);
    }
  }, [targetUserId, isEchoAiRoute]);

  // ─── Listen to partner's active skin from userSkins ────────
  useEffect(() => {
    if (!targetUserId || isEchoAiRoute) {
      setPartnerActiveSkin(null);
      return;
    }

    const skinRef = ref(db, `userSkins/${targetUserId}/activeSkin`);
    const unsubscribe = onValue(skinRef, (snapshot) => {
      const skin = snapshot.val();
      setPartnerActiveSkin(skin || null);
      // Also update cache
      const cached = getCachedProfile(targetUserId);
      if (cached) {
        cached.activeSkin = skin || null;
        // We'll rely on the cache service to update
      }
    });

    return () => unsubscribe();
  }, [targetUserId, isEchoAiRoute]);

  // ─── Fetch profiles ──────────────────────────────────────────
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

  const chatAvatar = isEchoAiRoute
    ? ECHO_AI_GIF
    : location.state?.userAvatar || targetProfile?.avatar || '';

  const chatName = isEchoAiRoute
    ? 'ECHO AI'
    : sanitizeName(location.state?.userName || targetProfile?.name, targetUserId);

  useEffect(() => {
    if (chatAvatar) {
      preloadMedia(chatAvatar);
    }
  }, [chatAvatar]);

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

  // ─── Partner's mood and skin ─────────────────────────────────
  const partnerMood = targetProfile?.mood || 'happy';
  // ✅ Use partnerActiveSkin from userSkins (already cached, instant)
  const partnerSkinId = partnerActiveSkin || targetProfile?.activeSkin || null;
  const partnerSkin = partnerSkinId ? getSkinById(partnerSkinId) : null;

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

        {/* ─── Chat Partner Info ───────────────────────────────── */}
        {isChatRoute && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <Avatar src={chatAvatar} name={chatName} size={38} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '14px', lineHeight: '1.2' }}>
                  {chatName}
                </span>
                {/* ✅ Partner's ECHOMOJI – instant skin from cache */}
                <ECHOMOJI
                  mood={partnerMood}
                  skin={partnerSkin}
                  size={32}
                  interactive={false}
                  animated={true}
                />
              </div>
              <span style={{ color: statusColor, fontSize: '11px', marginTop: '1px' }}>
                {statusText}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT SECTION – only user name and logout ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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