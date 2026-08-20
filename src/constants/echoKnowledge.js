// src/constants/echoKnowledge.js
export const ECHO_KNOWLEDGE = `
═══════════════════════════════════════════════════════════════════
                           ECHO – KNOWLEDGE BASE
═══════════════════════════════════════════════════════════════════

ECHO is a next‑generation visual identity chat platform. It goes
beyond traditional messaging by allowing users to express their
personality through animated avatars (ECHOMOJI), custom skins,
real‑time presence, and immersive communities. It’s a place where
every voice matters and every conversation is an opportunity to
connect, discover, and echo.

───────────────────────────────────────────────────────────────────
1.  COMPANY & TEAM
───────────────────────────────────────────────────────────────────

• Founder & CEO:
  – Lawal Abdul Malik
  – Started ECHO from scratch using HTML, CSS, JavaScript,
    and Node.js. He built the very first version of the app
    single‑handedly, focusing on creating a unique chat
    experience that felt alive.

• Co‑Founder & CTO:
  – Abdullah Bashir
  – Full‑stack developer who joined later to take ECHO to the
    next level. He rebuilt the entire app using React, making
    it faster, more scalable, and easier to maintain.
  – Abdullah also designed the real‑time architecture and
    integrated advanced features like the AI assistant.

• Team size:
  – 11 passionate members as of today, covering development,
    design, product management, and community support.

• User base:
  – 50+ active users and growing steadily.

• Mission:
  – Build products that solve real problems.
  – Ship fast, iterate quickly, and keep the code close to
    the founders.
  – Create a platform where users feel seen, heard, and
    empowered to express themselves.

• Vision:
  – To become the world’s most expressive communication
    platform, where every conversation is enhanced by visual
    identity and emotional intelligence.

───────────────────────────────────────────────────────────────────
2.  TECHNOLOGY STACK
───────────────────────────────────────────────────────────────────

• Frontend:
  – React 18 with functional components and hooks.
  – React Router for navigation (client‑side routing).
  – Context API for global state (Auth, Profile, Presence,
    Video/Audio, Cache).
  – React Helmet Async for SEO (meta tags, Open Graph,
    Twitter Cards).
  – Recharts for admin analytics (daily active users chart).
  – React‑Markdown + Remark‑GFM for rendering AI responses
    with formatting.

• Backend:
  – Node.js with Express for the Socket.io server and API
    endpoints.
  – Socket.io for real‑time events (typing indicators,
    message delivery, presence).
  – Web‑Push for push notifications (VAPID keys).

• Database:
  – Firebase Realtime Database (NoSQL, JSON tree structure).
  – Real‑time listeners (onValue) keep data in sync across
    all clients instantly.
  – Used for profiles, messages, chat lists, presence,
    user skins, coins, GIF library, admin notifications,
    daily login tracking, and more.

• Authentication:
  – Firebase Authentication.
  – Supports Google Sign‑In and Email/Password.
  – Custom demo account for quick onboarding.

• Hosting & Deployment:
  – Frontend hosted on Vercel or Netlify (custom domain:
    echoty.xyz).
  – Backend hosted on Render or a VPS.
  – Continuous deployment via GitHub Actions (build APK/AAB
    for Android).

• Additional Services:
  – Cloudinary: Media storage and delivery (images, videos,
    GIFs). Uploads are done via a preset.
  – Gemini API: Powers the ECHO AI assistant (natural
    language understanding and generation).
  – Capacitor: For wrapping the web app into native Android
    and iOS apps (with Preferences plugin for local storage).

───────────────────────────────────────────────────────────────────
3.  KEY FEATURES (IN DEPTH)
───────────────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────┐
│ 3.1  ECHOMOJI – Animated Avatars                              │
└─────────────────────────────────────────────────────────────────┘

ECHOMOJI are living, animated avatars that reflect the user's
current mood. They are at the heart of ECHO’s visual identity.

• Moods:
  – neutral, happy, sad, angry, excited, love, sleepy, cool,
    cry, shocked.
  – Each mood has a unique facial expression (eyes, mouth)
    and a themed color palette.
  – Users can change their mood at any time from the profile
    editing screen.
  – Moods are visible to others in chat headers, chat lists,
    and the home page.

• Skins (Themes):
  – Skins change the background gradient and LED color of the
    ECHOMOJI.
  – Types of skins:
    * Free: Ocean Deep, Forest Whisper.
    * Tier 1: Neon Dreams, Sunset Blaze.
    * Tier 2: Pastel Dream, Rose Gold.
    * Premium/Limited: Midnight Pulse, Cyberpunk,
      Halloween Glow, Galaxy Burst.
  – Limited skins expire after a certain number of days
    (e.g., 3 days) and are purchased with coins.
  – Users can apply any owned skin from the Shop or from
    their profile.

• Interactive:
  – Tap on any ECHOMOJI to see a ripple animation and hear
    a subtle sound (if audio is enabled).
  – Double‑tap to send a special reaction (future feature).

• Display:
  – In chat bubbles, ECHOMOJI are shown as the message content
    (e.g., a user sends “{echo:happy}” and the other sees an
    animated happy face).
  – In the navbar, the partner’s ECHOMOJI is displayed next
    to their name.
  – In the chat list, each conversation shows the partner’s
    ECHOMOJI as a small badge.

┌─────────────────────────────────────────────────────────────────┐
│ 3.2  Real‑Time Chat                                           │
└─────────────────────────────────────────────────────────────────┘

• Message Types:
  – Text: Plain or multi‑line (supports Shift+Enter for new
    lines).
  – ECHOMOJI: Send a mood directly (e.g., “{echo:happy}”).
  – Media: Images, videos, and voice notes.
  – Media uploads are handled via Cloudinary, with progress
    indicators and caching.

• Features:
  – Real‑time sending and receiving via Firebase onValue
    listeners and Socket.io for typing indicators.
  – Reply to a specific message (shows a preview of the
    original message).
  – Edit own messages (text and media captions) – updates in
    real time.
  – Delete messages – own messages only; deleting an AI
    message also deletes the user message it replied to
    (for privacy).
  – Read receipts (isRead flag) – unread counts are updated
    instantly.
  – Auto‑clear old support‑demo messages after 24 hours.

• Caching:
  – Messages are stored in IndexedDB (via idb) for offline
    access and faster loading.
  – Media is cached using the Cache API and IndexedDB
    (blob storage).
  – Smart cache invalidation: when messages are deleted or
    edited, the cache is updated accordingly.

• Unread Logic:
  – When a user opens a chat, all unread messages are marked
    as read instantly (optimistic update).
  – Unread count is displayed on the Chats tab in the bottom
    nav and on individual chat items.

┌─────────────────────────────────────────────────────────────────┐
│ 3.3  ECHO AI Assistant                                        │
└─────────────────────────────────────────────────────────────────┘

ECHO AI is an intelligent assistant integrated into the chat
interface. It uses Google's Gemini API to provide helpful,
friendly, and context‑aware responses.

• Capabilities:
  – Answer questions about ECHO (uses the knowledge base).
  – Provide general assistance, advice, and information.
  – Understand conversation context, including replies to
    previous messages.
  – Support Markdown formatting (bold, italic, lists,
    headings, code blocks, etc.).
  – Use emojis to make responses engaging.

• Interaction:
  – Users can chat with ECHO AI like any other contact.
  – The AI remembers the conversation history (within the
    current chat session).
  – Users can reply to the AI’s messages, and the AI will
    understand the context.
  – Editing or deleting a user message will regenerate or
    remove the AI’s response accordingly.

• Knowledge Base:
  – The AI is given a detailed system instruction that
    includes everything about ECHO (this document).
  – It knows about the founders, team, tech stack, features,
    and roadmap.

┌─────────────────────────────────────────────────────────────────┐
│ 3.4  Shop & Coins                                             │
└─────────────────────────────────────────────────────────────────┘

• Coins:
  – Virtual currency used to purchase skins and premium GIFs.
  – New users start with 350 free coins.
  – Coins can be purchased via bank transfer or (in future)
    Paystack integration.
  – Admin can add or subtract coins for any user.

• Shop Sections:
  – Skins: all available skins with prices (free, tiered,
    limited).
  – Premium GIFs: animated GIFs that can be used as profile
    avatars. They can be free or coin‑priced.
  – Admin‑only: Add/Edit/Delete GIFs from the shop.

• Purchasing Flow:
  – User selects an item, confirms the purchase.
  – Coins are deducted instantly, and the item is unlocked.
  – Limited skins have an expiry timer (visible to the user).
  – Purchases are recorded in the database (purchases node).

• “Get More Coins”:
  – A page that displays bank transfer details (account name,
    bank, account number) with a copy button.
  – Also includes a WhatsApp button to send payment receipt.
  – Coin packages: 500, 1000, 1500, 2000, 2500, 3000,
    4000, 5000 coins with corresponding prices.

┌─────────────────────────────────────────────────────────────────┐
│ 3.5  Admin Panel (Control)                                   │
└─────────────────────────────────────────────────────────────────┘

Available only to the support user (UID: hD7tJzPVI1VSorhok8GToBC6VDy1).

• User Management:
  – View a list of all registered users (name, UID, online
    status, ban status).
  – Search by name or UID.
  – Select a user to perform actions.

• Actions per User:
  – Check Coins: view the user’s current coin balance.
  – Add/Subtract Coins: modify the user’s coins.
  – Force Logout: instantly sign the user out (sets a flag
    in the database).
  – Wipe Data: delete all user data from profiles, userSkins,
    and userChats.
  – Delete Account: permanently delete the Firebase Auth
    account and all associated data.
  – Ban/Unban: block the user from logging in, with a
    custom reason.

• Admin Messages:
  – Send a real‑time notification to any user.
  – Message includes a title, body, and timestamp.
  – The user sees a bell icon with an unread count and a
    dropdown with all messages.

• Analytics:
  – Daily Active Users (DAU) chart over the last 7 days.
  – Data is collected from the userDailyLogins node.

┌─────────────────────────────────────────────────────────────────┐
│ 3.6  Home – Live Now                                         │
└─────────────────────────────────────────────────────────────────┘

The Home page displays all users who are currently online in
real time.

• Features:
  – Live dot indicator and online count.
  – Each online user is shown with an avatar, name, and a
    green online dot.
  – Tap any user to open a User Preview Modal (shows their
    profile picture, name, ECHOMOJI with skin, bio, and a
    “Chat” button).
  – Clicking “Chat” navigates directly to the chat with that
    user.

• Visibility Rules:
  – Demo users (UID: k9Cs6QPfDRNTputzic7V3xRUof63) can only
    see the support user (hD7tJzPVI1VSorhok8GToBC6VDy1) online.
  – Support users see all online users except the demo user.
  – Normal users see all online users except the demo user.

┌─────────────────────────────────────────────────────────────────┐
│ 3.7  Profile Management                                       │
└─────────────────────────────────────────────────────────────────┘

• User Profile Fields:
  – Name (max 25 characters)
  – Bio (max 130 characters)
  – Avatar (image or GIF, uploaded via Cloudinary or chosen
    from the GIF Library)
  – Mood (selected from a grid of moods)
  – Location (country and city, optional)
  – Active skin (selected from owned skins)

• Editing:
  – Users can enter edit mode to change any field.
  – Real‑time validation and character counters.
  – Changes are saved to Firebase and local cache.

• Avatar Picker:
  – Two options: Upload Image (PNG, JPEG, WEBP) or
    Choose from Library (free GIFs).
  – Demo users can only choose from the library.

• Account Details:
  – Displays the user’s email and UID (with a copy button).

┌─────────────────────────────────────────────────────────────────┐
│ 3.8  Communities (Coming Soon)                               │
└─────────────────────────────────────────────────────────────────┘

A future feature for group conversations and interest‑based
communities. Users will be able to join communities, participate
in group chats, and share content with like‑minded people.

───────────────────────────────────────────────────────────────────
4.  DATABASE SCHEMA
───────────────────────────────────────────────────────────────────

The Firebase Realtime Database uses the following main nodes:

• profiles/{uid}
  – name, avatar, videoUrl, mood, activeSkin, bio, interests,
    skills, country, city, status, lastActive, createdAt,
    searchName, lastLoginDate.

• messages / chats/{chatId}/messages/{msgId}
  – senderId, receiverId, type (text/media/echomoji), text,
    mediaUrl, mediaType, caption, duration, timestamp, isRead,
    replyTo (object), isEdited, lastEditedAt.

• userChats/{uid}/{partnerId}
  – id, partnerName, partnerAvatar, lastMessage, lastSenderId,
    lastUpdated, unreadCount, partnerDeleted (flag), partnerName.

• presence/online/{uid} -> boolean

• userSkins/{uid}
  – owned: [skinId, ...]
  – activeSkin: skinId
  – coins: number
  – purchases: { skinId: { purchasedAt, expiresInDays } }
  – unlockedGifs: [gifId, ...]

• gifLibrary/{gifId}
  – title, url, isPremium, price, category, duration.

• accounts/{uid}
  – email, joined, banned, banReason, bannedAt, forceLogout.

• adminNotifications/{uid}/messages/{msgId}
  – title, body, timestamp, read.

• userDailyLogins/{uid}/{date} -> true

• appConfig/version
  – latest, versionCode, versionName, playStoreUrl, whatsNew.

───────────────────────────────────────────────────────────────────
5.  UI/UX PHILOSOPHY
───────────────────────────────────────────────────────────────────

• Dark theme by default, with vibrant accent colors (purple
  and pink gradients).
• Animated elements (ECHOMOJI floating, ripple effects,
  message transitions).
• Retractable bottom navigation (users can minimize it to a
  thin bar).
• Skeleton loaders for a smooth perceived performance.
• Responsive design that works on desktop, tablet, and mobile.
• Touch‑friendly with larger tap targets on mobile.
• Accessibility: proper semantic HTML, ARIA labels, keyboard
  navigation.

───────────────────────────────────────────────────────────────────
6.  SECURITY & PRIVACY
───────────────────────────────────────────────────────────────────

• All data is stored in Firebase with security rules ensuring
  users can only read/write their own data (except public nodes
  like presence, gifLibrary).
• Authentication is handled by Firebase Auth with support for
  Google and email/password.
• Ban system: banned users are immediately logged out and shown
  a BanScreen with the reason.
• Force logout: admin can remotely sign out any user.
• Account deletion: users can delete their own account (with
  confirmation) and all associated data is removed from
  Firebase and IndexedDB.
• Data minimization: only essential data is collected and stored.
• No selling or sharing of user data with third parties.

───────────────────────────────────────────────────────────────────
7.  ROADMAP
───────────────────────────────────────────────────────────────────

• Q2 2025:
  – Communities (group chat)
  – More ECHOMOJI moods and skins
  – Push notifications for all platforms

• Q3 2025:
  – Video and audio calling
  – End‑to‑end encryption for private chats
  – Advanced search and filters

• Q4 2025:
  – User‑generated content (custom skins, GIFs)
  – Integration with external services (Spotify, YouTube)
  – AI‑powered conversation suggestions

• 2026 and beyond:
  – Augmented Reality (AR) avatars
  – Cross‑platform sync (web, mobile, desktop)
  – Developer API for third‑party integrations

───────────────────────────────────────────────────────────────────
8.  FUN FACTS
───────────────────────────────────────────────────────────────────

• The name “ECHO” was chosen because it represents the idea of
  a voice that reverberates and connects with others.
• The ECHOMOJI were originally designed as static emojis but
  were made animated to better express emotions.
• The first user ever was Lawal Abdul Malik (the founder).
• The support account (UID: hD7tJzPVI1VSorhok8GToBC6VDy1) is
  also used for internal testing and admin tasks.
• The demo account (UID: k9Cs6QPfDRNTputzic7V3xRUof63) was
  created to give new users a quick tour of the app.
• The app’s icon is a stylised combination of a chat bubble
  and sound wave, symbolising conversation and echo.

═══════════════════════════════════════════════════════════════════
END OF KNOWLEDGE BASE
═══════════════════════════════════════════════════════════════════
`;