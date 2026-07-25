import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type {
  ApiResponse,
  AuthMeResponse,
  CreateSessionRequest,
  LogoutResponse,
  SessionResponse,
} from '@/types';

export function createSession(body: CreateSessionRequest): Promise<SessionResponse> {
  return unwrap(apiClient.post<ApiResponse<SessionResponse>>(ENDPOINTS.authSession, body));
}

export function refreshSession(): Promise<SessionResponse> {
  return unwrap(apiClient.post<ApiResponse<SessionResponse>>(ENDPOINTS.authRefresh));
}

export function fetchCurrentUser(): Promise<AuthMeResponse> {
  return unwrap(apiClient.get<ApiResponse<AuthMeResponse>>(ENDPOINTS.authMe));
}

export function logout(): Promise<LogoutResponse> {
  return unwrap(apiClient.post<ApiResponse<LogoutResponse>>(ENDPOINTS.authLogout));
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  carName?: string;
  carRcName?: string;
}

export function updateUserProfile(body: UpdateProfileRequest): Promise<AuthMeResponse> {
  return unwrap(apiClient.post<ApiResponse<AuthMeResponse>>(ENDPOINTS.usersProfile, body));
}
