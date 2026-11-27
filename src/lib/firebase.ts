import { getApp, getApps, initializeApp, FirebaseApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  Firestore,
  collection,
  collectionGroup,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PredictionMarket, WalletTransaction } from '../types/trading';
import { CloudUserDirectoryRecord } from '../utils/tradingEngine';

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

let inMemoryIdToken: string | null = null;
let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;
let connectionTested = false;

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

function initFirebase(): {
  app: FirebaseApp | null;
  db: Firestore | null;
  auth: Auth | null;
} {
  if (appInstance && dbInstance && authInstance) {
    return { app: appInstance, db: dbInstance, auth: authInstance };
  }
  try {
    if (!firebaseConfig?.projectId || !firebaseConfig?.apiKey) {
      return { app: null, db: null, auth: null };
    }
    appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
    authInstance = getAuth(appInstance);
    return { app: appInstance, db: dbInstance, auth: authInstance };
  } catch (err) {
    console.warn('Firebase initialization skipped:', err);
    return { app: null, db: null, auth: null };
  }
}

export const firebaseInstances = initFirebase();
export const db = firebaseInstances.db;
export const auth = firebaseInstances.auth;

export function getInMemoryFirebaseToken(): string | null {
  return inMemoryIdToken;
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
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

export async function testConnection(): Promise<boolean> {
  if (connectionTested) return true;
  connectionTested = true;
  if (!db) return false;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'doc_1';
}

function sanitizeReferralCode(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (cleaned.length >= 4 && cleaned.length <= 24) return cleaned;
  return 'OURO-USER1';
}

export async function ensureFirestoreUserDocs(params: {
  uid: string;
  appUid?: string;
  email: string;
  name: string;
  phone?: string;
  referralCode: string;
  referredByCode?: string;
}): Promise<void> {
  if (!db || !auth?.currentUser || !auth.currentUser.emailVerified) return;
  const firebaseUid = auth.currentUser.uid;
  const publicPath = `users/${firebaseUid}`;
  const privatePath = `users/${firebaseUid}/private/account`;
  const cleanName = params.name.trim().slice(0, 80) || 'Trader';
  const cleanEmail = params.email.trim().toLowerCase().slice(0, 160);
  const cleanRefCode = sanitizeReferralCode(params.referralCode);
  const cleanAppUid = (params.appUid || params.uid || firebaseUid).trim().slice(0, 64);
  const loginNowMs = Date.now();

  try {
    const publicRef = doc(db, 'users', firebaseUid);
    const existingPublic = await getDoc(publicRef);
    if (!existingPublic.exists()) {
      await setDoc(publicRef, {
        uid: firebaseUid,
        displayName: cleanName,
        referralCode: cleanRefCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(publicRef, {
        displayName: cleanName,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, publicPath);
  }

  try {
    const privateRef = doc(db, 'users', firebaseUid, 'private', 'account');
    const existingPrivate = await getDoc(privateRef);
    if (!existingPrivate.exists()) {
      const payload: Record<string, unknown> = {
        uid: firebaseUid,
        appUid: cleanAppUid,
        email: cleanEmail,
        name: cleanName,
        balance: 0,
        withdrawableBalance: 0,
        realizedPnl: 0,
        totalDepositedInr: 0,
        totalWithdrawnInr: 0,
        referralCode: cleanRefCode,
        referralRewardSettled: false,
        lastLoginAtMs: loginNowMs,
        deactivated: false,
        frozen: false,
        banned: false,
        withdrawalsBlocked: false,
        tradingBlocked: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (params.phone?.trim()) {
        payload.phone = params.phone.trim().slice(0, 24);
      }
      if (params.referredByCode?.trim()) {
        payload.referredByCode = params.referredByCode.trim().slice(0, 24);
      }
      await setDoc(privateRef, payload);
    } else {
      const updatePayload: Record<string, unknown> = {
        name: cleanName,
        appUid: cleanAppUid,
        lastLoginAtMs: loginNowMs,
        deactivated: false,
        deactivatedAtMs: deleteField(),
        deactivatedReason: deleteField(),
        deactivatedBy: deleteField(),
        updatedAt: serverTimestamp(),
      };
      if (params.phone?.trim()) {
        updatePayload.phone = params.phone.trim().slice(0, 24);
      }
      await updateDoc(privateRef, updatePayload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privatePath);
  }
}

export async function signInWithGooglePopup(
  referralCodeGenerator: (email: string) => string,
  appUidHint?: string
): Promise<
  | {
      ok: true;
      user: { uid: string; email: string; name: string };
    }
  | { ok: false; error: string }
> {
  if (!auth || !db) {
    return {
      ok: false,
      error: 'Cloud sign-in is unavailable in this environment. Use email & password sign-in.',
    };
  }
  try {
    const cred = await signInWithPopup(auth, googleAuthProvider);
    const fbUser = cred.user;
    if (!fbUser.email) {
      return { ok: false, error: 'Google account did not provide an email address.' };
    }
    inMemoryIdToken = await fbUser.getIdToken();
    const displayName =
      fbUser.displayName?.trim() || fbUser.email.split('@')[0] || 'Trader';
    const refCode = referralCodeGenerator(fbUser.email);
    await ensureFirestoreUserDocs({
      uid: fbUser.uid,
      appUid: appUidHint,
      email: fbUser.email,
      name: displayName,
      referralCode: refCode,
    });
    return {
      ok: true,
      user: {
        uid: fbUser.uid,
        email: fbUser.email.toLowerCase(),
        name: displayName,
      },
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'Google sign-in was cancelled or blocked.';
    return { ok: false, error: msg };
  }
}

export async function signOutFirebase(): Promise<void> {
  inMemoryIdToken = null;
  if (!auth) return;
  try {
    await signOut(auth);
  } catch {
    // Ignore sign-out errors if session already cleared
  }
}

export async function syncPendingTxToFirestore(
  tx: WalletTransaction
): Promise<void> {
  if (!db || !auth?.currentUser || !auth.currentUser.emailVerified) return;
  if (tx.type !== 'deposit' && tx.type !== 'withdraw') return;
  const uid = auth.currentUser.uid;
  const cleanTxId = sanitizeId(tx.id);
  const path = `users/${uid}/transactions/${cleanTxId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'transactions', cleanTxId), {
      uid,
      type: tx.type,
      title: (tx.title || 'Wallet Transaction').slice(0, 120),
      amount: Number(tx.amount) || 0,
      status: 'Under Review',
      meta: (tx.meta || '').slice(0, 160),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncMarketToFirestore(
  market: PredictionMarket
): Promise<void> {
  if (!db || !auth?.currentUser || !auth.currentUser.emailVerified) return;
  if (auth.currentUser.email?.toLowerCase() !== 'karnajoydas@gmail.com') return;
  const uid = auth.currentUser.uid;
  const cleanId = sanitizeId(market.id);
  const path = `markets/${cleanId}`;
  try {
    const ref = doc(db, 'markets', cleanId);
    const snap = await getDoc(ref);
    const payload: Record<string, unknown> = {
      id: cleanId,
      category: market.category,
      subLabel: (market.subLabel || market.category).slice(0, 80),
      question: (market.question || 'Prediction Market').slice(0, 240),
      isActive: !market.resolvedOutcome,
      yesPool: Math.max(0, Number(market.yesPool) || 0),
      noPool: Math.max(0, Number(market.noPool) || 0),
      createdByUid: snap.exists() ? snap.data().createdByUid : uid,
      createdAt: snap.exists() ? snap.data().createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (market.resolvedOutcome === 'yes' || market.resolvedOutcome === 'no') {
      payload.resolvedOutcome = market.resolvedOutcome;
    }
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeActiveMarkets(
  onUpdate: (markets: Array<{ id: string; yesPool: number; noPool: number }>) => void
): () => void {
  if (!db || !auth?.currentUser || !auth.currentUser.emailVerified) {
    return () => {};
  }
  const path = 'markets';
  const q = query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          yesPool: Number(data.yesPool) || 0,
          noPool: Number(data.noPool) || 0,
        };
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function syncAdminUserUpdateToFirestore(
  firebaseUid: string | undefined,
  patch: {
    balance?: number;
    withdrawableBalance?: number;
    deactivated?: boolean;
    deactivatedAtMs?: number;
    deactivatedReason?: string;
    deactivatedBy?: 'inactivity_60d' | 'admin';
    frozen?: boolean;
    banned?: boolean;
    withdrawalsBlocked?: boolean;
    tradingBlocked?: boolean;
    lastLoginAtMs?: number;
  }
): Promise<void> {
  if (!db || !firebaseUid || !auth?.currentUser || !auth.currentUser.emailVerified) {
    return;
  }
  if (auth.currentUser.email?.toLowerCase() !== 'karnajoydas@gmail.com') {
    return;
  }
  const path = `users/${firebaseUid}/private/account`;
  try {
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (typeof patch.balance === 'number') payload.balance = Math.max(0, patch.balance);
    if (typeof patch.withdrawableBalance === 'number') {
      payload.withdrawableBalance = Math.max(0, patch.withdrawableBalance);
    }
    if (typeof patch.lastLoginAtMs === 'number') {
      payload.lastLoginAtMs = patch.lastLoginAtMs;
    }
    if (typeof patch.frozen === 'boolean') payload.frozen = patch.frozen;
    if (typeof patch.banned === 'boolean') payload.banned = patch.banned;
    if (typeof patch.withdrawalsBlocked === 'boolean') {
      payload.withdrawalsBlocked = patch.withdrawalsBlocked;
    }
    if (typeof patch.tradingBlocked === 'boolean') {
      payload.tradingBlocked = patch.tradingBlocked;
    }
    if (typeof patch.deactivated === 'boolean') {
      payload.deactivated = patch.deactivated;
      if (patch.deactivated) {
        payload.deactivatedAtMs = patch.deactivatedAtMs ?? Date.now();
        payload.deactivatedReason = (
          patch.deactivatedReason || 'Deactivated from Owner Admin Panel'
        ).slice(0, 160);
        payload.deactivatedBy = patch.deactivatedBy ?? 'admin';
      } else {
        payload.deactivatedAtMs = deleteField();
        payload.deactivatedReason = deleteField();
        payload.deactivatedBy = deleteField();
      }
    }
    await updateDoc(doc(db, 'users', firebaseUid, 'private', 'account'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeAllUsersForAdmin(
  onUpdate: (users: CloudUserDirectoryRecord[]) => void
): () => void {
  if (!db || !auth) return () => {};

  let unsubSnapshot: (() => void) | null = null;

  const attachSnapshot = () => {
    if (unsubSnapshot) {
      unsubSnapshot();
      unsubSnapshot = null;
    }
    const user = auth?.currentUser;
    if (
      !db ||
      !user ||
      !user.emailVerified ||
      user.email?.toLowerCase() !== 'karnajoydas@gmail.com'
    ) {
      return;
    }
    unsubSnapshot = onSnapshot(
      collectionGroup(db, 'private'),
      (snap) => {
        const records: CloudUserDirectoryRecord[] = [];
        for (const docSnap of snap.docs) {
          if (docSnap.id !== 'account') continue;
          const data = docSnap.data();
          const email = String(data.email || '').trim().toLowerCase();
          if (!email) continue;
          records.push({
            firebaseUid: String(data.uid || docSnap.ref.parent.parent?.id || ''),
            appUid: typeof data.appUid === 'string' ? data.appUid : undefined,
            email,
            name: String(data.name || email.split('@')[0] || 'Trader'),
            phone: typeof data.phone === 'string' ? data.phone : undefined,
            balance: Number(data.balance) || 0,
            withdrawableBalance: Number(data.withdrawableBalance) || 0,
            realizedPnl: Number(data.realizedPnl) || 0,
            referralCode: String(data.referralCode || 'OURO-USER1'),
            referredByCode:
              typeof data.referredByCode === 'string'
                ? data.referredByCode
                : undefined,
            referralRewardSettled: Boolean(data.referralRewardSettled),
            lastLoginAtMs:
              typeof data.lastLoginAtMs === 'number'
                ? data.lastLoginAtMs
                : undefined,
            deactivated: Boolean(data.deactivated),
            deactivatedAtMs:
              typeof data.deactivatedAtMs === 'number'
                ? data.deactivatedAtMs
                : undefined,
            deactivatedReason:
              typeof data.deactivatedReason === 'string'
                ? data.deactivatedReason
                : undefined,
            deactivatedBy:
              data.deactivatedBy === 'inactivity_60d' ||
              data.deactivatedBy === 'admin'
                ? data.deactivatedBy
                : undefined,
            frozen: Boolean(data.frozen),
            banned: Boolean(data.banned),
            withdrawalsBlocked: Boolean(data.withdrawalsBlocked),
            tradingBlocked: Boolean(data.tradingBlocked),
            totalDepositedInr: Number(data.totalDepositedInr) || 0,
            totalWithdrawnInr: Number(data.totalWithdrawnInr) || 0,
          });
        }
        onUpdate(records);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'private');
      }
    );
  };

  attachSnapshot();
  const unsubAuth = onAuthStateChanged(auth, () => {
    attachSnapshot();
  });

  return () => {
    if (unsubSnapshot) unsubSnapshot();
    unsubAuth();
  };
}
