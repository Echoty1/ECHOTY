// src/utils/versionCheck.js
/**
 * Checks for a new version of the app and performs a hard refresh if one is found.
 * Uses localStorage to track the current version and a timestamp to avoid excessive checks.
 *
 * On every page load, it fetches the latest version from Firebase and compares it
 * with the stored version. If they differ, it stores the new version and reloads.
 */

const VERSION_STORAGE_KEY = 'echo_app_version';
const LAST_CHECK_KEY = 'echo_version_last_check';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes – avoid hammering Firebase

/**
 * Fetches the latest version from Firebase.
 * Uses the REST API for simplicity (no Firebase SDK dependency here).
 * Handles both string and number values for `latest`.
 */
async function fetchLatestVersion() {
  try {
    const response = await fetch(
      'https://echoty-fa3ca-default-rtdb.firebaseio.com/appConfig/version.json'
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const latest = data?.latest;
    // ─── Convert to string if number (or any non-string) ──────
    return latest !== undefined && latest !== null ? String(latest) : null;
  } catch (err) {
    console.warn('Version check failed:', err.message);
    return null;
  }
}

/**
 * Main check function.
 * - Reads stored version and last check timestamp.
 * - If enough time has passed since last check, fetches remote version.
 * - If remote version differs from stored, stores the new version and reloads.
 */
export async function checkVersionAndReload() {
  // Skip if we're in development (optional – you can remove this line)
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Version check skipped in development');
    return;
  }

  // Avoid checking too frequently
  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  const now = Date.now();
  if (lastCheck && now - parseInt(lastCheck, 10) < CHECK_INTERVAL) {
    // Not enough time passed – skip
    return;
  }

  // Update last check timestamp
  localStorage.setItem(LAST_CHECK_KEY, String(now));

  const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
  const remoteVersion = await fetchLatestVersion();

  if (!remoteVersion) {
    // No remote version – maybe network issue, skip
    return;
  }

  if (storedVersion !== remoteVersion) {
    console.log(`🔄 New version detected: ${remoteVersion} (was ${storedVersion || 'none'})`);
    // Store the new version to prevent loops
    localStorage.setItem(VERSION_STORAGE_KEY, remoteVersion);
    // Also store a flag to indicate we're reloading
    sessionStorage.setItem('echo_reloading', 'true');
    // Perform a hard refresh (bypass cache)
    window.location.reload(true);
  } else {
    // Versions match – nothing to do
    console.log(`✅ App is up‑to‑date (v${remoteVersion})`);
  }
}

// ─── Auto‑run on module import ──────────────────────────────
// If you import this file, it will run immediately.
// To avoid running on every hot‑reload in dev, we check that we're not in a reload loop.
if (!sessionStorage.getItem('echo_reloading')) {
  checkVersionAndReload();
} else {
  // We just reloaded – clear the flag so future checks work normally.
  sessionStorage.removeItem('echo_reloading');
}