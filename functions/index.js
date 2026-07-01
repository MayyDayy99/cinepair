/**
 * CinePair Cloud Functions.
 *
 * onMatchCreated: when a `matches/{id}` document is created, push a notification to every
 * participant EXCEPT the one who triggered the match (matchedBy). Sends a DATA-ONLY message so
 * the service worker renders exactly one notification, and prunes tokens the FCM backend reports
 * as stale.
 *
 * Setup:
 *   firebase functions:secrets:set TMDB_API_KEY     # optional, for nice movie titles
 *   firebase deploy --only functions
 */
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'europe-west1', maxInstances: 10 });

const TMDB_API_KEY = defineSecret('TMDB_API_KEY');
const APP_URL = 'https://mayydayy99.github.io/cinepair/';

async function resolveTitle(movieId) {
  try {
    const key = TMDB_API_KEY.value();
    if (!key || !movieId) return null;
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}?api_key=${key}&language=hu-HU`
    );
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

        // Prune tokens FCM reports as permanently invalid.
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
