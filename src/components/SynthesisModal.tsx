import { useState, useEffect } from 'react';
import { Sparkles, X, RefreshCw, Compass, Heart, Award, ArrowUpRight, Copy, Check } from 'lucide-react';
import type { JournalEntry } from '../types.ts';
import { stripHtml } from '../utils/richText.ts';

interface SynthesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
}

interface SynthesisResult {
  summary: string;
  emotionalTrajectory: string;
  recurringThemes: string[];
  resilienceHighlights: string[];
  growthRecommendation: string;
}

export function SynthesisModal({ isOpen, onClose, entries }: SynthesisModalProps) {
  const [data, setData] = useState<SynthesisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchSynthesis = async () => {
    if (entries.length === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/gemini/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: entries.slice(0, 10).map((e) => ({
            date: e.createdAt.split('T')[0],
            title: e.title,
            text: stripHtml(e.content),
            mood: e.mood,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate synthesis with Gemini');
      }

      const res = await response.json();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Error communicating with Gemini');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !data && entries.length > 0) {
      fetchSynthesis();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!data) return;
    const text = `Personal Gemini Journal - Weekly Synthesis\n\nSummary:\n${data.summary}\n\nEmotional Trajectory:\n${data.emotionalTrajectory}\n\nThemes:\n${data.recurringThemes.join(', ')}\n\nResilience Highlights:\n${data.resilienceHighlights.join('\n- ')}\n\nGrowth Recommendation:\n${data.growthRecommendation}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="synthesis-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1F1C18]/60 backdrop-blur-xs"
    >
      <div
        id="synthesis-modal-card"
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#FAF8F5] border border-[#E2DCCE] rounded-2xl p-6 sm:p-7 shadow-xl relative animate-in fade-in zoom-in-95 duration-150"
      >
        <button
          id="close-synthesis-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-[#888175] hover:text-[#24211D] rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#1F1C18]">
              Multi-Entry Life Journey Review
            </h2>
            <p className="text-xs text-[#7A7367]">
              Gemini analysis of your recent {entries.length} journal {entries.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#7A7367] bg-white rounded-xl border border-[#E5E0D5]">
            Write a few journal entries first to unlock thematic reviews and emotional trajectory synthesis!
          </div>
        ) : isLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-6 h-6 mx-auto animate-spin text-[#6B6355]" />
            <p className="text-sm font-medium text-[#24211D]">
              Synthesizing your journal reflections...
            </p>
            <p className="text-xs text-[#7A7367] max-w-sm mx-auto">
              Connecting themes, recognizing your emotional currents, and illuminating resilience patterns.
            </p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 space-y-2">
            <p>{error}</p>
            <button
              onClick={fetchSynthesis}
              className="underline font-medium hover:text-red-900"
            >
              Try again
            </button>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Summary Box */}
            <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#3D372F]">
                <Compass className="w-4 h-4 text-amber-700" />
                <span>Journey Overview</span>
              </div>
              <p className="text-sm font-editorial text-[15px] leading-relaxed text-[#24211D]">
                {data.summary}
              </p>
            </div>

            {/* Emotional Trajectory */}
            <div className="p-4 sm:p-5 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#3D372F]">
                <Heart className="w-4 h-4 text-rose-700" />
                <span>Emotional Currents & Rhythm</span>
              </div>
              <p className="text-xs sm:text-sm text-[#4A4339] leading-relaxed">
                {data.emotionalTrajectory}
              </p>
            </div>

            {/* Grid: Themes & Resilience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Recurring Themes */}
              <div className="p-4 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2.5">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[#3D372F]">
                  Recurring Life Themes
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {data.recurringThemes.map((theme, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#F4EFE6] text-[#554C3F] border border-[#E2DCCE]"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>

              {/* Resilience Highlights */}
              <div className="p-4 rounded-xl bg-white border border-[#E5E0D5] shadow-2xs space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#3D372F]">
                  <Award className="w-4 h-4 text-emerald-700" />
                  <span>Resilience Highlights</span>
                </div>
                <ul className="space-y-1.5 text-xs text-[#4A4339]">
                  {data.resilienceHighlights.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5 leading-snug">
                      <span className="text-emerald-600 mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Growth Recommendation */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#F4EFE6] border border-[#E0D8CA] space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#3D372F]">
                <ArrowUpRight className="w-4 h-4 text-indigo-700" />
                <span>Mindful Growth Practice</span>
              </div>
              <p className="text-xs sm:text-sm text-[#38322A] leading-relaxed italic">
                "{data.growthRecommendation}"
              </p>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                id="refresh-synthesis-btn"
                type="button"
                onClick={fetchSynthesis}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs text-[#6B6355] hover:text-[#1F1C18]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-synthesize</span>
              </button>

              <button
                id="copy-synthesis-btn"
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#24211D] hover:bg-[#3D372F] text-white transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Synthesis'}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
