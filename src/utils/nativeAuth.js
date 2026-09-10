/**
 * Native (Capacitor) vs web auth helpers.
 * On phone/APK: use @capacitor-firebase/authentication for Google.
 * After success, Firebase JS SDK shares the same session → rest of app is unchanged.
 */
import { Capacitor } from '@capacitor/core';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { auth } from '../services/firebase';

export const isNativeApp = () => {
  try {
    return typeof window !== 'undefined' && Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
};

/**
 * Google sign-in that works on phone (native plugin) and on desktop (popup).
 * Returns Firebase UserCredential-like shape via JS SDK after credential exchange.
 */
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (!isNativeApp()) {
    // Browser / PWA
    return signInWithPopup(auth, provider);
  }

  // ── Capacitor Android / iOS ─────────────────────────────────────
  // Native Google UI → idToken → sign into the same Firebase JS auth instance
  // so AuthContext / onAuthStateChanged keep working as today.
  const { FirebaseAuthentication } = await import(
    '@capacitor-firebase/authentication'
  );

  // Optional: clear any stale native session so account picker shows
  try {
    await FirebaseAuthentication.signOut();
  } catch (_) {}

  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result?.credential?.idToken;
  if (!idToken) {
    throw Object.assign(new Error('No Google idToken from native sign-in'), {
      code: 'auth/no-id-token',
    });
  }

  const credential = GoogleAuthProvider.credential(idToken);
  return signInWithCredential(auth, credential);
}

/** Call once on Login mount (web only) to finish a pending redirect flow. */
export async function finishWebRedirectIfAny() {
  if (isNativeApp()) return null;
  try {
    return await getRedirectResult(auth);
  } catch (err) {
    const code = err?.code || '';
    if (code === 'auth/no-redirect-result' || code === 'auth/invalid-credential') {
      return null;
    }
    throw err;
  }
}

/** Legacy redirect path — prefer signInWithGoogle() instead. */
export async function signInWithGoogleRedirect() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithRedirect(auth, provider);
}
