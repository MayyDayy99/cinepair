import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, collection, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, deleteField, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { subscribeToMatches } from './services/movieService';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  matches: any[];
  matchesReady: boolean;
  invites: any[];
  loading: boolean;
  isAuthReady: boolean;
  sendInvite: (toUid: string) => Promise<void>;
  acceptInvite: (invite: any) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  removePartnerId: (partnerId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  matches: [],
  matchesReady: false,
  invites: [],
  loading: true,
  isAuthReady: false,
  sendInvite: async () => {},
  acceptInvite: async () => {},
  declineInvite: async () => {},
  removePartnerId: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  // Distinguishes "no matches yet, still loading" from "first snapshot received (genuinely 0/N)".
  const [matchesReady, setMatchesReady] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Send a pending connection request. Grants NO access until the recipient accepts.
  const sendInvite = async (toUid: string) => {
    const to = (toUid || '').trim();
    if (!user || !to || to === user.uid) return;
    const partnerIds: string[] = (profile && profile.partnerIds) || [];
    if (partnerIds.includes(to)) return; // already linked
    await setDoc(doc(db, 'invites', `${user.uid}_${to}`), {
      from: user.uid,
      to,
      fromName: profile?.displayName || 'Valaki',
      fromPhoto: profile?.photoURL || '',
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  };

  // Recipient accepts: links BOTH sides, THEN removes the invite. If either link write fails
  // (e.g. offline), the error propagates and the invite is kept so the user can retry — avoids a
  // half-linked, unrecoverable state. arrayUnion makes retries idempotent.
  const acceptInvite = async (invite: any) => {
    if (!user || !invite || !invite.from) return;
    await updateDoc(doc(db, 'users', user.uid), { partnerIds: arrayUnion(invite.from) });
    await updateDoc(doc(db, 'users', invite.from), { partnerIds: arrayUnion(user.uid) });
    if (invite.id) await deleteDoc(doc(db, 'invites', invite.id));
  };

  const declineInvite = async (inviteId: string) => {
    if (!inviteId) return;
    await deleteDoc(doc(db, 'invites', inviteId));
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

  // Incoming pending connection requests addressed to me.
  useEffect(() => {
    if (!user) {
      setInvites([]);
      return;
    }
    const q = query(collection(db, 'invites'), where('to', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInvites(
          snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as any) }))
            .filter((i: any) => i.status === 'pending')
        );
      },
      (error) => console.error('Invites subscription error:', error)
    );
    return () => unsub();
  }, [user]);

  return (
    <AuthContext.Provider
      value={{ user, profile, matches, matchesReady, invites, loading, isAuthReady, sendInvite, acceptInvite, declineInvite, removePartnerId }}
    >
      {children}
    </AuthContext.Provider>
  );
};
