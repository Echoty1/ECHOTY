// src/index.js
import './utils/versionCheck'; // ✅ auto‑runs the check
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

serviceWorkerRegistration.register({
  onUpdate: () => {
    console.log('🔄 Service worker updated – reloading...');
    window.location.reload();
  },
});