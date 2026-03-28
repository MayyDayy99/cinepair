import { collection, doc, setDoc, getDoc, query, where, onSnapshot, serverTimestamp, addDoc, getDocs } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase';
import { GoogleGenAI, Type } from "@google/genai";

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
    posterUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5i7b2qkzK-wx_lJ8b6oJrBfj5EKGy4Lu7VgJvp4D-7l8L_Sv6q2ioMBSAm8oBJCLoRgFrEZRwYTwTnf4MMw23WqZJUC4x6A56Y0S8S9ulpT4l4lSBi18YLdcpl7_UTXoHPgfTCO3gXMaEZ6JZ0d01UZQq6wiH8rjokebGjcCunW9j-o6fX8XdUw5yVxqccDhbqyhGflh5m7oFRwTtNTDjSMOhkhBZa4bBndwLwAa8TzV2AJki2xLl29iew5ld6I6UfqZ4_MQwzpU',
    synopsis: 'In a decaying metropolis, a memory thief uncovers a conspiracy that could rewrite the history of human consciousness.',
    genres: ['Sci-Fi', 'Thriller'],
    duration: '2h 10m'
  }
];

export async function fetchMoviesFromGemini(): Promise<Movie[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "List 15 currently popular movies (2024-2026 releases). For each movie, provide: title, year, IMDb rating (number), a REAL high-quality poster URL from IMDb or a reliable movie database (DO NOT use placeholders like picsum.photos), a 2-sentence synopsis, 2-3 genres, and duration (e.g. 2h 15m). Return as a JSON array. Ensure the poster URLs are direct image links that work.",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              year: { type: Type.STRING },
              rating: { type: Type.NUMBER },
              posterUrl: { type: Type.STRING },
              synopsis: { type: Type.STRING },
              genres: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              duration: { type: Type.STRING }
            },
            required: ["id", "title", "year", "rating", "posterUrl", "synopsis", "genres", "duration"]
          }
        }
      }
    });

    const movies = JSON.parse(response.text);
    
    // Save movies to Firestore so they are available for both users
    for (const movie of movies) {
      await setDoc(doc(db, 'movies', movie.id), movie, { merge: true });
    }
    
    return movies;
  } catch (error) {
    console.error("Error fetching movies from Gemini:", error);
    return MOCK_MOVIES;
  }
}

export async function getMovies(): Promise<Movie[]> {
  const path = 'movies';
  try {
    const querySnapshot = await getDocs(collection(db, path));
    const movies = querySnapshot.docs.map(doc => doc.data() as Movie);
    return movies.length > 0 ? movies : fetchMoviesFromGemini();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
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
