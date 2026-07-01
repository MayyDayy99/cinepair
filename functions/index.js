/**
 * CinePair Cloud Functions.
 *
 *  - onSwipeCreated : when a `like` swipe is written, create the match document server-side
 *                     (server-authoritative, redundant with the hardened client path).
 *  - onMatchCreated : when a `matches/{id}` doc is created, push a DATA-ONLY notification to the
 *                     other participant(s) and prune stale FCM tokens.
 *  - tmdb           : HTTPS proxy for TMDB so the API key stays server-side (secret), not in the
 *                     client bundle. Enable on the client via VITE_TMDB_PROXY_URL.
 *
 * Setup:
 *   firebase functions:secrets:set TMDB_API_KEY
 *   firebase deploy --only functions
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const TMDB_API_KEY = defineSecret('TMDB_API_KEY');
const APP_URL = 'https://mayydayy99.github.io/cinepair/';

// ---------------------------------------------------------------------------
// Server-side match creation (redundant safety net alongside the client path).
// ---------------------------------------------------------------------------
exports.onSwipeCreated = onDocumentCreated('users/{userId}/swipes/{movieId}', async (event) => {
  const snap = event.data;
  if (!snap) return;
  const swipe = snap.data() || {};
  if (swipe.type !== 'like') return;

  const { userId, movieId } = event.params;
  const db = admin.firestore();

  const userSnap = await db.collection('users').doc(userId).get();
  const partnerIds = (userSnap.exists && Array.isArray(userSnap.data().partnerIds))
    ? userSnap.data().partnerIds
    : [];
  if (partnerIds.length === 0) return;

  await Promise.all(
    partnerIds.map(async (partnerId) => {
      if (!partnerId || partnerId === userId) return;
      const partnerSwipe = await db.collection('users').doc(partnerId).collection('swipes').doc(movieId).get();
      if (!partnerSwipe.exists || partnerSwipe.data().type !== 'like') return;

      const sorted = [userId, partnerId].sort();
      const matchRef = db.collection('matches').doc(`${sorted[0]}_${sorted[1]}_${movieId}`);
      try {
        await matchRef.create({
          movieId,
          userIds: [userId, partnerId],
          matchedBy: userId,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        // ALREADY_EXISTS (code 6) — the client (or a concurrent run) already created it. Fine.
        if (!e || e.code !== 6) throw e;
      }
    })
  );
});

// ---------------------------------------------------------------------------
// Push notification on match.
// ---------------------------------------------------------------------------
async function resolveTitle(movieId) {
  try {
    const key = TMDB_API_KEY.value();
    if (!key || !movieId) return null;
    const res = await fetch(`https://api.themoviedb.org/3/movie/${movieId}?api_key=${key}&language=hu-HU`);
    if (!res.ok) return null;
    const m = await res.json();
    return m && m.title ? m.title : null;
  } catch (e) {
    console.warn('TMDB title fetch failed:', e);
    return null;
  }
}

exports.onMatchCreated = onDocumentCreated(
  { document: 'matches/{matchId}', secrets: [TMDB_API_KEY] },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const match = snap.data() || {};
    const userIds = Array.isArray(match.userIds) ? match.userIds : [];
    const recipients = userIds.filter((uid) => uid && uid !== match.matchedBy);
    if (recipients.length === 0) return;

    const title = await resolveTitle(match.movieId);
    const body = title ? `A párod is kedvelte: ${title}` : 'A párod is kedvelt egy filmet! 🍿';

    const db = admin.firestore();

    await Promise.all(
      recipients.map(async (uid) => {
        const tokensSnap = await db.collection('users').doc(uid).collection('fcmTokens').get();
        if (tokensSnap.empty) return;
        const tokens = tokensSnap.docs.map((d) => d.id);

        const resp = await admin.messaging().sendEachForMulticast({
          tokens,
          data: {
            title: 'Új CinePair Találat! 🍿',
            body,
            link: `${APP_URL}#/watchlist`,
            icon: `${APP_URL}icon-512.png`,
            movieId: String(match.movieId || ''),
          },
        });

        const deletions = [];
        resp.responses.forEach((r, i) => {
          if (r.success) return;
          const code = r.error && r.error.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token' ||
            code === 'messaging/invalid-argument'
          ) {
            deletions.push(tokensSnap.docs[i].ref.delete());
          }
        });
        await Promise.all(deletions);
      })
    );
  }
);

// ---------------------------------------------------------------------------
// TMDB proxy — keeps the API key server-side.
//   GET <fn-url>?path=/discover/movie&language=hu-HU&page=1&...
// ---------------------------------------------------------------------------
exports.tmdb = onRequest({ secrets: [TMDB_API_KEY], cors: true, maxInstances: 10 }, async (req, res) => {
  try {
    if (req.method !== 'GET') {
      res.status(405).json({ error: 'method not allowed' });
      return;
    }
    const key = TMDB_API_KEY.value();
    if (!key) {
      res.status(500).json({ error: 'tmdb key not configured' });
      return;
    }
    const tpath = String(req.query.path || '');
    // Only allow safe TMDB path shapes (no host override, no scheme).
    if (!/^\/[A-Za-z0-9/_.-]+$/.test(tpath)) {
      res.status(400).json({ error: 'invalid path' });
      return;
    }
    const params = new URLSearchParams(req.query);
    params.delete('path');
    params.set('api_key', key);

    const r = await fetch(`https://api.themoviedb.org/3${tpath}?${params.toString()}`);
    const body = await r.text();
    res.set('Cache-Control', 'public, max-age=3600');
    res.status(r.status).type('application/json').send(body);
  } catch (e) {
    console.error('tmdb proxy error:', e);
    res.status(502).json({ error: 'proxy error' });
  }
});
