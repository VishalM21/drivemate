import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type {
  ApiResponse,
  DriverProfile,
  SetAvailabilityRequest,
  UpsertDriverProfileRequest,
} from '@/types';

export function upsertDriverProfile(
  body: UpsertDriverProfileRequest,
): Promise<DriverProfile> {
  return unwrap(apiClient.patch<ApiResponse<DriverProfile>>(ENDPOINTS.driversProfile, body));
}

export function setDriverAvailability(
  body: SetAvailabilityRequest,
): Promise<DriverProfile> {
  return unwrap(
    apiClient.post<ApiResponse<DriverProfile>>(ENDPOINTS.driversAvailability, body),
  );
}
