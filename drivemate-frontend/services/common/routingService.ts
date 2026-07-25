import type { Coordinates } from '@/types';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

/** Fetches the actual road-following route between two points via OSRM's
 * public routing API. Returns null on any failure so callers can fall back
 * to a straight line instead of breaking the map. */
export async function fetchRoadRoute(
  start: Coordinates,
  end: Coordinates,
): Promise<Coordinates[] | null> {
  try {
    const url = `${OSRM_BASE_URL}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const coords = data?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;

    return coords.map(([longitude, latitude]: [number, number]) => ({ latitude, longitude }));
  } catch {
    return null;
  }
}
