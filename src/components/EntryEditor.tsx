import { useState, useEffect, useRef } from 'react';
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
  Info,
  MessageSquare,
  Send,
  CornerDownLeft,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import type {
  JournalEntry,
  MoodType,
  AiReflection,
  EntryLocation,
  ReflectionConversation,
  ConversationMessage,
} from '../types.ts';
import { MOODS } from '../utils/storage.ts';
import { redactPII } from '../utils/crypto.ts';
import { stripHtml, countWords, markdownToHtml } from '../utils/richText.ts';
import {
  getDisplayPlaceName,
  isRawCoordinateString,
  resolveLocationAsync,
} from '../utils/locationHelper.ts';
import { sendReflectionChatMessage } from '../utils/apiClient.ts';

interface EntryEditorProps {
  entry: JournalEntry | null;
  onSave: (entry: JournalEntry, options?: { keepOpen?: boolean; isNewReflection?: boolean }) => Promise<void>;
  onBack: () => void;
}

const POPULAR_TAGS = ['Mindfulness', 'Gratitude', 'Career', 'Relationships', 'Health', 'Creativity', 'Reframing', 'Family', 'Dreams'];

export function EntryEditor({ entry, onSave, onBack }: EntryEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeEntryId, setActiveEntryId] = useState<string>(
    () => entry?.id || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );
  const [title, setTitle] = useState(entry?.title || '');
  const [content, setContent] = useState(() => markdownToHtml(entry?.content || ''));
  const [mood, setMood] = useState<MoodType>(entry?.mood || 'thoughtful');
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(entry?.isFavorite || false);
  const [reflection, setReflection] = useState<AiReflection | undefined>(entry?.reflection);

  // Active toolbar formats (WYSIWYG state)
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    list: false,
    quote: false,
  });

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

  // Multi-Turn Reflection Dialogue state
  const [conversation, setConversation] = useState<ReflectionConversation | undefined>(
    entry?.conversation
  );
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Persistence status states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Initialize and sync editor DOM when entry changes or on mount
  useEffect(() => {
    if (entry?.id) {
      setActiveEntryId(entry.id);
      setTitle(entry.title || '');
      setMood(entry.mood || 'thoughtful');
      setTags(entry.tags || []);
      setIsFavorite(entry.isFavorite || false);
      setReflection(entry.reflection);
      setConversation(entry.conversation);
    }
    const formatted = markdownToHtml(entry?.content || '');
    setContent(formatted);
    if (editorRef.current) {
      editorRef.current.innerHTML = formatted;
    }

    // Auto-resolve any legacy coordinate strings to friendly place names
    if (entry?.location && isRawCoordinateString(entry.location.name)) {
      resolveLocationAsync(entry.location, (resolvedName) => {
        setLocation((prev) => (prev ? { ...prev, name: resolvedName } : prev));
      });
    }
  }, [entry?.id]);

  // Metrics
  const words = countWords(content);
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));
  const isContentEmpty = !content || !stripHtml(content).trim();

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

  // Query browser formatting state for selection or current cursor
  const updateActiveFormats = () => {
    if (!editorRef.current) return;
    try {
      const isBold = document.queryCommandState('bold');
      const isItalic = document.queryCommandState('italic');
      const isList = document.queryCommandState('insertUnorderedList');
      const blockType = document.queryCommandValue('formatBlock');
      const isQuote = blockType === 'blockquote' || blockType?.toLowerCase() === 'blockquote';
      setActiveFormats({
        bold: isBold,
        italic: isItalic,
        list: isList,
        quote: Boolean(isQuote),
      });
    } catch {
      // Ignore if outside editable range
    }
  };

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const plain = editorRef.current.innerText || '';
    if (!plain.trim() && (html === '<br>' || html === '<p><br></p>' || html === '<div><br></div>')) {
      setContent('');
    } else {
      setContent(html);
    }
    updateActiveFormats();
  };

  // WYSIWYG format command execution
  const handleFormat = (command: string, value: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    if (command === 'formatBlock' && value === 'blockquote') {
      const blockType = document.queryCommandValue('formatBlock');
      const isQuote = blockType === 'blockquote' || blockType?.toLowerCase() === 'blockquote';
      document.execCommand('formatBlock', false, isQuote ? '<p>' : '<blockquote>');
    } else {
      document.execCommand(command, false, value);
    }

    updateActiveFormats();
    handleEditorInput();
  };

  const handleSave = async (
    overrideReflection?: AiReflection,
    options?: { keepOpen?: boolean; isNewReflection?: boolean },
    overrideConversation?: ReflectionConversation | null
  ) => {
    setSaveError(null);
    setSaveSuccessNotice(null);
    setIsSaving(true);

    const currentHtml = editorRef.current ? editorRef.current.innerHTML : content;
    const cleanHtml = currentHtml === '<br>' || currentHtml === '<p><br></p>' ? '' : currentHtml;
    const strippedText = stripHtml(cleanHtml).trim();
    const cleanTitle = title.trim();

    // Safeguard to prevent saving empty/placeholder entries without substantive reflection
    if (strippedText.length < 4 && cleanTitle.length < 3 && !overrideReflection && !reflection) {
      setSaveError('Please write at least a few words or a title before saving this reflection.');
      setIsSaving(false);
      return;
    }

    const resolvedConversation =
      overrideConversation !== undefined
        ? overrideConversation === null
          ? undefined
          : overrideConversation
        : conversation;

    const now = new Date().toISOString();
    const finalEntry: JournalEntry = {
      id: activeEntryId,
      title: cleanTitle || 'Untitled Reflection',
      content: cleanHtml,
      createdAt: entry?.createdAt || now,
      updatedAt: now,
      mood,
      tags,
      isFavorite,
      wordCount: countWords(cleanHtml),
      reflection: overrideReflection !== undefined ? overrideReflection : reflection,
      conversation: resolvedConversation,
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
   * Send follow-up question or reflection prompt in multi-turn conversation
   */
  const handleSendChatMessage = async (presetQuestion?: string) => {
    const rawMsg = presetQuestion || chatInput;
    const msg = rawMsg.trim();
    if (!msg || isChatSending) return;

    const plainText = stripHtml(content).trim();
    if (!plainText) {
      setChatError('Please write some thoughts in your journal entry before discussing it with Gemini.');
      return;
    }

    setChatError(null);
    setIsChatSending(true);
    if (!presetQuestion) {
      setChatInput('');
    }

    try {
      const result = await sendReflectionChatMessage({
        entryId: activeEntryId,
        entryTitle: title.trim() || 'Journal Entry',
        entryText: plainText,
        initialReflection: reflection?.reflectionText,
        messages: conversation?.messages || [],
        message: msg,
        mode: reflectionMode,
        conversationId: conversation?.id,
        conversationCreatedAt: conversation?.createdAt,
      });

      setConversation(result.conversation);

      // Save to sync Firestore state and parent state immediately
      await handleSave(reflection, { keepOpen: true }, result.conversation);

      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } catch (err: any) {
      console.error('Gemini chat error:', err);
      setChatError(err.message || 'Failed to receive a response from Gemini. Please try again.');
      if (!presetQuestion) {
        setChatInput(rawMsg);
      }
    } finally {
      setIsChatSending(false);
    }
  };

  /**
   * Clear the active dialogue history with user confirmation
   */
  const handleClearConversation = async () => {
    if (!conversation || !conversation.messages?.length) return;
    if (confirm('Clear this follow-up dialogue? Your journal entry and primary reflection will remain intact.')) {
      setConversation(undefined);
      await handleSave(reflection, { keepOpen: true }, null);
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
          // Network or API failure fallback: store validated coordinates gracefully with clean place label
          const newLoc: EntryLocation = {
            latitude,
            longitude,
            name: 'Captured Location',
            formattedAddress: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
            accuracy: accuracy || undefined,
            capturedAt: new Date().toISOString(),
            source: 'coordinates-fallback',
          };
          setLocation(newLoc);
          setLocationSuccessNotice('Location captured.');
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

  const handleReflectWithGemini = async () => {
    const plainText = stripHtml(content);
    if (!plainText.trim()) {
      setReflectionError('Please write some journal content before requesting an AI reflection.');
      return;
    }

    setIsReflecting(true);
    setReflectionError(null);
    setRedactionNotice(null);

    let textToSend = plainText;
    if (enablePiiRedaction) {
      const { redactedText, redactionsCount } = redactPII(plainText);
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
    const safeQuestion = question
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const addition = `<blockquote><strong>Reflecting on:</strong> <em>${safeQuestion}</em></blockquote><p><br></p>`;
    if (editorRef.current) {
      editorRef.current.focus();
      editorRef.current.innerHTML = (editorRef.current.innerHTML || '') + addition;
      handleEditorInput();
    } else {
      setContent((prev) => prev + addition);
    }
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
                  {getDisplayPlaceName(location)}
                </span>
                {location.formattedAddress && !isRawCoordinateString(location.formattedAddress) && location.formattedAddress !== getDisplayPlaceName(location) && (
                  <span className="text-[11px] text-[#787163] hidden sm:inline">
                    ({location.formattedAddress})
                  </span>
                )}
                {/* Coordinates as small metadata info tooltip */}
                <span
                  className="inline-flex items-center text-[#8C8476] hover:text-[#5E574B] cursor-help ml-0.5"
                  title={`Coordinates: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}${typeof location.accuracy === 'number' ? ` (±${Math.round(location.accuracy)}m)` : ''}`}
                >
                  <Info className="w-3.5 h-3.5" />
                </span>
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

        {/* Rich Text Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-[#F4EFE6] border border-[#E2DCCE] rounded-lg text-xs text-[#5E574B]">
          <div className="flex items-center gap-1">
            <button
              id="editor-format-bold"
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleFormat('bold');
              }}
              className={`p-1.5 rounded transition-all flex items-center justify-center ${
                activeFormats.bold
                  ? 'bg-[#24211D] text-[#FAF8F5] shadow-2xs font-bold'
                  : 'hover:bg-white text-[#5E574B] hover:text-[#1F1C18]'
              }`}
              title="Bold (Ctrl+B / ⌘B)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              id="editor-format-italic"
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleFormat('italic');
              }}
              className={`p-1.5 rounded transition-all flex items-center justify-center ${
                activeFormats.italic
                  ? 'bg-[#24211D] text-[#FAF8F5] shadow-2xs italic'
                  : 'hover:bg-white text-[#5E574B] hover:text-[#1F1C18]'
              }`}
              title="Italic (Ctrl+I / ⌘I)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              id="editor-format-list"
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleFormat('insertUnorderedList');
              }}
              className={`p-1.5 rounded transition-all flex items-center justify-center ${
                activeFormats.list
                  ? 'bg-[#24211D] text-[#FAF8F5] shadow-2xs'
                  : 'hover:bg-white text-[#5E574B] hover:text-[#1F1C18]'
              }`}
              title="Bullet list"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              id="editor-format-quote"
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                handleFormat('formatBlock', 'blockquote');
              }}
              className={`p-1.5 rounded transition-all flex items-center justify-center ${
                activeFormats.quote
                  ? 'bg-[#24211D] text-[#FAF8F5] shadow-2xs'
                  : 'hover:bg-white text-[#5E574B] hover:text-[#1F1C18]'
              }`}
              title="Blockquote"
            >
              <Quote className="w-3.5 h-3.5" />
            </button>
          </div>

          <span className="text-[11px] text-[#888073]">
            Owner-bound Cloud Firestore persistence
          </span>
        </div>

        {/* Content Rich Text Editor */}
        <div className="relative">
          <div
            id="entry-content-editor"
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            onInput={handleEditorInput}
            onKeyUp={updateActiveFormats}
            onMouseUp={updateActiveFormats}
            onSelect={updateActiveFormats}
            onBlur={() => {
              handleEditorInput();
              updateActiveFormats();
            }}
            className="w-full min-h-[360px] font-editorial text-[17px] leading-[1.7] text-[#24211D] bg-white border border-[#E0D9CC] rounded-xl p-5 sm:p-6 focus:outline-hidden focus:border-[#24211D] focus:ring-1 focus:ring-[#24211D] shadow-2xs overflow-y-auto cursor-text [&_blockquote]:border-l-4 [&_blockquote]:border-amber-700/60 [&_blockquote]:pl-4 [&_blockquote]:py-1.5 [&_blockquote]:my-3 [&_blockquote]:italic [&_blockquote]:text-[#4A4339] [&_blockquote]:bg-[#F9F6F0] [&_blockquote]:rounded-r-lg [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2.5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2.5 [&_li]:my-0.5 [&_b]:font-bold [&_strong]:font-bold [&_i]:italic [&_em]:italic [&_p]:my-1.5"
          />

          {isContentEmpty && (
            <div
              id="editor-placeholder"
              onClick={() => editorRef.current?.focus()}
              className="absolute top-5 sm:top-6 left-5 sm:left-6 font-editorial text-[17px] leading-[1.7] text-[#A39C91] pointer-events-none select-none"
            >
              Write without judgment. Whatever needs to be felt or witnessed has a home here...
            </div>
          )}

          {/* Hidden textarea for DOM compatibility */}
          <textarea
            id="entry-content-textarea"
            value={content}
            onChange={() => {}}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            readOnly
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
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 bg-[#FAF8F5] rounded-lg border border-[#E8E3DA] text-xs"
                      >
                        <p className="text-[#332E27] font-editorial text-[14px] flex-1">
                          "{q}"
                        </p>
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                          <button
                            id={`answer-prompt-btn-${idx}`}
                            type="button"
                            onClick={() => appendQuestionToEntry(q)}
                            className="flex items-center gap-1 text-[11px] font-medium text-[#24211D] hover:underline px-2 py-1 rounded bg-white border border-[#E0D8CA]"
                            title="Append to journal entry"
                          >
                            <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Answer below</span>
                          </button>
                          <button
                            id={`discuss-gemini-prompt-btn-${idx}`}
                            type="button"
                            onClick={() => handleSendChatMessage(q)}
                            disabled={isChatSending}
                            className="flex items-center gap-1 text-[11px] font-medium text-[#FAF8F5] bg-[#24211D] hover:bg-[#3D372F] px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                            title="Discuss this inquiry in multi-turn conversation with Gemini"
                          >
                            <MessageSquare className="w-3 h-3 text-amber-300" />
                            <span>Discuss with Gemini</span>
                          </button>
                        </div>
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

          {/* MULTI-TURN REFLECTION DIALOGUE */}
          <div
            id="multi-turn-dialogue-section"
            className="mt-6 pt-5 border-t border-[#E2DCCE] space-y-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#24211D] text-[#FAF8F5] flex items-center justify-center shadow-2xs">
                  <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[#3D372F]">
                      Multi-Turn Reflection Dialogue
                    </h4>
                    {conversation?.messages && conversation.messages.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#E8E2D5] text-[#554D41]">
                        {conversation.messages.length} message{conversation.messages.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#7A7367]">
                    Continue the conversation with your reflective companion — ask clarifying questions or explore feelings deeper.
                  </p>
                </div>
              </div>

              {conversation?.messages && conversation.messages.length > 0 && (
                <button
                  id="clear-dialogue-btn"
                  type="button"
                  onClick={handleClearConversation}
                  className="flex items-center gap-1 text-[11px] text-[#888073] hover:text-red-700 transition-colors"
                  title="Clear conversation history"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Reset dialogue</span>
                </button>
              )}
            </div>

            {/* Conversation Messages Thread */}
            {conversation?.messages && conversation.messages.length > 0 ? (
              <div
                id="dialogue-messages-thread"
                className="space-y-3 p-4 bg-white/80 rounded-xl border border-[#E5E0D5] max-h-[420px] overflow-y-auto shadow-2xs"
              >
                {conversation.messages.map((msg, i) => (
                  <div
                    key={msg.id || i}
                    className={`flex items-start gap-2.5 ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.role === 'model' && (
                      <div className="w-6 h-6 rounded-md bg-[#24211D] text-amber-400 flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                        <Sparkles className="w-3 h-3" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-xl p-3.5 text-xs shadow-2xs ${
                        msg.role === 'user'
                          ? 'bg-[#24211D] text-[#FAF8F5]'
                          : 'bg-[#F9F7F2] text-[#24211D] border border-[#E5E0D5]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75">
                        <span className="font-medium">
                          {msg.role === 'user' ? 'You' : 'Gemini Companion'}
                        </span>
                        <span>
                          {msg.timestamp
                            ? new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>
                      <div className="font-editorial text-[14px] leading-relaxed whitespace-pre-line">
                        {msg.content}
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-6 h-6 rounded-md bg-[#E8E2D5] text-[#4A4339] flex items-center justify-center shrink-0 mt-1">
                        <UserIcon className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-white/60 border border-dashed border-[#DBD4C5] text-center space-y-2">
                <p className="text-xs text-[#6A6356]">
                  No follow-up exchanges yet. Ask Gemini a question about this entry or select a prompt below.
                </p>
                {/* Starter suggestions */}
                <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                  {[
                    'How can I view this situation with more self-compassion?',
                    'What unspoken emotions might be beneath the surface here?',
                    'Help me reframe this thought constructively.',
                    'What is one small step I can take next?',
                  ].map((starter, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => handleSendChatMessage(starter)}
                      disabled={isChatSending || !content.trim()}
                      className="px-2.5 py-1 rounded-full text-[11px] bg-white border border-[#DDD6C8] hover:border-[#24211D] text-[#4A4339] hover:text-[#1F1C18] transition-colors disabled:opacity-40"
                    >
                      "{starter}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Error Banner */}
            {chatError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{chatError}</span>
              </div>
            )}

            {/* Chat Input Box */}
            <div className="relative flex items-center gap-2">
              <input
                id="dialogue-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
                disabled={isChatSending}
                placeholder={
                  isChatSending
                    ? 'Gemini is reflecting with you...'
                    : 'Ask Gemini a follow-up question or share a reflection... (Enter to send)'
                }
                className="flex-1 text-xs px-3.5 py-2.5 bg-white border border-[#D5CEC0] rounded-xl text-[#24211D] placeholder-[#9E978C] focus:outline-hidden focus:border-[#24211D] focus:ring-1 focus:ring-[#24211D] disabled:opacity-60 shadow-2xs"
              />
              <button
                id="dialogue-send-btn"
                type="button"
                onClick={() => handleSendChatMessage()}
                disabled={isChatSending || !chatInput.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] transition-colors shadow-2xs disabled:opacity-40"
              >
                {isChatSending ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
                ) : (
                  <Send className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span className="hidden sm:inline">{isChatSending ? 'Reflecting...' : 'Send'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
