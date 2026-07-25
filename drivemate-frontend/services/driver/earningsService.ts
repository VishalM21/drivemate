import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, DriverEarnings } from '@/types';

export function fetchDriverEarnings(): Promise<DriverEarnings> {
  return unwrap(apiClient.get<ApiResponse<DriverEarnings>>(ENDPOINTS.driversEarnings));
}
