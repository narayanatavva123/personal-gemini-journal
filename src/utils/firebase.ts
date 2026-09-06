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
  getDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';
import type { JournalEntry, UserNotificationSettings } from '../types.ts';

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
    location: entry.location
      ? {
          latitude: entry.location.latitude,
          longitude: entry.location.longitude,
          name: entry.location.name || null,
          formattedAddress: entry.location.formattedAddress || null,
          accuracy: typeof entry.location.accuracy === 'number' ? entry.location.accuracy : null,
          capturedAt: entry.location.capturedAt || new Date().toISOString(),
          source: entry.location.source || 'coordinates-fallback',
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
      location: data.location
        ? {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
            name: data.location.name || undefined,
            formattedAddress: data.location.formattedAddress || undefined,
            accuracy: typeof data.location.accuracy === 'number' ? data.location.accuracy : undefined,
            capturedAt: data.location.capturedAt || data.createdAt || new Date().toISOString(),
            source: data.location.source || undefined,
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

// Fetch user notification preferences directly from owner-isolated Firestore path
export async function fetchNotificationSettingsFromFirestore(
  userId: string
): Promise<UserNotificationSettings | null> {
  if (!userId) return null;
  try {
    const docRef = doc(db, 'users', userId, 'settings', 'notifications');
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }
    const data = docSnap.data();
    const notificationEmail = data.notificationEmail || data.email || '';
    const emailNotificationsEnabled =
      typeof data.emailNotificationsEnabled === 'boolean'
        ? data.emailNotificationsEnabled
        : typeof data.enabled === 'boolean'
        ? data.enabled
        : false;
    const reflectionReady = data.reflectionReady !== false;
    const writingStreak =
      typeof data.writingStreak === 'boolean'
        ? data.writingStreak
        : data.streakMilestone !== false;
    const weeklySynthesis =
      typeof data.weeklySynthesis === 'boolean'
        ? data.weeklySynthesis
        : data.weeklySummary !== false;
    const inactivityNudge =
      typeof data.inactivityNudge === 'boolean'
        ? data.inactivityNudge
        : Boolean(data.inactivityReminder);
    const inactivityDays =
      typeof data.inactivityDays === 'number' && data.inactivityDays > 0
        ? data.inactivityDays
        : 3;

    return {
      notificationEmail,
      emailNotificationsEnabled,
      reflectionReady,
      writingStreak,
      weeklySynthesis,
      inactivityNudge,
      inactivityDays,
      updatedAt: data.updatedAt || new Date().toISOString(),
      // Legacy compatibility aliases
      email: notificationEmail,
      enabled: emailNotificationsEnabled,
      streakMilestone: writingStreak,
      weeklySummary: weeklySynthesis,
      inactivityReminder: inactivityNudge,
    };
  } catch (error) {
    console.warn('Could not read user notification settings from Firestore:', error);
    return null;
  }
}

// Persist user notification preferences permanently to Firestore (/users/{userId}/settings/notifications)
export async function saveNotificationSettingsToFirestore(
  userId: string,
  settings: Partial<UserNotificationSettings>
): Promise<UserNotificationSettings> {
  if (!userId) {
    throw new Error('Cannot save notification preferences: Unauthenticated user.');
  }

  const docRef = doc(db, 'users', userId, 'settings', 'notifications');
  const now = new Date().toISOString();

  const notificationEmail = (settings.notificationEmail ?? settings.email ?? '').trim();
  const emailNotificationsEnabled =
    typeof settings.emailNotificationsEnabled === 'boolean'
      ? settings.emailNotificationsEnabled
      : typeof settings.enabled === 'boolean'
      ? settings.enabled
      : false;
  const reflectionReady = settings.reflectionReady !== false;
  const writingStreak =
    typeof settings.writingStreak === 'boolean'
      ? settings.writingStreak
      : settings.streakMilestone !== false;
  const weeklySynthesis =
    typeof settings.weeklySynthesis === 'boolean'
      ? settings.weeklySynthesis
      : settings.weeklySummary !== false;
  const inactivityNudge =
    typeof settings.inactivityNudge === 'boolean'
      ? settings.inactivityNudge
      : Boolean(settings.inactivityReminder);
  const inactivityDays =
    typeof settings.inactivityDays === 'number' && settings.inactivityDays > 0
      ? settings.inactivityDays
      : 3;

  const payload = sanitizeForFirestore({
    notificationEmail,
    emailNotificationsEnabled,
    reflectionReady,
    writingStreak,
    weeklySynthesis,
    inactivityNudge,
    inactivityDays,
    // Store legacy aliases as well so existing readers and backend services find them
    email: notificationEmail,
    enabled: emailNotificationsEnabled,
    streakMilestone: writingStreak,
    weeklySummary: weeklySynthesis,
    inactivityReminder: inactivityNudge,
    updatedAt: now,
  });

  await setDoc(docRef, payload, { merge: true });

  return {
    notificationEmail,
    emailNotificationsEnabled,
    reflectionReady,
    writingStreak,
    weeklySynthesis,
    inactivityNudge,
    inactivityDays,
    email: notificationEmail,
    enabled: emailNotificationsEnabled,
    streakMilestone: writingStreak,
    weeklySummary: weeklySynthesis,
    inactivityReminder: inactivityNudge,
    updatedAt: now,
  };
}
