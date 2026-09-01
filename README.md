# ECHO — Junior Developer Onboarding Guide

> **Purpose:** Get the project running, understand the core pieces, and make safe changes.  
> **Live Site:** [https://echoty.xyz](https://echoty.xyz)  
> **Repository:** https://github.com/Echoty1/ECHOTY

---

## 1. Quick Start (Running the Project)

### Prerequisites
- Node.js (v18 or later)
- npm
- Git

### Step 1: Clone & Install Frontend

    git clone https://github.com/Echoty1/ECHOTY.git
    cd ECHOTY
    npm install

### Step 2: Set up Environment Variables

You need **two** `.env` files. Ask a senior dev for the actual secret values (or copy them from the team vault). **Never commit these files.**

**A) Frontend `.env` (in the project root folder):**

    REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
    REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    REACT_APP_FIREBASE_PROJECT_ID=your_project_id
    REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    REACT_APP_FIREBASE_APP_ID=your_app_id
    REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
    REACT_APP_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
    REACT_APP_VAPID_PUBLIC_KEY=your_vapid_public_key
    REACT_APP_BACKEND_URL=http://localhost:3000/
    REACT_APP_API_URL=http://localhost:3000/
    REACT_APP_GROQ_API_KEY=your_groq_key
    REACT_APP_GEMINI_API_KEY=your_gemini_key
    DISABLE_ESLINT_PLUGIN=true   # Optional: suppresses lint warnings in dev

**B) Backend `.env` (inside the `/backend` folder):**

    # Firebase Admin (paste the entire JSON object on one line or keep it formatted)
    FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com/
    FIREBASE_SERVICE_ACCOUNT={ "type": "service_account", "project_id": "...", "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n", "client_email": "...", ... }

    # VAPID Keys (for push notifications)
    VAPID_PUBLIC_KEY=your_vapid_public_key
    VAPID_PRIVATE_KEY=your_vapid_private_key

    # Payment (Selar)
    SELAR_API_KEY=your_selar_api_key
    SELAR_EMAIL=your_selar_email
    SELAR_EMAIL_PASS=your_selar_email_password

    # AI Providers
    GROQ_API_KEY=your_groq_api_key
    GEMINI_API_KEY=your_gemini_api_key
    GROQ_MODEL=llama-3.3-70b-versatile
    GEMINI_MODEL=gemini-2.0-flash

    # Server
    PORT=3000

### Step 3: Run the Backend (Optional)

The backend handles AI chat, payments, and admin actions.  
**You only need this if you're testing those features.**

```bash
cd backend
npm install
node server.js
```

The backend runs on `http://localhost:3000`.

---

### Step 4: Run the Frontend

Open a **new terminal** and run:

```bash
npm start
```

The frontend runs on `http://localhost:3001`.

---

> **📌 Note:** You don't have to run the backend during frontend-only development. The app will load and work for UI changes, chat UI, etc. The frontend automatically detects the backend URL – it uses `http://localhost:3000` in development and your live backend URL in production. If you need to override it, set `REACT_APP_API_URL` in `.env`.

---

## 2. Tech Stack (What you are using)

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, React Router, Context API, Framer Motion |
| **Backend** | Node.js, Express |
| **Database** | Firebase Realtime Database **(The absolute Source of Truth)** |
| **Authentication** | Firebase Auth |
| **AI** | Groq (primary) → Gemini (fallback) |
| **Media** | Cloudinary (upload), IndexedDB (local cache) |
| **Mobile** | Capacitor (Android) |

---

## 3. Project Structure (Where things live)

    ECHOTY/
    ├── src/                    # Frontend React code
    │   ├── components/         # UI Pages (Chat, Profile, Shop, Admin)
    │   ├── contexts/           # Shared state (Auth, Profile, Theme, Call)
    │   ├── services/           # Firebase, IndexedDB, Media cache logic
    │   ├── hooks/              # Reusable React hooks
    │   └── utils/              # Helpers (AI formatters, version checks)
    │
    ├── backend/                # Node/Express server
    │   ├── server.js           # Main API entry point
    │   ├── echoAi.js           # AI orchestration (Groq → Gemini)
    │   └── echoKnowledge.js    # ECHO's specific knowledge base
    │
    ├── public/                 # Static assets & PWA manifest
    └── android/                # Capacitor native Android project

---

## 4. Core Architecture Rules (Must Understand)

1. **Firebase = Source of Truth.** IndexedDB and localStorage are just temporary caches. Never treat them as the final authority.

2. **Cache Strategy (Stale-While-Revalidate):**
   - Show cached data immediately (for speed).
   - Then fetch fresh data from Firebase and update the UI + cache.

3. **The Client is NOT Secure.** Never trust the frontend for:
   - Coin balances.
   - Admin status.
   - Payment completion.
   - Privileged writes.
   - *Always validate these on the backend.*

4. **AI Data Flow:** Frontend sends a prompt to `/api/chat` → Backend builds the context → Calls Groq (if it fails, falls back to Gemini) → Returns formatted response to the UI.

5. **Security:** Never put API keys, service account JSON, or passwords in the source code. Use `.env` files (which are in `.gitignore`).

---

## 5. Development & Git Workflow (Strict Rules)

**The Golden Rule:** You are **never** allowed to push directly to `main`. You will work on **feature branches** and open **Pull Requests (PRs)** for review.

### Standard Daily Workflow

**1. Always start by updating your local `main`:**

    git checkout main
    git pull origin main

**2. Create a new branch for your specific task:**

    git checkout -b feature/your-feature-name

