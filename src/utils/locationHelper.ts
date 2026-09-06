import type { EntryLocation } from '../types.ts';

// In-memory cache for resolved coordinate strings
const geocodeCache = new Map<string, string>();

/**
 * Check if a location name is just raw coordinates (e.g., "16.84° N, 81.52° E")
 */
export function isRawCoordinateString(name?: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed === 'Captured Location' || trimmed === 'Current Location') return false;
  // Matches patterns like "16.84° N, 81.52° E" or "16.84, 81.52" or "Coordinates: ..."
  return /\d+(\.\d+)?°\s*[NSEW]/i.test(trimmed) || /^coordinates:\s*[\d.-]+/i.test(trimmed);
}

/**
 * Get displayable place name without showing raw coordinates as primary text
 */
export function getDisplayPlaceName(location?: EntryLocation | null): string {
  if (!location) return '';
  const key = `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key)!;
  }

  if (location.name && !isRawCoordinateString(location.name)) {
    return location.name;
  }

  if (location.formattedAddress && !isRawCoordinateString(location.formattedAddress)) {
    const firstPart = location.formattedAddress.split(',')[0]?.trim();
    if (firstPart && !isRawCoordinateString(firstPart)) {
      return firstPart;
    }
  }

  return 'Captured Location';
}

/**
 * Asynchronously resolve raw coordinates to place names and cache them
 */
export async function resolveLocationAsync(
  location: EntryLocation,
  onResolved?: (resolvedName: string) => void
): Promise<string> {
  const key = `${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}`;
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key)!;
  }

  if (location.name && !isRawCoordinateString(location.name)) {
    geocodeCache.set(key, location.name);
    return location.name;
  }

  try {
    const res = await fetch('/api/location/reverse-geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.name && !isRawCoordinateString(data.name)) {
        geocodeCache.set(key, data.name);
        if (onResolved) onResolved(data.name);
        return data.name;
      }
    }
  } catch (err) {
    console.debug('Async location resolution note:', err);
  }

  const fallback = 'Captured Location';
  geocodeCache.set(key, fallback);
  return fallback;
}
