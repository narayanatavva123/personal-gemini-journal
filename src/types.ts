export type MoodType =
  | 'serene'
  | 'joyful'
  | 'grateful'
  | 'thoughtful'
  | 'overwhelmed'
  | 'anxious'
  | 'energized'
  | 'tired';

export interface MoodMeta {
  type: MoodType;
  label: string;
  emoji: string;
  color: string;
  bgLight: string;
  borderLight: string;
}

export interface AiReflection {
  reflectionText: string;
  followUpQuestions: string[];
  cognitiveInsight?: string;
  detectedThemes: string[];
  createdAt: string;
  mode: 'deep-reflection' | 'socratic' | 'cognitive-reframe' | 'gratitude-strengths';
}

export interface EntryLocation {
  latitude: number;
  longitude: number;
  name?: string;
  formattedAddress?: string;
  accuracy?: number;
  capturedAt: string;
  source?: 'google-maps-geocoding' | 'coordinates-fallback';
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  mood: MoodType;
  tags: string[];
  isFavorite: boolean;
  wordCount: number;
  reflection?: AiReflection;
  location?: EntryLocation;
}

export interface EncryptedPayload {
  version: 1;
  salt: string; // base64
  iv: string;   // base64
  ciphertext: string; // base64
}

export interface VaultConfig {
  isConfigured: boolean;
  verification?: EncryptedPayload;
  autoLockMinutes: number;
  useEncryption: boolean;
}

export type ViewMode = 'list' | 'editor' | 'synthesis' | 'admin';

export interface UserNotificationSettings {
  notificationEmail: string;
  emailNotificationsEnabled: boolean;
  reflectionReady: boolean;
  writingStreak: boolean;
  weeklySynthesis: boolean;
  inactivityNudge: boolean;
  inactivityDays?: number;
  updatedAt?: string;

  // Backwards compatibility aliases
  enabled?: boolean;
  email?: string;
  weeklySummary?: boolean;
  streakMilestone?: boolean;
  inactivityReminder?: boolean;
}

export interface AdminAggregateStats {
  totalUsers: number;
  totalEntries: number;
  totalReflections: number;
  totalSavedPlaces: number;
  totalWordsWritten: number;
  systemActivity: Array<{
    id: string;
    eventType: string;
    timestamp: string;
    details: string;
  }>;
  securityAudit: {
    serverSideGemini: boolean;
    clientKeyExposed: boolean;
    secretManagerIntegrated: boolean;
    rbacActive: boolean;
    emailNotificationsConfigured: boolean;
    emailProvider: string;
    lastAuditTimestamp: string;
  };
}

export interface UserAuthProfile {
  authenticated: boolean;
  uid: string;
  email?: string;
  isAdmin: boolean;
  role: 'admin' | 'user';
}