> *Naming rule:* `feature/` for new features, `fix/` for bug fixes. Example: `feature/chat-typing-indicator` or `fix/login-error`.

**3. Make your changes in the code.**

**4. Stage and commit your work (commit often with clear messages):**

    git add .
    git commit -m "Clear description of what this commit does"

**5. Push your branch to GitHub (NOT main):**

    git push origin feature/your-feature-name

**6. Open a Pull Request:**
- Go to the GitHub repository.
- Click **"Compare & pull request"**.
- Add a description of your changes and request a review from a senior developer.

---

### 🛑 The Absolute Forbidden Command

    # ❌ NEVER RUN THIS:
    git push origin main

    # ✅ ALWAYS RUN THIS:
    git push origin feature/your-branch-name

*If you accidentally try to push to main, Git will likely reject it (if protected), but always double-check your branch with `git branch` before pushing.*

---

### 🩹 Git Troubleshooting (Fix common mistakes)

| Problem | How to fix it |
| :--- | :--- |
| **"I committed to main locally by accident!"** | `git checkout -b feature/backup-branch` (moves your commits to a new branch). Then `git checkout main` and `git reset --hard origin/main` to reset your local main. |
| **"My branch is behind main (needs updates)"** | `git checkout feature/your-branch` <br> `git pull --rebase origin main` (pulls latest main and places your commits on top). |
| **"I added a file to the commit by mistake"** | `git restore --staged <file-path>` (un-stages it, keeps your edits). |
| **"I want to undo my last commit (local only)"** | `git reset --hard HEAD~1` (**DANGER:** deletes those changes permanently). Only use if 100% sure. |
| **"Git says I have a merge conflict"** | Open the conflicting file. Look for `<<<<<<< HEAD` and `>>>>>>>`. Decide which code to keep, delete the markers, save, then run: <br> `git add .` <br> `git commit -m "Resolved merge conflict"` <br> `git push origin feature/your-branch` |
| **"How do I see my changes before committing?"** | `git diff` (shows unstaged changes). <br> `git diff --staged` (shows staged changes). |
| **"How do I bundle the repo for an AI prompt?"** | Run `npx repomix` in the root folder – it creates a single text file of your entire codebase. |
| **"My .gitignore isn't working!"** | Run `git rm -r --cached .` then `git add .` to re-apply the rules. |

---

## 6. Selective Android Sync (Build AAB with ONLY specific changes)

Use this workflow when you only want to push **one specific fix** to Android Studio, while hiding all your other half-finished work.

**🎯 Goal:** Build an AAB with only `src/components/Auth/Login.js` (for example).

### Step-by-step

**1. Stage ONLY the file you want to deploy:**

    git add src/components/Auth/Login.js

**2. Stash everything else (keeps the staged file visible):**

    git stash push --keep-index -m "wip-features-hidden"

> *Note: `--keep-index` ensures your staged file stays in your working directory.*

**3. Build the Web App:**

    npm run build

**4. Sync to Android Studio:**

    npx cap sync android
    npx cap open android

**5. Build the AAB in Android Studio:**

- Wait for Gradle sync to finish.
- Go to **Build → Build Bundle(s) / APK(s) → Build Bundle(s)**.
- The `.aab` file will be in: `android/app/build/outputs/bundle/release/`

**6. Restore your hidden work:**

    git stash pop

> *If you get a conflict on `android/app/build.gradle`, run:*

    git restore android/app/build.gradle && git stash pop

### Standard Full Android Build (No selective hiding)

If you want to sync **everything you've committed:**

    npm run build
    npx cap sync android
    npx cap open android

Then follow step 5 above to generate the AAB.

### ⚠️ Quick Android/Stash Fixes

| Problem | Solution |
| :--- | :--- |
| **Stash conflict on `build.gradle`** | `git restore android/app/build.gradle && git stash pop` |
| **Android Studio shows an old web build** | Re-run `npm run build && npx cap sync android` and rebuild. |
| **Staged changes didn't make it into the build** | Make sure you ran `git add <file>` **before** `git stash push --keep-index`. |
| **I want to permanently discard hidden changes** | **Warning:** Deletes them forever! <br> `git stash drop` (or `git stash clear` to delete all). |

---

## 7. Debugging Tips (When things break)

### Frontend Debugging

- Open **DevTools (F12)** → **Console** tab for errors.
- Check the **Network** tab to see if API calls are returning `500` or `400` errors.
- **Clear cached data** if the UI shows stale information:
  - Go to **Application** tab → **Storage** → **Clear site data**, or
  - Run this in the console:

        Object.keys(localStorage).filter(k => k.startsWith('echo_cache_')).forEach(k => localStorage.removeItem(k));

### Backend Debugging

- Look at the terminal where `npm run dev` is running.
- Check the logs for `console.log` outputs or explicit error messages.

---

## 8. Golden Rules (Never Break These)

1. **Code over documentation:** If an old note says X but the current code does Y, **trust the code**.

2. **Don't break existing features:** If you touch the Chat module, make sure Reply, Edit, Media, and Reactions still work.

3. **Update the cache:** If you write data to Firebase (edit profile, send message), update the local IndexedDB/cache immediately after.

4. **Never commit secrets:** No API keys, passwords, or service account JSON in source files. Use `.env` (and they are in `.gitignore`).

5. **Don't invent features:** If a feature isn't in the code yet, describe it as "planned", not "implemented".

6. **Test both states:** Logged in, Logged out, Normal user, Admin user, and Mobile view (resize your browser). 