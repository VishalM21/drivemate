import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, DriverLocation, UpdateDriverLocationRequest } from '@/types';

export function updateDriverLocation(
  body: UpdateDriverLocationRequest,
): Promise<DriverLocation> {
  return unwrap(apiClient.post<ApiResponse<DriverLocation>>(ENDPOINTS.driversLocation, body));
}
