// src/App.js
import React, { useRef, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProfileProvider } from './contexts/ProfileContext';
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
import CoinPurchase from './components/pages/CoinPurchase/CoinPurchase';
import Login from './components/Auth/Login';
import Navbar from './components/Layout/Navbar';
import BottomNav from './components/Layout/BottomNav';
import { useAuth } from './hooks/useAuth';
import About from './components/pages/Other/About';

// ─── ScrollToTop component ──────────────────────────────────────
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

// ─── Loading Screen ─────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: '#0A0A0F',
    }}>
      <div style={{ width: '80px', height: '80px', marginBottom: '20px', animation: 'float 2s ease-in-out infinite' }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
          <rect width="512" height="512" rx="96" fill="#182830" />
          <path d="M 120 120 H 280 V 176 H 180 V 228 H 260 V 284 H 180 V 336 H 280 V 392 H 120 Z" fill="#6C3CE1" />
          <path d="M 320 160 A 140 140 0 0 1 320 352" stroke="#6C3CE1" strokeWidth="36" fill="none" strokeLinecap="round" />
          <path d="M 370 200 A 90 90 0 0 1 370 312" stroke="#EC4899" strokeWidth="32" strokeOpacity="0.6" fill="none" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{
        fontSize: '32px',
        fontWeight: 900,
        background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: '4px',
      }}>ECHO</div>
      <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', letterSpacing: '6px', textTransform: 'uppercase', marginTop: '4px' }}>
        The future of conversations
      </div>
      <div style={{ width: '200px', height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginTop: '30px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: '30%',
          background: 'linear-gradient(135deg, #6C3CE1, #EC4899)',
          borderRadius: '4px',
          animation: 'shimmer 1.5s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}

// ─── AppContent ─────────────────────────────────────────────────
function AppContent() {
  const { user, loading } = useAuth();
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimePassed(true), 3500);
    return () => clearTimeout(timer);
  }, []);

  const showLoading = loading || !minTimePassed;

  if (showLoading) return <LoadingScreen />;
  if (!user) return <Login />;

  return (
    <>
      <Navbar />
      <ScrollToTop />
      <div
        id="main-content"
        style={{
          paddingBottom: '72px',
          paddingTop: '56px',
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
          <Route path="*" element={<Navigate to="/" />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
}

// ─── App ────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProfileProvider>
          <PresenceProvider>
            <CacheProvider>
              <AppContent />
            </CacheProvider>
          </PresenceProvider>
        </ProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;