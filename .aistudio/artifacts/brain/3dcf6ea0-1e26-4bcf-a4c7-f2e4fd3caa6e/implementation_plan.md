# LootRadar — Mobile App Downloads, User Accounts & Cloud Claim Sync

This update adds a unified **Download App** launcher (supporting both Android `.apk` and iOS `.mobileconfig` / `.ipa` installations) in the top-right header, a complete **User Account & Sign-Up System** (supporting **Google / Gmail**, **Apple / iCloud**, and **any Email Address + Password**), and a **Firebase Cloud Firestore** database that permanently remembers every game a user has claimed across Web, Android, and iPhone.

---

## User Review & Confirmed Decisions

> [!IMPORTANT]
> **Confirmed Choices from Phase 1:**
> - **Top-Right Download UI**: A single **Download App** button in the top-right header that opens a unified **Android & iOS Download Modal** (offering the signed Android `LootRadar-S26Ultra.apk`, the signed iPhone `LootRadar-iOS.mobileconfig` direct installer, the native `LootRadar-iOS.ipa` package, and Safari Home Screen instructions).
> - **Authentication Providers**: Quick 1-click sign-up/sign-in with **Google (Gmail)** and **Apple (iCloud)**, plus full **Email & Password registration and sign-in** so users with any email address (Outlook, Yahoo, ProtonMail, custom domains, etc.) can create an account.
> - **Cloud Database Persistence & Sync**: Full synchronization of **claimed games**, **store/notification alert preferences**, and **automatic migration of guest claims** into the user's cloud account upon sign-in.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Lets visitors download the native **Android APK** or **iOS App** directly from the top-right header.
  2. Lets users create an account or sign in via **Google (Gmail)**, **Apple (iCloud)**, or **any Email & Password**.
  3. Persists every claimed game and alert preference in **Firebase Cloud Firestore**, automatically marking claimed games (`Claimed in Library`) across the Hero Spotlight, Radar Grid cards, Game Detail Modal, and Claimed Library view on every device.
