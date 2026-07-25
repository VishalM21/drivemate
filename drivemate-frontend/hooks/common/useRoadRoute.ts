import { useQuery } from '@tanstack/react-query';

import { fetchRoadRoute } from '@/services/common/routingService';
import type { Coordinates } from '@/types';

// Round to ~11m precision so small GPS jitter (or a 15s location re-ping)
// doesn't trigger a fresh routing request every tick.
const round = (n: number) => Math.round(n * 10000) / 10000;

/** Real road-following route between two points, falling back to a straight
 * line (just the two endpoints) if the routing request fails or is loading. */
export function useRoadRoute(start: Coordinates | null | undefined, end: Coordinates | null | undefined) {
  const startKey = start ? `${round(start.latitude)},${round(start.longitude)}` : null;
  const endKey = end ? `${round(end.latitude)},${round(end.longitude)}` : null;

  const { data } = useQuery({
    queryKey: ['roadRoute', startKey, endKey],
    queryFn: () => fetchRoadRoute(start!, end!),
    enabled: !!start && !!end,
    staleTime: 20000,
    gcTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (data && data.length >= 2) return data;
  if (start && end) return [start, end];
  return [];
}
