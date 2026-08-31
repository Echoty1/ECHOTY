// src/utils/versionCheck.js
const VERSION_STORAGE_KEY = 'echo_app_version';
const LAST_CHECK_KEY = 'echo_version_last_check';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function fetchVersionName() {
  try {
    const response = await fetch(
      'https://echoty-fa3ca-default-rtdb.firebaseio.com/appConfig/version/versionName.json'
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data !== null && data !== undefined ? String(data) : null;
  } catch (err) {
    console.warn('Version check failed:', err.message);
    return null;
  }
}

export async function checkVersionAndReload() {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Version check skipped in development');
    return;
  }

  const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
  const now = Date.now();
  if (lastCheck && now - parseInt(lastCheck, 10) < CHECK_INTERVAL) {
    return;
  }
  localStorage.setItem(LAST_CHECK_KEY, String(now));

  const storedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
  const remoteVersion = await fetchVersionName();

  if (!remoteVersion) return;

  if (storedVersion !== remoteVersion) {
    console.log(`🔄 New version detected: ${remoteVersion} (was ${storedVersion || 'none'})`);
    localStorage.setItem(VERSION_STORAGE_KEY, remoteVersion);
    sessionStorage.setItem('echo_reloading', 'true');
    window.location.reload();
  } else {
    console.log(`✅ App is up-to-date (v${remoteVersion})`);
  }
}

if (typeof window !== 'undefined') {
  if (!sessionStorage.getItem('echo_reloading')) {
    checkVersionAndReload();
  } else {
    sessionStorage.removeItem('echo_reloading');
  }
}
