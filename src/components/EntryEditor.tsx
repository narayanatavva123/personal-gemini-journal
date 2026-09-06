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
  MapPin,
  ExternalLink,
  X,
} from 'lucide-react';
import type { JournalEntry, MoodType, AiReflection, EntryLocation } from '../types.ts';
import { MOODS } from '../utils/storage.ts';
import { redactPII } from '../utils/crypto.ts';

interface EntryEditorProps {
  entry: JournalEntry | null;
  onSave: (entry: JournalEntry, options?: { keepOpen?: boolean; isNewReflection?: boolean }) => Promise<void>;
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

  // Geolocation state
  const [location, setLocation] = useState<EntryLocation | undefined>(entry?.location);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSuccessNotice, setLocationSuccessNotice] = useState<string | null>(null);

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
  }, [title, content, mood, tags, isFavorite, reflection, location]);

  const handleSave = async (
    overrideReflection?: AiReflection,
    options?: { keepOpen?: boolean; isNewReflection?: boolean }
  ) => {
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
      location,
    };

    try {
      await onSave(finalEntry, options);
      setSaveSuccessNotice('Entry and reflection safely persisted to your private Firestore vault.');
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    } catch (err: any) {
      console.error('Save failed:', err);
      // NEVER clear the user's input buffer!
      setSaveError(err.message || 'Failed to save entry to Cloud Firestore. Your writing is preserved.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Explicit user-triggered location capture.
   * Prompts browser permission only upon clicking 'Add Location'.
   */
  const handleAddLocation = () => {
    setLocationError(null);
    setLocationSuccessNotice(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser environment.');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          // Call secure server-side reverse-geocode proxy (keeps Google Maps API keys hidden)
          const res = await fetch('/api/location/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              latitude,
              longitude,
              accuracy: accuracy || undefined,
            }),
          });

          if (!res.ok) {
            throw new Error('Reverse geocoding proxy returned an error');
          }

          const data = await res.json();
          const newLoc: EntryLocation = {
            latitude: data.latitude,
            longitude: data.longitude,
            name: data.name,
            formattedAddress: data.formattedAddress,
            accuracy: data.accuracy,
            capturedAt: data.capturedAt || new Date().toISOString(),
            source: data.source,
          };

          setLocation(newLoc);
          setLocationSuccessNotice(`Attached: ${newLoc.name || 'Current Location'}`);
          setTimeout(() => setLocationSuccessNotice(null), 4000);
        } catch {
          // Network or API failure fallback: store validated coordinates gracefully
          const fallbackName = `${Math.abs(latitude).toFixed(2)}° ${latitude >= 0 ? 'N' : 'S'}, ${Math.abs(longitude).toFixed(2)}° ${longitude >= 0 ? 'E' : 'W'}`;
          const newLoc: EntryLocation = {
            latitude,
            longitude,
            name: fallbackName,
            formattedAddress: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            accuracy: accuracy || undefined,
            capturedAt: new Date().toISOString(),
            source: 'coordinates-fallback',
          };
          setLocation(newLoc);
          setLocationSuccessNotice('Coordinates attached.');
          setTimeout(() => setLocationSuccessNotice(null), 4000);
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission was denied. Allow location access in browser or iframe settings to attach your location.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information is unavailable from your device or network.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out. Please try again.');
            break;
          default:
            setLocationError(error.message || 'Unable to retrieve your location.');
            break;
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  const handleRemoveLocation = () => {
    setLocation(undefined);
    setLocationSuccessNotice(null);
    setLocationError(null);
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
      await handleSave(newRef, { keepOpen: true, isNewReflection: true });
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

        {/* Location Section */}
        <div id="entry-location-bar" className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-[#E5E0D5] text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-4 h-4 text-[#8C8476] shrink-0" />
            {location ? (
              <div className="flex flex-wrap items-center gap-1.5 text-[#2E2A24]">
                <span className="font-medium text-[#1F1C18]">
                  {location.name || `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`}
                </span>
                {location.formattedAddress && location.formattedAddress !== location.name && (
                  <span className="text-[11px] text-[#787163] hidden sm:inline">
                    ({location.formattedAddress})
                  </span>
                )}
                {typeof location.accuracy === 'number' && (
                  <span className="text-[10px] text-[#8C8476] bg-[#F4EFE6] px-1.5 py-0.5 rounded">
                    ±{Math.round(location.accuracy)}m
                  </span>
                )}
                <a
                  id="view-on-google-maps-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[11px] text-amber-800 hover:text-amber-900 underline ml-1"
                  title="Open location in Google Maps (opens in new tab)"
                >
                  <span>Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : (
              <span className="text-[#888175]">
                Optional: attach your current location to this journal entry
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {location ? (
              <div className="flex items-center gap-1.5">
                <button
                  id="update-location-btn"
                  type="button"
                  onClick={handleAddLocation}
                  disabled={isLocating}
                  className="px-2 py-1 text-[11px] font-medium text-[#5E5648] hover:text-[#1F1C18] hover:bg-[#F2ECE1] rounded transition-colors disabled:opacity-50"
                  title="Update to current location"
                >
                  {isLocating ? 'Updating...' : 'Update'}
                </button>
                <button
                  id="remove-location-btn"
                  type="button"
                  onClick={handleRemoveLocation}
                  className="px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 rounded transition-colors flex items-center gap-1"
                  title="Detach location from entry"
                >
                  <X className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              </div>
            ) : (
              <button
                id="add-location-btn"
                type="button"
                onClick={handleAddLocation}
                disabled={isLocating}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FAF7F2] hover:bg-[#F0ECE3] border border-[#DDD6C8] text-[#3D372F] rounded-lg text-xs font-medium transition-colors shadow-2xs disabled:opacity-50"
                title="Attach current location (requests browser permission)"
              >
                <MapPin className={`w-3.5 h-3.5 ${isLocating ? 'animate-bounce text-amber-600' : 'text-[#7A7367]'}`} />
                <span>{isLocating ? 'Acquiring GPS...' : 'Add Location'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Location Alerts */}
        {locationError && (
          <div
            id="location-error-banner"
            className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start justify-between gap-2"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{locationError}</span>
            </div>
            <button
              type="button"
              onClick={() => setLocationError(null)}
              className="text-rose-600 hover:text-rose-900 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {locationSuccessNotice && (
          <div
            id="location-success-banner"
            className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{locationSuccessNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setLocationSuccessNotice(null)}
              className="text-emerald-600 hover:text-emerald-900 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

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
