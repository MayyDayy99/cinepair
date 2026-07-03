import { collection, doc, setDoc, getDoc, deleteDoc, updateDoc, addDoc, arrayRemove, query, where, onSnapshot, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';

export interface Movie {
  id: string;
  title: string;
  year: string;
  rating: number;
  posterUrl: string;
  synopsis: string;
  genres: string[];
  duration: string;
}

export const MOCK_MOVIES: Movie[] = [
  {
    id: '1',
    title: 'NEON DRIFT',
    year: '2024',
    rating: 8.4,
    posterUrl: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1025&auto=format&fit=crop',
    synopsis: 'Egy elhaló metropoliszban egy emléklopó összeesküvésre bukkan, amely átírhatja az emberi tudat történelmét.',
    genres: ['Sci-Fi', 'Thriller'],
    duration: '2h 10m'
  },
  {
    id: '2',
    title: 'THE LAST SILENCE',
    year: '2023',
    rating: 7.9,
    posterUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1170&auto=format&fit=crop',
    synopsis: 'Egy siket vadász a poszt-apokaliptikus világban megvédi a faluját a hang alapján vadászó lényektől.',
    genres: ['Horror', 'Dráma'],
    duration: '1h 45m'
  },
  {
    id: '3',
    title: 'COSMIC REACH',
    year: '2024',
    rating: 8.1,
    posterUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=1172&auto=format&fit=crop',
    synopsis: 'A Proxima Centaurihoz indított első emberes misszió felfedezi, hogy nem ők az első emberek, akik elhagyták a Földet.',
    genres: ['Sci-Fi', 'Kaland'],
    duration: '2h 30m'
  }
];

const env = (import.meta as any).env || {};
const TMDB_API_KEY = env.VITE_TMDB_API_KEY;
// When set, TMDB requests are routed through our Cloud Function proxy so the API key never
// ships in the client bundle. Falls back to direct TMDB (with the client key) when unset.
const TMDB_PROXY: string = env.VITE_TMDB_PROXY_URL || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const tmdbAvailable = !!TMDB_API_KEY || !!TMDB_PROXY;

// Returns a URL prefix ending in `&` so callers can append `key=value&...` uniformly.
function tmdbBase(path: string): string {
  if (TMDB_PROXY) return `${TMDB_PROXY}?path=${encodeURIComponent(path)}&`;
  return `${TMDB_BASE_URL}${path}?api_key=${TMDB_API_KEY}&`;
}

// --- Genre Map Cache ---
let genreMap: Record<number, string> = {};
let genreMapLoaded = false;

async function loadGenreMap(): Promise<void> {
  if (genreMapLoaded || !tmdbAvailable) return;
  try {
    const response = await fetch(`${tmdbBase('/genre/movie/list')}language=hu-HU`);
    if (!response.ok) {
      console.warn(`TMDB genre list failed: HTTP ${response.status}`);
      return;
    }
    const data = await response.json();
    if (data.genres) {
      genreMap = {};
      for (const g of data.genres) {
        genreMap[g.id] = g.name;
      }
      genreMapLoaded = true;
    }
  } catch (e) {
    console.warn('Could not load genre map:', e);
  }
}

function resolveGenres(genreIds: number[]): string[] {
  if (!genreIds || genreIds.length === 0) return ['Film'];
  return genreIds.map(id => genreMap[id] || 'Film').filter((v, i, a) => a.indexOf(v) === i);
}

// --- Available genres for UI filter ---
export async function getGenreList(): Promise<{ id: number; name: string }[]> {
  await loadGenreMap();
  return Object.entries(genreMap).map(([id, name]) => ({ id: Number(id), name }));
}

export interface MovieFetchOptions {
  page?: number;
  year?: string;
  genreId?: string;
}

export async function getMovies(options: MovieFetchOptions = {}): Promise<Movie[]> {
  const { page = 1, year, genreId } = options;

  if (!tmdbAvailable) {
    console.error("TMDB not configured (no API key or proxy URL)!");
    return MOCK_MOVIES;
  }

  await loadGenreMap();

  try {
    let url = `${tmdbBase('/discover/movie')}language=hu-HU&sort_by=popularity.desc&page=${page}&vote_count.gte=100`;
    
    if (year) {
      url += `&primary_release_year=${year}`;
    }
    if (genreId) {
      url += `&with_genres=${genreId}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      console.error(`TMDB discover failed: HTTP ${response.status}`);
      return [];
    }
    const data = await response.json();

    if (!data.results) return [];

    const movies: Movie[] = data.results
      .filter((m: any) => m && m.id != null && m.title)
      .map((m: any) => ({
      id: m.id.toString(),
      title: m.title.toUpperCase(),
      year: m.release_date ? m.release_date.split('-')[0] : 'N/A',
      rating: Math.round((m.vote_average || 0) * 10) / 10,
      posterUrl: m.poster_path ? `${TMDB_IMAGE_BASE}${m.poster_path}` : 'https://images.unsplash.com/photo-1542204172-3f19114d5049?q=80&w=1035&auto=format&fit=crop',
      synopsis: m.overview || 'Nincs elérhető leírás.',
      genres: resolveGenres(m.genre_ids || []),
      duration: 'N/A'
    }));

    return movies;
  } catch (error) {
    console.error("TMDB Fetch Error:", error);
    return [];
  }
}

export async function getMovieById(movieId: string): Promise<Movie | null> {
  if (!tmdbAvailable) return null;
  try {
    const response = await fetch(`${tmdbBase('/movie/' + movieId)}language=hu-HU`);
    if (!response.ok) {
      console.warn(`TMDB movie ${movieId} failed: HTTP ${response.status}`);
      return null;
    }
    const m = await response.json();
    if (!m.id || !m.title) return null;
    return {
      id: m.id.toString(),
      title: m.title.toUpperCase(),
      year: m.release_date ? m.release_date.split('-')[0] : 'N/A',
      rating: Math.round((m.vote_average || 0) * 10) / 10,
      posterUrl: m.poster_path ? `${TMDB_IMAGE_BASE}${m.poster_path}` : 'https://images.unsplash.com/photo-1542204172-3f19114d5049?q=80&w=1035&auto=format&fit=crop',
      synopsis: m.overview || 'Nincs elérhető leírás.',
      genres: m.genres ? m.genres.map((g: any) => g.name) : ['Film'],
      duration: m.runtime ? `${Math.floor(m.runtime/60)}h ${m.runtime%60}m` : 'N/A'
    };
  } catch(e) {
    return null;
  }
}

export async function getMovieTrailer(movieId: string): Promise<string | null> {
  if (!tmdbAvailable) return null;
  try {
    const response = await fetch(`${tmdbBase('/movie/' + movieId + '/videos')}language=hu-HU`);
    if (!response.ok) {
      console.warn(`TMDB trailer ${movieId} failed: HTTP ${response.status}`);
      return null;
    }
    const data = await response.json();
    let trailer = data.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
    if (!trailer) {
      // Fallback to English
      const enResponse = await fetch(`${tmdbBase('/movie/' + movieId + '/videos')}language=en-US`);
      if (!enResponse.ok) return null;
      const enData = await enResponse.json();
      trailer = enData.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
    }
    return trailer ? `https://www.youtube.com/embed/${trailer.key}` : null;
  } catch(e) {
    return null;
  }
}

export async function swipeMovie(userId: string, movieId: string, type: 'like' | 'dislike', partnerIds?: string[]): Promise<boolean> {
  const path = `users/${userId}/swipes`;

  // 1) Persist the swipe. A failure here IS surfaced (the caller recovers the deck).
  try {
    const swipeRef = doc(collection(db, path), movieId);
    await setDoc(swipeRef, { userId, movieId, type, timestamp: serverTimestamp() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false; // unreachable (handleFirestoreError throws) — keeps the return type honest
  }

  if (type !== 'like' || !partnerIds || partnerIds.length === 0) return false;

  // 2) Match detection is best-effort: the like is already saved, and the onSwipeCreated Cloud
  //    Function creates matches server-side as a backstop, so a failure here must NOT be reported
  //    as a failed swipe.
  let anyMatch = false;
  try {
    for (const partnerId of partnerIds) {
      const partnerSwipeSnap = await getDoc(doc(db, `users/${partnerId}/swipes`, movieId));
      if (partnerSwipeSnap.exists() && partnerSwipeSnap.data().type === 'like') {
        const sortedIds = [userId, partnerId].sort();
        const matchRef = doc(db, 'matches', `${sortedIds[0]}_${sortedIds[1]}_${movieId}`);
        await setDoc(matchRef, {
          movieId,
          userIds: [userId, partnerId],
          matchedBy: userId,
          timestamp: serverTimestamp(),
        });
        anyMatch = true;
      }
    }
  } catch (error) {
    console.warn('Match detection failed (the swipe was saved):', error);
  }
  return anyMatch;
}

export async function undoSwipe(userId: string, movieId: string) {
  const path = `users/${userId}/swipes`;
  try {
    await deleteDoc(doc(db, path, movieId));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeMatch(matchId: string) {
  try {
    await deleteDoc(doc(db, 'matches', matchId));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'matches');
  }
}

export async function toggleMatchWatched(matchId: string, watched: boolean) {
  const matchRef = doc(db, 'matches', matchId);
  try {
    await setDoc(matchRef, { watched }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'matches');
  }
}

export function subscribeToMatches(userId: string, callback: (matches: any[]) => void) {
  const path = 'matches';
  const q = query(collection(db, path), where('userIds', 'array-contains', userId));
  
  return onSnapshot(q, (snapshot) => {
    const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(matches);
  }, (error) => {
    // Do NOT rethrow here: a thrown error inside the snapshot error handler becomes an
    // uncatchable runtime error. Log instead so a transient failure can't crash the app.
    console.error(`Firestore subscription error (${path}):`, error);
  });
}

export async function getUserSwipes(userId: string): Promise<string[]> {
  const path = `users/${userId}/swipes`;
  try {
    const querySnapshot = await getDocs(collection(db, path));
    return querySnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.warn("Could not fetch swipes:", error);
    return [];
  }
}

export async function getPartnerLikedMovies(partnerIds: string[], myUserId: string): Promise<Movie[]> {
  try {
    const mySwipedIds = await getUserSwipes(myUserId);
    const seenIds = new Set(mySwipedIds);
    const collectedIds: string[] = [];

    for (const partnerId of partnerIds) {
      const partnerSwipesRef = collection(db, `users/${partnerId}/swipes`);
      const q = query(partnerSwipesRef, where('type', '==', 'like'));
      const partnerLikesSnap = await getDocs(q);
      for (const d of partnerLikesSnap.docs) {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          collectedIds.push(d.id);
        }
      }
    }

    // Resolve up to 30 (was a silent cap of 10) in parallel instead of a slow N+1 loop.
    const resolved = await Promise.all(collectedIds.slice(0, 30).map(id => getMovieById(id)));
    return resolved.filter((m): m is Movie => m !== null);
  } catch (error) {
    console.error("Error fetching partner likes:", error);
    return [];
  }
}

// ===============================================================
// Collections (groups) — matches are DERIVED as the intersection of members' likes.
// ===============================================================
export interface Collection {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}

export function subscribeToCollections(uid: string, callback: (cols: Collection[]) => void) {
  const q = query(collection(db, 'collections'), where('memberIds', 'array-contains', uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  }, (error) => console.error('collections subscription error:', error));
}

export async function createCollection(uid: string, name: string): Promise<string> {
  const ref = await addDoc(collection(db, 'collections'), {
    name: (name || '').trim() || 'Új gyűjtő',
    ownerId: uid,
    memberIds: [uid],
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function renameCollection(cid: string, name: string) {
  await updateDoc(doc(db, 'collections', cid), { name: (name || '').trim() || 'Gyűjtő' });
}

export async function deleteCollection(cid: string) {
  await deleteDoc(doc(db, 'collections', cid));
}

export async function leaveCollection(cid: string, uid: string) {
  await updateDoc(doc(db, 'collections', cid), { memberIds: arrayRemove(uid) });
}

export async function toggleCollectionWatched(cid: string, movieId: string, watched: boolean) {
  const ref = doc(db, 'collections', cid, 'watched', movieId);
  if (watched) await setDoc(ref, { at: serverTimestamp() });
  else await deleteDoc(ref);
}

/**
 * Live-subscribes to the derived matches of a collection: the set of movies that EVERY member
 * has 'like'd, annotated with the per-collection "watched" flag. Recomputes on any member's
 * likes changing or the watched set changing.
 */
export function subscribeToCollectionMatches(
  memberIds: string[],
  cid: string,
  callback: (matches: { movieId: string; watched: boolean }[]) => void
): () => void {
  // A collection needs at least 2 members for a "match" to be meaningful (a shared like).
  if (!memberIds || memberIds.length < 2) {
    callback([]);
    return () => {};
  }
  const likeSets: (Set<string> | null)[] = memberIds.map(() => null);
  let watchedSet = new Set<string>();

  const recompute = () => {
    if (likeSets.some(s => s === null)) return; // wait until every member's first snapshot arrived
    let inter = likeSets[0] ? Array.from(likeSets[0]!) : [];
    for (let i = 1; i < likeSets.length; i++) {
      const s = likeSets[i]!;
      inter = inter.filter(id => s.has(id));
    }
    callback(inter.map(movieId => ({ movieId, watched: watchedSet.has(movieId) })));
  };

  const unsubs = memberIds.map((uid, idx) =>
    onSnapshot(
      query(collection(db, `users/${uid}/swipes`), where('type', '==', 'like')),
      (snap) => { likeSets[idx] = new Set(snap.docs.map(d => d.id)); recompute(); },
      (err) => { console.error(`likes subscription error (member ${uid}):`, err); likeSets[idx] = new Set(); recompute(); }
    )
  );
  const unsubWatched = onSnapshot(
    collection(db, `collections/${cid}/watched`),
    (snap) => { watchedSet = new Set(snap.docs.map(d => d.id)); recompute(); },
    (err) => console.error('watched subscription error:', err)
  );

  return () => { unsubs.forEach(u => u()); unsubWatched(); };
}

/** After you like a movie, returns true if every OTHER member has already liked it (instant match). */
export async function isCollectionMatch(movieId: string, otherMemberIds: string[]): Promise<boolean> {
  if (!otherMemberIds || otherMemberIds.length === 0) return false;
  try {
    const snaps = await Promise.all(otherMemberIds.map(uid => getDoc(doc(db, `users/${uid}/swipes`, movieId))));
    return snaps.every(s => s.exists() && s.data().type === 'like');
  } catch (e) {
    console.warn('collection match check failed:', e);
    return false;
  }
}

