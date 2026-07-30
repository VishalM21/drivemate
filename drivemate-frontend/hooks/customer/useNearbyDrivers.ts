import { useQuery } from '@tanstack/react-query';

import { fetchNearbyDrivers } from '@/services/customer/discoveryService';
import type { NearbyDriversResponse, ServiceType } from '@/types';

interface UseNearbyDriversParams {
  latitude: number | null;
  longitude: number | null;
  radiusKm?: number;
  serviceType: ServiceType;
  enabled?: boolean;
  dropLatitude?: number | null;
  dropLongitude?: number | null;
}

export function useNearbyDrivers({
  latitude,
  longitude,
  radiusKm = 10,
  serviceType,
  enabled = true,
  dropLatitude,
  dropLongitude,
}: UseNearbyDriversParams) {
  return useQuery<NearbyDriversResponse>({
    queryKey: ['nearbyDrivers', latitude, longitude, serviceType, radiusKm, dropLatitude, dropLongitude],
    queryFn: () =>
      fetchNearbyDrivers({
        latitude: latitude!,
        longitude: longitude!,
        radiusKm,
        serviceType,
        dropLatitude: dropLatitude ?? undefined,
        dropLongitude: dropLongitude ?? undefined,
      }),
    enabled: enabled && latitude !== null && longitude !== null,
    staleTime: 10000, // 10 seconds fresh time
  });
}
