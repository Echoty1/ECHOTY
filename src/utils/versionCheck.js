// src/utils/versionCheck.js
/**
 * Checks for a new version of the app and performs a hard refresh if one is found.
 * Uses localStorage to track the current version and a timestamp to avoid excessive checks.
 *
 * On every page load, it fetches the latest versionName from Firebase and compares it
 * with the stored version. If they differ, it stores the new version and reloads.
 */

const VERSION_STORAGE_KEY = 'echo_app_version';
const LAST_CHECK_KEY = 'echo_version_last_check';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches the versionName from Firebase (appConfig/version/versionName).
 * Uses the REST API for simplicity.
 */
async function fetchVersionName() {
  try {
    const response = await fetch(
      'https://echoty-fa3ca-default-rtdb.firebaseio.com/appConfig/version/versionName.json'
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    // versionName is stored as a string like "1.1", "1.2", etc.
    return data !== null && data !== undefined ? String(data) : null;
  } catch (err) {
    console.warn('Version check failed:', err.message);
    return null;
  }
}

/**
 * Main check function.
 * - Reads stored version and last check timestamp.
 * - If enough time has passed since last check, fetches remote versionName.
 * - If remote version differs from stored, stores the new version and reloads.
 */
export async function checkVersionAndReload() {
  // Skip in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Version check skipped in development');
    return;
  }

  // Avoid checking too frequently
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  const now = Date.now();
  if (lastCheck && now - parseInt(lastCheck, 10) < CHECK_INTERVAL) {
    return;
  }
  localStorage.setItem(LAST_CHECK_KEY, String(now));

  const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
  const remoteVersion = await fetchVersionName();

  if (!remoteVersion) {
    // No remote version – maybe network issue, skip
    return;
  }

  if (storedVersion !== remoteVersion) {
    console.log(`🔄 New version detected: ${remoteVersion} (was ${storedVersion || 'none'})`);
    localStorage.setItem(VERSION_STORAGE_KEY, remoteVersion);
    sessionStorage.setItem('echo_reloading', 'true');
    // Hard refresh (bypass cache)
    window.location.reload(true);
  } else {
    console.log(`✅ App is up‑to‑date (v${remoteVersion})`);
  }
}

// Auto‑run on module import
if (!sessionStorage.getItem('echo_reloading')) {
  checkVersionAndReload();
} else {
  sessionStorage.removeItem('echo_reloading');
}