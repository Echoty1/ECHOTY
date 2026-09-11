export function friendlyAuthError(err) {
  const code = String(err?.code || '');
  const raw = String(err?.message || '');

  const map = {
    'auth/network-request-failed':
      'Sign-in could not reach Google. Check your connection, disable ad blockers for this site, then try again.',
    'auth/too-many-requests':
      'Too many tries. Wait a minute, then try again.',
    'auth/user-disabled':
      'This account is disabled. Use another account or contact ECHO support.',
    'auth/user-not-found':
      'No account uses that email. Check the spelling or tap Sign up.',
    'auth/wrong-password':
      'That password does not match. Try again or use Continue with Google.',
    'auth/invalid-credential':
      'Email or password is not correct. Check both, then try again.',
    'auth/invalid-email':
      'That does not look like a valid email.',
    'auth/email-already-in-use':
      'That email already has an account. Log in instead.',
    'auth/weak-password':
      'Use a password with at least 6 characters.',
    'auth/missing-password':
      'Enter a password first.',
    'auth/operation-not-allowed':
      'This sign-in method is turned off on the server. Try Google or contact support.',
    'auth/popup-closed-by-user':
      'The Google window was closed before finishing. Tap Continue with Google again.',
    'auth/popup-blocked':
      'The browser blocked the Google window. Allow popups for this site, then try again.',
    'auth/cancelled-popup-request':
      'Google sign-in was cancelled. Tap the button once and wait.',
    'auth/account-exists-with-different-credential':
      'That email is already used with another sign-in method. Log in the way you created the account.',
    'auth/requires-recent-login':
      'For safety, sign in again, then retry that action.',
    'auth/invalid-api-key':
      'The app is missing its Firebase key. Restart the app after checking the .env file.',
    'auth/unauthorized-domain':
      'This website address is not allowed for sign-in. Add it under Firebase authorized domains.',
    'auth/internal-error':
      'Sign-in hit a temporary problem. Wait a few seconds and try again.',
    'auth/no-redirect-result':
      '',
    'auth/developer-error':
      raw ||
      'Google Sign-In is not configured for this app build. Add SHA-1 in Firebase Console and rebuild.',
    'auth/no-id-token':
      raw ||
      'Google did not return a token. Check SHA-1 fingerprints in Firebase Console.',
  };

  if (map[code]) return map[code];

  // Play Services / One Tap developer error (phone)
  if (/28444|DEVELOPER_ERROR|Developer console is not set up|ApiException:\s*10/i.test(raw)) {
    return 'Google Sign-In is not set up for this APK (error 10). Add the app SHA-1 in Firebase Console → Project settings → Android, replace google-services.json, rebuild.';
  }

  if (/network|offline|Failed to fetch|ERR_/i.test(raw)) {
    return 'We cannot reach the internet right now. Check your connection and try again.';
  }
  if (/Firebase:/i.test(raw)) {
    return 'We could not complete sign-in. Check your connection and try again.';
  }
  return raw || 'Something went wrong. Try again.';
}
