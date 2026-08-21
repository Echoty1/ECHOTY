// src/utils/forceRefresh.js

// Inject build version from environment (set in CI/CD)
// Fallback to '1.0' if not set (for local dev)
export const BUILD_VERSION = process.env.REACT_APP_BUILD_VERSION || '1.0';

export const checkForUpdate = () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Force refresh skipped in development');
    return;
  }

  const storedVersion = localStorage.getItem('echo_build_version');

  if (!storedVersion) {
    // First visit – store and proceed
    localStorage.setItem('echo_build_version', BUILD_VERSION);
    console.log(`✅ Build version set to ${BUILD_VERSION}`);
    return;
  }

  if (storedVersion !== BUILD_VERSION) {
    console.log(`🔄 New build detected: ${BUILD_VERSION} (was ${storedVersion})`);
    localStorage.setItem('echo_build_version', BUILD_VERSION);
    // Hard refresh (bypass cache)
    window.location.reload(true);
  } else {
    console.log(`✅ App is up‑to‑date (v${BUILD_VERSION})`);
  }
};

// Auto‑run if not already done
if (typeof window !== 'undefined' && !window._forceRefreshChecked) {
  window._forceRefreshChecked = true;
  checkForUpdate();
}