- **Where to Host the App & Database**:
  - **Database & Auth Layer (Firebase Auth + Cloud Firestore)**: Hosted directly on Google Cloud / Firebase (`Spark` free tier included). Because Firestore is a managed cloud database, user accounts and claimed game records live permanently in the cloud and are accessed securely from the web app, the Android APK, and the iPhone app.
  - **Web & API Server Hosting Options**:
    1. **Google Cloud Run (Built-in / Recommended)**: 1-click deploy directly from AI Studio (`Cloud Run`), keeping the Express live-radar API (`/api/giveaways`) and static bundle connected to your Firebase database.
    2. **Render / Railway / Fly.io**: Connect your GitHub repository (`https://github.com/phend0/lootradar`) with build command `npm install && npm run build` and start command `npm start`. Because Firebase config is bundled, all user accounts and claimed games remain connected to the exact same Firestore database.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Top-Right Header Action Bar**:
     - Displays the **Download App** button (with Android + Apple icons) and the **Sign In / Sign Up** button (or the signed-in user's avatar badge + synced claim count).
  2. **Unified Android & iOS Download Modal**:
     - **Android Tab / Card**: Direct 1-tap download of the signed `LootRadar-S26Ultra.apk` (`234 KB`, v1/v2/v3 signed) with step-by-step installation guide.
     - **iOS (iPhone & iPad) Tab / Card**: Direct 1-tap download of the signed `LootRadar-iOS.mobileconfig` WebClip installer (installs full-screen Home Screen app without a computer), direct download of `LootRadar-iOS.ipa` (for AltStore / Sideloadly), and Safari *"Add to Home Screen"* guide.
  3. **Quick Sign-Up & Sign-In Modal**:
     - **Continue with Google (Gmail)** button (`GoogleAuthProvider`).
     - **Continue with Apple (iCloud)** button (`OAuthProvider('apple.com')`).
     - **Email & Password Form**: Toggle between **Create Account** (Display Name, Email, Password) and **Sign In** (Email, Password, Forgot Password reset) for any email provider.
  4. **Persistent Claimed Game Status Across All Views**:
     - When a user clicks **Claim Free Game** (or **Mark as Claimed**), the game is immediately saved to their Cloud Firestore `/users/{uid}/claims/{gameId}` collection (and mirrored locally for instant offline access).
     - Any game already claimed by the user displays a clear **Claimed** status indicator on the card, Hero banner, and Detail modal, and users can toggle/unmark a claim if needed.
- **Visual Identity & Theme**:
  - Preserves the **Obsidian Vault** palette (`#0B0F19` canvas, `#111827` structural surfaces, `#06B6D4` cyan primary action, `#10B981` emerald claimed state) with `Outfit` display headings, `Plus Jakarta Sans` UI body, and `JetBrains Mono` tabular numerals.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Hybrid Offline + Cloud Firestore Sync (Guest-to-Cloud Merge)**
  - *Chosen Approach*: Maintain instant local storage state while signed out, and automatically merge local claimed games into Cloud Firestore (`users/{uid}/claims/{gameId}`) the moment a user creates an account or signs in.
  - *Why*: Users never lose games they marked as claimed before signing up, and signed-in users get real-time multi-device sync across desktop, Android APK, and iOS.
- **Decision 2: Split User Profile & Claims Subcollection in Firestore**
  - *Chosen Approach*: Store private user account data and alert settings at `/users/{userId}` and each claimed game as an individual document at `/users/{userId}/claims/{gameId}` enforced by Zero-Trust Firestore Security Rules (`isOwner(userId)`).
  - *Why*: Avoids document size limits as a user's claimed library grows over years of giveaways, and guarantees strict owner-only read/write isolation.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        LootRadar Top Header Bar                            │
│  [LootRadar Brand]     [Live Radar · Claimed · Alerts]   [Download] [Auth] │
└───────────────────────────────────────────────┬──────────────┬─────────────┘
                                                │              │
                     ┌──────────────────────────┘              └────────────────────────┐
                     ▼                                                                  ▼
┌─────────────────────────────────────────┐                ┌──────────────────────────────────────────┐
│     MobileAppDownloadModal (UI)         │                │            AuthModal (UI)                │
│  • Android: /LootRadar-S26Ultra.apk     │                │  • Google Sign-In (Gmail Popup)          │
│  • iOS Profile: /LootRadar-iOS.mobile.. │                │  • Apple Sign-In (iCloud Popup)          │
│  • iOS Package: /LootRadar-iOS.ipa      │                │  • Email & Password Sign-Up / Sign-In    │
│  • Safari Home Screen Guide             │                │  • Password Reset & Cloud Hosting Info   │
└─────────────────────────────────────────┘                └─────────────────────┬────────────────────┘
                                                                                 │
                                                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          Firebase Auth & Cloud Firestore Sync Engine                                │
│  • Auth State Listener (onAuthStateChanged)                                                         │
│  • Guest Claim Merger (migrates localStorage claims -> Firestore on login)                          │
│  • Real-Time Listeners (onSnapshot):                                                                │
│      ├── /users/{userId}               (User profile, email, provider, alertPreferences)            │
│      └── /users/{userId}/claims/{id}   (Claimed game ID, title, store, retail price, claimedAt)     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Security Rules (`firebase-blueprint.json` & `firestore.rules`)

1. **`UserProfile` (`/users/{userId}`)**:
   - Fields: `uid` (string), `email` (string), `displayName` (string), `authProvider` (`google` | `apple` | `password`), `pushEnabled` (boolean), `notifyStores` (list of store IDs), `createdAt` (timestamp), `updatedAt` (timestamp).
   - Access: Strictly owner-only (`request.auth != null && request.auth.uid == userId`).
2. **`ClaimedGameRecord` (`/users/{userId}/claims/{claimId}`)**:
   - Fields: `uid` (string), `gameId` (string), `title` (string), `store` (string), `storeName` (string), `originalPrice` (number), `claimUrl` (string), `coverImage` (string), `claimedAt` (string ISO), `createdAt` (timestamp).
   - Access: Strictly owner-only (`request.auth != null && request.auth.uid == userId`) with full schema and size validation.
