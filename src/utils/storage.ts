import type { JournalEntry, VaultConfig, EncryptedPayload, MoodMeta } from '../types.ts';
import { encryptText, decryptText } from './crypto.ts';

const VAULT_CONFIG_KEY = 'gemini_journal_vault_config';
const ENCRYPTED_ENTRIES_KEY = 'gemini_journal_entries_enc';
const PLAIN_ENTRIES_KEY = 'gemini_journal_entries_plain';

export const MOODS: MoodMeta[] = [
  { type: 'serene', label: 'Serene', emoji: '🌿', color: '#2E7D32', bgLight: '#E8F5E9', borderLight: '#C8E6C9' },
  { type: 'grateful', label: 'Grateful', emoji: '✨', color: '#B78103', bgLight: '#FEF9E7', borderLight: '#FCEEC7' },
  { type: 'thoughtful', label: 'Thoughtful', emoji: '🪐', color: '#455A64', bgLight: '#ECEFF1', borderLight: '#CFD8DC' },
  { type: 'joyful', label: 'Joyful', emoji: '☀️', color: '#D84315', bgLight: '#FBE9E7', borderLight: '#FFCCBC' },
  { type: 'energized', label: 'Energized', emoji: '⚡', color: '#00838F', bgLight: '#E0F7FA', borderLight: '#B2EBF2' },
  { type: 'anxious', label: 'Anxious', emoji: '🌊', color: '#5E35B1', bgLight: '#EDE7F6', borderLight: '#D1C4E9' },
  { type: 'overwhelmed', label: 'Overwhelmed', emoji: '🌪️', color: '#C62828', bgLight: '#FFEBEE', borderLight: '#FFCDD2' },
  { type: 'tired', label: 'Rest-Seeking', emoji: '🌙', color: '#4A148C', bgLight: '#F3E5F5', borderLight: '#E1BEE7' },
];

export const INITIAL_ENTRIES: JournalEntry[] = [
  {
    id: 'entry-welcome-1',
    title: 'A Sanctuary for Unfiltered Thought',
    content: `Today I set up this personal vault. There is something grounding about having a secure, quiet corner where thoughts do not have to be performative, organized, or polished for anyone else.

I noticed earlier how easy it is to carry subtle anxieties throughout the day—unanswered messages, small deadlines, and comparing my timeline with others. When I actually sit down with a cup of tea and exhale, I realize most of what felt urgent wasn't truly important.

Looking ahead to this week:
- Honor my morning boundary before opening notifications.
- Take a 15-minute walk outside around midday without headphones.
- Notice when I am rushing and intentionally slow my breath.`,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    mood: 'serene',
    tags: ['Mindfulness', 'Intention', 'Boundaries'],
    isFavorite: true,
    wordCount: 114,
    reflection: {
      reflectionText: 'There is deep wisdom in recognizing the subtle tension between performative living and authentic stillness. By acknowledging your morning boundaries and scheduling headphone-free walks, you are actively choosing presence over reactivity.',
      followUpQuestions: [
        'When you feel that urge to rush during the day, what physical cue does your body give you first?',
        'What would it feel like to allow one "urgent" task to wait without apologizing for it?'
      ],
      cognitiveInsight: 'Notice how separating urgent noise from meaningful importance instantly expands your mental space.',
      detectedThemes: ['Presence', 'Digital Boundaries', 'Grounding'],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      mode: 'deep-reflection',
    },
  },
  {
    id: 'entry-welcome-2',
    title: 'Finding Ease in the Unfinished',
    content: `Spent most of the afternoon working through a creative problem that didn't have an obvious answer. In the past, this ambiguity would have triggered frustration—I used to feel like an unproductive day meant a personal failure.

Today, I paused and reframed it: the exploration itself is the work. Ideas need time to steep, like loose-leaf tea. For dinner, made roasted vegetables with rosemary, olive oil, and sea salt. The smell filled the apartment with warmth.

Grateful for patience, good nourishment, and the quiet evening light.`,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    mood: 'grateful',
    tags: ['CreativeProcess', 'Gratitude', 'Cooking'],
    isFavorite: false,
    wordCount: 97,
    reflection: {
      reflectionText: 'Reframing ambiguity as "steeping time" is a profound shift from outcome-attachment to reverence for the process. Grounding yourself through the sensory act of cooking roasted vegetables beautifully anchored your mind back into the present.',
      followUpQuestions: [
        'How can you bring this same patient "steeping" mindset to other areas where you feel impatient?',
      ],
      cognitiveInsight: 'Creativity is not purely output; incubation in silence is an indispensable half of the cycle.',
      detectedThemes: ['Patience', 'Reframing', 'Sensory Gratitude'],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      mode: 'cognitive-reframe',
    },
  },
];

/**
 * Load vault security configuration
 */
