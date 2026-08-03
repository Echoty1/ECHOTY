import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Login from './components/Auth/Login';
import ChatList from './components/Chat/ChatList';
import ChatView from './components/Chat/ChatView';
import Profile from './components/Profile/Profile';
import Navbar from './components/Layout/Navbar';
import BottomNav from './components/Layout/BottomNav';
import BanScreen from './components/Ban/BanScreen';

function App() {
  const { user, bannedUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0A0A0F' }}>
        <div style={{ width: '80px', height: '80px', marginBottom: '20px', animation: 'float 2s ease-in-out infinite' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
            <rect width="512" height="512" rx="96" fill="#182830" />
            <path d="M 120 120 H 280 V 176 H 180 V 228 H 260 V 284 H 180 V 336 H 280 V 392 H 120 Z" fill="#6C3CE1" />
            <path d="M 320 160 A 140 140 0 0 1 320 352" stroke="#6C3CE1" strokeWidth="36" fill="none" strokeLinecap="round" />
            <path d="M 370 200 A 90 90 0 0 1 370 312" stroke="#EC4899" strokeWidth="32" strokeOpacity="0.6" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div style={{ fontSize: '32px', fontWeight: 900, background: 'linear-gradient(135deg, #6C3CE1, #EC4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '4px' }}>ECHO</div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', letterSpacing: '6px', textTransform: 'uppercase', marginTop: '4px' }}>Premium Chat</div>
        <div style={{ width: '200px', height: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginTop: '30px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '30%', background: 'linear-gradient(135deg, #6C3CE1, #EC4899)', borderRadius: '4px', animation: 'shimmer 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    );
  }

  if (bannedUser) {
    return <BanScreen user={bannedUser} />;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Navbar />
      <div className="page-container" style={{ padding: 0, overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={<ChatList />} />
          <Route path="/chat/:userId" element={<ChatView />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  );
}

export default App;