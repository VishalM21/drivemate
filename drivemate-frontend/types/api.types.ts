export interface ApiErrorPayload {
  code: string;
  message: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  error: null;
}

export interface ApiFailureResponse {
  success: false;
  data: null;
  error: ApiErrorPayload;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;
