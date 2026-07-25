import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, ReviewsByDriverResponse } from '@/types';

export function fetchReviewsByDriver(driverId: string): Promise<ReviewsByDriverResponse> {
  return unwrap(
    apiClient.get<ApiResponse<ReviewsByDriverResponse>>(ENDPOINTS.reviewsByDriver, {
      params: { driverId },
    }),
  );
}
