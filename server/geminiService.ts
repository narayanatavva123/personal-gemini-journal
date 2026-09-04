import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment.');
    }
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
 * Robust helper that calls Gemini with fallback if model experiences high demand spikes (503)
 */
async function callGeminiWithFallback(params: {
  contents: string;
  systemInstruction?: string;
  responseMimeType?: string;
  temperature?: number;
}) {
  const ai = getAiClient();
  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite'];

  let lastError: any = null;
  for (const model of modelsToTry) {
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
      console.warn(`Model ${model} request error:`, err?.message || err);
      // If 503 or 429, loop to fallback model
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
    const response = await callGeminiWithFallback({
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
    // Graceful fallback if both external model endpoints are temporarily saturated
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
    const response = await callGeminiWithFallback({
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
    const response = await callGeminiWithFallback({
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
