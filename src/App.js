// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { isAndroid, isIOS } from 'react-device-detect';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import { PresenceProvider } from './contexts/PresenceContext';
import { CacheProvider } from './contexts/CacheContext';
import { ThemeProvider } from './contexts/ThemeContext'; // ✅ ADD THIS
import Home from './components/pages/Home/Home';
import Chats from './components/pages/Chats/Chats';
import ChatView from './components/pages/Chat/ChatView';
import Profile from './components/pages/Profile/Profile';
import Other from './components/pages/Other/Other';
import Terms from './components/pages/Other/Terms';
import Privacy from './components/pages/Other/Privacy';
import Report from './components/pages/Other/Report';
import Settings from './components/pages/Other/Settings';
import About from './components/pages/Other/About';
import CoinPurchase from './components/pages/CoinPurchase/CoinPurchase';
import Login from './components/Auth/Login';
import Navbar from './components/Layout/Navbar';
import BottomNav from './components/Layout/BottomNav';
import { useAuth } from './hooks/useAuth';
import NetworkStatus from './components/common/NetworkStatus';
import UpdatePopup from './components/UpdatePopup/UpdatePopup';
import InstallPopup from './components/InstallPopup/InstallPopup';
import InstallBanner from './components/common/InstallBanner';
import { cleanAllCachedMessages } from './services/messageCleanup';
import { getChatList } from './services/indexedDBService';
import { db } from './services/firebase';
import Shop from './components/pages/Shop/Shop';
import { clearAllIndexedDB } from './services/indexedDBService';
import AdminPanel from './components/pages/Admin/AdminPanel';
import BanScreen from './components/BanScreen/BanScreen';
import Communities from './components/pages/Communities/Communities';

const DEMO_UID = 'k9Cs6QPfDRNTputzic7V3xRUof63';

