import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Sparkles,
  Save,
  Star,
  Tag,
  Bold,
  Italic,
  List,
  Quote,
  Eye,
  EyeOff,
  Shield,
  Clock,
  FileText,
  HelpCircle,
  BrainCircuit,
  HeartHandshake,
  Check,
  PlusCircle,
  AlertCircle,
  RefreshCw,
  CloudCheck,
} from 'lucide-react';
import type { JournalEntry, MoodType, AiReflection } from '../types.ts';
import { MOODS } from '../utils/storage.ts';
import { redactPII } from '../utils/crypto.ts';

interface EntryEditorProps {
  entry: JournalEntry | null;
  onSave: (entry: JournalEntry) => Promise<void>;
  onBack: () => void;
}

const POPULAR_TAGS = ['Mindfulness', 'Gratitude', 'Career', 'Relationships', 'Health', 'Creativity', 'Reframing', 'Family', 'Dreams'];

export function EntryEditor({ entry, onSave, onBack }: EntryEditorProps) {
  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(entry?.content || '');
  const [mood, setMood] = useState<MoodType>(entry?.mood || 'thoughtful');
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(entry?.isFavorite || false);
  const [reflection, setReflection] = useState<AiReflection | undefined>(entry?.reflection);

  // Reflection options
  const [reflectionMode, setReflectionMode] = useState<
    'deep-reflection' | 'socratic' | 'cognitive-reframe' | 'gratitude-strengths'
  >('deep-reflection');
  const [enablePiiRedaction, setEnablePiiRedaction] = useState(true);
  const [isReflecting, setIsReflecting] = useState(false);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [redactionNotice, setRedactionNotice] = useState<string | null>(null);

  // Persistence status states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Metrics
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));

  // Handle Ctrl+S or Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [title, content, mood, tags, isFavorite, reflection]);

  const handleSave = async (overrideReflection?: AiReflection) => {
    setSaveError(null);
    setSaveSuccessNotice(null);
    setIsSaving(true);

    const now = new Date().toISOString();
    const finalEntry: JournalEntry = {
      id: entry?.id || `entry-${Date.now()}`,
      title: title.trim() || 'Untitled Reflection',
      content,
      createdAt: entry?.createdAt || now,
      updatedAt: now,
      mood,
      tags,
      isFavorite,
      wordCount: words,
      reflection: overrideReflection !== undefined ? overrideReflection : reflection,
    };

    try {
      await onSave(finalEntry);
      setSaveSuccessNotice('Entry safely persisted to your private Firestore vault.');
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err: any) {
      console.error('Save failed:', err);
      // NEVER clear the user's input buffer!
      setSaveError(err.message || 'Failed to save entry to Cloud Firestore. Your writing is preserved.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = (tagToAdd: string) => {
    const clean = tagToAdd.trim().replace(/^#/, '');
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('entry-content-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const replacement = `${prefix}${selected || 'text'}${suffix}`;

    const newContent = content.substring(0, start) + replacement + content.substring(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4));
    }, 0);
  };

  const handleReflectWithGemini = async () => {
    if (!content.trim()) {
      setReflectionError('Please write some journal content before requesting an AI reflection.');
      return;
    }

    setIsReflecting(true);
    setReflectionError(null);
    setRedactionNotice(null);

    let textToSend = content;
    if (enablePiiRedaction) {
      const { redactedText, redactionsCount } = redactPII(content);
      textToSend = redactedText;
      if (redactionsCount > 0) {
        setRedactionNotice(`Masked ${redactionsCount} personal identifier(s) (emails/numbers) for privacy.`);
      }
    }

    try {
      const response = await fetch('/api/gemini/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryText: textToSend,
          title: title.trim() || 'Journal Entry',
          mood,
          tags,
          mode: reflectionMode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to obtain reflection from Gemini');
      }

      const data = await response.json();
      const newRef: AiReflection = {
        reflectionText: data.reflection,
        followUpQuestions: data.followUpQuestions || [],
        cognitiveInsight: data.cognitiveInsight,
        detectedThemes: data.detectedThemes || [],
        createdAt: new Date().toISOString(),
        mode: reflectionMode,
      };

      setReflection(newRef);

      // Auto-save user input and Gemini reflection to Firestore immediately to guarantee persistence
      await handleSave(newRef);
    } catch (err: any) {
      setReflectionError(err.message || 'Reflection request failed');
    } finally {
      setIsReflecting(false);
    }
  };

  const appendQuestionToEntry = (question: string) => {
    const addition = `\n\n> **Reflecting on:** *${question}*\n\n`;
    setContent((prev) => prev + addition);
  };

  const currentMoodMeta = MOODS.find((m) => m.type === mood) || MOODS[0];

  return (
    <div id="entry-editor-container" className="max-w-4xl mx-auto pb-20">
      {/* Save Error Banner with Retry Save Option */}
      {saveError && (
        <div
          id="save-error-banner"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold">Persistence Alert: Save Failed</p>
              <p className="text-xs text-red-700 mt-0.5">
                {saveError} All of your writing is safe in the editor.
              </p>
            </div>
          </div>
          <button
            id="retry-save-btn"
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-red-800 hover:bg-red-900 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Retrying...' : 'Retry Save'}</span>
          </button>
        </div>
      )}

      {/* Save Success Notice */}
      {saveSuccessNotice && (
        <div
          id="save-success-banner"
          className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs shadow-2xs animate-in fade-in duration-200"
        >
          <Check className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{saveSuccessNotice}</span>
        </div>
      )}

      {/* Top Bar with Back & Save */}
      <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-[#E8E3DA]">
        <button
          id="back-to-list-btn"
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#655E53] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Entries</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Favorite Toggle */}
          <button
            id="toggle-favorite-btn"
            type="button"
            onClick={() => setIsFavorite(!isFavorite)}
            className={`p-2 rounded-lg border transition-colors ${
              isFavorite
                ? 'bg-amber-50 border-amber-300 text-amber-600'
                : 'bg-white border-[#E0D9CC] text-[#888175] hover:text-amber-600'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Star as favorite'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-500' : ''}`} />
          </button>

          {/* Save Button */}
          <button
            id="save-entry-btn"
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-lg text-xs font-medium transition-colors shadow-xs disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${isSaving ? 'animate-pulse' : ''}`} />
            <span>{isSaving ? 'Saving to Firestore...' : 'Save Entry'}</span>
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Entry Header: Mood & Date */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Mood Selector Dropdown / Chips */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#7A7367] font-medium">State of Mind:</span>
            <div className="flex flex-wrap gap-1.5">
              {MOODS.map((m) => (
                <button
                  key={m.type}
                  id={`editor-mood-${m.type}`}
                  type="button"
                  onClick={() => setMood(m.type)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    mood === m.type
                      ? 'shadow-xs text-white'
                      : 'bg-white border border-[#E5E0D5] text-[#554E43] hover:bg-[#F9F7F3]'
                  }`}
                  style={{
                    backgroundColor: mood === m.type ? m.color : undefined,
                    borderColor: mood === m.type ? m.color : undefined,
                  }}
                >
                  <span>{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Metrics */}
          <div className="flex items-center gap-3 text-xs text-[#7A7367]">
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              <span>{words} {words === 1 ? 'word' : 'words'}</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{readingTimeMin} min read</span>
            </span>
          </div>
        </div>

        {/* Title Input */}
        <div>
          <input
            id="entry-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title of this reflection..."
            className="w-full text-2xl sm:text-3xl font-editorial font-medium text-[#1F1C18] placeholder-[#9E978C] bg-transparent border-0 border-b border-transparent hover:border-[#E8E3DA] focus:border-[#24211D] focus:outline-hidden pb-2 transition-colors"
          />
        </div>

        {/* Markdown Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-[#F4EFE6] border border-[#E2DCCE] rounded-lg text-xs text-[#5E574B]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => insertMarkdown('**', '**')}
              className="p-1.5 hover:bg-white rounded hover:text-[#1F1C18]"
              title="Bold (**text**)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('*', '*')}
              className="p-1.5 hover:bg-white rounded hover:text-[#1F1C18]"
              title="Italic (*text*)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('\n- ')}
              className="p-1.5 hover:bg-white rounded hover:text-[#1F1C18]"
              title="Bullet list"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('\n> ')}
              className="p-1.5 hover:bg-white rounded hover:text-[#1F1C18]"
              title="Blockquote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[11px] text-[#888073]">
            Owner-bound Cloud Firestore persistence
          </span>
        </div>

        {/* Content Textarea */}
        <div>
          <textarea
            id="entry-content-textarea"
            rows={14}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write without judgment. Whatever needs to be felt or witnessed has a home here..."
            className="w-full font-editorial text-[17px] leading-[1.7] text-[#24211D] placeholder-[#A39C91] bg-white border border-[#E0D9CC] rounded-xl p-5 sm:p-6 focus:outline-hidden focus:border-[#24211D] focus:ring-1 focus:ring-[#24211D] shadow-2xs resize-y"
          />
        </div>

        {/* Tags Section */}
        <div className="p-4 bg-white border border-[#E5E0D5] rounded-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#4A4339]">
            <Tag className="w-3.5 h-3.5" />
            <span>Tags & Themes</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F2ECE1] text-[#4A4339]"
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="text-[#888175] hover:text-red-700"
                >
                  ×
                </button>
              </span>
            ))}

            {/* Tag Input */}
            <input
              id="new-tag-input"
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag(newTagInput);
                }
              }}
              placeholder="+ Add tag (Enter)"
              className="text-xs px-2.5 py-1 bg-transparent border border-dashed border-[#C8C0B2] rounded-full text-[#4A4339] placeholder-[#9E978C] focus:outline-hidden focus:border-[#24211D]"
            />
          </div>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center gap-1 pt-1 text-[11px] text-[#7A7367]">
            <span className="mr-1">Suggestions:</span>
            {POPULAR_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddTag(tag)}
                className="hover:underline text-[#554C3F]"
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>

        {/* GEMINI COMPANION DOCK */}
        <div
          id="gemini-companion-panel"
          className="rounded-2xl border border-[#DCD5C7] bg-[#FAF7F0] p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#24211D] text-[#FAF8F5] flex items-center justify-center shadow-2xs">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#1F1C18]">
                  Gemini Reflection Companion
                </h3>
                <p className="text-xs text-[#7A7367]">
                  Private, psychologically attuned inquiry powered by Gemini 3.8 Flash
                </p>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center gap-1.5">
              <select
                id="reflection-mode-select"
                value={reflectionMode}
                onChange={(e) => setReflectionMode(e.target.value as any)}
                className="text-xs px-3 py-1.5 bg-white border border-[#D5CEC0] rounded-lg text-[#24211D] focus:outline-hidden"
              >
                <option value="deep-reflection">Empathetic Reflection</option>
                <option value="socratic">Socratic Deep Inquiry</option>
                <option value="cognitive-reframe">Cognitive Reframe (CBT)</option>
                <option value="gratitude-strengths">Inner Strengths & Gratitude</option>
              </select>
            </div>
          </div>

          {/* Privacy Safeguards Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EAE4D7] text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-[#4D463B]">
              <input
                id="pii-redaction-toggle"
                type="checkbox"
                checked={enablePiiRedaction}
                onChange={(e) => setEnablePiiRedaction(e.target.checked)}
                className="rounded border-[#C8C0B2] text-[#24211D] focus:ring-0"
              />
              <span className="flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-emerald-700" />
                <span>Mask sensitive identifiers (PII) before AI reflection</span>
              </span>
            </label>

            <button
              id="reflect-with-gemini-btn"
              type="button"
              onClick={handleReflectWithGemini}
              disabled={isReflecting || !content.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] transition-colors shadow-xs disabled:opacity-40"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isReflecting ? 'animate-spin' : ''}`} />
              <span>{isReflecting ? 'Reflecting with Gemini...' : 'Reflect with Gemini'}</span>
            </button>
          </div>

          {redactionNotice && (
            <p className="text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              {redactionNotice}
            </p>
          )}

          {reflectionError && (
            <p className="text-xs text-red-800 bg-red-50 p-2.5 rounded-lg border border-red-200">
              {reflectionError}
            </p>
          )}

          {/* Rendered Reflection Output */}
          {reflection && (
            <div
              id="ai-reflection-card"
              className="mt-4 p-5 rounded-xl bg-white border border-[#E2DCCE] shadow-2xs space-y-4 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between text-xs text-[#7A7367]">
                <span className="font-semibold uppercase tracking-wide text-[#3D372F]">
                  Gemini Reflection ({reflection.mode.replace('-', ' ')})
                </span>
                <span>{new Date(reflection.createdAt).toLocaleDateString()}</span>
              </div>

              {/* Reflection Prose */}
              <div className="font-editorial text-[15px] leading-relaxed text-[#24211D] whitespace-pre-line">
                {reflection.reflectionText}
              </div>

              {/* Cognitive Insight */}
              {reflection.cognitiveInsight && (
                <div className="p-3 bg-[#F7F4EE] rounded-lg border border-[#E5E0D5] text-xs text-[#4A4339] space-y-1">
                  <span className="font-semibold text-[#24211D] flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5 text-amber-700" />
                    Mindful Reframing Note
                  </span>
                  <p>{reflection.cognitiveInsight}</p>
                </div>
              )}

              {/* Follow-up Questions */}
              {reflection.followUpQuestions && reflection.followUpQuestions.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#EFEBE4]">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[#4D463B]">
                    Inquiry for Further Writing
                  </h4>
                  <div className="space-y-2">
                    {reflection.followUpQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between gap-3 p-2.5 bg-[#FAF8F5] rounded-lg border border-[#E8E3DA] text-xs"
                      >
                        <p className="text-[#332E27] font-editorial text-[14px]">
                          "{q}"
                        </p>
                        <button
                          id={`answer-prompt-btn-${idx}`}
                          type="button"
                          onClick={() => appendQuestionToEntry(q)}
                          className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-[#24211D] hover:underline"
                          title="Append to journal entry"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Answer below</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected Themes */}
              {reflection.detectedThemes && reflection.detectedThemes.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-[#7A7367]">Recognized Currents:</span>
                  {reflection.detectedThemes.map((th, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full bg-[#F4EFE6] text-[#554D41] text-[11px] font-medium"
                    >
                      {th}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
