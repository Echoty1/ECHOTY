import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { PresenceProvider } from './contexts/PresenceContext';
import { SocketProvider } from './contexts/SocketContext';
import { startOfflineSync, syncUsers } from './services/offlineService';
import UpdateChecker from './components/UpdateChecker';

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PresenceProvider>
          <SocketProvider>
            <UpdateChecker>
              <App />
            </UpdateChecker>
          </SocketProvider>
        </PresenceProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PresenceProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </PresenceProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// At the bottom of src/index.js
import { db } from './services/firebase';
import { ref, onValue, update } from 'firebase/database';

// Expose for console testing
window.__resetPresence = () => {
  const usersRef = ref(db, 'users');
  onValue(usersRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const updates = {};
      Object.keys(data).forEach(uid => {
        updates[`users/${uid}/online`] = false;
        updates[`users/${uid}/status`] = 'offline';
      });
      update(ref(db), updates).then(() => {
        console.log('✅ All users reset to offline.');
      }).catch(err => console.error('❌ Reset failed:', err));
    }
  }, { onlyOnce: true });
};