// src/index.js
import './utils/forceRefresh'; // Keep this if you want, but it might cause refreshes
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// 🔥 REMOVED: serviceWorkerRegistration.register(...) 
// This was causing the page to auto-reload every time OneSignal or Monetag updated.
