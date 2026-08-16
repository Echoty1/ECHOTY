// src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ref, get } from 'firebase/database';
import { isAndroid, isIOS } from 'react-device-detect';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import { PresenceProvider } from './contexts/PresenceContext';
import { CacheProvider } from './contexts/CacheContext';
import Home from './components/pages/Home/Home';
import Chats from './components/pages/Chats/Chats';
import ChatView from './components/pages/Chat/ChatView';
import ECHOMojiTab from './components/pages/ECHOMojiTab/ECHOMojiTab';
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
import { db } from './services/firebase';
import { clearAllIndexedDB } from './services/indexedDBService';

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

// ─── Loading Screen ──────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#0A0A0F',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: '240px',
          height: '240px',
          borderRadius: '50%',
          border: '2px solid rgba(108, 60, 225, 0.2)',
          animation: 'echoRingPulse 2.5s ease-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          border: '2px solid rgba(236, 72, 153, 0.15)',
          animation: 'echoRingPulse 3s ease-out infinite 0.5s',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          border: '2px solid rgba(108, 60, 225, 0.1)',
          animation: 'echoRingPulse 3.5s ease-out infinite 1s',
        }}
      />

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
          <rect width="512" height="512" rx="96" fill="#182830" />
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

      <div
        style={{
          fontSize: '40px',
          fontWeight: 900,
          background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '8px',
          zIndex: 2,
          textShadow: '0 0 40px rgba(108,60,225,0.3), 0 0 80px rgba(236,72,153,0.15)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        ECHO
      </div>

      <div
        style={{
          color: 'rgba(255,255,255,0.2)',
          fontSize: '13px',
          letterSpacing: '8px',
          textTransform: 'uppercase',
          marginTop: '2px',
          zIndex: 2,
        }}
      >
        Discover. Connect. Echo.
      </div>

      <div
        style={{
          width: '200px',
          height: '3px',
          background: 'rgba(255,255,255,0.05)',
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
  const { user, loading } = useAuth();
  const { fetchProfile } = useProfile();
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [showUpdatePopup, setShowUpdatePopup] = useState(false);
  const [showInstallPopup, setShowInstallPopup] = useState(false);
  const [playStoreUrl, setPlayStoreUrl] = useState('');
  const [appVersion] = useState(process.env.REACT_APP_VERSION || '1.0');

  // ─── Minimum loading time (2s) ──────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // ─── Fetch Play Store URL (always) ──────────────────────────
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
        const latestVersion = data.latest || '1.0';

        const currentParts = appVersion.split('.').map(Number);
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

  // ─── Fetch profile when user logs in ─────────────────────────
  useEffect(() => {
    if (user?.uid) {
      fetchProfile(user.uid);
    }
  }, [user?.uid, fetchProfile]);

  const showLoading = loading || !minTimePassed;

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
          paddingTop: '64px',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          background: '#0A0A0F',
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/chat/:userId" element={<ChatView />} />
          <Route path="/echomoji" element={<ECHOMojiTab />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/other" element={<Other />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/coins" element={<CoinPurchase />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <BottomNav />

      {/* ─── Update Popup ────────────────────────────────────────── */}
      {showUpdatePopup && (
        <UpdatePopup
          currentVersion={appVersion}
          onClose={() => setShowUpdatePopup(false)}
        />
      )}

      {/* ─── Install Popup (full‑screen) ────────────────────────── */}
      {showInstallPopup && (
        <InstallPopup
          playStoreUrl={playStoreUrl}
          onClose={handleInstallPopupClose}
        />
      )}

      {/* ─── Install Banner (bottom, with 5‑day snooze) ─────────── */}
      <InstallBanner playStoreUrl={playStoreUrl} />
    </>
  );
}

// ─── App ────────────────────────────────────────────────────────
function App() {
  // ─── Version check: clear localStorage & IndexedDB on first visit after update ──
  useEffect(() => {
    const CURRENT_VERSION = '2.0.0'; // change with each release
    const storedVersion = localStorage.getItem('echo_app_version');

    if (storedVersion !== CURRENT_VERSION) {
      // Clear localStorage (keep only essential keys)
      const keysToKeep = ['echo_install_popup_dismissed_until', 'echo_update_shown', 'echo_changelog_version'];
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      }
      // Clear IndexedDB to avoid old data
      clearAllIndexedDB().catch(() => {});
      localStorage.setItem('echo_app_version', CURRENT_VERSION);
      console.log('🧹 Cleared localStorage and IndexedDB for new version');
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <PresenceProvider>
          <ProfileProvider>
            <CacheProvider>
              <AppContent />
            </CacheProvider>
          </ProfileProvider>
        </PresenceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;