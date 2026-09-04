import { useState } from 'react';
import {
  Search,
  Star,
  Sparkles,
  Calendar,
  Tag,
  Trash2,
  Plus,
  Filter,
  FileText,
  Flame,
  X,
  Compass,
} from 'lucide-react';
import type { JournalEntry, MoodType } from '../types.ts';
import { MOODS } from '../utils/storage.ts';

interface EntryListProps {
  entries: JournalEntry[];
  streak: number;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
  onDeleteEntry: (id: string) => void;
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

  // Compute statistics
  const totalWords = entries.reduce((acc, e) => acc + (e.wordCount || 0), 0);
  const reflectedCount = entries.filter((e) => Boolean(e.reflection)).length;

  // Extract all unique tags
  const allTags = Array.from(
    new Set(entries.flatMap((e) => e.tags || []))
  ).filter(Boolean);

  // Filter entries
  const filtered = entries.filter((entry) => {
    // Search query matches title or content or tags
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = entry.title.toLowerCase().includes(q);
      const matchContent = entry.content.toLowerCase().includes(q);
      const matchTag = entry.tags?.some((t) => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchTag) return false;
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

    return true;
  });

  // Sort descending by date
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div id="entry-list-view" className="space-y-6">
      {/* Stats and Welcome Banner */}
      <div
        id="stats-banner"
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 rounded-2xl bg-white border border-[#E5E0D5] shadow-2xs"
      >
        <div className="space-y-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#888175]">
            Writing Streak
          </span>
          <div className="flex items-center gap-1.5 text-xl font-semibold text-[#24211D]">
            <Flame className="w-5 h-5 text-amber-600" />
            <span>{streak} {streak === 1 ? 'day' : 'days'}</span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#888175]">
            Journal Entries
          </span>
          <div className="flex items-center gap-1.5 text-xl font-semibold text-[#24211D]">
            <FileText className="w-5 h-5 text-[#5D5547]" />
            <span>{entries.length}</span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#888175]">
            Words Written
          </span>
          <div className="flex items-center gap-1.5 text-xl font-semibold text-[#24211D]">
            <Compass className="w-5 h-5 text-[#5D5547]" />
            <span>{totalWords.toLocaleString()}</span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#888175]">
            Gemini Reflections
          </span>
          <div className="flex items-center gap-1.5 text-xl font-semibold text-[#24211D]">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <span>{reflectedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8477]" />
            <input
              id="search-entries-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search thoughts, themes, or insights..."
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-[#DCD5C8] rounded-xl text-xs sm:text-sm text-[#1F1C18] placeholder-[#9E978C] focus:outline-hidden focus:border-[#24211D] focus:ring-1 focus:ring-[#24211D]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#8C8477] hover:text-[#1F1C18]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Favorites Filter Toggle */}
          <div className="flex items-center gap-2">
            <button
              id="filter-favorites-btn"
              type="button"
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                onlyFavorites
                  ? 'bg-amber-50 border-amber-300 text-amber-800'
                  : 'bg-white border-[#DCD5C8] text-[#5D5547] hover:bg-[#F9F7F3]'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>Favorites</span>
            </button>

            {/* Prompt Helper CTA */}
            <button
              id="list-prompts-btn"
              type="button"
              onClick={onOpenPrompts}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#F2ECE1] hover:bg-[#EBE4D5] text-[#4A4339] border border-[#E0D9CB] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Daily Spark</span>
            </button>
          </div>
        </div>

        {/* Mood Selector Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-medium text-[#7A7367] mr-1 shrink-0">
            Mood:
          </span>
          <button
            id="filter-mood-all"
            type="button"
            onClick={() => setSelectedMood('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
              selectedMood === 'all'
                ? 'bg-[#24211D] text-[#FAF8F5]'
                : 'bg-white border border-[#E5E0D5] text-[#554E43] hover:bg-[#F9F7F3]'
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
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors shrink-0 ${
                selectedMood === m.type
                  ? 'text-white shadow-2xs'
                  : 'bg-white border border-[#E5E0D5] text-[#554E43] hover:bg-[#F9F7F3]'
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

        {/* Active Tag Filter if any */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-medium text-[#7A7367] mr-1 shrink-0">
              Tags:
            </span>
            <button
              id="filter-tag-all"
              type="button"
              onClick={() => setSelectedTag('all')}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                selectedTag === 'all'
                  ? 'bg-[#4A4339] text-white'
                  : 'bg-white border border-[#E5E0D5] text-[#6A6255] hover:bg-[#F9F7F3]'
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
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors shrink-0 ${
                  selectedTag === tag
                    ? 'bg-[#4A4339] text-white'
                    : 'bg-white border border-[#E5E0D5] text-[#6A6255] hover:bg-[#F9F7F3]'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Entries Grid / Cards */}
      {sorted.length === 0 ? (
        <div
          id="empty-entries-view"
          className="p-12 text-center bg-white border border-[#E5E0D5] rounded-2xl space-y-4"
        >
          <div className="w-12 h-12 rounded-full bg-[#FAF8F5] border border-[#E5E0D5] flex items-center justify-center mx-auto text-[#7A7367]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1F1C18]">
              {searchQuery || selectedMood !== 'all' || selectedTag !== 'all' || onlyFavorites
                ? 'No matching entries found'
                : 'Your journal is ready for your thoughts'}
            </h3>
            <p className="text-xs text-[#7A7367] max-w-md mx-auto mt-1">
              {searchQuery || selectedMood !== 'all' || selectedTag !== 'all' || onlyFavorites
                ? 'Try clearing your filters or search keywords to see your writings.'
                : 'Write your first reflection or get inspired by an introspective prompt from Gemini.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              id="empty-new-entry-btn"
              type="button"
              onClick={onNewEntry}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#24211D] hover:bg-[#3D372F] text-[#FAF8F5] rounded-lg text-xs font-medium transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Write an Entry</span>
            </button>
            <button
              id="empty-prompts-btn"
              type="button"
              onClick={onOpenPrompts}
              className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#FAF8F5] text-[#24211D] border border-[#D5CEC0] rounded-lg text-xs font-medium transition-colors shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Generate a Prompt</span>
            </button>
          </div>
        </div>
      ) : (
        <div id="entries-card-list" className="space-y-3.5">
          {sorted.map((entry) => {
            const moodMeta = MOODS.find((m) => m.type === entry.mood) || MOODS[0];
            const dateObj = new Date(entry.createdAt);
            const dateStr = dateObj.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
            const previewText = entry.content.replace(/^[#>*-\s]+/gm, '').trim();

            return (
              <article
                key={entry.id}
                id={`journal-card-${entry.id}`}
                onClick={() => onSelectEntry(entry)}
                className="group relative p-5 bg-white border border-[#E5E0D5] hover:border-[#C8C0B2] rounded-2xl transition-all shadow-2xs hover:shadow-xs cursor-pointer space-y-3"
              >
                {/* Card Top: Date, Mood & Star */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
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

                    <span className="text-xs text-[#8A8376] flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{dateStr}</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {/* Gemini badge if reflected */}
                    {entry.reflection && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
                        title="Contains Gemini Reflection"
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
                      className={`p-1.5 rounded-lg hover:bg-[#F2ECE1] transition-colors ${
                        entry.isFavorite ? 'text-amber-500' : 'text-[#A0998E]'
                      }`}
                      title={entry.isFavorite ? 'Unstar' : 'Star'}
                    >
                      <Star className={`w-4 h-4 ${entry.isFavorite ? 'fill-amber-500' : ''}`} />
                    </button>

                    {/* Delete Button */}
                    <button
                      id={`delete-btn-${entry.id}`}
                      type="button"
                      onClick={() => {
                        if (confirm('Delete this journal entry?')) {
                          onDeleteEntry(entry.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-[#A0998E] hover:text-red-700 hover:bg-red-50 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-editorial font-semibold text-[#1F1C18] group-hover:text-[#383126] transition-colors leading-snug">
                  {entry.title || 'Untitled Reflection'}
                </h3>

                {/* Excerpt */}
                <p className="text-xs sm:text-sm font-editorial text-[15px] leading-relaxed text-[#595246] line-clamp-2">
                  {previewText || 'Empty entry...'}
                </p>

                {/* Card Footer: Tags & Word count */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F2EDE4] text-xs text-[#888073]">
                  <div className="flex flex-wrap items-center gap-1">
                    {entry.tags?.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md bg-[#F4EFE6] text-[#5C5346] text-[11px]"
                      >
                        #{tag}
                      </span>
                    ))}
                    {(entry.tags?.length || 0) > 4 && (
                      <span className="text-[11px] text-[#A0998E]">
                        +{(entry.tags?.length || 0) - 4} more
                      </span>
                    )}
                  </div>

                  <span className="text-[11px]">
                    {entry.wordCount || 0} words
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
