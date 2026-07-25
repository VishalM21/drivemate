import { env } from '@/config/env';

export interface PlaceSuggestion {
  id: string;
  name: string;
  description: string;
  source: 'google' | 'photon';
  // Only present for photon results — already geocoded. Google results need
  // a follow-up fetchPlaceDetails() call once the user actually picks one.
  latitude?: number;
  longitude?: number;
}

const GOOGLE_KEY = env.googleMapsApiKeyAndroid;

/** Google Places API (New) autocomplete — best-in-class India business/POI
 * coverage, matching what Uber's own search uses. Requires "Places API
 * (New)" enabled + billing on the Google Cloud project for this key; until
 * then every call 403s and callers should fall back to fetchPhotonSuggestions. */
async function fetchGoogleSuggestions(
  query: string,
  bias?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  if (!GOOGLE_KEY) return [];

  const body: Record<string, unknown> = {
    input: query,
    regionCode: 'IN',
    languageCode: 'en',
  };
  if (bias) {
    body.locationBias = {
      circle: {
        center: { latitude: bias.latitude, longitude: bias.longitude },
        radius: 50000.0,
      },
    };
  }

  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data?.error?.message || `Places autocomplete failed (${res.status})`);
  }

  const suggestions = data.suggestions ?? [];
  return suggestions
    .filter((s: any) => s.placePrediction)
    .map((s: any) => {
      const p = s.placePrediction;
      return {
        id: p.placeId,
        name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? '',
        description: p.text?.text ?? '',
        source: 'google' as const,
      };
    });
}

/** Resolves a Google place prediction's id to actual coordinates — a
 * separate call since autocomplete predictions don't include a location. */
export async function fetchGooglePlaceCoordinates(
  placeId: string,
): Promise<{ latitude: number; longitude: number } | null> {
  if (!GOOGLE_KEY) return null;

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_KEY,
      'X-Goog-FieldMask': 'location',
    },
  });
  const data = await res.json();
  if (!res.ok || data.error || !data.location) return null;

  return { latitude: data.location.latitude, longitude: data.location.longitude };
}

/** Free OpenStreetMap-based fallback (Photon) — used automatically whenever
 * Google Places isn't available (not yet enabled, over quota, network
 * issue), so search never just breaks. */
async function fetchPhotonSuggestions(
  query: string,
  bias?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  const biasParams = bias ? `&lat=${bias.latitude}&lon=${bias.longitude}` : '';
  const res = await fetch(
    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5${biasParams}`,
    { headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`Photon search failed (${res.status})`);
  const data = await res.json();

  return (data.features || []).map((f: any) => {
    const [lon, lat] = f.geometry.coordinates;
    const name = f.properties.name || '';
    const city = f.properties.city || '';
    const state = f.properties.state || '';
    const country = f.properties.country || '';
    const description = [name, city, state, country].filter(Boolean).join(', ');
    return {
      id: String(f.properties.osm_id ?? Math.random()),
      name,
      description,
      source: 'photon' as const,
      latitude: lat,
      longitude: lon,
    };
  });
}

/** Place search with automatic Google -> free-OSM fallback. Google gives
 * Uber-level building/restaurant coverage once Places API is enabled on the
 * project; until then (or if it ever errors), this transparently falls back
 * to the free OSM-based search so results never just disappear. */
export async function searchPlaces(
  query: string,
  bias?: { latitude: number; longitude: number },
): Promise<PlaceSuggestion[]> {
  if (GOOGLE_KEY) {
    try {
      const results = await fetchGoogleSuggestions(query, bias);
      if (results.length > 0) return results;
    } catch (err) {
      console.log('Google Places unavailable, falling back to OSM search:', err);
    }
  }
  return fetchPhotonSuggestions(query, bias);
}
