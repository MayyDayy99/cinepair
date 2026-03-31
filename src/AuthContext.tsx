import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from './firebase';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAuthReady: boolean;
  addPartnerId: (partnerId: string) => Promise<void>;
  removePartnerId: (partnerId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
  addPartnerId: async () => {},
  removePartnerId: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const addPartnerId = async (partnerId: string) => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { partnerIds: arrayUnion(partnerId) });
    }
  };

  const removePartnerId = async (partnerId: string) => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { partnerIds: arrayRemove(partnerId) });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);

        const unsubProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Migrate legacy partnerId (string) → partnerIds (array)
            if (data.partnerId && !data.partnerIds) {
              updateDoc(userRef, {
                partnerIds: [data.partnerId],
                partnerId: null,
              });
            }
            setProfile(data);
          } else {
            setDoc(userRef, {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Vendég',
              photoURL: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=Vend%C3%A9g&background=f5c518&color=000`,
              email: firebaseUser.email || 'guest@cinepair.app',
              partnerIds: [],
              createdAt: new Date().toISOString()
            }, { merge: true });
          }
          setLoading(false);
        });

        return () => unsubProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAuthReady, addPartnerId, removePartnerId }}>
      {children}
    </AuthContext.Provider>
  );
};
