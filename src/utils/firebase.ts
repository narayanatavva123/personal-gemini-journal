import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import type { JournalEntry } from '../types.ts';

// Sanitize payload to strip any undefined values before sending to Firestore
export function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_, value) => (value === undefined ? null : value))
  );
}

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfigData);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Check redirect result on load
getRedirectResult(auth).catch((err) => {
  if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
    console.info('Redirect auth status:', err?.code);
  }
});

// Initialize Cloud Firestore with explicit databaseId if specified
export const db: Firestore = firebaseConfigData.firestoreDatabaseId
  ? getFirestore(app, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(app);

// Test connection on boot per Firebase skill guidelines
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Verify network or Firebase configuration.');
    }
  }
}
testConnection();

/**
 * Robust Google Sign-In with popup & cancellation handling.
 * Returns User if successful, or null if the user cancelled/closed the popup.
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    const code = error?.code || '';
    // Gracefully handle standard user cancellation / popup dismissals
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      console.info('Google Sign-In was cancelled or closed by user.');
      return null;
    }
    if (code === 'auth/popup-blocked') {
      console.warn('Google Sign-In popup was blocked by browser. Attempting redirect or open in new tab.');
      throw new Error('Sign-in popup was blocked. Please enable popups or open this app in a new tab.');
    }
    console.error('Firebase Google Sign-In error:', error);
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Firebase Sign-Out error:', error);
    throw error;
  }
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Owner-bound Firestore Persistence:
 * Path: /users/{userId}/interactions/{interactionId}
 */

// Save a journal entry & Gemini reflection to Firestore
export async function saveInteractionToFirestore(
  userId: string,
  entry: JournalEntry
): Promise<void> {
  if (!userId) {
    throw new Error('Cannot save to Firestore: No authenticated user ID.');
  }

  const interactionRef = doc(db, 'users', userId, 'interactions', entry.id);

  const payload = sanitizeForFirestore({
    id: entry.id,
    userId,
    type: 'journal_entry',
    title: entry.title || 'Untitled Reflection',
    content: entry.content || '',
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString(),
    mood: entry.mood || 'thoughtful',
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    isFavorite: Boolean(entry.isFavorite),
    wordCount: entry.wordCount || 0,
    reflection: entry.reflection
      ? {
          reflectionText: entry.reflection.reflectionText || '',
          followUpQuestions: Array.isArray(entry.reflection.followUpQuestions)
            ? entry.reflection.followUpQuestions
            : [],
          cognitiveInsight: entry.reflection.cognitiveInsight || null,
          detectedThemes: Array.isArray(entry.reflection.detectedThemes)
            ? entry.reflection.detectedThemes
            : [],
          createdAt: entry.reflection.createdAt || new Date().toISOString(),
          mode: entry.reflection.mode || 'deep-reflection',
        }
      : null,
    savedAt: new Date().toISOString(),
  });

  await setDoc(interactionRef, payload, { merge: true });
}

// Fetch all owner-bound interactions for authenticated user
export async function fetchUserInteractions(userId: string): Promise<JournalEntry[]> {
  if (!userId) return [];

  const interactionsRef = collection(db, 'users', userId, 'interactions');
  const q = query(interactionsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  const entries: JournalEntry[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    entries.push({
      id: data.id || docSnap.id,
      title: data.title || 'Untitled Reflection',
      content: data.content || '',
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
      mood: data.mood || 'thoughtful',
      tags: Array.isArray(data.tags) ? data.tags : [],
      isFavorite: Boolean(data.isFavorite),
      wordCount: data.wordCount || 0,
      reflection: data.reflection
        ? {
            reflectionText: data.reflection.reflectionText || '',
            followUpQuestions: Array.isArray(data.reflection.followUpQuestions)
              ? data.reflection.followUpQuestions
              : [],
            cognitiveInsight: data.reflection.cognitiveInsight || undefined,
            detectedThemes: Array.isArray(data.reflection.detectedThemes)
              ? data.reflection.detectedThemes
              : [],
            createdAt: data.reflection.createdAt || new Date().toISOString(),
            mode: data.reflection.mode || 'deep-reflection',
          }
        : undefined,
    });
  });

  return entries;
}

// Delete an interaction from Firestore
export async function deleteInteractionFromFirestore(
  userId: string,
  entryId: string
): Promise<void> {
  if (!userId || !entryId) return;
  const docRef = doc(db, 'users', userId, 'interactions', entryId);
  await deleteDoc(docRef);
}
