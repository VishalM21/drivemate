import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, CreateReviewRequest, Review } from '@/types';

export function createReview(body: CreateReviewRequest): Promise<Review> {
  return unwrap(apiClient.post<ApiResponse<Review>>(ENDPOINTS.reviewsCreate, body));
}
