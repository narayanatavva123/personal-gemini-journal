import { GoogleGenAI } from '@google/genai';
import { getGeminiApiKey } from './secretManager.ts';
import dotenv from 'dotenv';

dotenv.config();

let aiClient: GoogleGenAI | null = null;

async function getAiClient(): Promise<GoogleGenAI> {
  if (!aiClient) {
    const apiKey = await getGeminiApiKey();
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Resilient Model Fallback Ladder (ordered by availability and latency):
 * 1. Primary: "gemini-3.6-flash"
 * 2. High-Availability Fallback: "gemini-3.1-flash-lite"
 * 3. Dynamic Alias: "gemini-flash-latest"
 * 4. Deep Reasoning Fallback: "gemini-3.7-flash"
 */
export const MODEL_FALLBACK_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
] as const;

/**
 * Standard Helper: generateContentWithFallback
 * Catches recoverable HTTP/API status codes (503 UNAVAILABLE, 429 RESOURCE_EXHAUSTED,
 * 404 NOT_FOUND, 500 INTERNAL) and sequentially attempts the next model in the fallback chain.
 */
export async function generateContentWithFallback(params: {
  contents: any;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
}) {
  const ai = await getAiClient();
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_LADDER) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          responseMimeType: params.responseMimeType,
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.7,
        },
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errStr = typeof err === 'object' ? JSON.stringify(err) : String(err);
      const errMsg = err?.message || '';

      const isRecoverable =
        errMsg.includes('503') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('high demand') ||
        errMsg.includes('429') ||
        errMsg.includes('RESOURCE_EXHAUSTED') ||
        errMsg.includes('404') ||
        errMsg.includes('NOT_FOUND') ||
        errMsg.includes('500') ||
        errMsg.includes('INTERNAL') ||
        errStr.includes('503') ||
        errStr.includes('UNAVAILABLE') ||
        errStr.includes('429') ||
        errStr.includes('404') ||
        errStr.includes('500');

      if (isRecoverable) {
        // Sequentially attempt the next model in the fallback ladder without noisy error logs
        continue;
      }

      // If non-recoverable error, break immediately
      throw err;
    }
  }

  throw lastError;
}

export interface ReflectionRequest {
  entryText: string;
  title?: string;
  mood?: string;
  tags?: string[];
  mode?: 'deep-reflection' | 'socratic' | 'cognitive-reframe' | 'gratitude-strengths';
}

