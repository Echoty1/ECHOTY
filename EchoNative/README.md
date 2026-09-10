# ECHO Login Debug (Expo)

Minimal Expo app to test Firebase Auth (demo + email) on a real phone.

## Why this exists

The main ECHO app is **React + Capacitor**, not Expo. Login on phone often fails because of:

1. **Google Sign-In in WebView** – `signInWithPopup` is blocked; redirect often breaks in Capacitor
2. **Firebase authorized domains** – must include your host / `localhost` for dev
3. **Email verification gate** – password users must verify before AuthContext accepts them
4. **Network** – `auth/network-request-failed` on bad Wi‑Fi or blocked Google endpoints

This Expo project uses the **Firebase JS SDK** so it runs in **Expo Go** without a custom native build.

## Run on your phone

```bash
cd EchoNative
npm install
npx expo start
```

1. Install **Expo Go** from Play Store / App Store  
2. Scan the QR code (same Wi‑Fi as your computer)  
3. Try **Try Demo** first, then email/password  

Watch the small log line at the bottom of the screen and the Metro terminal for errors.

## What “success” means

- **Demo works here** → Firebase project + network are fine. Fix the Capacitor/WebView Google flow in the main app.  
- **Demo fails with network-request-failed** → phone cannot reach Google/Firebase (DNS, firewall, VPN, region).  
- **Email works, Google fails in APK** → expected until you wire `@capacitor-firebase/authentication` properly.

## Google Sign-In

Not included in this Expo Go build. Native Google needs either:

- Capacitor plugin (`@capacitor-firebase/authentication`) in the main APK, or  
- Expo **development build** + `@react-native-google-signin/google-signin`

## Credentials

Uses the same Firebase project as production (`echoty-fa3ca`). Demo account:

- Email: `demo@echoty.xyz`  
- Password: `demodemo`
