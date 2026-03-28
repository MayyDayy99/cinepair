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

export async function getMovies(): Promise<Movie[]> {
  const path = 'movies';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const movies = querySnapshot.docs.map(doc => doc.data() as Movie);
    // If no movies in Firestore, seed with MOCK_MOVIES
    if (movies.length === 0) {
      await seedMovies();
      return MOCK_MOVIES;
    }
    return movies;
  } catch (error) {
    console.warn("Falling back to mock movies due to error:", error);
    return MOCK_MOVIES;
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
      // Check if partner also liked it
      const partnerSwipeRef = doc(db, `users/${partnerId}/swipes`, movieId);
      const partnerSwipeSnap = await getDoc(partnerSwipeRef);
      
      if (partnerSwipeSnap.exists() && partnerSwipeSnap.data().type === 'like') {
        // It's a match!
        const matchPath = 'matches';
        const matchRef = doc(collection(db, matchPath), `${userId}_${partnerId}_${movieId}`);
        await setDoc(matchRef, {
          movieId,
          userIds: [userId, partnerId],
          timestamp: serverTimestamp()
        });
        return true; // Match found
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
