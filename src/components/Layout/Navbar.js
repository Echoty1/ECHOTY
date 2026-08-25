// src/components/Layout/Navbar.js
import React, { useEffect, memo, useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../../contexts/ProfileContext';
import { useCall } from '../../contexts/CallContext';
import { db } from '../../services/firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import ECHOMOJI from '../UI/ECHOMOJI';
import { getSkinById } from '../../constants/echomoji';
import Avatar from '../common/Avatar';
import { preloadMedia } from '../../utils/mediaCache';
import NotificationModal from '../common/NotificationModal';
import ConfirmModal from '../common/ConfirmModal';

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
  const { startVideoCall } = useCall();

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const dropdownRef = useRef(null);
  const bellRef = useRef(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    loading: false,
    onConfirm: null,
  });

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const openConfirmModal = (config) => {
    setConfirmModal({
      isOpen: true,
      loading: false,
      ...config,
    });
  };

  const pathParts = location.pathname.split('/');
  const targetUserId = pathParts[1] === 'chat' ? pathParts[2] : undefined;
  const isChatRoute = location.pathname.startsWith('/chat/');
  const isEchoAiRoute = targetUserId === 'echo_ai_assistant';
  const isCommunityRoute = location.pathname.startsWith('/community/');
  const communityId = isCommunityRoute ? pathParts[2] : null;
  const [communityInfo, setCommunityInfo] = useState(null);

  // ─── Pages that need a back button ──────────────────────────
  const isProfileRoute = location.pathname === '/profile';
  const isSettingsRoute = location.pathname === '/settings';
  const isAboutRoute = location.pathname === '/about';
  const isTermsRoute = location.pathname === '/terms';
  const isPrivacyRoute = location.pathname === '/privacy';
  const isReportRoute = location.pathname === '/report';
  const isCoinsRoute = location.pathname === '/coins';

  const showBackButton =
    isChatRoute ||
    isCommunityRoute ||
    isProfileRoute ||
    isSettingsRoute ||
    isAboutRoute ||
    isTermsRoute ||
    isPrivacyRoute ||
    isReportRoute ||
    isCoinsRoute;

  // ─── Back destination ───────────────────────────────────────
  const getBackDestination = () => {
    if (isCommunityRoute) return '/communities';
    if (isChatRoute) {
      const fromCommunity = location.state?.fromCommunity;
      if (fromCommunity) return `/community/${fromCommunity}`;
      return '/chats';
    }
    if (isProfileRoute || isSettingsRoute) return '/other';
    if (isAboutRoute || isTermsRoute || isPrivacyRoute || isReportRoute) return '/other';
    if (isCoinsRoute) return '/shop';
    return '/';
  };

  // ─── Handle back: preserve scroll position ──────────────────
  const handleBack = () => {
    // If there's a history entry, go back naturally (preserves scroll)
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      // Fallback if no history (e.g., direct URL)
      navigate(getBackDestination());
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    const notifRef = ref(db, `adminNotifications/${user.uid}/messages`);
    const unsubscribe = onValue(notifRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      const msgs = Object.entries(data).map(([id, msg]) => ({
        id,
        ...msg,
      }));
      msgs.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(msgs);
      const unread = msgs.filter((m) => !m.read).length;
      setUnreadCount(unread);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const markAsRead = (msgId) => {
    if (!user?.uid) return;
    const notifRef = ref(db, `adminNotifications/${user.uid}/messages/${msgId}`);
    update(notifRef, { read: true });
  };

  const handleClearAll = () => {
    if (!user?.uid || notifications.length === 0) return;
    openConfirmModal({
      title: 'Clear All Messages',
      message: 'Are you sure you want to delete all notifications? This cannot be undone.',
      confirmText: 'Clear All',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, loading: true }));
        try {
          const notifRef = ref(db, `adminNotifications/${user.uid}/messages`);
          await remove(notifRef);
          setNotifications([]);
          setUnreadCount(0);
          setShowNotifications(false);
          setConfirmModal(prev => ({ ...prev, loading: false, isOpen: false }));
        } catch (err) {
          console.error('Failed to clear messages:', err);
          setConfirmModal(prev => ({ ...prev, loading: false }));
        }
      },
    });
  };

  const openNotification = (msg) => {
    setSelectedNotification(msg);
    setModalOpen(true);
    if (!msg.read) {
      markAsRead(msg.id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === msg.id ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    }
    setShowNotifications(false);
  };

  const toggleDropdown = () => {
    setShowNotifications((prev) => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        bellRef.current &&
        !bellRef.current.contains(e.target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (user?.uid) {
      const cleanup = fetchProfile(user.uid);
      return () => {
        if (typeof cleanup === 'function') cleanup();
      };
    }
  }, [user?.uid, fetchProfile]);

  useEffect(() => {
    if (!communityId) {
      setCommunityInfo(null);
      return;
    }
    const cRef = ref(db, `communities/${communityId}`);
    const unsub = onValue(cRef, (snap) => {
      if (!snap.exists()) {
        setCommunityInfo(null);
        return;
      }
      const d = snap.val() || {};
      setCommunityInfo({
        id: communityId,
        name: d.name || 'Community',
        image: d.image || '/images/communities/default.png',
        memberCount: Number(d.memberCount || 0),
      });
    });
    return () => unsub();
  }, [communityId]);

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
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 1000,
        boxSizing: 'border-box',
        color: 'var(--text-primary)',
      }}
    >
      {/* LEFT SECTION */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {showBackButton ? (
          <button
            onClick={handleBack}
            style={{
              background: 'none',
              border: '1px solid transparent',
              color: 'var(--text-primary)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '6px 10px',
              borderRadius: '8px',
              transition: 'background 0.2s, border-color 0.2s',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.borderColor = 'transparent';
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
              color: 'var(--text-primary)',
            }}
          >
            ECHO
          </span>
        )}

        {isCommunityRoute && communityInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <img
              src={communityInfo.image}
              alt=""
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1px solid var(--border-color)',
                flexShrink: 0,
              }}
              onError={(e) => {
                e.currentTarget.src = '/images/communities/default.png';
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: 14,
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '42vw',
                }}
              >
                {communityInfo.name}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                {communityInfo.memberCount.toLocaleString()} members
              </span>
            </div>
          </div>
        )}

        {isChatRoute && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              className="nav-chat-avatar"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-color)',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <Avatar src={chatAvatar} name={chatName} size={36} />
              {partnerSkin && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -6,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'var(--bg-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid var(--bg-primary)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  className="nav-chat-name"
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '14px',
                    lineHeight: '1.2',
                    maxWidth: '42vw',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {chatName}
                </span>
                <span className="nav-chat-echomoji">
                  <ECHOMOJI
                    mood={partnerMood}
                    skin={partnerSkin}
                    size={18}
                    interactive={false}
                    animated={false}
                  />
                </span>
              </div>
              <span style={{ color: statusColor, fontSize: '11px', marginTop: '1px' }}>
                {statusText}
              </span>
            </div>
          </div>
        )}

        {/* ─── For profile/legal pages, show page title ──────── */}
        {!isChatRoute && !isCommunityRoute && showBackButton && (
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {isProfileRoute && 'Profile'}
            {isSettingsRoute && 'Settings'}
            {isAboutRoute && 'About Us'}
            {isTermsRoute && 'Terms of Service'}
            {isPrivacyRoute && 'Privacy Policy'}
            {isReportRoute && 'Report'}
            {isCoinsRoute && 'Get Coins'}
          </span>
        )}
      </div>

      {/* RIGHT SECTION */}
      <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {isChatRoute && targetUserId && !isEchoAiRoute && isTargetOnline && (
          <button
            onClick={() => startVideoCall(targetUserId, chatName, chatAvatar)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            title="Start video call"
          >
            <i className="fas fa-video" />
          </button>
        )}

        {/* Notification Bell */}
        <div ref={bellRef} className="notification-bell-wrapper" style={{ position: 'relative' }}>
          <button
            onClick={toggleDropdown}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className="fas fa-bell" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  minWidth: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  border: '2px solid var(--bg-primary)',
                  lineHeight: 1,
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              ref={dropdownRef}
              className="notification-dropdown"
              style={{
                position: 'fixed',
                top: '60px',
                right: '16px',
                width: 'min(320px, calc(100vw - 32px))',
                maxHeight: 'min(360px, calc(100vh - 120px))',
                overflowY: 'auto',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 12px 40px var(--shadow-color)',
                padding: '8px 0',
                zIndex: 9999,
                transform: 'none !important',
                left: 'auto !important',
              }}
            >
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>
                  Notifications
                </span>
                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '16px',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      transition: 'color 0.2s, background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    title="Clear all messages"
                  >
                    <i className="fas fa-trash-alt" style={{ color: '#EF4444' }} />
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No notifications
                </div>
              ) : (
                notifications.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => openNotification(msg)}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: msg.read ? 'transparent' : 'rgba(108,60,225,0.08)',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = msg.read ? 'transparent' : 'rgba(108,60,225,0.08)';
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px' }}>
                        {msg.title || 'Admin Message'}
                      </span>
                      {!msg.read && (
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#6C3CE1',
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    <p
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                        margin: '4px 0 0 0',
                        lineHeight: '1.3',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '90%',
                      }}
                    >
                      {msg.body}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* User Info */}
        {ownSkin && (
          <ECHOMOJI
            mood={ownProfile?.mood || 'happy'}
            skin={ownSkin}
            size={30}
            interactive={false}
            animated={false}
          />
        )}
        <span
          className="nav-own-name"
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
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

      <NotificationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedNotification?.title || 'Admin Message'}
        body={selectedNotification?.body || ''}
        timestamp={selectedNotification?.timestamp}
      />

      <style>{`
        @media (max-width: 480px) {
          .nav-own-name { display: none !important; }
          .nav-chat-name { max-width: 28vw !important; font-size: 13px !important; }
          .nav-chat-echomoji { display: none !important; }
          .notification-bell-wrapper button { font-size: 18px !important; }
        }
        @media (max-width: 360px) {
          .nav-chat-name { max-width: 22vw !important; }
        }
      `}</style>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        loading={confirmModal.loading}
      />
    </nav>
  );
});

export default Navbar;