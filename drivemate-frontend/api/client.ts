import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

import { env } from '@/config/env';
import { getFirebaseIdToken } from '@/firebase/auth';
import { useAuthStore } from '@/store/authStore';
import type { ApiErrorPayload, ApiResponse, SessionResponse } from '@/types';

import { ENDPOINTS } from './endpoints';

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(payload: ApiErrorPayload, status: number | null) {
    super(payload.message);
    this.name = 'ApiRequestError';
    this.code = payload.code;
    this.status = status;
  }
}

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retried?: boolean };

export const apiClient: AxiosInstance = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  config.headers.set('Bypass-Tunnel-Reminder', 'true');
  return config;
});

// The backend's /auth-refresh re-signs a token from an ALREADY-VALID bearer
// token — it cannot revive an expired one. So on 401 we fall back to Firebase,
// which keeps its own session alive independently, and re-run /auth-session.
let inFlightReauth: Promise<string | null> | null = null;

async function reauthenticate(): Promise<string | null> {
  const role = useAuthStore.getState().user?.role;
  if (!role) return null;

  const firebaseIdToken = await getFirebaseIdToken(true);
  if (!firebaseIdToken) return null;

  const response = await axios.post<ApiResponse<SessionResponse>>(
    `${env.apiBaseUrl}/${ENDPOINTS.authSession}`,
    { firebaseIdToken, role },
    { headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' } },
  );

  if (!response.data.success) return null;

  useAuthStore.getState().setSession(response.data.data);
  return response.data.data.accessToken;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    const status = error.response?.status ?? null;
    const payload = error.response?.data;

    if (status === 401 && originalRequest && !originalRequest._retried) {
      originalRequest._retried = true;
      inFlightReauth ??= reauthenticate().finally(() => {
        inFlightReauth = null;
      });
      const newToken = await inFlightReauth;
      if (newToken) {
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        return apiClient.request(originalRequest);
      }
      useAuthStore.getState().clearSession();
    }

    const apiData = payload as any;
    if (apiData && apiData.success === false && apiData.error) {
      return Promise.reject(new ApiRequestError(apiData.error, status));
    }
    const serverMessage = apiData && apiData.error && apiData.error.message
      ? String(apiData.error.message)
      : error.message;
    return Promise.reject(
      new ApiRequestError({ code: 'NETWORK_ERROR', message: serverMessage }, status),
    );
  },
);

export async function unwrap<T>(
  request: Promise<{ data: ApiResponse<T> }>,
): Promise<T> {
  const { data } = await request;
  if (!data.success) {
    throw new ApiRequestError(data.error, null);
  }
  return data.data;
}
