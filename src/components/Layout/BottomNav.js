// src/components/Layout/BottomNav.js
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCall } from '../../contexts/CallContext';
import { db } from '../../services/firebase';
import { ref, onValue, get } from 'firebase/database';
import { setFaviconBadge } from '../../utils/faviconBadge';
import './BottomNav.css';

const SUPPORT_UID = '5cSplOLz30d8dgM3wvXUcDmL2QK2';
const DEFAULT_TAB_KEY = 'echo_default_tab';
const WAVE_VIDEO = '/wave-bg.mp4';

const haptic = (pattern = 12) => {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {}
};

const isOnlineValue = (val) => {
  if (!val) return false;
  if (val === 'online' || val === true) return true;
  if (typeof val === 'string') return val.toLowerCase() === 'online';
  if (typeof val === 'object') {
    if (val.state === 'online' || val.status === 'online' || val.isOnline === true) return true;
    if (val.lastChanged || val.last_seen || val.timestamp) {
      const ts = Number(val.lastChanged || val.last_seen || val.timestamp);
      if (ts > 1000000000000) return Date.now() - ts < 2 * 60 * 1000;
      if (ts > 1000000000) return Date.now() - ts * 1000 < 2 * 60 * 1000;
    }
  }
  return false;
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [defaultToast, setDefaultToast] = useState(null);
  const [spinningId, setSpinningId] = useState(null);
  const [pulseFlash, setPulseFlash] = useState(false);
  const [onlineSheetOpen, setOnlineSheetOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [callingUid, setCallingUid] = useState(null);
  const [leavingId, setLeavingId] = useState(null);
  const [onlineError, setOnlineError] = useState('');
  const swipeStartX = useRef(null);
  const swipeStartY = useRef(null);
  const swiping = useRef(false);
  const centerTouchY = useRef(null);
  const lastTapRef = useRef(0);
  const lastScrollY = useRef(0);
  const prevUnread = useRef(0);
  const statusRef = useRef({});
  const presenceRef = useRef({});
  const contactIdsRef = useRef([]);
  const videoRef = useRef(null);
  const isSupport = user?.uid === SUPPORT_UID;

  // ====================== UPDATED TABS ======================
  // Shop and Drop are hidden (commented out) for now.
  const baseTabs = useMemo(() => {
    if (isSupport) {
      return [
        { to: '/', label: 'Home', icon: 'fa-house', id: 'home' },
        { to: '/control', label: 'Control', icon: 'fa-sliders-h', id: 'control' },
        { to: '/chats', label: 'Chats', icon: 'fa-comment-dots', id: 'chats' },
        { to: '/communities', label: 'Communities', icon: 'fa-users', id: 'communities' },
        // { to: '/echodrop', label: 'Drop', icon: 'fa-bolt', id: 'echodrop' }, // hidden
        // { to: '/shop', label: 'Shop', icon: 'fa-store', id: 'shop' },        // hidden
        { to: '/other', label: 'Other', icon: 'fa-ellipsis-h', id: 'other' },
      ];
    }
    return [
      { to: '/', label: 'Home', icon: 'fa-house', id: 'home' },
      { to: '/chats', label: 'Chats', icon: 'fa-comment-dots', id: 'chats' },
      { to: '/communities', label: 'Communities', icon: 'fa-users', id: 'communities' },
      // { to: '/echodrop', label: 'Drop', icon: 'fa-bolt', id: 'echodrop' }, // hidden
      // { to: '/shop', label: 'Shop', icon: 'fa-store', id: 'shop' },        // hidden
      { to: '/other', label: 'Other', icon: 'fa-ellipsis-h', id: 'other' },
    ];
  }, [isSupport]);
  // ==========================================================

  const orderedTabs = baseTabs;
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

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const play = () => el.play().catch(() => {});
    play();
    el.addEventListener('canplay', play);
    return () => el.removeEventListener('canplay', play);
  }, []);

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
    setSheetOpen(false);
    setOnlineSheetOpen(false);
    setSpinningId(null);
  }, [location.pathname]);

  const [liveHidden, setLiveHidden] = useState(
    typeof document !== 'undefined' && document.body.classList.contains('echo-hide-bottom-nav')
  );

  useEffect(() => {
    const check = () => {
      const bodyHide = document.body.classList.contains('echo-hide-bottom-nav');
      const liveUi = Boolean(
        document.querySelector(
          '.broadcast-view, .live-view-modal, .LiveViewModal, [data-echo-live="open"]'
        )
      );
      setLiveHidden(bodyHide || liveUi);
    };
    check();
    const mo = new MutationObserver(check);
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  const recountOnline = useCallback(() => {
    const me = user?.uid;
    const ids = new Set();
    Object.entries(statusRef.current).forEach(([uid, val]) => {
      if (uid !== me && isOnlineValue(val)) ids.add(uid);
    });
    Object.entries(presenceRef.current).forEach(([uid, val]) => {
      if (uid !== me && isOnlineValue(val)) ids.add(uid);
    });
    setOnlineCount(ids.size);
  }, [user?.uid]);

  useEffect(() => {
    const unsubs = [];
    unsubs.push(
      onValue(ref(db, 'status'), (snap) => {
        statusRef.current = snap.val() || {};
        recountOnline();
      })
    );
    unsubs.push(
      onValue(ref(db, 'presence'), (snap) => {
        presenceRef.current = snap.val() || {};
        recountOnline();
      })
    );
    return () => unsubs.forEach((u) => typeof u === 'function' && u());
  }, [recountOnline]);

  useEffect(() => {
    if (!user?.uid) {
      contactIdsRef.current = [];
      setUnreadChatsCount(0);
      setLastChatPreview('');
      return;
    }
    return onValue(ref(db, `userChats/${user.uid}`), (snapshot) => {
      const data = snapshot.val() || {};
      const ids = [];
      Object.entries(data).forEach(([key, chat]) => {
        const other =
          chat.userId ||
          chat.uid ||
          chat.partnerId ||
          chat.receiverId ||
          chat.senderId ||
          (key !== user.uid ? key : null);
        if (other && other !== user.uid && other !== 'echo_ai_assistant') {
          ids.push(String(other));
        }
      });
      contactIdsRef.current = [...new Set(ids)];
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
      setFaviconBadge(count).catch(() => {});
      setLastChatPreview(latest?.text ? `${latest.name}: ${latest.text}` : '');
    });
  }, [user?.uid]);

  const fetchProfile = async (uid) => {
    const paths = [`users/${uid}`, `profiles/${uid}`, `userProfiles/${uid}`];
    for (const p of paths) {
      try {
        const snap = await get(ref(db, p));
        if (snap.exists()) {
          const v = snap.val();
          return {
            uid,
            name: v.name || v.displayName || v.username || v.userName || 'User',
            avatar: v.avatar || v.photoURL || v.profileImage || v.image || '',
          };
        }
      } catch (_) {}
    }
    return { uid, name: 'User', avatar: '' };
  };

  const collectOnlineUids = () => {
    const me = user?.uid;
    const online = new Set();
    Object.entries(statusRef.current).forEach(([uid, val]) => {
      if (uid !== me && isOnlineValue(val)) online.add(uid);
    });
    Object.entries(presenceRef.current).forEach(([uid, val]) => {
      if (uid !== me && isOnlineValue(val)) online.add(uid);
    });
    return online;
  };

  const openOnlineSheet = async () => {
    setSheetOpen(false);
    setOnlineSheetOpen(true);
    setOnlineLoading(true);
    setOnlineError('');
    haptic(14);
    try {
      const onlineSet = collectOnlineUids();
      const contacts = contactIdsRef.current || [];
      let uids = contacts.filter((id) => onlineSet.has(id));
      if (uids.length === 0) uids = [...onlineSet];
      uids = uids.slice(0, 50);
      const verified = [];
      for (const uid of uids) {
        let live = onlineSet.has(uid);
        if (!live) {
          try {
            const s1 = await get(ref(db, `status/${uid}`));
            const s2 = await get(ref(db, `presence/${uid}`));
            live = isOnlineValue(s1.val()) || isOnlineValue(s2.val());
          } catch (_) {}
        }
        if (live) verified.push(uid);
      }
      const profiles = await Promise.all(verified.map((uid) => fetchProfile(uid)));
      const contactSet = new Set(contacts);
      profiles.sort((a, b) => {
        const ac = contactSet.has(a.uid) ? 0 : 1;
        const bc = contactSet.has(b.uid) ? 0 : 1;
        if (ac !== bc) return ac - bc;
        return String(a.name).localeCompare(String(b.name));
      });
      setOnlineUsers(profiles);
      setOnlineCount(profiles.length);
      if (profiles.length === 0) setOnlineError('No one is online on ECHO right now');
    } catch (err) {
      console.error('Online list failed:', err);
      setOnlineUsers([]);
      setOnlineError('Could not load online users');
    } finally {
      setOnlineLoading(false);
    }
  };

  const callUser = async (person) => {
    if (!person?.uid) return;
    if (!startVideoCall) {
      setOnlineError('Calling is not available right now');
      return;
    }
    let stillOnline = false;
    try {
      const s1 = await get(ref(db, `status/${person.uid}`));
      const s2 = await get(ref(db, `presence/${person.uid}`));
      stillOnline = isOnlineValue(s1.val()) || isOnlineValue(s2.val());
    } catch (_) {
      stillOnline = true;
    }
    if (!stillOnline) {
      setOnlineError(`${person.name} just went offline`);
      setOnlineUsers((prev) => prev.filter((p) => p.uid !== person.uid));
      haptic([20, 40]);
      return;
    }
    setCallingUid(person.uid);
    haptic([12, 24, 12]);
    try {
      await Promise.resolve(startVideoCall(person.uid, person.name, person.avatar || ''));
      setOnlineSheetOpen(false);
    } catch (err) {
      console.error('Call failed:', err);
      setOnlineError('Could not start the call');
    } finally {
      setTimeout(() => setCallingUid(null), 900);
    }
  };

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
    setOnlineSheetOpen(false);
    setHidden(false);
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

  const onTabClick = (tab, isCenter = false) => {
    if (swiping.current) return;
    if (isCenter) {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        lastTapRef.current = 0;
        scrollToTop();
        return;
      }
      lastTapRef.current = now;
      goToTab(tab);
      return;
    }
    setLeavingId(tab.id);
    setSpinningId(tab.id);
    setTimeout(() => {
      setLeavingId(null);
      goToTab(tab);
    }, 180);
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
  };

  const onCenterTouchEnd = (e) => {
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
        className={`echo-v-tab ${leavingId === tab.id ? 'is-leaving' : ''}`}
        onClick={() => onTabClick(tab)}
      >
        <div className={`echo-v-icon ${spinning ? 'silky-spin' : ''}`}>
          <i className={`fas ${tab.icon}`} />
          {badge && <span className="echo-v-badge">{badge}</span>}
        </div>
        <span className="echo-v-label">{tab.label}</span>
      </button>
    );
  };

  if (liveHidden) return null;

  return (
    <nav
      className={`echo-v-nav ${hidden ? 'is-hidden' : ''} ${liveHidden ? 'is-live-hidden' : ''}`}
      aria-label="Bottom navigation"
      onTouchStart={onNavPointerDown}
      onTouchMove={onNavPointerMove}
      onTouchEnd={onNavPointerUp}
      onMouseDown={onNavPointerDown}
      onMouseUp={onNavPointerUp}
    >
      <div className="echo-v-video" aria-hidden="true">
        <video
          ref={videoRef}
          src={WAVE_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      </div>

      {previewOpen && lastChatPreview && (
        <div className="echo-v-preview" onClick={() => setPreviewOpen(false)}>
          <span className="dot" />
          <span>{lastChatPreview}</span>
        </div>
      )}

      {defaultToast && <div className="echo-v-toast">{defaultToast}</div>}

      {onlineSheetOpen && (
        <div className="echo-online-wrap">
          <div className="echo-online-bg" onClick={() => setOnlineSheetOpen(false)} />
          <div className="echo-online-sheet">
            <div className="handle" />
            <div className="online-head">
              <div>
                <h3>Who’s online</h3>
                <p>
                  {onlineLoading
                    ? 'Connecting to presence…'
                    : `${onlineUsers.length} online on ECHO`}
                </p>
              </div>
              <button type="button" className="online-close" onClick={() => setOnlineSheetOpen(false)}>
                <i className="fas fa-xmark" />
              </button>
            </div>
            {onlineError && <div className="online-error">{onlineError}</div>}
            <div className="online-list">
              {onlineLoading && <div className="online-empty">Finding people online…</div>}
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
                        <img
                          src={person.avatar}
                          alt=""
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <span>{initials(person.name)}</span>
                      )}
                      <i className="online-dot" />
                    </div>
                    <div className="online-meta">
                      <span className="online-name">{person.name}</span>
                      <span className="online-sub">
                        {callingUid === person.uid ? 'Calling…' : 'Online · Tap to video call'}
                      </span>
                    </div>
                    <span className="online-call-btn">
                      <i
                        className={`fas ${
                          callingUid === person.uid ? 'fa-spinner fa-spin' : 'fa-video'
                        }`}
                      />
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
                // { label: 'Drop', icon: 'fa-bolt', to: '/echodrop' },   // hidden
                // { label: 'Shop', icon: 'fa-store', to: '/shop' },       // hidden
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

      <div className="echo-v-inner">
        <div className="echo-v-side">{leftTabs.map(renderSide)}</div>
        <div className="echo-v-center">
          <button
            key={swingKey}
            type="button"
            className={`echo-v-tab center jump ${hasPulse ? 'has-pulse' : ''} ${
              pulseFlash ? 'pulse-flash' : ''
            }`}
            onClick={() => onTabClick(activeTab, true)}
            onTouchStart={onCenterTouchStart}
            onTouchEnd={onCenterTouchEnd}
            aria-current="page"
          >
            {hasPulse && (
              <>
                <span className="pulse-ring r1" />
                <span className="pulse-ring r2" />
                <span className="pulse-ring r3" />
              </>
            )}
            <div
              className={`echo-v-icon center-icon ${
                spinningId === activeTab.id ? 'silky-spin' : ''
              }`}
            >
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
    </nav>
  );
};

export default BottomNav;
