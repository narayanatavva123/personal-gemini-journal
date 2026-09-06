import { getGoogleMapsApiKey } from './secretManager.ts';

export interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  name: string;
  formattedAddress: string;
  accuracy?: number;
  capturedAt: string;
  source: 'google-maps-geocoding' | 'coordinates-fallback';
}

/**
 * Format coordinates into an elegant human-readable representation
 */
function formatCoordinateString(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lngStr}`;
}

/**
 * Reverse geocodes coordinates via Google Maps Geocoding REST API with
 * fallback to coordinate labeling if API key is not yet provisioned.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  accuracy?: number
): Promise<ReverseGeocodeResult> {
  // Validate coordinate boundaries
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Invalid coordinates: latitude must be between -90 and 90, longitude between -180 and 180.');
  }

  const capturedAt = new Date().toISOString();
  const fallbackCoords = formatCoordinateString(latitude, longitude);

  try {
    const mapsApiKey = await getGoogleMapsApiKey();

    if (mapsApiKey && mapsApiKey.trim() !== '') {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${latitude},${longitude}`);
      url.searchParams.set('key', mapsApiKey.trim());

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'gmp_mcp_codeassist_v1_aistudio personal-gemini-journal',
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
          const topResult = data.results[0];
          const formattedAddress = topResult.formatted_address || fallbackCoords;

          // Attempt to extract concise city / region name
          let locality = '';
          let adminArea = '';
          let country = '';

          for (const component of topResult.address_components || []) {
            const types: string[] = component.types || [];
            if (types.includes('locality') || types.includes('sublocality') || types.includes('postal_town')) {
              locality = component.long_name || component.short_name;
            } else if (types.includes('administrative_area_level_1')) {
              adminArea = component.short_name || component.long_name;
            } else if (types.includes('country')) {
              country = component.short_name || component.long_name;
            }
          }

          let friendlyName = locality;
          if (locality && adminArea) {
            friendlyName = `${locality}, ${adminArea}`;
          } else if (locality && country) {
            friendlyName = `${locality}, ${country}`;
          } else if (adminArea && country) {
            friendlyName = `${adminArea}, ${country}`;
          } else if (!friendlyName) {
            friendlyName = topResult.formatted_address.split(',')[0] || fallbackCoords;
          }

          return {
            latitude,
            longitude,
            name: friendlyName,
            formattedAddress,
            accuracy: typeof accuracy === 'number' ? accuracy : undefined,
            capturedAt,
            source: 'google-maps-geocoding',
          };
        }
      }
    }

    // Public reverse geocoding fallback (Nominatim OpenStreetMap) when Google Maps API key is not provisioned
    try {
      const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`;
      const osmRes = await fetch(osmUrl, {
        headers: {
          'User-Agent': 'gmp_mcp_codeassist_v1_aistudio personal-gemini-journal',
          'Accept': 'application/json',
        },
      });
      if (osmRes.ok) {
        const osmData = await osmRes.json();
        const addr = osmData.address || {};
        const locality =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.suburb ||
          addr.municipality ||
          addr.county;
        const region = addr.state || addr.country;

        let friendlyName = locality;
        if (locality && region && locality !== region) {
          friendlyName = `${locality}, ${region}`;
        } else if (locality) {
          friendlyName = locality;
        } else if (region) {
          friendlyName = region;
        } else if (osmData.name) {
          friendlyName = osmData.name;
        }

        if (friendlyName) {
          return {
            latitude,
            longitude,
            name: friendlyName,
            formattedAddress: osmData.display_name || fallbackCoords,
            accuracy: typeof accuracy === 'number' ? accuracy : undefined,
            capturedAt,
            source: 'google-maps-geocoding',
          };
        }
      }
    } catch (osmErr) {
      console.warn('Public geocoding fallback note:', osmErr);
    }
  } catch (err: any) {
    console.warn('Reverse geocoding encountered issue, falling back safely:', err?.message || err);
  }

  // Graceful fallback without failing user intent - provide a clean place name label
  return {
    latitude,
    longitude,
    name: 'Captured Location',
    formattedAddress: `Coordinates: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    accuracy: typeof accuracy === 'number' ? accuracy : undefined,
    capturedAt,
    source: 'coordinates-fallback',
  };
}
