import { useQuery } from '@tanstack/react-query';

import { fetchNearbyDrivers } from '@/services/customer/discoveryService';
import type { NearbyDriversResponse, ServiceType } from '@/types';

interface UseNearbyDriversParams {
  latitude: number | null;
  longitude: number | null;
  radiusKm?: number;
  serviceType: ServiceType;
  enabled?: boolean;
}

export function useNearbyDrivers({
  latitude,
  longitude,
  radiusKm = 10,
  serviceType,
  enabled = true,
}: UseNearbyDriversParams) {
  return useQuery<NearbyDriversResponse>({
    queryKey: ['nearbyDrivers', latitude, longitude, serviceType, radiusKm],
    queryFn: () =>
      fetchNearbyDrivers({
        latitude: latitude!,
        longitude: longitude!,
        radiusKm,
        serviceType,
      }),
    enabled: enabled && latitude !== null && longitude !== null,
    staleTime: 10000, // 10 seconds fresh time
  });
}
