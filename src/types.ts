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

export type ViewMode = 'list' | 'editor' | 'synthesis';
