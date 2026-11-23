import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { GiveawayGame, StoreId } from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export type AuthProviderKind = 'google' | 'password';

export interface CloudClaimRecord {
  uid: string;
  gameId: string;
  title: string;
  store: StoreId;
  storeName: string;
  originalPrice: number;
  claimUrl: string;
  coverImage: string;
  claimedAt: string;
}

export function sanitizeDocId(rawId: string): string {
  const cleaned = String(rawId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128);
  return cleaned || 'unknown-id';
}

export function detectProviderKind(user: User): AuthProviderKind {
  const providers = user.providerData.map((p) => p.providerId);
  if (providers.includes('google.com')) return 'google';
  return 'password';
}

const VALID_STORES: StoreId[] = ['epic', 'steam', 'gog', 'prime', 'itch'];

function clampString(val: string | null | undefined, max: number, fallback: string): string {
  const trimmed = String(val || '').trim();
  if (!trimmed) return fallback.slice(0, max);
  return trimmed.slice(0, max);
}

// Sign-in triggers this from two places. Run them in order so the second sees
// what the first wrote, because the rules reject re-creating existing documents.
const profileSyncQueue = new Map<string, Promise<void>>();

export function ensureUserProfileAndSyncGuestClaims(
  user: User,
  localClaimedIds: string[],
  allGiveaways: GiveawayGame[],
  pushEnabled: boolean,
  notifyStores: StoreId[]
): Promise<void> {
  const previous = profileSyncQueue.get(user.uid) ?? Promise.resolve();
  const run = previous
    .catch(() => {})
    .then(() =>
      syncProfileAndGuestClaims(
        user,
        localClaimedIds,
        allGiveaways,
        pushEnabled,
        notifyStores
      )
    );
  profileSyncQueue.set(user.uid, run);
  return run;
}

async function syncProfileAndGuestClaims(
  user: User,
  localClaimedIds: string[],
  allGiveaways: GiveawayGame[],
  pushEnabled: boolean,
  notifyStores: StoreId[]
): Promise<void> {
  const uid = sanitizeDocId(user.uid);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const providerKind = detectProviderKind(user);
  const safeEmail = clampString(user.email, 254, `${uid}@user.lootradar.app`);
  const defaultName = safeEmail.split('@')[0] || 'LootRadar Member';
  const safeDisplayName = clampString(user.displayName, 80, defaultName);
  const safeStores = notifyStores
    .filter((s): s is StoreId => VALID_STORES.includes(s))
    .slice(0, 10);

  let profileExists = false;
  const existingClaimIds = new Set<string>();
  try {
    const snap = await getDoc(userRef);
    profileExists = snap.exists();
    if (profileExists) {
      // Rewriting an existing claim changes createdAt, which the rules reject
      // and which would fail this entire batch.
      const claims = await getDocs(
        query(collection(db, 'users', uid, 'claims'), where('uid', '==', uid))
      );
      claims.forEach((claim) => existingClaimIds.add(claim.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  try {
    const batch = writeBatch(db);
    if (!profileExists) {
      batch.set(userRef, {
        uid,
        email: safeEmail,
        displayName: safeDisplayName,
        authProvider: providerKind,
        pushEnabled: Boolean(pushEnabled),
        notifyStores: safeStores,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(userRef, {
        displayName: safeDisplayName,
        email: safeEmail,
        authProvider: providerKind,
        updatedAt: serverTimestamp(),
      });
    }

    // Merge any guest claimed games into Firestore atomically
    const unsyncedClaims = new Map<string, GiveawayGame>();
    for (const rawGameId of localClaimedIds) {
      const gameId = sanitizeDocId(rawGameId);
      if (existingClaimIds.has(gameId) || unsyncedClaims.has(gameId)) continue;
      const foundGame = allGiveaways.find(
        (g) => sanitizeDocId(g.id) === gameId || g.id === rawGameId
      );
      if (foundGame) unsyncedClaims.set(gameId, foundGame);
    }
    for (const [gameId, foundGame] of Array.from(unsyncedClaims).slice(0, 50)) {
      const claimRef = doc(db, 'users', uid, 'claims', gameId);
      const storeVal: StoreId = VALID_STORES.includes(foundGame.store)
        ? foundGame.store
        : 'steam';
      const safePrice = Math.min(
        2000,
        Math.max(0, Number(foundGame.originalPrice) || 0)
      );

      batch.set(claimRef, {
        uid,
        gameId,
        title: clampString(foundGame.title, 160, 'Free Game'),
        store: storeVal,
        storeName: clampString(foundGame.storeName, 80, 'Store'),
        originalPrice: safePrice,
        claimUrl: clampString(
          foundGame.claimUrl,
          500,
          'https://store.steampowered.com'
        ),
        coverImage: clampString(foundGame.coverImage, 500, ''),
        claimedAt: new Date().toISOString().slice(0, 64),
        createdAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function saveClaimToCloud(
  user: User,
  game: GiveawayGame
): Promise<void> {
  const uid = sanitizeDocId(user.uid);
  const gameId = sanitizeDocId(game.id);
  const claimPath = `users/${uid}/claims/${gameId}`;
  const claimRef = doc(db, 'users', uid, 'claims', gameId);

  const storeVal: StoreId = VALID_STORES.includes(game.store)
    ? game.store
    : 'steam';
  const safePrice = Math.min(
    2000,
    Math.max(0, Number(game.originalPrice) || 0)
  );

  try {
    await setDoc(claimRef, {
      uid,
      gameId,
      title: clampString(game.title, 160, 'Free Game'),
      store: storeVal,
      storeName: clampString(game.storeName, 80, 'Store'),
      originalPrice: safePrice,
      claimUrl: clampString(
        game.claimUrl,
        500,
        'https://store.steampowered.com'
      ),
      coverImage: clampString(game.coverImage, 500, ''),
      claimedAt: new Date().toISOString().slice(0, 64),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, claimPath);
  }
}

export async function removeClaimFromCloud(
  user: User,
  rawGameId: string
): Promise<void> {
  const uid = sanitizeDocId(user.uid);
  const gameId = sanitizeDocId(rawGameId);
  const claimPath = `users/${uid}/claims/${gameId}`;
  const claimRef = doc(db, 'users', uid, 'claims', gameId);

  try {
    await deleteDoc(claimRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, claimPath);
  }
}

export async function updateAlertPrefsInCloud(
  user: User,
  pushEnabled: boolean,
  notifyStores: StoreId[]
): Promise<void> {
  const uid = sanitizeDocId(user.uid);
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  const providerKind = detectProviderKind(user);
  const safeEmail = clampString(user.email, 254, `${uid}@user.lootradar.app`);
  const defaultName = safeEmail.split('@')[0] || 'LootRadar Member';
  const safeDisplayName = clampString(user.displayName, 80, defaultName);
  const safeStores = notifyStores
    .filter((s): s is StoreId => VALID_STORES.includes(s))
    .slice(0, 10);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const existingData = snap.data();
      await setDoc(userRef, {
        uid,
        email: safeEmail,
        displayName: safeDisplayName,
        authProvider: providerKind,
        pushEnabled: Boolean(pushEnabled),
        notifyStores: safeStores,
        createdAt: existingData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

// Authentication methods
export async function signInWithGooglePopup(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function registerWithEmailPassword(
  displayName: string,
  email: string,
  password: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  const cleanName = clampString(
    displayName,
    80,
    email.split('@')[0] || 'Member'
  );
  await updateProfile(cred.user, { displayName: cleanName });
  return cred.user;
}

export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function sendAccountPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, collection, doc, query, where, onSnapshot };
export type { User };