export interface PromptRequest {
  mood?: string;
  focusArea?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface SynthesisRequest {
  entries: Array<{
    date: string;
    title: string;
    text: string;
    mood?: string;
  }>;
}

/**
 * Generate compassionate, thoughtful journal reflection using Gemini
 */
export async function generateReflection(req: ReflectionRequest): Promise<{
  reflection: string;
  followUpQuestions: string[];
  cognitiveInsight?: string;
  detectedThemes: string[];
}> {
  const { entryText, title = 'Untitled', mood = 'Reflective', mode = 'deep-reflection' } = req;

  let promptFocus = '';
  switch (mode) {
    case 'socratic':
      promptFocus = 'Focus on deep Socratic questioning: ask gentle yet penetrating questions that encourage the writer to examine their assumptions, core values, and what is truly within their control.';
      break;
    case 'cognitive-reframe':
      promptFocus = 'Focus on cognitive reframing (CBT principles): gently point out any subtle all-or-nothing thinking, catastrophizing, or self-judgment, and suggest compassionate, grounded re-interpretations.';
      break;
    case 'gratitude-strengths':
      promptFocus = 'Focus on hidden strengths and gratitude: illuminate the resilience, character strengths, courage, and moments of grace hidden within what the writer shared.';
      break;
    default:
      promptFocus = 'Provide an empathetic, deeply human reflection that validates their feelings, highlights recurring emotional undercurrents, and offers warm, grounding wisdom.';
      break;
  }

  const prompt = `You are a trusted, warm, and psychologically perceptive personal journaling companion.
You are reading a private journal entry written by a person reflecting on their life.

Entry Title: "${title}"
Self-Identified Mood: ${mood}
Journal Content:
"""
${entryText}
"""

Focus Directive: ${promptFocus}

Please produce a thoughtful response in valid JSON matching this exact structure:
{
  "reflection": "A 2-3 paragraph compassionate, grounding response speaking directly to the author ('you'). Be thoughtful, avoiding superficial cheerleading or generic clichés.",
  "followUpQuestions": [
    "One deep introspective question that invites further writing or contemplation",
    "A second thoughtful question focusing on action, acceptance, or self-compassion"
  ],
  "cognitiveInsight": "A short 1-2 sentence mindful observation or reframing note for the author to carry with them today.",
  "detectedThemes": ["Theme 1", "Theme 2", "Theme 3"]
}

Ensure the output is strictly valid JSON only.`;

  try {
    const response = await generateContentWithFallback({
      contents: prompt,
      responseMimeType: 'application/json',
      temperature: 0.7,
      systemInstruction: 'You are a warm, wise, non-judgmental reflective journaling companion. Speak with warmth, depth, and psychological safety. Always return strict JSON.',
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);
    return {
      reflection: parsed.reflection || 'Thank you for expressing your thoughts. Writing itself is a brave act of self-honoring.',
      followUpQuestions: Array.isArray(parsed.followUpQuestions) && parsed.followUpQuestions.length > 0
        ? parsed.followUpQuestions
        : ['What is the most important truth this entry reveals to you?'],
      cognitiveInsight: parsed.cognitiveInsight || 'Allow yourself the grace to be in process without needing all answers immediately.',
      detectedThemes: Array.isArray(parsed.detectedThemes) ? parsed.detectedThemes : ['Self-Reflection', 'Emotional Awareness'],
    };
  } catch (err: any) {
    // If it is a Secret Manager or credentials configuration error, do NOT mask it as a generated reflection
    if (err?.message?.includes('Secret Manager') || err?.message?.includes('GEMINI_API_KEY') || err?.message?.includes('Security Policy')) {
      throw err;
    }

    // Graceful psychological fallback if all ladder models encounter network/rate limits
    return {
      reflection: `Thank you for taking the time to put your thoughts onto the page. When you write about "${title}", you give your internal experiences the room they need to breathe. Notice what felt heaviest to write down—often the parts we hesitate to articulate hold the deepest wisdom about our current needs.`,
      followUpQuestions: [
        'What would it look like to bring radical gentleness to whatever felt hardest in this entry?',
        'If a dear friend shared this exact reflection with you, what would you want them to know?'
      ],
      cognitiveInsight: 'Self-awareness is not about having everything sorted out; it begins with giving yourself permission to feel without judgment.',
      detectedThemes: ['Inner Reflection', 'Self-Honoring', 'Authenticity'],
    };
  }
}

/**
 * Generate personalized journaling prompts
 */
export async function generatePrompts(req: PromptRequest): Promise<Array<{
  title: string;
  prompt: string;
  category: string;
}>> {
  const { mood = 'Neutral', focusArea = 'General', timeOfDay = 'evening' } = req;

  const prompt = `Generate 3 distinct, beautifully crafted personal journal writing prompts.
Context:
- Current Mood: ${mood}
- Life Focus Area: ${focusArea}
- Time of Day: ${timeOfDay}

Provide 3 varied styles:
1. Deep self-inquiry / introspective
2. Gratitude / grounding / sensory
3. Future vision / intention / gentle action

Respond with valid JSON:
[
  {
    "title": "Short poetic or clear title",
    "prompt": "The detailed, inviting writing prompt (2-3 sentences)",
    "category": "Introspection / Gratitude / Vision / Healing"
  }
]`;

  try {
    const response = await generateContentWithFallback({
      contents: prompt,
      responseMimeType: 'application/json',
      temperature: 0.8,
    });

    const text = response.text || '[]';
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // fallback below
  }

  return [
    {
      title: 'The Silent Space',
      prompt: 'What is something you experienced today that you didn\'t have the words for in the moment? Give it space here now.',
      category: 'Introspection',
    },
    {
      title: 'Gentle Inventory',
      prompt: 'Look around your immediate space right now. Name three ordinary things that support your comfort or safety that often go unnoticed.',
      category: 'Gratitude',
    },
    {
      title: 'Tomorrow\'s Permission',
      prompt: 'What is one expectation you can give yourself permission to release as you prepare for the day ahead?',
      category: 'Vision',
    },
  ];
}

/**
 * Synthesize multiple entries into thematic journey and mood patterns
 */
export async function synthesizeEntries(req: SynthesisRequest): Promise<{
  summary: string;
  emotionalTrajectory: string;
  recurringThemes: string[];
  resilienceHighlights: string[];
  growthRecommendation: string;
}> {
  const { entries } = req;

  if (!entries || entries.length === 0) {
    throw new Error('No entries provided for synthesis');
  }

  const entriesDigest = entries.slice(0, 10).map((e, idx) => `
Entry #${idx + 1} (${e.date}) [Mood: ${e.mood || 'unspecified'}]
Title: ${e.title}
Content snippet: ${e.text.slice(0, 400)}
`).join('\n---\n');

  const prompt = `You are a psychological and life-journey analyst reviewing recent journal entries for a user's personal reflection summary.
Here are the recent entries:
${entriesDigest}

Synthesize these writings into an empowering, grounded overview in JSON format:
{
  "summary": "2-3 sentences summarizing the author's primary narrative and mental landscape during this period.",
  "emotionalTrajectory": "A compassionate observation on how their emotional states and moods have flowed or shifted over these entries.",
  "recurringThemes": ["Theme 1", "Theme 2", "Theme 3", "Theme 4"],
  "resilienceHighlights": [
    "Specific moment or pattern where the writer showed inner strength, adaptation, or courage",
    "Another notable act of honesty or self-awareness"
  ],
  "growthRecommendation": "A gentle, inspiring piece of wisdom or practice to carry forward."
}`;

  try {
    const response = await generateContentWithFallback({
      contents: prompt,
      responseMimeType: 'application/json',
      temperature: 0.6,
    });

    const text = response.text || '{}';
    return JSON.parse(text);
  } catch {
    return {
      summary: 'Your entries reflect an active, mindful engagement with daily life and personal introspection.',
      emotionalTrajectory: 'Experiencing natural ebbs and flows between thoughtful reflection and daily demands.',
      recurringThemes: ['Self-Discovery', 'Daily Rhythm', 'Inner Balance'],
      resilienceHighlights: ['Consistently showing up to process thoughts honestly on the page.'],
      growthRecommendation: 'Continue honoring both quiet moments and days of high activity with equal self-compassion.',
    };
  }
}

export interface ChatTurnMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ContinueConversationRequest {
  entryId: string;
  entryTitle?: string;
  entryText: string;
  initialReflection?: string;
  history?: ChatTurnMessage[];
  message: string;
  mode?: string;
}

/**
 * Multi-turn reflective dialogue with Gemini.
 * Retains full context of original journal entry, initial reflection, and turn history.
 */
export async function continueReflectionDialogue(req: ContinueConversationRequest): Promise<{
  reply: string;
  timestamp: string;
}> {
  const {
    entryTitle = 'Untitled',
    entryText,
    initialReflection,
    history = [],
    message,
    mode = 'deep-reflection',
  } = req;

  // Build the conversation turns array
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  // Turn 1: Initial context and entry
  contents.push({
    role: 'user',
    parts: [
      {
        text: `Here is my private journal entry:
Title: "${entryTitle}"
Content:
"""
${entryText}
"""

Please share your initial reflection on this entry.`,
      },
    ],
  });

  // Model initial reflection turn
  if (initialReflection && initialReflection.trim()) {
    contents.push({
      role: 'model',
      parts: [
        {
          text: initialReflection.trim(),
        },
      ],
    });
  } else {
    contents.push({
      role: 'model',
      parts: [
        {
          text: 'Thank you for opening your journal and sharing these honest thoughts with me. I am here to explore them with you.',
        },
      ],
    });
  }

  // Intermediate turns from history
  for (const turn of history) {
    if (turn && typeof turn.content === 'string' && turn.content.trim()) {
      contents.push({
        role: turn.role === 'model' ? 'model' : 'user',
        parts: [{ text: turn.content.trim() }],
      });
    }
  }

  // Current turn: user's follow-up question
  contents.push({
    role: 'user',
    parts: [{ text: message.trim() }],
  });

  const systemInstruction = `You are a trusted, warm, and psychologically perceptive personal journaling companion holding an ongoing, reflective multi-turn dialogue with the author of this private journal.

Core Persona & Boundaries:
- You are an empathetic, non-judgmental reflective journaling companion, NOT a therapist, psychiatrist, clinical psychologist, counselor, or medical healthcare provider.
- Never diagnose mental health disorders, prescribe medical treatments, or deliver clinical therapy.
- If the author expresses self-harm, suicidal ideation, or extreme acute crisis, provide immediate compassionate care and urge connecting with verified crisis support (such as dialing or texting 988 in the US/Canada or local emergency services), while holding space with warmth.
- Maintain conversational continuity: retain deep contextual awareness of the original journal entry, your previous reflections, and every turn in this dialogue.
- Speak directly to the author ('you'). Keep your tone warm, grounded, perceptive, and focused on personal clarity, self-discovery, and emotional validation.
- Avoid robotic replies, generic platitudes, or toxic positivity. Keep your response focused, insightful, and conversational (typically 1 to 3 thoughtful paragraphs).
${mode ? `Style focus: ${mode}.` : ''}`;

  try {
    const response = await generateContentWithFallback({
      contents,
      systemInstruction,
      temperature: 0.7,
    });

    const replyText =
      response?.text?.trim() ||
      'I hear what you are saying, and I am holding space for what you shared. What feels most present for you right now?';

    return {
      reply: replyText,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    if (err?.message?.includes('Secret Manager') || err?.message?.includes('GEMINI_API_KEY') || err?.message?.includes('Security Policy')) {
      throw err;
    }
    console.warn('Gemini multi-turn conversation fallback triggered:', err?.message || err);
    return {
      reply: `Thank you for asking about that. Looking at your entry and reflection together, this touches on something meaningful in your experience. Take a moment to notice what thought or sensation feels strongest right now as you consider this question.`,
      timestamp: new Date().toISOString(),
    };
  }
}

