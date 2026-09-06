import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Star,
  Sparkles,
  Calendar,
  Trash2,
  Plus,
  FileText,
  Flame,
  X,
  MapPin,
  ExternalLink,
  BookOpen,
  ArrowUpDown,
  Clock,
  Compass,
  Info,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { JournalEntry, MoodType, EntryLocation } from '../types.ts';
import { MOODS } from '../utils/storage.ts';
import { stripHtml } from '../utils/richText.ts';
import {
  getDisplayPlaceName,
  isRawCoordinateString,
  resolveLocationAsync,
} from '../utils/locationHelper.ts';

function EntryLocationBadge({ location, entryId }: { location: EntryLocation; entryId: string }) {
  const [displayName, setDisplayName] = useState(() => getDisplayPlaceName(location));

  useEffect(() => {
    if (isRawCoordinateString(location.name)) {
      resolveLocationAsync(location, (resolved) => {
        setDisplayName(resolved);
      });
    }
  }, [location.latitude, location.longitude, location.name]);

  const coordsText = `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`;

  return (
    <div
      id={`entry-location-badge-${entryId}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF7F2] border border-[#E7E0D2] text-xs text-[#4A4338] max-w-full"
      onClick={(e) => e.stopPropagation()}
    >
      <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
      <span className="font-medium text-[#1F1C18] truncate max-w-[200px] sm:max-w-xs">
        {displayName}
      </span>
      {location.formattedAddress &&
        !isRawCoordinateString(location.formattedAddress) &&
        location.formattedAddress !== displayName && (
          <span className="text-[11px] text-[#6B6355] hidden md:inline truncate max-w-[180px]">
            • {location.formattedAddress}
          </span>
        )}
      {/* Coordinates available as a small metadata info tooltip */}
      <span
        className="inline-flex items-center text-[#8C8477] hover:text-[#524B40] cursor-help ml-0.5"
        title={`Coordinates: ${coordsText}${typeof location.accuracy === 'number' ? ` (±${Math.round(location.accuracy)}m)` : ''}`}
      >
        <Info className="w-3.5 h-3.5" />
      </span>
      <a
        id={`maps-link-${entryId}`}
        href={`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-amber-800 hover:text-amber-900 ml-1 inline-flex items-center gap-0.5 hover:underline"
        title="Open in Google Maps (opens in new tab)"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}

interface EntryListProps {
  entries: JournalEntry[];
  streak: number;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onDeleteEntry: (id: string) => Promise<void> | void;
  onToggleFavorite: (id: string) => void;
  onOpenPrompts: () => void;
}

export function EntryList({
  entries,
  streak,
  onSelectEntry,
  onNewEntry,
  onDeleteEntry,
  onToggleFavorite,
  onOpenPrompts,
}: EntryListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMood, setSelectedMood] = useState<MoodType | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [onlyWithLocation, setOnlyWithLocation] = useState(false);
  const [onlyReflected, setOnlyReflected] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // In-app Delete Confirmation Modal state
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Close modal on Escape
  useEffect(() => {
    if (!entryToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        setEntryToDelete(null);
        setDeleteError(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [entryToDelete, isDeleting]);

  const handleConfirmDelete = async () => {
    if (!entryToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteEntry(entryToDelete.id);
      setEntryToDelete(null);
    } catch (err: any) {
      console.error('Delete reflection error:', err);
      setDeleteError(
        err?.message || 'Unable to delete reflection from your vault. Please check your connection.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Compute statistics
  const totalWords = useMemo(
    () => entries.reduce((acc, e) => acc + (e.wordCount || 0), 0),
    [entries]
  );
  const reflectedCount = useMemo(
    () => entries.filter((e) => Boolean(e.reflection)).length,
    [entries]
  );
  const locationCount = useMemo(
    () => entries.filter((e) => Boolean(e.location)).length,
    [entries]
  );

  // Extract all unique tags
  const allTags = useMemo(
    () => Array.from(new Set(entries.flatMap((e) => e.tags || []))).filter(Boolean),
    [entries]
  );

  // Filter entries
  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      // Search query matches title or content or tags or location
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = entry.title.toLowerCase().includes(q);
        const matchContent = stripHtml(entry.content).toLowerCase().includes(q);
        const matchTag = entry.tags?.some((t) => t.toLowerCase().includes(q));
        const matchLocation =
          entry.location?.name?.toLowerCase().includes(q) ||
          entry.location?.formattedAddress?.toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchTag && !matchLocation) return false;
      }

      // Mood filter
      if (selectedMood !== 'all' && entry.mood !== selectedMood) {
        return false;
      }

      // Tag filter
      if (selectedTag !== 'all' && !entry.tags?.includes(selectedTag)) {
        return false;
      }

      // Favorites only
      if (onlyFavorites && !entry.isFavorite) {
        return false;
      }

      // Location only
      if (onlyWithLocation && !entry.location) {
        return false;
      }

      // Reflected only
      if (onlyReflected && !entry.reflection) {
        return false;
      }

      return true;
    });
  }, [entries, searchQuery, selectedMood, selectedTag, onlyFavorites, onlyWithLocation, onlyReflected]);

  // Sort entries
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [filtered, sortOrder]);

  const hasActiveFilters =
    Boolean(searchQuery) ||
    selectedMood !== 'all' ||
    selectedTag !== 'all' ||
    onlyFavorites ||
    onlyWithLocation ||
    onlyReflected;

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedMood('all');
    setSelectedTag('all');
    setOnlyFavorites(false);
    setOnlyWithLocation(false);
    setOnlyReflected(false);
  };

  // Time-aware greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div id="entry-list-view" className="space-y-6 sm:space-y-8">
      {/* Welcome & Quick Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-editorial font-bold text-[#1F1C18] tracking-tight">
              {greeting}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F2ECE1] text-[#635B4E] font-medium border border-[#E5E0D5]">
              Private Vault
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#7A7367]">
            Your sanctuary for mindful writing, cognitive inquiry, and self-discovery.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="list-prompts-btn"
            type="button"
            onClick={onOpenPrompts}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-white hover:bg-[#FAF8F5] active:bg-[#F2ECE1] text-[#2C2720] border border-[#DDD6C8] hover:border-[#BFB6A6] shadow-2xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
            title="Get inspired by an introspective prompt"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Daily Spark</span>
          </button>

          <button
            id="new-entry-primary-btn"
            type="button"
            onClick={onNewEntry}
            className="flex items-center gap-2 px-4 py-2 bg-[#24211D] hover:bg-[#3D372F] active:bg-[#1A1815] text-[#FAF8F5] rounded-xl text-xs font-medium transition-all duration-150 shadow-xs hover:shadow-sm active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Reflection</span>
          </button>
        </div>
      </div>

      {/* Stats Cards (4 Distinct Balanced Cards) */}
      <div
        id="stats-banner"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
      >
        {/* Card 1: Writing Streak */}
        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D6] shadow-2xs space-y-2 hover:border-[#CFC6B8] hover:shadow-xs transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#665E50]">
              Writing Streak
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-200/60">
              <Flame className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-editorial font-bold text-[#1F1C18]">
              {streak}
            </span>
            <span className="text-xs text-[#524B3F]">
              {streak === 1 ? 'day active' : 'days active'}
            </span>
          </div>
          <p className="text-[11px] text-[#736B5E] truncate">
            {streak > 0 ? 'Consistency nurtures clarity' : 'Start your streak today'}
          </p>
        </div>

        {/* Card 2: Journal Entries */}
        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D6] shadow-2xs space-y-2 hover:border-[#CFC6B8] hover:shadow-xs transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#665E50]">
              Total Entries
            </span>
            <div className="w-7 h-7 rounded-lg bg-[#F4EFE6] text-[#4A4339] flex items-center justify-center border border-[#E2DCCE]">
              <BookOpen className="w-4 h-4 text-[#3D372F]" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-editorial font-bold text-[#1F1C18]">
              {entries.length}
            </span>
            <span className="text-xs text-[#524B3F]">
              writings
            </span>
          </div>
          <p className="text-[11px] text-[#736B5E] truncate">
            {totalWords.toLocaleString()} words penned
          </p>
        </div>

        {/* Card 3: Saved Locations */}
        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D6] shadow-2xs space-y-2 hover:border-[#CFC6B8] hover:shadow-xs transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#665E50]">
              Places Attached
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200/60">
              <MapPin className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-editorial font-bold text-[#1F1C18]">
              {locationCount}
            </span>
            <span className="text-xs text-[#524B3F]">
              geotagged
            </span>
          </div>
          <p className="text-[11px] text-[#736B5E] truncate">
            Google Maps integrated
          </p>
        </div>

        {/* Card 4: Gemini Reflections */}
        <div className="p-4 rounded-2xl bg-white border border-[#E8E2D6] shadow-2xs space-y-2 hover:border-[#CFC6B8] hover:shadow-xs transition-all duration-150">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#665E50]">
              AI Reflections
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-900 flex items-center justify-center border border-amber-200/60">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-editorial font-bold text-[#1F1C18]">
              {reflectedCount}
            </span>
            <span className="text-xs text-[#524B3F]">
              insights
            </span>
          </div>
          <p className="text-[11px] text-[#736B5E] truncate">
            Gemini Flash inquiry
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3.5 bg-white border border-[#E8E2D6] rounded-2xl p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8477]" />
            <input
              id="search-entries-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search thoughts, themes, locations, or insights..."
              className="w-full h-10 pl-10 pr-9 py-2 bg-[#FAF8F5] border border-[#DDD6C8] rounded-xl text-xs sm:text-sm text-[#1F1C18] placeholder-[#9E978C] focus:outline-hidden focus:border-[#24211D] focus:bg-white focus:ring-1 focus:ring-[#24211D] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8C8477] hover:text-[#1F1C18]"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Chips & Sort */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              id="filter-favorites-btn"
              type="button"
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`h-10 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-medium border transition-colors duration-150 cursor-pointer ${
                onlyFavorites
                  ? 'bg-[#FBF6EE] border-amber-300 text-amber-950 shadow-2xs'
                  : 'bg-white border-[#DDD6C8] text-[#4A4235] hover:bg-[#F9F7F3]'
              }`}
            >
              <Star
                className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-amber-500 text-amber-500' : 'text-[#7A7265]'}`}
              />
              <span>Favorites</span>
            </button>

            <button
              id="filter-location-btn"
              type="button"
              onClick={() => setOnlyWithLocation(!onlyWithLocation)}
              className={`h-10 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-medium border transition-colors duration-150 cursor-pointer ${
                onlyWithLocation
                  ? 'bg-[#24211D] border-[#24211D] text-[#FAF8F5] shadow-2xs'
                  : 'bg-white border-[#DDD6C8] text-[#4A4235] hover:bg-[#F9F7F3]'
              }`}
              title="Filter entries with attached locations"
            >
              <MapPin
                className={`w-3.5 h-3.5 ${onlyWithLocation ? 'text-amber-300' : 'text-[#7A7265]'}`}
              />
              <span>Places {locationCount > 0 && `(${locationCount})`}</span>
            </button>

            <button
              id="filter-reflections-btn"
              type="button"
              onClick={() => setOnlyReflected(!onlyReflected)}
              className={`h-10 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-medium border transition-colors duration-150 cursor-pointer ${
                onlyReflected
                  ? 'bg-[#FDF6E2] border-amber-300 text-amber-950 shadow-2xs'
                  : 'bg-white border-[#DDD6C8] text-[#4A4235] hover:bg-[#F9F7F3]'
              }`}
              title="Filter entries with Gemini AI reflections"
            >
              <Sparkles
                className={`w-3.5 h-3.5 ${onlyReflected ? 'text-amber-700' : 'text-[#7A7265]'}`}
              />
              <span>Reflected {reflectedCount > 0 && `(${reflectedCount})`}</span>
            </button>

            {/* Sort Toggle */}
            <button
              id="toggle-sort-order-btn"
              type="button"
              onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
              className="h-10 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-medium bg-white border border-[#DDD6C8] text-[#4A4235] hover:bg-[#F9F7F3] transition-colors duration-150 cursor-pointer"
              title={`Sorting by ${sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}`}
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#7A7265]" />
              <span className="hidden sm:inline">
                {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
              </span>
            </button>
          </div>
        </div>

        {/* Mood Selector Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs pt-1 border-t border-[#F0ECE1]">
          <span className="text-[11px] font-semibold text-[#665E50] mr-1 shrink-0">
            Mood:
          </span>
          <button
            id="filter-mood-all"
            type="button"
            onClick={() => setSelectedMood('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 shrink-0 cursor-pointer ${
              selectedMood === 'all'
                ? 'bg-[#24211D] text-[#FAF8F5]'
                : 'bg-[#FAF8F5] border border-[#DDD6C8] text-[#4A4235] hover:bg-white'
            }`}
          >
            All Moods
          </button>
          {MOODS.map((m) => (
            <button
              key={m.type}
              id={`filter-mood-${m.type}`}
              type="button"
              onClick={() => setSelectedMood(selectedMood === m.type ? 'all' : m.type)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-150 shrink-0 cursor-pointer ${
                selectedMood === m.type
                  ? 'text-white shadow-2xs'
                  : 'bg-[#FAF8F5] border border-[#DDD6C8] text-[#4A4235] hover:bg-white'
              }`}
              style={{
                backgroundColor: selectedMood === m.type ? m.color : undefined,
                borderColor: selectedMood === m.type ? m.color : undefined,
              }}
            >
              <span>{m.emoji}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>

        {/* Tag Filters & Filter Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5">
              <span className="text-[11px] font-semibold text-[#665E50] mr-1 shrink-0">
                Tags:
              </span>
              <button
                id="filter-tag-all"
                type="button"
                onClick={() => setSelectedTag('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors duration-150 shrink-0 cursor-pointer ${
                  selectedTag === 'all'
                    ? 'bg-[#3D372F] text-white'
                    : 'bg-[#FAF8F5] border border-[#DDD6C8] text-[#554D40] hover:bg-white'
                }`}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  id={`filter-tag-${tag}`}
                  type="button"
                  onClick={() => setSelectedTag(selectedTag === tag ? 'all' : tag)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors duration-150 shrink-0 cursor-pointer ${
                    selectedTag === tag
                      ? 'bg-[#3D372F] text-white'
                      : 'bg-[#FAF8F5] border border-[#DDD6C8] text-[#554D40] hover:bg-white'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {hasActiveFilters && (
            <button
              id="clear-all-filters-btn"
              type="button"
              onClick={handleClearFilters}
              className="text-xs text-[#8A4A00] hover:text-[#5E3200] font-medium hover:underline flex items-center gap-1 ml-auto cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Entries List Header */}
      <div className="flex items-center justify-between text-xs text-[#524A3E] px-1 font-medium">
        <span>
          Showing {sorted.length} {sorted.length === 1 ? 'reflection' : 'reflections'}
          {hasActiveFilters ? ' (filtered)' : ''}
        </span>
        <span className="text-[#6B6355]">Sorted by {sortOrder === 'newest' ? 'newest first' : 'oldest first'}</span>
      </div>

      {/* Entries Grid / Cards */}
      {sorted.length === 0 ? (
        <div
          id="empty-entries-view"
          className="p-10 sm:p-14 text-center bg-white border border-[#E8E2D6] rounded-2xl space-y-4 shadow-2xs"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#FAF8F5] border border-[#E2DCCE] flex items-center justify-center mx-auto text-[#7A7367]">
            <FileText className="w-6 h-6 text-[#5E574B]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-editorial font-bold text-[#1F1C18]">
              {hasActiveFilters
                ? 'No matching reflections found'
                : 'Your journal is open and listening'}
            </h3>
            <p className="text-xs sm:text-sm text-[#7A7367] max-w-md mx-auto leading-relaxed">
              {hasActiveFilters
                ? 'Try refining or clearing your active filters to see your writings.'
                : 'Write your thoughts without hesitation, or explore an introspective prompt crafted by Gemini.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-xl text-xs font-medium transition-colors shadow-xs cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset All Filters</span>
              </button>
            ) : (
              <>
                <button
                  id="empty-new-entry-btn"
                  type="button"
                  onClick={onNewEntry}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-xl text-xs font-medium transition-colors shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Write an Entry</span>
                </button>
                <button
                  id="empty-prompts-btn"
                  type="button"
                  onClick={onOpenPrompts}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-white hover:bg-[#FAF8F5] text-[#24211D] border border-[#D5CEC0] rounded-xl text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Generate a Prompt</span>
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div id="entries-card-list" className="space-y-4">
          {sorted.map((entry) => {
            const moodMeta = MOODS.find((m) => m.type === entry.mood) || MOODS[0];
            const dateObj = new Date(entry.createdAt);
            const dateStr = dateObj.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const previewText = stripHtml(entry.content).replace(/^[#>*-\s]+/gm, '').trim();
            const readingTimeMin = Math.max(1, Math.ceil((entry.wordCount || 0) / 200));

            return (
              <article
                key={entry.id}
                id={`journal-card-${entry.id}`}
                onClick={() => onSelectEntry(entry)}
                className="group relative p-5 sm:p-6 bg-white border border-[#E8E2D6] hover:border-[#BFB6A6] rounded-2xl transition-all duration-150 shadow-2xs hover:shadow-xs cursor-pointer space-y-3.5"
              >
                {/* Card Top: Date, Mood & Actions */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: moodMeta.bgLight,
                        color: moodMeta.color,
                        borderColor: moodMeta.borderLight,
                        borderWidth: 1,
                      }}
                    >
                      <span>{moodMeta.emoji}</span>
                      <span>{moodMeta.label}</span>
                    </span>

                    <span className="text-xs text-[#5E5648] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-[#887F71]" />
                      <span>{dateStr}</span>
                    </span>

                    <span className="text-xs text-[#6B6355] hidden sm:flex items-center gap-1">
                      <span>•</span>
                      <Clock className="w-3.5 h-3.5 text-[#887F71]" />
                      <span>{readingTimeMin} min read</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {/* Gemini badge if reflected */}
                    {entry.reflection && (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200"
                        title={`Contains Gemini Reflection (${entry.reflection.mode})`}
                      >
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        <span className="hidden sm:inline">Reflected</span>
                      </span>
                    )}

                    {/* Favorite Button */}
                    <button
                      id={`favorite-btn-${entry.id}`}
                      type="button"
                      onClick={() => onToggleFavorite(entry.id)}
                      className={`p-1.5 rounded-lg hover:bg-[#F2ECE1] transition-colors duration-150 cursor-pointer ${
                        entry.isFavorite ? 'text-amber-500' : 'text-[#887F71] hover:text-[#24211D]'
                      }`}
                      title={entry.isFavorite ? 'Unstar' : 'Star'}
                    >
                      <Star className={`w-4 h-4 ${entry.isFavorite ? 'fill-amber-500' : ''}`} />
                    </button>

                    {/* Delete Button */}
                    <button
                      id={`delete-btn-${entry.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteError(null);
                        setEntryToDelete(entry);
                      }}
                      className="p-1.5 rounded-lg text-[#736B5E] hover:text-red-700 hover:bg-red-50 active:bg-red-100 transition-colors duration-150 cursor-pointer"
                      title="Delete entry"
                      aria-label={`Delete entry: ${entry.title || 'Untitled Reflection'}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg sm:text-xl font-editorial font-semibold text-[#1F1C18] group-hover:text-[#383126] transition-colors leading-snug">
                  {entry.title || 'Untitled Reflection'}
                </h3>

                {/* Location Badge if attached - displays resolved place name only */}
                {entry.location && (
                  <EntryLocationBadge location={entry.location} entryId={entry.id} />
                )}

                {/* Excerpt */}
                <p className="font-editorial text-[15px] leading-relaxed text-[#4A4235] line-clamp-2">
                  {previewText || 'Empty entry...'}
                </p>

                {/* Card Footer: Tags & Word count */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[#F2EDE4] text-xs text-[#524A3E]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {entry.tags?.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-0.5 rounded-full bg-[#F4EFE6] text-[#423A2F] text-[11px] font-medium border border-[#E5DED0]"
                      >
                        #{tag}
                      </span>
                    ))}
                    {(entry.tags?.length || 0) > 4 && (
                      <span className="text-[11px] text-[#6B6355]">
                        +{(entry.tags?.length || 0) - 4} more
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-medium text-[#524A3E]">
                    {entry.wordCount || 0} {entry.wordCount === 1 ? 'word' : 'words'}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* In-App Delete Confirmation Modal */}
      {entryToDelete && (
        <div
          id="delete-confirmation-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#24211D]/45 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => {
            if (!isDeleting) {
              setEntryToDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            id="delete-confirmation-modal"
            className="w-full max-w-md bg-white border border-[#E2DCCE] rounded-2xl shadow-xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center shrink-0 border border-red-200/60 shadow-2xs">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h3
                  id="delete-modal-title"
                  className="text-base sm:text-lg font-editorial font-bold text-[#1F1C18]"
                >
                  Delete Reflection?
                </h3>
                <p className="text-xs sm:text-sm text-[#5E5648] leading-relaxed">
                  Are you sure you want to permanently delete{' '}
                  <span className="font-semibold text-[#24211D]">
                    “{entryToDelete.title?.trim() || 'Untitled Reflection'}”
                  </span>
                  ? This will remove it from your private cloud vault and local cache. This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <div
                id="delete-error-banner"
                className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="flex-1">{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#F2ECE1]">
              <button
                id="cancel-delete-modal-btn"
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setEntryToDelete(null);
                  setDeleteError(null);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-white hover:bg-[#FAF8F5] active:bg-[#F2ECE1] text-[#4A4235] border border-[#DDD6C8] transition-colors duration-150 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-modal-btn"
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-red-700 hover:bg-red-800 active:bg-red-900 text-white shadow-xs transition-colors duration-150 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Reflection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

