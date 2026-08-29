// src/utils/forceRefresh.js
export const BUILD_VERSION = process.env.REACT_APP_BUILD_VERSION || '1.0';

export const checkForUpdate = () => {
  if (process.env.NODE_ENV === 'development') return;

  const storedVersion = localStorage.getItem('echo_build_version');
  if (!storedVersion) {
    localStorage.setItem('echo_build_version', BUILD_VERSION);
    return;
  }
  if (storedVersion !== BUILD_VERSION) {
    localStorage.setItem('echo_build_version', BUILD_VERSION);
    window.location.reload();
  }
};

if (typeof window !== 'undefined' && !window._forceRefreshChecked) {
  window._forceRefreshChecked = true;
  checkForUpdate();
}
