import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, SaveFcmTokenRequest, SaveFcmTokenResponse } from '@/types';

export function saveFcmToken(body: SaveFcmTokenRequest): Promise<SaveFcmTokenResponse> {
  return unwrap(
    apiClient.post<ApiResponse<SaveFcmTokenResponse>>(ENDPOINTS.usersFcmToken, body),
  );
}
