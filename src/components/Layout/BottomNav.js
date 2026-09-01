// src/components/Layout/BottomNav.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCall } from '../../contexts/CallContext';
import { db } from '../../services/firebase';
import { ref, onValue, get } from 'firebase/database';

const SUPPORT_UID = 'hD7tJzPVI1VSorhok8GToBC6VDy1';
const DEFAULT_TAB_KEY = 'echo_default_tab';
const TAB_ORDER_KEY = 'echo_tab_order';

const haptic = (pattern = 12) => {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {}
};

const BottomNav = () => {
  const { user } = useAuth();
  const { startVideoCall } = useCall();
  const location = useLocation();
  const navigate = useNavigate();

  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [lastChatPreview, setLastChatPreview] = useState('');
  const [communityUnread, setCommunityUnread] = useState(0);
  const [controlUnread, setControlUnread] = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [coinBalance, setCoinBalance] = useState(0);
  const [swingKey, setSwingKey] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [defaultToast, setDefaultToast] = useState(null);
  const [spinningId, setSpinningId] = useState(null);
  const [pulseFlash, setPulseFlash] = useState(false);

  // Online call sheet
  const [onlineSheetOpen, setOnlineSheetOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]); // { uid, name, avatar, status }
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [callingUid, setCallingUid] = useState(null);

  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const swipeStartX = useRef(null);
  const swipeStartY = useRef(null);
  const swiping = useRef(false);
  const centerTouchY = useRef(null);
  const lastTapRef = useRef(0);
  const lastScrollY = useRef(0);
  const prevUnread = useRef(0);
  const statusMapRef = useRef({});

  const isSupport = user?.uid === SUPPORT_UID;

  const baseTabs = useMemo(() => {
    const common = [
      { to: '/', label: 'Home', icon: 'fa-house', id: 'home' },
      { to: '/chats', label: 'Chats', icon: 'fa-comment-dots', id: 'chats' },
      { to: '/communities', label: 'Communities', icon: 'fa-users', id: 'communities' },
      { to: '/shop', label: 'Shop', icon: 'fa-store', id: 'shop' },
    ];
    if (isSupport) {
      return [
        ...common,
        { to: '/control', label: 'Control', icon: 'fa-sliders-h', id: 'control' },
        { to: '/other', label: 'Other', icon: 'fa-ellipsis-h', id: 'other' },
      ];
    }
    return [...common, { to: '/other', label: 'Other', icon: 'fa-ellipsis-h', id: 'other' }];
  }, [isSupport]);

  const [tabOrder, setTabOrder] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TAB_ORDER_KEY) || 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (_) {}
    return null;
  });

  const orderedTabs = useMemo(() => {
    if (!tabOrder) return baseTabs;
    const map = Object.fromEntries(baseTabs.map((t) => [t.id, t]));
    const fromSaved = tabOrder.map((id) => map[id]).filter(Boolean);
    const missing = baseTabs.filter((t) => !tabOrder.includes(t.id));
    return [...fromSaved, ...missing];
  }, [baseTabs, tabOrder]);

  const activeIndex = useMemo(() => {
    const idx = orderedTabs.findIndex((t) => {
      if (t.to === '/') return location.pathname === '/';
      return location.pathname.startsWith(t.to);
    });
    return idx >= 0 ? idx : 0;
  }, [location.pathname, orderedTabs]);

  const activeTab = orderedTabs[activeIndex];
  const sideTabs = orderedTabs.filter((_, i) => i !== activeIndex);
  const leftTabs = sideTabs.slice(0, Math.ceil(sideTabs.length / 2));
  const rightTabs = sideTabs.slice(Math.ceil(sideTabs.length / 2));

  const hasPulse = unreadChatsCount > 0 || onlineCount > 0;

  useEffect(() => setSwingKey((k) => k + 1), [activeIndex]);

  useEffect(() => {
    if (unreadChatsCount > prevUnread.current) {
      setPulseFlash(true);
      haptic([10, 30, 10]);
      const t = setTimeout(() => setPulseFlash(false), 1600);
      prevUnread.current = unreadChatsCount;
      return () => clearTimeout(t);
    }
    prevUnread.current = unreadChatsCount;
  }, [unreadChatsCount]);

  useEffect(() => {
    const el = document.getElementById('main-content') || window;
    const getY = () => (el === window ? window.scrollY : el.scrollTop || 0);
    lastScrollY.current = getY();
    const onScroll = () => {
      const y = getY();
      const delta = y - lastScrollY.current;
      if (y > 50 && delta > 6) setHidden(true);
      else if (delta < -5 || y < 30) setHidden(false);
      lastScrollY.current = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setContextMenu(null);
    setSheetOpen(false);
    setSpinningId(null);
    setOnlineSheetOpen(false);
  }, [location.pathname]);

  const rememberOrder = useCallback(
    (nextActiveId) => {
      const ids = orderedTabs.map((t) => t.id);
      const without = ids.filter((id) => id !== nextActiveId);
      const mid = Math.floor(without.length / 2);
      const next = [...without.slice(0, mid), nextActiveId, ...without.slice(mid)];
      setTabOrder(next);
      localStorage.setItem(TAB_ORDER_KEY, JSON.stringify(next));
    },
    [orderedTabs]
  );

  const isUserOnline = (val) =>
    val === 'online' ||
    val === true ||
    val?.state === 'online' ||
    val?.isOnline === true ||
    val?.status === 'online';

  // Keep live status map + count
  useEffect(() => {
    return onValue(ref(db, 'status'), (snap) => {
      const data = snap.val() || {};
      statusMapRef.current = data;
      const count = Object.entries(data).filter(
        ([uid, s]) => uid !== user?.uid && isUserOnline(s)
      ).length;
      setOnlineCount(count);
    });
  }, [user?.uid]);

  // Load online users with profiles for mini page
  const openOnlineSheet = async () => {
    setContextMenu(null);
    setSheetOpen(false);
    setOnlineSheetOpen(true);
    setOnlineLoading(true);
    haptic(14);

    try {
      const data = statusMapRef.current || {};
      const uids = Object.entries(data)
        .filter(([uid, s]) => uid !== user?.uid && isUserOnline(s))
        .map(([uid]) => uid)
        .slice(0, 40);

      const profiles = await Promise.all(
        uids.map(async (uid) => {
          try {
            const snap = await get(ref(db, `users/${uid}`));
            const p = snap.exists() ? snap.val() : {};
            return {
              uid,
              name: p.name || p.displayName || p.username || 'User',
              avatar: p.avatar || p.photoURL || p.profileImage || '',
            };
          } catch (_) {
            return { uid, name: 'User', avatar: '' };
          }
        })
      );

      setOnlineUsers(profiles);
    } catch (err) {
      console.error('Online list failed:', err);
      setOnlineUsers([]);
    } finally {
      setOnlineLoading(false);
    }
  };

  const callUser = (person) => {
    if (!person?.uid || !startVideoCall) return;
    setCallingUid(person.uid);
    haptic([12, 24, 12]);
    try {
      startVideoCall(person.uid, person.name, person.avatar);
      setOnlineSheetOpen(false);
    } catch (err) {
      console.error('Call failed:', err);
    } finally {
      setTimeout(() => setCallingUid(null), 800);
    }
  };

  useEffect(() => {
    if (!user?.uid) {
      setUnreadChatsCount(0);
      setLastChatPreview('');
      return;
    }
    return onValue(ref(db, `userChats/${user.uid}`), (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setUnreadChatsCount(0);
        setLastChatPreview('');
        return;
      }
      let count = 0;
      let latest = null;
      Object.values(data).forEach((chat) => {
        if (chat.unreadCount > 0) count++;
        const ts = chat.lastMessageTime || chat.timestamp || 0;
        if (!latest || ts > latest.ts) {
          latest = {
            ts,
            text: chat.lastMessage || chat.lastMessageText || '',
            name: chat.userName || chat.name || 'Chat',
          };
        }
      });
      setUnreadChatsCount(count);
      setLastChatPreview(latest?.text ? `${latest.name}: ${latest.text}` : '');
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return setCommunityUnread(0);
    return onValue(ref(db, `userCommunityUnread/${user.uid}`), (snap) => {
      const val = snap.val();
      if (typeof val === 'number') setCommunityUnread(val);
      else if (val && typeof val === 'object') {
        setCommunityUnread(Object.values(val).reduce((a, b) => a + (Number(b) || 0), 0));
      } else setCommunityUnread(0);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !isSupport) return setControlUnread(0);
    return onValue(ref(db, `adminNotifications/${user.uid}/messages`), (snap) => {
      const data = snap.val();
      setControlUnread(data ? Object.values(data).filter((m) => !m.read).length : 0);
    });
  }, [user?.uid, isSupport]);

  useEffect(() => {
    if (!user?.uid) return setCoinBalance(0);
    return onValue(ref(db, `users/${user.uid}/coins`), (snap) => {
      setCoinBalance(Number(snap.val()) || 0);
    });
  }, [user?.uid]);

  const getBadge = (tab) => {
    if (tab.id === 'chats' && unreadChatsCount > 0)
      return unreadChatsCount > 9 ? '9+' : String(unreadChatsCount);
    if (tab.id === 'communities' && communityUnread > 0)
      return communityUnread > 9 ? '9+' : String(communityUnread);
    if (tab.id === 'control' && controlUnread > 0)
      return controlUnread > 9 ? '9+' : String(controlUnread);
    return null;
  };

  const getStatus = () => {
    if (!activeTab) return '';
    if (activeTab.id === 'home' && onlineCount > 0) return `${onlineCount} online`;
    if (activeTab.id === 'chats' && unreadChatsCount > 0) return `${unreadChatsCount} unread`;
    if (activeTab.id === 'shop' && coinBalance) return `${coinBalance} coins`;
    if (activeTab.id === 'communities' && communityUnread > 0) return `${communityUnread} new`;
    if (activeTab.id === 'control' && controlUnread > 0) return `${controlUnread} alerts`;
    return '';
  };

  const stopSpinSoon = () => setTimeout(() => setSpinningId(null), 380);

  const goToTab = (tab) => {
    if (!tab) return;
    const same =
      tab.to === '/' ? location.pathname === '/' : location.pathname.startsWith(tab.to);
    if (same) return;
    haptic(12);
    setSheetOpen(false);
    setContextMenu(null);
    setOnlineSheetOpen(false);
    setHidden(false);
    rememberOrder(tab.id);
    navigate(tab.to);
  };

  const goRelative = (dir) => {
    const next = orderedTabs[(activeIndex + dir + orderedTabs.length) % orderedTabs.length];
    setSpinningId(next.id);
    stopSpinSoon();
    goToTab(next);
  };

  const scrollToTop = () => {
    const el = document.getElementById('main-content');
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
    haptic(8);
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = (tab, e) => {
    longPressTriggered.current = false;
    clearLongPress();
    setSpinningId(tab.id);
    const x = e?.touches?.[0]?.clientX ?? e?.clientX ?? window.innerWidth / 2;
    const y = e?.touches?.[0]?.clientY ?? e?.clientY ?? window.innerHeight - 120;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      haptic([8, 20, 8]);
      setContextMenu({ tab, x, y });
      stopSpinSoon();
    }, 480);
  };

  const endPress = () => {
    clearLongPress();
    if (!longPressTriggered.current) stopSpinSoon();
  };

  const setAsDefault = (tab) => {
    localStorage.setItem(DEFAULT_TAB_KEY, tab.to);
    haptic([12, 30, 12]);
    setDefaultToast(`“${tab.label}” opens next visit`);
    setContextMenu(null);
    setTimeout(() => setDefaultToast(null), 2200);
  };

  const onTabClick = (tab, isCenter = false) => {
    if (longPressTriggered.current || swiping.current) {
      longPressTriggered.current = false;
      return;
    }
    setSpinningId(tab.id);
    stopSpinSoon();
    if (isCenter) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        lastTapRef.current = 0;
        scrollToTop();
        return;
      }
      lastTapRef.current = now;
    }
    goToTab(tab);
  };

  const onNavPointerDown = (e) => {
    const t = e.touches ? e.touches[0] : e;
    swipeStartX.current = t.clientX;
    swipeStartY.current = t.clientY;
    swiping.current = false;
  };
  const onNavPointerMove = (e) => {
    if (swipeStartX.current == null) return;
    const t = e.touches ? e.touches[0] : e;
    const dx = t.clientX - swipeStartX.current;
    const dy = t.clientY - (swipeStartY.current ?? t.clientY);
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      swiping.current = true;
      clearLongPress();
    }
  };
  const onNavPointerUp = (e) => {
    if (swipeStartX.current == null) return;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - swipeStartX.current;
    const dy = t.clientY - (swipeStartY.current ?? t.clientY);
    swipeStartX.current = null;
    swipeStartY.current = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
      swiping.current = true;
      if (dx < 0) goRelative(1);
      else goRelative(-1);
      setTimeout(() => {
        swiping.current = false;
      }, 200);
      return;
    }
    setTimeout(() => {
      swiping.current = false;
    }, 80);
  };

  const onCenterTouchStart = (e) => {
    centerTouchY.current = e.touches?.[0]?.clientY ?? null;
    startLongPress(activeTab, e);
  };
  const onCenterTouchEnd = (e) => {
    endPress();
    if (centerTouchY.current == null) return;
    const y = e.changedTouches?.[0]?.clientY;
    const dy = centerTouchY.current - y;
    centerTouchY.current = null;
    if (dy > 36 && !swiping.current) {
      haptic(14);
      setSpinningId(activeTab.id);
      stopSpinSoon();
      setSheetOpen(true);
    }
  };

  const status = getStatus();

  const initials = (name) => {
    const p = String(name || 'U').trim().split(/\s+/);
    return ((p[0]?.[0] || 'U') + (p[1]?.[0] || '')).toUpperCase();
  };

  const renderSide = (tab) => {
    const badge = getBadge(tab);
    const spinning = spinningId === tab.id;
    return (
      <button
        key={tab.id}
        type="button"
        className="echo-v-tab"
        onClick={() => onTabClick(tab)}
        onMouseDown={(e) => startLongPress(tab, e)}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        onTouchStart={(e) => startLongPress(tab, e)}
        onTouchEnd={endPress}
      >
        <div className={`echo-v-icon ${spinning ? 'silky-spin' : ''}`}>
          <i className={`fas ${tab.icon}`} />
          {badge && <span className="echo-v-badge">{badge}</span>}
        </div>
        <span className="echo-v-label">{tab.label}</span>
      </button>
    );
  };

  return (
    <nav
      className={`echo-v-nav ${hidden ? 'is-hidden' : ''}`}
      aria-label="Bottom navigation"
      onTouchStart={onNavPointerDown}
      onTouchMove={onNavPointerMove}
      onTouchEnd={onNavPointerUp}
      onMouseDown={onNavPointerDown}
      onMouseUp={onNavPointerUp}
    >
      {previewOpen && lastChatPreview && (
        <div className="echo-v-preview" onClick={() => setPreviewOpen(false)}>
          <span className="dot" />
          <span>{lastChatPreview}</span>
        </div>
      )}
      {defaultToast && <div className="echo-v-toast">{defaultToast}</div>}

      {/* Long-press menu */}
      {contextMenu && (
        <div className="echo-v-ctx-wrap">
          <div className="echo-v-ctx-bg" onClick={() => setContextMenu(null)} />
          <div
            className="echo-v-ctx"
            style={{
              left: Math.min(Math.max(16, contextMenu.x - 100), window.innerWidth - 220),
              bottom: 110,
            }}
          >
            <button type="button" onClick={() => { setContextMenu(null); goToTab(contextMenu.tab); }}>
              <i className="fas fa-arrow-up-right-from-square" /> Open {contextMenu.tab.label}
            </button>
            <button type="button" className="accent" onClick={openOnlineSheet}>
              <i className="fas fa-video" /> Call who’s online
              {onlineCount > 0 && <span className="ctx-count">{onlineCount}</span>}
            </button>
            <button type="button" onClick={() => setAsDefault(contextMenu.tab)}>
              <i className="fas fa-house" /> Open on next visit
            </button>
            <button type="button" onClick={() => { setContextMenu(null); scrollToTop(); }}>
              <i className="fas fa-arrow-up" /> Scroll to top
            </button>
          </div>
        </div>
      )}

      {/* Mini online page */}
      {onlineSheetOpen && (
        <div className="echo-online-wrap">
          <div className="echo-online-bg" onClick={() => setOnlineSheetOpen(false)} />
          <div className="echo-online-sheet">
            <div className="handle" />
            <div className="online-head">
              <div>
                <h3>Who’s online</h3>
                <p>{onlineLoading ? 'Loading…' : `${onlineUsers.length} available to call`}</p>
              </div>
              <button type="button" className="online-close" onClick={() => setOnlineSheetOpen(false)}>
                <i className="fas fa-xmark" />
              </button>
            </div>

            <div className="online-list">
              {onlineLoading && (
                <div className="online-empty">Finding people online…</div>
              )}
              {!onlineLoading && onlineUsers.length === 0 && (
                <div className="online-empty">
                  <i className="fas fa-moon" style={{ marginBottom: 8, opacity: 0.5 }} />
                  <div>No one online right now</div>
                </div>
              )}
              {!onlineLoading &&
                onlineUsers.map((person) => (
                  <button
                    key={person.uid}
                    type="button"
                    className={`online-row ${callingUid === person.uid ? 'calling' : ''}`}
                    onClick={() => callUser(person)}
                  >
                    <div className="online-avatar">
                      {person.avatar ? (
                        <img src={person.avatar} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <span>{initials(person.name)}</span>
                      )}
                      <i className="online-dot" />
                    </div>
                    <div className="online-meta">
                      <span className="online-name">{person.name}</span>
                      <span className="online-sub">Online · Tap to video call</span>
                    </div>
                    <span className="online-call-btn">
                      <i className="fas fa-video" />
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {sheetOpen && (
        <div className="echo-v-sheet-wrap">
          <div className="echo-v-sheet-bg" onClick={() => setSheetOpen(false)} />
          <div className="echo-v-sheet">
            <div className="handle" />
            <p>Quick actions</p>
            <div className="grid">
              {[
                { label: 'Chats', icon: 'fa-comment-dots', to: '/chats' },
                { label: 'Communities', icon: 'fa-users', to: '/communities' },
                { label: 'Shop', icon: 'fa-store', to: '/shop' },
                { label: 'Online', icon: 'fa-video', action: openOnlineSheet },
              ].map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    if (a.action) a.action();
                    else {
                      navigate(a.to);
                      haptic(10);
                    }
                  }}
                >
                  <i className={`fas ${a.icon}`} />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="echo-v-underlay" />
      <svg className="echo-v-svg" viewBox="0 0 400 90" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="vFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="50%" stopColor="rgba(167,139,250,0.1)" />
            <stop offset="100%" stopColor="rgba(108,60,225,0.12)" />
          </linearGradient>
          <linearGradient id="vLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="50%" stopColor="rgba(196,181,253,0.45)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
        </defs>
        <path
          d="M0,32 C70,32 110,32 145,32 C175,32 188,6 200,6 C212,6 225,32 255,32 C290,32 330,32 400,32 L400,90 L0,90 Z"
          fill="url(#vFill)"
        />
        <path
          d="M0,32 C70,32 110,32 145,32 C175,32 188,6 200,6 C212,6 225,32 255,32 C290,32 330,32 400,32"
          fill="none"
          stroke="url(#vLine)"
          strokeWidth="1.5"
        />
      </svg>

      <div className="echo-v-inner">
        <div className="echo-v-side">{leftTabs.map(renderSide)}</div>

        <div className="echo-v-center">
          <button
            key={swingKey}
            type="button"
            className={`echo-v-tab center ${hasPulse ? 'has-pulse' : ''} ${pulseFlash ? 'pulse-flash' : ''}`}
            onClick={() => onTabClick(activeTab, true)}
            onTouchStart={onCenterTouchStart}
            onTouchEnd={onCenterTouchEnd}
            onMouseDown={(e) => startLongPress(activeTab, e)}
            onMouseUp={endPress}
            onMouseLeave={endPress}
            aria-current="page"
          >
            {hasPulse && (
              <>
                <span className="pulse-ring r1" />
                <span className="pulse-ring r2" />
                <span className="pulse-ring r3" />
              </>
            )}
            <div className={`echo-v-icon center-icon ${spinningId === activeTab.id ? 'silky-spin' : ''}`}>
              <i className={`fas ${activeTab.icon}`} />
              {getBadge(activeTab) && (
                <span
                  className="echo-v-badge"
                  onClick={(e) => {
                    if (activeTab.id === 'chats' && lastChatPreview) {
                      e.stopPropagation();
                      setPreviewOpen((p) => !p);
                    }
                  }}
                >
                  {getBadge(activeTab)}
                </span>
              )}
            </div>
            <span className="echo-v-label">
              {activeTab.label}
              {status ? ` · ${status}` : ''}
            </span>
          </button>
        </div>

        <div className="echo-v-side">{rightTabs.map(renderSide)}</div>
      </div>

      <style>{`
        .echo-v-nav {
          position: fixed; left: 0; right: 0; bottom: 0; z-index: 50;
          height: 88px; padding-bottom: env(safe-area-inset-bottom, 0px);
          pointer-events: none;
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          touch-action: pan-y;
        }
        .echo-v-nav.is-hidden { transform: translateY(110%); }

        .echo-v-underlay {
          position: absolute; left: 0; right: 0; bottom: 0; height: 58px;
          background: linear-gradient(180deg, rgba(12,12,18,0.75), rgba(12,12,18,0.96));
          backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.08); pointer-events: none;
        }
        .echo-v-svg {
          position: absolute; inset: 0; width: 100%; height: 100%;
          pointer-events: none; filter: drop-shadow(0 -8px 24px rgba(0,0,0,0.4));
        }
        .echo-v-inner {
          position: relative; pointer-events: auto;
          display: flex; align-items: flex-end; justify-content: space-between;
          max-width: 560px; margin: 0 auto; height: 100%; padding: 0 6px 12px;
        }
        .echo-v-side {
          display: flex; flex: 1; justify-content: space-around;
          align-items: flex-end; height: 54px; min-width: 0;
        }
        .echo-v-center { flex: 0 0 auto; display: flex; align-items: flex-end; margin: 0 2px; }

        .echo-v-tab {
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: none; border: none; color: rgba(255,255,255,0.5);
          min-width: 44px; padding: 4px 6px; cursor: pointer; font-family: inherit;
          -webkit-tap-highlight-color: transparent; position: relative;
        }
        .echo-v-tab.center {
          color: #f3e8ff; transform: translateY(-16px);
          animation: vSwing 0.45s cubic-bezier(0.34, 1.4, 0.64, 1) both;
        }
        @keyframes vSwing {
          0% { opacity: 0.4; transform: translateY(-8px) rotate(-16deg) scale(0.78); }
          65% { opacity: 1; transform: translateY(-18px) rotate(5deg) scale(1.05); }
          100% { opacity: 1; transform: translateY(-16px) rotate(0) scale(1); }
        }
        .echo-v-icon {
          position: relative; width: 40px; height: 30px;
          display: flex; align-items: center; justify-content: center; border-radius: 14px;
        }
        .echo-v-icon i { font-size: 18px; }
        .echo-v-icon.center-icon {
          width: 54px; height: 54px; border-radius: 50%; z-index: 2;
          background: linear-gradient(145deg, rgba(196,181,253,0.45), rgba(108,60,225,0.55));
          border: 1px solid rgba(255,255,255,0.28);
          box-shadow: 0 6px 24px rgba(108,60,225,0.5), inset 0 1px 0 rgba(255,255,255,0.35);
        }
        .echo-v-icon.center-icon i { font-size: 22px; color: #fff; }

        .pulse-ring {
          position: absolute; left: 50%; top: 22px; width: 54px; height: 54px;
          margin-left: -27px; margin-top: -27px; border-radius: 50%;
          border: 2px solid rgba(167,139,250,0.55); pointer-events: none; z-index: 1;
          animation: echoPulse 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
        }
        .pulse-ring.r2 { animation-delay: 0.7s; border-color: rgba(108,60,225,0.4); }
        .pulse-ring.r3 { animation-delay: 1.4s; border-color: rgba(236,72,153,0.35); }
        @keyframes echoPulse {
          0% { transform: scale(0.85); opacity: 0.7; }
          70% { transform: scale(1.85); opacity: 0; }
          100% { transform: scale(1.85); opacity: 0; }
        }
        .silky-spin { animation: silkySpin 0.95s cubic-bezier(0.45, 0.05, 0.2, 1) infinite; }
        @keyframes silkySpin {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(90deg) scale(1.07); }
          50% { transform: rotate(180deg) scale(1.02); }
          75% { transform: rotate(270deg) scale(1.07); }
          100% { transform: rotate(360deg) scale(1); }
        }
        .echo-v-label {
          font-size: 10px; font-weight: 600; white-space: nowrap; z-index: 2;
          max-width: 96px; overflow: hidden; text-overflow: ellipsis;
        }
        .echo-v-badge {
          position: absolute; top: -4px; right: -2px; min-width: 16px; height: 16px;
          border-radius: 999px; background: #EF4444; color: #fff; font-size: 9px; font-weight: 700;
          display: flex; align-items: center; justify-content: center; padding: 0 4px;
          border: 2px solid #0c0c12;
        }

        .echo-v-preview, .echo-v-toast {
          position: absolute; left: 50%; transform: translateX(-50%); bottom: 100px; z-index: 60;
          border-radius: 12px; padding: 8px 14px; font-size: 12px; color: #fff; white-space: nowrap;
          max-width: min(320px, calc(100vw - 24px));
        }
        .echo-v-preview {
          display: flex; align-items: center; gap: 8px; pointer-events: auto;
          background: rgba(20,16,32,0.95); border: 1px solid rgba(167,139,250,0.35);
        }
        .echo-v-preview .dot { width: 8px; height: 8px; border-radius: 50%; background: #EF4444; }
        .echo-v-toast { background: rgba(108,60,225,0.95); font-weight: 600; pointer-events: none; }

        .echo-v-ctx-wrap, .echo-v-sheet-wrap, .echo-online-wrap {
          position: fixed; inset: 0; z-index: 90; pointer-events: auto;
        }
        .echo-v-ctx-bg, .echo-v-sheet-bg, .echo-online-bg {
          position: absolute; inset: 0; background: rgba(0,0,0,0.4);
        }
        .echo-v-ctx {
          position: absolute; width: 220px;
          background: rgba(24,20,36,0.97);
          border: 1px solid rgba(167,139,250,0.25);
          border-radius: 14px; overflow: hidden;
          box-shadow: 0 16px 40px rgba(0,0,0,0.45);
        }
        .echo-v-ctx button {
          width: 100%; padding: 12px 14px; border: none; background: transparent;
          color: #fff; font-size: 13px; font-weight: 600; text-align: left;
          cursor: pointer; font-family: inherit;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; gap: 10px;
        }
        .echo-v-ctx button.accent { color: #c4b5fd; }
        .echo-v-ctx button i { width: 16px; font-size: 12px; color: #a78bfa; }
        .echo-v-ctx button:last-child { border-bottom: none; }
        .ctx-count {
          margin-left: auto; background: #10B981; color: #fff;
          font-size: 10px; padding: 1px 6px; border-radius: 999px;
        }

        /* Online mini page */
        .echo-online-sheet {
          position: absolute; left: 0; right: 0; bottom: 0;
          max-height: min(72vh, 520px);
          background: rgba(14,12,22,0.98);
          border-radius: 20px 20px 0 0;
          padding: 12px 0 calc(12px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid rgba(167,139,250,0.25);
          display: flex; flex-direction: column;
          animation: sheetUp 0.28s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes sheetUp {
          from { transform: translateY(24%); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
        .echo-online-sheet .handle {
          width: 36px; height: 4px; border-radius: 4px; margin: 0 auto 12px;
          background: rgba(255,255,255,0.2);
        }
        .online-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 0 16px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .online-head h3 {
          margin: 0; font-size: 17px; font-weight: 700; color: #fff;
        }
        .online-head p {
          margin: 4px 0 0; font-size: 12px; color: rgba(255,255,255,0.5);
        }
        .online-close {
          width: 32px; height: 32px; border-radius: 10px; border: none;
          background: rgba(255,255,255,0.06); color: #fff; cursor: pointer;
        }
        .online-list {
          overflow-y: auto; padding: 8px 10px; flex: 1;
        }
        .online-empty {
          text-align: center; color: rgba(255,255,255,0.45);
          padding: 36px 16px; font-size: 13px;
          display: flex; flex-direction: column; align-items: center;
        }
        .online-row {
          width: 100%; display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: 14px; border: none;
          background: transparent; color: #fff; cursor: pointer;
          font-family: inherit; text-align: left;
          transition: background 0.15s;
        }
        .online-row:hover, .online-row:active {
          background: rgba(108,60,225,0.14);
        }
        .online-row.calling {
          background: rgba(16,185,129,0.15);
        }
        .online-avatar {
          position: relative; width: 44px; height: 44px; border-radius: 50%;
          overflow: hidden; flex-shrink: 0;
          background: linear-gradient(135deg, #6C3CE1, #a78bfa);
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 14px;
        }
        .online-avatar img {
          width: 100%; height: 100%; object-fit: cover;
        }
        .online-dot {
          position: absolute; bottom: 1px; right: 1px;
          width: 11px; height: 11px; border-radius: 50%;
          background: #10B981; border: 2px solid #0e0c16;
        }
        .online-meta { flex: 1; min-width: 0; }
        .online-name {
          display: block; font-size: 14px; font-weight: 650;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .online-sub {
          display: block; font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 2px;
        }
        .online-call-btn {
          width: 40px; height: 40px; border-radius: 12px;
          background: rgba(108,60,225,0.25); color: #c4b5fd;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .online-row.calling .online-call-btn {
          background: rgba(16,185,129,0.3); color: #6ee7b7;
        }

        .echo-v-sheet {
          position: absolute; left: 0; right: 0; bottom: 0;
          background: rgba(16,14,24,0.97);
          border-radius: 18px 18px 0 0;
          padding: 12px 16px calc(16px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid rgba(167,139,250,0.2);
        }
        .echo-v-sheet .handle {
          width: 36px; height: 4px; border-radius: 4px; margin: 0 auto 12px;
          background: rgba(255,255,255,0.2);
        }
        .echo-v-sheet p {
          margin: 0 0 12px; text-align: center; color: rgba(255,255,255,0.6);
          font-size: 12px; font-weight: 600;
        }
        .echo-v-sheet .grid {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
        }
        .echo-v-sheet .grid button {
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          padding: 14px 6px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08);
          background: rgba(108,60,225,0.12); color: #fff;
          font-size: 10px; font-weight: 600; cursor: pointer; font-family: inherit;
        }
        .echo-v-sheet .grid button i { font-size: 18px; color: #a78bfa; }

        @media (max-width: 480px) {
          .echo-v-nav { height: 82px; }
          .echo-v-icon.center-icon { width: 50px; height: 50px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .silky-spin, .echo-v-tab.center, .pulse-ring, .echo-online-sheet { animation: none !important; }
        }
      `}</style>
    </nav>
  );
};

export default BottomNav;

