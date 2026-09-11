/**
 * Web: same as before → signInWithPopup only (do not touch redirect on load).
 * Phone (Capacitor): @capacitor-firebase/authentication → idToken → JS SDK.
 */
import { Capacitor } from '@capacitor/core';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../services/firebase';

/** Web client ID from google-services.json (client_type: 3) */
export const GOOGLE_WEB_CLIENT_ID =
  '506340369217-pqibe643qj110b2irc6m7vfp5fmt16he.apps.googleusercontent.com';

export const isNativeApp = () => {
  try {
    return typeof window !== 'undefined' && Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

/**
 * Google sign-in.
 * - Browser / PWA: Firebase popup (unchanged behaviour).
 * - Capacitor APK: native Google UI, then link into the same Firebase JS session.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  // ── Web / desktop / mobile browser ─────────────────────────────
  if (!isNativeApp()) {
    return signInWithPopup(auth, provider);
  }

  // ── Capacitor Android / iOS ────────────────────────────────────
  const { FirebaseAuthentication } = await import(
    '@capacitor-firebase/authentication'
  );

  try {
    await FirebaseAuthentication.signOut();
  } catch (_) {}

  let result;
  try {
    result = await FirebaseAuthentication.signInWithGoogle({
      mode: 'login',
    });
  } catch (err) {
    throw normalizeNativeGoogleError(err);
  }

  const idToken =
    result?.credential?.idToken ||
    result?.credential?.id_token ||
    null;

  if (!idToken) {
    throw Object.assign(
      new Error(
        'Google did not return a token. In Firebase Console → Project settings → Your apps → Android, add the SHA-1 of your debug and release keystores, then download a fresh google-services.json.'
      ),
      { code: 'auth/no-id-token' }
    );
  }

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

/** Map Play Services / One Tap codes to readable messages */
function normalizeNativeGoogleError(err) {
  const raw = String(err?.message || err || '');
  const code = String(err?.code || '');

  if (
    /28444|DEVELOPER_ERROR|Developer console is not set up|error code: 10|:\s*10\b|ApiException:\s*10/i.test(
      raw
    ) ||
    code === '10' ||
    code === 'DEVELOPER_ERROR'
  ) {
    return Object.assign(
      new Error(
        'Google Sign-In is not configured for this app build (error 10). Add this app’s SHA-1 fingerprint in Firebase Console → Project settings → Android app, download a new google-services.json into android/app/, then rebuild the APK.'
      ),
      { code: 'auth/developer-error' }
    );
  }

  if (/12501|SIGN_IN_CANCELLED|canceled|cancelled/i.test(raw + code)) {
    return Object.assign(new Error('Google sign-in was cancelled.'), {
      code: 'auth/popup-closed-by-user',
    });
  }

  if (/7\b|NETWORK_ERROR|network/i.test(raw)) {
    return Object.assign(
      new Error('Network error during Google sign-in. Check connection and try again.'),
      { code: 'auth/network-request-failed' }
    );
  }

  return err instanceof Error ? err : new Error(raw || 'Google sign-in failed');
}