// ─── ScrollToTop ──────────────────────────────────────────────────
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const container = document.getElementById('main-content');
    if (container) {
      container.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

// ─── Loading Screen (Theme‑aware + mobile friendly) ────────────
function LoadingScreen() {
  const isMobile = window.innerWidth <= 480;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.3s ease',
      }}
    >
      {/* ─── Decorative rings (use theme variables) ────────────── */}
      <div
        style={{
          position: 'absolute',
          width: '240px',
          height: '240px',
          borderRadius: '50%',
          border: '2px solid var(--border-color)',
          opacity: 0.3,
          animation: 'echoRingPulse 2.5s ease-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          border: '2px solid var(--border-color)',
          opacity: 0.2,
          animation: 'echoRingPulse 3s ease-out infinite 0.5s',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          border: '2px solid var(--border-color)',
          opacity: 0.1,
          animation: 'echoRingPulse 3.5s ease-out infinite 1s',
        }}
      />

      {/* Logo */}
      <div
        style={{
          width: '100px',
          height: '100px',
          marginBottom: '20px',
          animation: 'echoFloat 2.5s ease-in-out infinite',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          style={{ width: '100%', height: '100%' }}
        >
          {/* ─── Background rectangle uses theme variable ────── */}
          <rect width="512" height="512" rx="96" fill="var(--bg-secondary)" />
          <path
            d="M 120 120 H 280 V 176 H 180 V 228 H 260 V 284 H 180 V 336 H 280 V 392 H 120 Z"
            fill="#6C3CE1"
          />
          <path
            d="M 320 160 A 140 140 0 0 1 320 352"
            stroke="#6C3CE1"
            strokeWidth="36"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 370 200 A 90 90 0 0 1 370 312"
            stroke="#EC4899"
            strokeWidth="32"
            strokeOpacity="0.6"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* ─── ECHO Text ──────────────────────────────────────────── */}
      <div
        style={{
          fontSize: isMobile ? '32px' : '40px',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: isMobile ? '4px' : '8px',
          zIndex: 2,
          textShadow: '0 0 40px rgba(108,60,225,0.3), 0 0 80px rgba(236,72,153,0.15)',
          fontFamily: 'Inter, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        ECHO
      </div>

      {/* ─── Tagline ────────────────────────────────────────────── */}
      <div
        style={{
          color: 'var(--text-muted)',
          fontSize: isMobile ? '10px' : '13px',
          letterSpacing: isMobile ? '4px' : '8px',
          textTransform: 'uppercase',
          marginTop: '2px',
          zIndex: 2,
          whiteSpace: 'nowrap',
        }}
      >
        Discover. Connect. Echo.
      </div>

      {/* ─── Progress bar ───────────────────────────────────────── */}
      <div
        style={{
          width: '200px',
          height: '3px',
          background: 'var(--bg-input)',
          borderRadius: '4px',
          marginTop: '30px',
          overflow: 'hidden',
          zIndex: 2,
          boxShadow: '0 0 15px rgba(108,60,225,0.1)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: '200%',
            background: 'linear-gradient(90deg, #6C3CE1, #EC4899, #6C3CE1)',
            borderRadius: '4px',
            animation: 'shimmer 1.8s ease-in-out infinite',
          }}
        />
      </div>
    </div>
  );
}

// ─── AppContent ─────────────────────────────────────────────────
function AppContent() {
  const { user, loading, banInfo } = useAuth();
  const { fetchProfile } = useProfile();
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [playStoreUrl, setPlayStoreUrl] = useState('');
  const [appVersion] = useState(process.env.REACT_APP_VERSION || '1.0');
  const [showDbClearedPopup, setShowDbClearedPopup] = useState(false);

  // ─── Hard refresh on version change ──────────────────────────────
  useEffect(() => {
    const currentVersion = process.env.REACT_APP_VERSION || '1.0';
    const storedVersion = localStorage.getItem('echo_installed_version');

    if (storedVersion && storedVersion !== currentVersion) {
      localStorage.setItem('echo_installed_version', currentVersion);
      window.location.reload(true);
    } else if (!storedVersion) {
      localStorage.setItem('echo_installed_version', currentVersion);
    }
  }, []);

  // ─── Minimum loading time (2s) ──────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // ─── Check for one‑time database cleared notification ────────
  useEffect(() => {
    if (user?.uid) {
      const hasSeen = localStorage.getItem('echo_db_cleared_notification');
      if (!hasSeen) {
        setShowDbClearedPopup(true);
      }
    }
  }, [user]);

  const handleDbClearedDismiss = () => {
    localStorage.setItem('echo_db_cleared_notification', 'true');
    setShowDbClearedPopup(false);
    window.location.reload();
  };

  // ─── Clean up ALL cache keys from localStorage ──────────────
  const cleanLocalStorage = () => {
    try {
      const keys = Object.keys(localStorage);
      const toRemove = keys.filter(key => {
        return (
          key.startsWith('echo_cache_') ||
          key.startsWith('echo_small_') ||
          key.startsWith('echo_cache_v2_') ||
          key.startsWith('echo_small_v2_') ||
          key.startsWith('echocache_v2_')
        );
      }).filter(key => {
        const essential = [
          'echo_has_recovered_',
          'echo_app_version',
          'echo_changelog_version',
          'echo_install_popup_dismissed_until',
          'echo_update_shown',
          'firebase:host',
        ];
        for (const e of essential) {
          if (key.startsWith(e)) return false;
        }
        return true;
      });

      toRemove.forEach(key => localStorage.removeItem(key));
      if (toRemove.length > 0) {
        console.log(`🧹 Cleaned ${toRemove.length} cache entries from localStorage`);
      }
    } catch (e) {
      console.warn('LocalStorage cleanup failed:', e);
    }
  };

  useEffect(() => {
    if (user) {
      cleanLocalStorage();
    }
  }, [user]);

  // ─── Fetch Play Store URL ──────────────────────────────────────
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snapshot = await get(ref(db, 'appConfig'));
        if (snapshot.exists()) {
          const data = snapshot.val();
          if (data.version?.playStoreUrl) {
            setPlayStoreUrl(data.version.playStoreUrl);
          }
        }
      } catch (err) {
        console.warn('Config fetch failed:', err);
      }
    };
    fetchConfig();
  }, []);

  // ─── Show install popup (only mobile, 5‑day snooze) ────────
  useEffect(() => {
    if (!isAndroid && !isIOS) return;
    if (!playStoreUrl || !minTimePassed) return;

    const dismissedUntil = localStorage.getItem('install_popup_dismissed_until');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    const alreadyShown = sessionStorage.getItem('install_popup_shown');
    if (alreadyShown) return;

    setShowInstallPopup(true);
    sessionStorage.setItem('install_popup_shown', 'true');
  }, [playStoreUrl, minTimePassed]);

  const handleInstallPopupClose = () => {
    const until = Date.now() + 5 * 24 * 60 * 60 * 1000;
    localStorage.setItem('install_popup_dismissed_until', String(until));
    setShowInstallPopup(false);
  };

  // ─── Update check (only mobile, once per version) ───────────
  useEffect(() => {
    if (!user) return;
    if (!isAndroid && !isIOS) return;

    const checkForUpdate = async () => {
      try {
        const snapshot = await get(ref(db, 'appConfig/version'));
        if (!snapshot.exists()) return;
        const data = snapshot.val();

        let latestVersion = data?.latest ?? '1.0';
        if (typeof latestVersion === 'number') {
          latestVersion = String(latestVersion);
        }
        if (typeof latestVersion !== 'string') {
          console.warn('Latest version is not a string:', latestVersion);
          return;
        }

        const currentVersion = typeof appVersion === 'string' ? appVersion : '1.0';

        const currentParts = currentVersion.split('.').map(Number);
        const latestParts = latestVersion.split('.').map(Number);
        let needsUpdate = false;
        for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
          const c = currentParts[i] || 0;
          const l = latestParts[i] || 0;
          if (l > c) { needsUpdate = true; break; }
          if (l < c) break;
        }

        if (needsUpdate) {
          const lastShown = localStorage.getItem('echo_update_shown');
          if (lastShown !== latestVersion) {
            setShowUpdatePopup(true);
            localStorage.setItem('echo_update_shown', latestVersion);
          }
        }
      } catch (err) {
        console.warn('Update check failed:', err);
      }
    };

    checkForUpdate();
  }, [user, appVersion]);

  // ─── Fetch profile and clean messages ─────────────────────────
  useEffect(() => {
    if (user?.uid) {
      fetchProfile(user.uid);

      const cleanup = async () => {
        try {
          const chatList = await getChatList(user.uid);
          if (chatList && chatList.length > 0) {
            const removed = await cleanAllCachedMessages(user.uid, chatList);
            if (removed > 0) {
              console.log(`🧹 Cleaned ${removed} stale messages from cache`);
            }
          }
        } catch (_) {}
      };
      cleanup();
    }
  }, [user?.uid, fetchProfile]);

  // ─── Check for service worker updates on app start ────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();
      }).catch(() => {});
    }
  }, []);

  const showLoading = loading || !minTimePassed;

  // ─── Show BanScreen if user is banned ──────────────────────
  if (!showLoading && user && banInfo.isBanned) {
    return <BanScreen />;
  }

  // ─── Show Database Cleared Popup ──────────────────────────
  if (!showLoading && user && showDbClearedPopup) {
    return (
      <div className="db-cleared-overlay">
        <div className="db-cleared-modal">
          <div className="db-cleared-icon">🗄️</div>
          <h2>Database Update</h2>
          <p>We have cleared and reset your data to improve performance and reliability.</p>
          <p>Please refresh to continue using ECHO.</p>
          <button className="db-cleared-btn" onClick={handleDbClearedDismiss}>
            Refresh Now
          </button>
        </div>
      </div>
    );
  }

  if (showLoading) return <LoadingScreen />;
  if (!user) return <Login />;

  return (
    <>
      <Navbar />
      <NetworkStatus />
      <ScrollToTop />
      <div
        id="main-content"
        style={{
          paddingBottom: '72px',
          paddingTop: '60px',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          background: 'var(--bg-primary)',
          maxWidth: '1400px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/chat/:userId" element={<ChatView />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/other" element={<Other />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/coins" element={<CoinPurchase />} />
          <Route path="/about" element={<About />} />
          <Route path="/control" element={<AdminPanel />} />
          <Route path="*" element={<Navigate to="/" />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/shop" element={<Shop />} />
        </Routes>
      </div>
      <BottomNav />

      {showUpdatePopup && (
        <UpdatePopup
          currentVersion={appVersion}
          onClose={() => setShowUpdatePopup(false)}
        />
      )}

      {showInstallPopup && (
        <InstallPopup
          playStoreUrl={playStoreUrl}
          onClose={handleInstallPopupClose}
        />
      )}

      <InstallBanner playStoreUrl={playStoreUrl} />
    </>
  );
}

// ─── App ────────────────────────────────────────────────────────
function App() {
  // ─── Version check: clear localStorage & IndexedDB on first visit after update ──
  useEffect(() => {
    const CURRENT_VERSION = '2.0.0';
    const storedVersion = localStorage.getItem('echo_app_version');

    if (storedVersion !== CURRENT_VERSION) {
      const keysToKeep = [
        'echo_install_popup_dismissed_until',
        'echo_update_shown',
        'echo_changelog_version',
        'firebase:host',
        'echo_db_cleared_notification',
      ];
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (!keysToKeep.includes(key) && !key.startsWith('echo_has_recovered_')) {
          localStorage.removeItem(key);
        }
      }
      clearAllIndexedDB().catch(() => {});
      localStorage.setItem('echo_app_version', CURRENT_VERSION);
      console.log('🧹 Cleared localStorage and IndexedDB for new version');
    }
  }, []);

  return (
    <BrowserRouter>
      {/* ─── ThemeProvider MUST wrap everything ─────────────────── */}
      <ThemeProvider>
        <AuthProvider>
          <PresenceProvider>
            <ProfileProvider>
              <CacheProvider>
                <AppContent />
              </CacheProvider>
            </ProfileProvider>
          </PresenceProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;