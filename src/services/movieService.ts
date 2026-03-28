import { collection, doc, setDoc, getDoc, query, where, onSnapshot, serverTimestamp, getDocs } from 'firebase/firestore';
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
    synopsis: 'In a decaying metropolis, a memory thief uncovers a conspiracy that could rewrite the history of human consciousness.',
    genres: ['Sci-Fi', 'Thriller'],
    duration: '2h 10m'
  },
  {
    id: '2',
    title: 'THE LAST SILENCE',
    year: '2023',
    rating: 7.9,
    posterUrl: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?q=80&w=1170&auto=format&fit=crop',
    synopsis: 'A deaf hunter in a post-apocalyptic world must protect her village from creatures that hunt by sound.',
    genres: ['Horror', 'Drama'],
    duration: '1h 45m'
  },
  {
    id: '3',
    title: 'COSMIC REACH',
    year: '2024',
    rating: 8.1,
    posterUrl: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=1172&auto=format&fit=crop',
    synopsis: 'The first manned mission to Proxima Centauri discovers that they are not the first humans to leave Earth.',
    genres: ['Sci-Fi', 'Adventure'],
    duration: '2h 30m'
  }
];

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

export interface MovieFetchOptions {
  page?: number;
  year?: string;
}

export async function getMovies(options: MovieFetchOptions = {}): Promise<Movie[]> {
  const { page = 1, year } = options;

  if (!TMDB_API_KEY) {
    console.error("TMDB API Key missing!");
    return MOCK_MOVIES;
  }

  try {
    let url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=hu-HU&sort_by=popularity.desc&page=${page}&vote_count.gte=100`;
    
    if (year) {
      url += `&primary_release_year=${year}`;
    }

    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.results) return [];

    const movies: Movie[] = data.results.map((m: any) => ({
      id: m.id.toString(),
      title: m.title.toUpperCase(),
      year: m.release_date ? m.release_date.split('-')[0] : 'N/A',
      rating: Math.round(m.vote_average * 10) / 10,
      posterUrl: m.poster_path ? `${TMDB_IMAGE_BASE}${m.poster_path}` : 'https://images.unsplash.com/photo-1542204172-3f19114d5049?q=80&w=1035&auto=format&fit=crop',
      synopsis: m.overview || 'Nincs elérhető leírás.',
      genres: ['Film', 'TMDB'],
      duration: 'N/A'
    }));

    return movies;
  } catch (error) {
    console.error("TMDB Fetch Error:", error);
    return [];
  }
}

export async function getMovieById(movieId: string): Promise<Movie | null> {
  if (!TMDB_API_KEY) return null;
  try {
    const response = await fetch(`${TMDB_BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=hu-HU`);
    const m = await response.json();
    if (!m.id) return null;
    return {
      id: m.id.toString(),
      title: m.title.toUpperCase(),
      year: m.release_date ? m.release_date.split('-')[0] : 'N/A',
      rating: Math.round(m.vote_average * 10) / 10,
      posterUrl: m.poster_path ? `${TMDB_IMAGE_BASE}${m.poster_path}` : 'https://images.unsplash.com/photo-1542204172-3f19114d5049?q=80&w=1035&auto=format&fit=crop',
      synopsis: m.overview || 'Nincs elérhető leírás.',
      genres: m.genres ? m.genres.map((g: any) => g.name) : ['Film'],
      duration: m.runtime ? `${Math.floor(m.runtime/60)}h ${m.runtime%60}m` : 'N/A'
    };
  } catch(e) {
    return null;
  }
}

export async function swipeMovie(userId: string, movieId: string, type: 'like' | 'dislike', partnerId?: string) {
  const path = `users/${userId}/swipes`;
  try {
    const swipeRef = doc(collection(db, path), movieId);
    await setDoc(swipeRef, {
      userId,
      movieId,
      type,
      timestamp: serverTimestamp()
    });

    if (type === 'like' && partnerId) {
      const partnerSwipeRef = doc(db, `users/${partnerId}/swipes`, movieId);
      const partnerSwipeSnap = await getDoc(partnerSwipeRef);
      
      if (partnerSwipeSnap.exists() && partnerSwipeSnap.data().type === 'like') {
        const matchPath = 'matches';
        const matchRef = doc(collection(db, matchPath), `${userId}_${partnerId}_${movieId}`);
        await setDoc(matchRef, {
          movieId,
          userIds: [userId, partnerId],
          timestamp: serverTimestamp()
        });
        return true;
      }
    }
    return false;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToMatches(userId: string, callback: (matches: any[]) => void) {
  const path = 'matches';
  const q = query(collection(db, path), where('userIds', 'array-contains', userId));
  
  return onSnapshot(q, (snapshot) => {
    const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(matches);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
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


export async function seedMovies() {
  const path = 'movies';
  try {
    for (const movie of MOCK_MOVIES) {
      await setDoc(doc(db, path, movie.id), movie);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
