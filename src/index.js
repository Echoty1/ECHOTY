// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// ─── Register service worker with auto-reload on update ────────
serviceWorkerRegistration.register({
  onUpdate: () => {
    // When a new version is installed, reload the page
    console.log('🔄 New version detected – reloading...');
    window.location.reload();
  },
});