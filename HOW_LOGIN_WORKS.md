# How phone login should work (no Expo handoff)

## What you asked for
> On phone, auto-detect → use native login only → then continue in the normal app.

## Correct design (one app)
```
┌─────────────────────────────────────────┐
│  Capacitor APK (same ECHO app)          │
│                                         │
│  Login screen (web UI)                  │
│    ├─ Phone detected?                   │
│    │    YES → native Google sheet       │
│    │         (@capacitor-firebase/auth) │
│    │    NO  → browser popup             │
│    │                                    │
│    └─ Firebase JS session set           │
│              ↓                          │
│  AuthContext sees user                  │
│              ↓                          │
│  Normal Home / Chats / … (same app)     │
└─────────────────────────────────────────┘
```

**Expo is not involved.** Expo cannot “take over login then switch into” the Capacitor app without two installs and a deep-link token handoff (fragile).

You already ship `@capacitor-firebase/authentication` in Android. The fix is to **use it** on native instead of `signInWithRedirect`.

## Files to copy into your real repo
From `artifacts/`:

1. `src/utils/nativeAuth.js`  → new file  
2. `src/components/Auth/Login.js` → replace existing  

## Rebuild APK after copy
```bash
npm run build
npx cap sync android
# then open Android Studio / assemble release as you usually do
```

## Behaviour after patch
| Where | Google | Email / Demo |
|-------|--------|--------------|
| Desktop browser | Popup | Firebase JS |
| Phone browser (PWA) | Popup (may still struggle) | Firebase JS |
| Capacitor APK | **Native Google UI** → idToken → JS SDK | Firebase JS |

After any successful method, **same AuthContext**, same screens — no “switch app”.

## Backend?
Not required for login. Backend is for AI / sockets / push only.

## Expo folder
Keep `EchoNative` only if you want a separate login *debug* toy. It is **not** wired into production.
