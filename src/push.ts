import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from './firebase';
import toast from 'react-hot-toast';

const env = (import.meta as any).env || {};
const VAPID_KEY: string = env.VITE_FIREBASE_VAPID_KEY || '';
const BASE: string = env.BASE_URL || '/';

let foregroundBound = false;

/**
 * Registers this device for Web Push and stores the FCM token under the user's
 * fcmTokens subcollection (a Cloud Function reads it to notify the partner on a match).
 * Safe to call repeatedly; resolves false (without throwing) when push is unavailable
 * — e.g. permission not granted, unsupported browser, or VAPID key not configured.
 */
export async function registerForPush(uid: string): Promise<boolean> {
  try {
    if (!uid) return false;
    if (!VAPID_KEY) {
      console.info('Push disabled: VITE_FIREBASE_VAPID_KEY is not set.');
      return false;
    }
    if (!('serviceWorker' in navigator)) return false;
    if (!(await isSupported())) return false;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;

    const swReg =
      (await navigator.serviceWorker.getRegistration(BASE)) ||
      (await navigator.serviceWorker.ready);

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (!token) return false;

    await setDoc(
      doc(db, 'users', uid, 'fcmTokens', token),
      { createdAt: serverTimestamp(), platform: (navigator.userAgent || '').slice(0, 180) },
      { merge: true }
    );

    // Foreground messages don't trigger the service worker; surface an in-app toast instead.
    if (!foregroundBound) {
      foregroundBound = true;
      onMessage(messaging, (payload) => {
        const d = (payload && payload.data) || {};
        toast(d.body || 'Új találat! 🍿', { icon: '🍿' });
      });
    }
    return true;
  } catch (e) {
    console.warn('Push registration failed:', e);
    return false;
  }
}

/** Removes a token (e.g. on logout) so the user stops receiving push on this device. */
export async function unregisterPushToken(uid: string, token: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'users', uid, 'fcmTokens', token));
  } catch (e) {
    console.warn('Push token removal failed:', e);
  }
}