export function getVaultConfig(): VaultConfig {
  try {
    const raw = localStorage.getItem(VAULT_CONFIG_KEY);
    if (!raw) {
      return {
        isConfigured: false,
        autoLockMinutes: 5,
        useEncryption: false,
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      isConfigured: false,
      autoLockMinutes: 5,
      useEncryption: false,
    };
  }
}

/**
 * Save vault configuration
 */
export function saveVaultConfig(config: VaultConfig): void {
  localStorage.setItem(VAULT_CONFIG_KEY, JSON.stringify(config));
}

/**
 * Load entries from storage
 */
export async function loadEntries(passcode?: string): Promise<JournalEntry[]> {
  const config = getVaultConfig();

  if (config.useEncryption && config.isConfigured) {
    const encRaw = localStorage.getItem(ENCRYPTED_ENTRIES_KEY);
    if (!encRaw) {
      return [];
    }
    if (!passcode) {
      throw new Error('Vault is locked. Passcode required to decrypt entries.');
    }
    const payload: EncryptedPayload = JSON.parse(encRaw);
    const json = await decryptText(payload, passcode);
    return JSON.parse(json);
  }

  // Plaintext mode
  const plainRaw = localStorage.getItem(PLAIN_ENTRIES_KEY);
  if (!plainRaw) {
    // Seed with initial entries if first time
    localStorage.setItem(PLAIN_ENTRIES_KEY, JSON.stringify(INITIAL_ENTRIES));
    return INITIAL_ENTRIES;
  }
  try {
    return JSON.parse(plainRaw);
  } catch {
    return [];
  }
}

/**
 * Save entries to storage (encrypts if vault encryption enabled)
 */
export async function saveEntries(entries: JournalEntry[], passcode?: string): Promise<void> {
  const config = getVaultConfig();
  const json = JSON.stringify(entries);

  if (config.useEncryption && config.isConfigured) {
    if (!passcode) {
      throw new Error('Passcode required to save encrypted entries.');
    }
    const encrypted = await encryptText(json, passcode);
    localStorage.setItem(ENCRYPTED_ENTRIES_KEY, JSON.stringify(encrypted));
  } else {
    localStorage.setItem(PLAIN_ENTRIES_KEY, json);
  }
}

/**
 * Calculate journaling streak in days
 */
export function calculateStreak(entries: JournalEntry[]): number {
  if (entries.length === 0) return 0;

  const dates = Array.from(
    new Set(
      entries.map((e) => {
        const d = new Date(e.createdAt);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    )
  ).sort().reverse();

  if (dates.length === 0) return 0;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

  let streak = 0;
  let checkDate = new Date();

  // If haven't written today, check if wrote yesterday
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    return 0;
  }

  if (dates[0] === todayStr) {
    checkDate = new Date(today);
  } else {
    checkDate = new Date(yesterday);
  }

  for (let i = 0; i < dates.length; i++) {
    const expectedStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (dates.includes(expectedStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Identify test or placeholder entries (e.g., 'Aweome', 'narayana', 'Title'/'hiii')
 */
export function isTestOrPlaceholderEntry(entry: JournalEntry): boolean {
  if (!entry) return true;
  const title = (entry.title || '').trim().toLowerCase();
  const rawContent = (entry.content || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
    .toLowerCase();

  const testPhrases = ['aweome', 'narayana', 'hiii', 'test', 'asdf', 'dummy', 'testing'];

  if (testPhrases.includes(title)) return true;
  if (testPhrases.includes(rawContent)) return true;

  // Combination of placeholder 'Title' and near-empty content like 'hiii'
  if (title === 'title' && (rawContent.length < 5 || testPhrases.includes(rawContent))) {
    return true;
  }

  // Fragment entries with no title, no reflection, and virtually zero characters
  if (!entry.reflection && rawContent.length < 4 && title.length < 4) {
    return true;
  }

  return false;
}

/**
 * Deduplicate entries by ID and by content fingerprint (e.g. preventing duplicate 'Happy mood' writes)
 * and filter out invalid/placeholder test data for clean production viewing.
 */
export function deduplicateAndSanitizeEntries(entries: JournalEntry[]): JournalEntry[] {
  if (!Array.isArray(entries)) return [];

  const seenIds = new Set<string>();
  const seenFingerprints = new Set<string>();
  const cleanList: JournalEntry[] = [];

  for (const entry of entries) {
    if (!entry || !entry.id) continue;

    // Filter out test/junk entries like 'Aweome', 'narayana', 'Title'/'hiii'
    if (isTestOrPlaceholderEntry(entry)) {
      continue;
    }

    // Deduplicate by entry ID
    if (seenIds.has(entry.id)) {
      continue;
    }

    // Deduplicate identical title + body content fingerprints (resolves duplicate writes on auth sync)
    const normalizedTitle = (entry.title || '').trim().toLowerCase();
    const cleanBody = (entry.content || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    const fingerprint = `${normalizedTitle}::${cleanBody}`;

    if (fingerprint.length > 5 && seenFingerprints.has(fingerprint)) {
      continue;
    }

    seenIds.add(entry.id);
    if (fingerprint.length > 5) {
      seenFingerprints.add(fingerprint);
    }
    cleanList.push(entry);
  }

  return cleanList;
}

