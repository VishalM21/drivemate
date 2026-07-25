export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  driverId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface CreateReviewRequest {
  bookingId: string;
  rating: number;
  comment?: string;
}

export interface ReviewsByDriverResponse {
  driverId: string;
  rating: number;
  count: number;
  reviews: Review[];
}
