import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, collection, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, arrayUnion, arrayRemove, deleteField, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  subscribeToCollections, subscribeToCollectionMatches,
  createCollection as svcCreateCollection, renameCollection as svcRenameCollection,
  deleteCollection as svcDeleteCollection, leaveCollection as svcLeaveCollection,
  Collection,
} from './services/movieService';

export interface DerivedMatch { movieId: string; watched: boolean; }

interface AuthContextType {
  user: User | null;
  profile: any | null;
  collections: Collection[];
  activeCollection: Collection | null;
  matches: DerivedMatch[];
  matchesReady: boolean;
  invites: any[];
  loading: boolean;
  isAuthReady: boolean;
  sendInvite: (toUid: string, collectionId?: string, collectionName?: string) => Promise<void>;
  acceptInvite: (invite: any) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  createCollection: (name: string) => Promise<string | null>;
  renameCollection: (cid: string, name: string) => Promise<void>;
  deleteCollection: (cid: string) => Promise<void>;
  leaveCollection: (cid: string) => Promise<void>;
  setActiveCollection: (cid: string) => Promise<void>;
  removePartnerId: (partnerId: string) => Promise<void>;
}

const noop = async () => {};
const AuthContext = createContext<AuthContextType>({
  user: null, profile: null, collections: [], activeCollection: null, matches: [], matchesReady: false,
  invites: [], loading: true, isAuthReady: false,
  sendInvite: noop, acceptInvite: noop, declineInvite: noop,
  createCollection: async () => null, renameCollection: noop, deleteCollection: noop, leaveCollection: noop,
  setActiveCollection: noop, removePartnerId: noop,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [matches, setMatches] = useState<DerivedMatch[]>([]);
  const [matchesReady, setMatchesReady] = useState(false);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // The active collection: the profile's choice if still valid, else the first one, else null.
  const activeCollection =
    collections.find(c => c.id === profile?.activeCollectionId) || collections[0] || null;

  const removePartnerId = async (partnerId: string) => {
    if (user) await updateDoc(doc(db, 'users', user.uid), { partnerIds: arrayRemove(partnerId) });
  };

  const setActiveCollection = async (cid: string) => {
    if (user) await updateDoc(doc(db, 'users', user.uid), { activeCollectionId: cid });
  };

  const createCollection = async (name: string): Promise<string | null> => {
    if (!user) return null;
    const cid = await svcCreateCollection(user.uid, name);
    await updateDoc(doc(db, 'users', user.uid), { activeCollectionId: cid }); // make it active
    return cid;
  };

  const renameCollection = (cid: string, name: string) => svcRenameCollection(cid, name);
  const deleteCollection = (cid: string) => svcDeleteCollection(cid);
  const leaveCollection = async (cid: string) => {
    if (user) await svcLeaveCollection(cid, user.uid);
  };

  // Send a pending connection request, optionally to join a specific collection.
  const sendInvite = async (toUid: string, collectionId?: string, collectionName?: string) => {
    const to = (toUid || '').trim();
    if (!user || !to || to === user.uid) return;
    const inviteId = collectionId ? `${user.uid}_${to}_${collectionId}` : `${user.uid}_${to}`;
    const data: any = {
      from: user.uid, to,
      fromName: profile?.displayName || 'Valaki',
      fromPhoto: profile?.photoURL || '',
      status: 'pending',
      createdAt: serverTimestamp(),
    };
    if (collectionId) { data.collectionId = collectionId; data.collectionName = collectionName || ''; }
    await setDoc(doc(db, 'invites', inviteId), data);
  };

  const acceptInvite = async (invite: any) => {
    if (!user || !invite) return;
    if (invite.collectionId) {
      const colRef = doc(db, 'collections', invite.collectionId);
      // Join first — the rules permit adding only your own uid even without read access.
      await updateDoc(colRef, { memberIds: arrayUnion(user.uid) });
      try {
        const snap = await getDoc(colRef); // now readable as a member
        const members: string[] = (snap.exists() && (snap.data() as any).memberIds) || [];
        // Establish mutual read links with every member so the derived-match intersection can read all.
        await Promise.all(
          members.filter(m => m !== user.uid).flatMap(m => [
            updateDoc(doc(db, 'users', user.uid), { partnerIds: arrayUnion(m) }),
            updateDoc(doc(db, 'users', m), { partnerIds: arrayUnion(user.uid) }).catch(() => {}),
          ])
        );
        await updateDoc(doc(db, 'users', user.uid), { activeCollectionId: invite.collectionId });
      } catch (e) {
        console.warn('collection link after join failed:', e);
      }
    } else {
      // Legacy 1:1 partner invite.
      await updateDoc(doc(db, 'users', user.uid), { partnerIds: arrayUnion(invite.from) });
      await updateDoc(doc(db, 'users', invite.from), { partnerIds: arrayUnion(user.uid) });
    }
    if (invite.id) await deleteDoc(doc(db, 'invites', invite.id));
  };

  // --- Auth + profile listener ---
  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (unsubProfile) { unsubProfile(); unsubProfile = undefined; }
      setUser(firebaseUser);
      setIsAuthReady(true);

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.partnerId !== undefined && !data.partnerIds) {
              updateDoc(userRef, { partnerIds: data.partnerId ? [data.partnerId] : [], partnerId: deleteField() })
                .catch((e) => console.warn('partnerId migration failed:', e));
            }
            setProfile(data);
          } else {
            setDoc(userRef, {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Vendég',
              photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=Vend%C3%A9g&background=f5c518&color=000`,
              email: firebaseUser.email || 'guest@cinepair.app',
              partnerIds: [],
              createdAt: new Date().toISOString(),
            }, { merge: true }).catch((e) => console.warn('profile create failed:', e));
          }
          setLoading(false);
        }, (error) => { console.error('Profile listener error:', error); setLoading(false); });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => { unsubscribe(); if (unsubProfile) unsubProfile(); };
  }, []);

  // --- Collections subscription ---
  useEffect(() => {
    if (!user) { setCollections([]); return; }
    const unsub = subscribeToCollections(user.uid, setCollections);
    return () => unsub();
  }, [user]);

  // --- Incoming invites ---
  useEffect(() => {
    if (!user) { setInvites([]); return; }
    const q = query(collection(db, 'invites'), where('to', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter((i: any) => i.status === 'pending'));
    }, (error) => console.error('Invites subscription error:', error));
    return () => unsub();
  }, [user]);

  // --- Derived matches for the active collection (intersection of members' likes) ---
  const activeKey = activeCollection ? `${activeCollection.id}:${[...activeCollection.memberIds].sort().join(',')}` : '';
  useEffect(() => {
    if (!user || !activeCollection) { setMatches([]); setMatchesReady(true); return; }
    setMatchesReady(false);
    const unsub = subscribeToCollectionMatches(activeCollection.memberIds, activeCollection.id, (m) => {
      setMatches(m);
      setMatchesReady(true);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeKey]);

  return (
    <AuthContext.Provider
      value={{
        user, profile, collections, activeCollection, matches, matchesReady, invites, loading, isAuthReady,
        sendInvite, acceptInvite, declineInvite: async (inviteId: string) => { if (inviteId) await deleteDoc(doc(db, 'invites', inviteId)); },
        createCollection, renameCollection, deleteCollection, leaveCollection, setActiveCollection, removePartnerId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
