import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Hard-coded public web config for project cinepair-31543 — the project actually managed in
// the Firebase console (authorized domains, Google provider, etc.).
// NOTE: do NOT drive this from the VITE_FIREBASE_* CI secrets: those point at a different
// Firebase project/API key, which makes Google sign-in fail with auth/unauthorized-domain on
// the custom domain (the app would talk to the wrong project). A web apiKey is not a secret,
// so shipping it is fine; access is governed by Firestore rules.
const firebaseConfig = {
  apiKey: "AIzaSyC8E5q9agK_utY_GZzvt9NIvIO0b1HV2Gk",
  authDomain: "cinepair-31543.firebaseapp.com",
  projectId: "cinepair-31543",
  storageBucket: "cinepair-31543.firebasestorage.app",
  messagingSenderId: "113009325170",
  appId: "1:113009325170:web:76cb08f667a371ddd8feeb"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signInAsGuest = () => signInAnonymously(auth);
export const logout = () => signOut(auth);

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
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
