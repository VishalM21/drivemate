import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, NearbyDriversQuery, NearbyDriversResponse } from '@/types';

export function fetchNearbyDrivers(
  query: NearbyDriversQuery,
): Promise<NearbyDriversResponse> {
  return unwrap(
    apiClient.get<ApiResponse<NearbyDriversResponse>>(ENDPOINTS.driversNearby, {
      params: {
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        serviceType: query.serviceType,
        dropLatitude: query.dropLatitude,
        dropLongitude: query.dropLongitude,
      },
    }),
  );
}
