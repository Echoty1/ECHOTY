import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Navbar from './components/Layout/Navbar';
import BottomNav from './components/Layout/BottomNav';
import Login from './components/Auth/Login';
import Feed from './components/Feed/Feed';
import Chat from './components/Chat/ChatList';
import ChatView from './components/Chat/ChatView';
import Profile from './components/Profile/Profile';
import Events from './components/Events/Events';
import Groups from './components/Groups/Groups';
import Marketplace from './components/Marketplace/Marketplace';
import Donations from './components/Donations/Donations';
import Search from './components/Search/Search';
import Notifications from './components/Notifications/Notifications';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'var(--dark)' }}>
        <div className="loader">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/search" element={<Search />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:userId" element={<ChatView />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:userId" element={<Profile />} />
        <Route path="/events" element={<Events />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/donations" element={<Donations />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <BottomNav />
    </>
  );
}

export default App;