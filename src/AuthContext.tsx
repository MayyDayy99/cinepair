import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore';
import { auth, db } from './firebase';
import { subscribeToMatches } from './services/movieService';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  matches: any[];
  matchesReady: boolean;
  loading: boolean;
  isAuthReady: boolean;
  addPartnerId: (partnerId: string) => Promise<void>;
  removePartnerId: (partnerId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  matches: [],
  matchesReady: false,
  loading: true,
  isAuthReady: false,
  addPartnerId: async () => {},
  removePartnerId: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  // Distinguishes "no matches yet, still loading" from "first snapshot received (genuinely 0/N)".
  const [matchesReady, setMatchesReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const addPartnerId = async (partnerId: string) => {
    if (!user || !partnerId || partnerId === user.uid) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { partnerIds: arrayUnion(partnerId) });
    // Best-effort reciprocal link so discovery/matching works in BOTH directions.
    // (Rules allow appending only our own uid to another user's partnerIds.)
    try {
      await updateDoc(doc(db, 'users', partnerId), { partnerIds: arrayUnion(user.uid) });
    } catch (e) {
      console.warn('Reciprocal partner link failed (partner doc may not exist yet):', e);
    }
  };

  const removePartnerId = async (partnerId: string) => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { partnerIds: arrayRemove(partnerId) });
    }
  };

  useEffect(() => {
    // Tracks the per-user profile listener so it can be torn down on every auth change
    // (onAuthStateChanged ignores any value returned from its observer, so we must do it manually).
    let unsubProfile: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }

      setUser(firebaseUser);
      setIsAuthReady(true);

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);

        unsubProfile = onSnapshot(
          userRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              // Migrate legacy partnerId (string|null) → partnerIds (array).
              // Use deleteField() so the key is removed (a literal null would fail isValidUser).
              if (data.partnerId !== undefined && !data.partnerIds) {
                updateDoc(userRef, {
                  partnerIds: data.partnerId ? [data.partnerId] : [],
                  partnerId: deleteField(),
                }).catch((e) => console.warn('partnerId migration failed:', e));
              }
              setProfile(data);
            } else {
              setDoc(
                userRef,
                {
                  uid: firebaseUser.uid,
                  displayName: firebaseUser.displayName || 'Vendég',
                  photoURL:
                    firebaseUser.photoURL ||
                    `https://ui-avatars.com/api/?name=Vend%C3%A9g&background=f5c518&color=000`,
                  email: firebaseUser.email || 'guest@cinepair.app',
                  partnerIds: [],
                  createdAt: new Date().toISOString(),
                },
                { merge: true }
              ).catch((e) => console.warn('profile create failed:', e));
            }
            setLoading(false);
          },
          (error) => {
            // Without this, a denied/errored profile read would leave loading=true forever.
            console.error('Profile listener error:', error);
            setLoading(false);
          }
        );
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // Single, app-wide matches subscription (consumed by both the notification logic and the watchlist).
  useEffect(() => {
    if (!user) {
      setMatches([]);
      setMatchesReady(false);
      return;
    }
    setMatchesReady(false);
    const unsub = subscribeToMatches(user.uid, (m) => {
      setMatches(m);
      setMatchesReady(true);
    });
    return () => unsub();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, matches, matchesReady, loading, isAuthReady, addPartnerId, removePartnerId }}>
      {children}
    </AuthContext.Provider>
  );
};
