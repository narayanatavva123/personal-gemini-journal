import { useState } from 'react';
import { Sparkles, X, ArrowRight, RefreshCw, Sun, Sunset, Moon, Coffee } from 'lucide-react';
import type { MoodType } from '../types.ts';
import { MOODS } from '../utils/storage.ts';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPrompt: (title: string, promptText: string, suggestedMood: MoodType) => void;
}

interface GeneratedPrompt {
  title: string;
  prompt: string;
  category: string;
}

export function PromptModal({ isOpen, onClose, onSelectPrompt }: PromptModalProps) {
  const [selectedMood, setSelectedMood] = useState<MoodType>('thoughtful');
  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('evening');
  const [focusArea, setFocusArea] = useState('Inner Peace & Mindfulness');
  const [prompts, setPrompts] = useState<GeneratedPrompt[]>([
    {
      title: 'The Silent Space',
      prompt: 'What is something you experienced today that you did not have words for in the moment? Give it space here now.',
      category: 'Introspection',
    },
    {
      title: 'Gentle Inventory',
      prompt: 'Look around your immediate space right now. Name three ordinary things that support your comfort or safety that often go unnoticed.',
      category: 'Gratitude',
    },
    {
      title: 'Releasing What Is Not Yours',
      prompt: 'What emotional burden or expectation did you carry today that belonged to someone else? How can you lay it down tonight?',
      category: 'Boundaries',
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gemini/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mood: selectedMood,
          timeOfDay,
          focusArea,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate prompts from Gemini');
      }

      const data = await response.json();
      if (Array.isArray(data.prompts) && data.prompts.length > 0) {
        setPrompts(data.prompts);
      }
    } catch (err: any) {
      setError(err.message || 'Could not fetch prompts');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      id="prompt-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1C18]/60 backdrop-blur-xs"
    >
      <div
        id="prompt-modal-card"
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#FAF8F5] border border-[#E2DCCE] rounded-2xl p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          id="close-prompt-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-[#888175] hover:text-[#24211D] rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1F1C18]">
              Personalized Writing Prompts
            </h2>
            <p className="text-xs text-[#7A7367]">
              Tailored by Gemini to your current state of mind
            </p>
          </div>
        </div>

        {/* Customization controls */}
        <div className="space-y-3.5 mb-5 p-4 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs">
          {/* Mood selection */}
          <div>
            <label className="block text-xs font-medium text-[#4D463B] mb-1.5">
              Current Emotional Landscape:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <button
                  key={m.type}
                  id={`prompt-mood-${m.type}`}
                  type="button"
                  onClick={() => setSelectedMood(m.type)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    selectedMood === m.type
                      ? 'bg-[#24211D] text-white shadow-xs'
                      : 'bg-[#F2ECE1] text-[#5A5346] hover:bg-[#EBE4D5]'
                  }`}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Time of Day */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {[
              { key: 'morning', label: 'Morning', icon: Sun },
              { key: 'afternoon', label: 'Midday', icon: Coffee },
              { key: 'evening', label: 'Evening', icon: Sunset },
              { key: 'night', label: 'Deep Night', icon: Moon },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTimeOfDay(t.key as any)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                    timeOfDay === t.key
                      ? 'bg-[#F0EBE0] border-[#C8C0B2] text-[#1F1C18]'
                      : 'bg-white border-[#E5E0D5] text-[#7A7367] hover:bg-[#F9F7F3]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Generate Button */}
          <button
            id="generate-new-prompts-btn"
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Generating with Gemini...' : 'Generate New Prompts'}</span>
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-700 mb-3 bg-red-50 p-2.5 rounded-lg border border-red-200">
            {error}
          </p>
        )}

        {/* Prompt List */}
        <div className="space-y-3">
          {prompts.map((p, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-white border border-[#E5E0D5] hover:border-[#C8C0B2] transition-all group"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h4 className="text-sm font-semibold text-[#1F1C18]">{p.title}</h4>
                <span className="text-[10px] font-medium tracking-wide uppercase px-2 py-0.5 rounded-full bg-[#F4EFE6] text-[#7A7163]">
                  {p.category}
                </span>
              </div>
              <p className="text-xs text-[#5D564A] leading-relaxed mb-3 font-editorial text-[14px]">
                "{p.prompt}"
              </p>
              <button
                id={`use-prompt-btn-${idx}`}
                type="button"
                onClick={() => {
                  onSelectPrompt(p.title, p.prompt, selectedMood);
                  onClose();
                }}
                className="flex items-center gap-1 text-xs font-medium text-[#24211D] hover:text-[#5E5549] group-hover:translate-x-0.5 transition-transform"
              >
                <span>Write with this prompt</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
