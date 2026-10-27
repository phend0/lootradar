# LootRadar Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership Isolation**: A `/users/{userId}` document can only be created, read (`get`), or updated by the authenticated user whose `request.auth.uid == userId`. Directory listing (`list`) on `/users` is forbidden to prevent PII enumeration.
2. **Relational Subcollection Gate**: A `/users/{userId}/claims/{claimId}` document can only exist if its parent `/users/{userId}` document exists (or existsAfter in a batch write) and belongs to `request.auth.uid == userId`, and `claimId == incoming().gameId`.
3. **Strict Key & Volumetric Boundaries**: Every write to `/users/{userId}` and `/users/{userId}/claims/{claimId}` enforces `hasAll` + `hasOnly` key allowlists, strict `.size()` bounds on every string/list, and server timestamps (`request.time`).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on UserProfile**: `{ uid, email, displayName, authProvider, pushEnabled, notifyStores, createdAt, updatedAt, isAdmin: true }` -> Rejected by `hasOnly()`.
2. **Cross-User Profile Spoofing**: Authenticated as `userA`, writing `/users/userB` with `uid: "userB"` -> Rejected by `isOwner(userId)` and `data.uid == request.auth.uid`.
3. **PII Enumeration Attack**: Authenticated user running `getDocs(collection(db, 'users'))` -> Rejected because `allow list` is omitted on `/users/{userId}`.
4. **Oversized ID Poisoning**: Creating `/users/userA/claims/<200-char-id>` -> Rejected by `isValidId(claimId)`.
5. **Unbounded Array Exhaustion**: Updating `notifyStores` with 50 store strings -> Rejected by `data.notifyStores.size() <= 10 && data.notifyStores.hasOnly(['epic', 'steam', 'gog', 'prime', 'itch'])`.
6. **Value Poisoning on Update**: Updating `displayName` to a boolean or 5,000-character string -> Rejected because `isValidUserProfile(incoming())` wraps `allow update`.
7. **Immutable Field Mutation**: Updating `createdAt` or `uid` on `/users/{userId}` -> Rejected by `incoming().uid == existing().uid && incoming().createdAt == existing().createdAt`.
8. **Forged Client Timestamp**: Creating a claim with a past/future `createdAt` timestamp instead of `serverTimestamp()` -> Rejected by `incoming().createdAt == request.time`.
9. **Orphaned Claim Without Parent User Profile**: Creating `/users/userA/claims/game1` when `/users/userA` does not exist -> Rejected by `existsAfter(/databases/$(database)/documents/users/$(userId))`.
10. **Cross-User Claim Scraping**: User `userA` querying `/users/userB/claims` -> Rejected by `isOwner(userId) && resource.data.uid == request.auth.uid`.
11. **Negative or NaN Price Injection**: Creating a claim with `originalPrice: -999` or `originalPrice: 999999` -> Rejected by `data.originalPrice >= 0 && data.originalPrice <= 2000`.
12. **Mismatched Claim Path ID**: Creating `/users/userA/claims/slug_1` where `incoming().gameId == "slug_2"` -> Rejected by `claimId == incoming().gameId`.
