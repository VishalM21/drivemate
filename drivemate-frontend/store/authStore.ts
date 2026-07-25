import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STORAGE_KEYS } from '@/constants/storageKeys';
import { zustandMmkvStorage } from '@/utils/mmkv';
import type { DriverProfile, SessionResponse, User, UserRole } from '@/types';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  driverProfile: DriverProfile | null;
  /** Role last used to sign in on this device — survives logout so a repeat
   *  login can skip role selection. The backend still enforces the real role. */
  lastRole: UserRole | null;
  isHydrated: boolean;
}

interface AuthActions {
  setSession: (session: SessionResponse) => void;
  setAccessToken: (accessToken: string) => void;
  setUser: (user: User) => void;
  setDriverProfile: (driverProfile: DriverProfile | null) => void;
  clearSession: () => void;
  setHydrated: (isHydrated: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      driverProfile: null,
      lastRole: null,
      isHydrated: false,

      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          user: session.user,
          lastRole: session.user.role,
        }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      setDriverProfile: (driverProfile) => set({ driverProfile }),
      clearSession: () =>
        set({ accessToken: null, user: null, driverProfile: null }),
      setHydrated: (isHydrated) => set({ isHydrated }),
    }),
    {
      name: STORAGE_KEYS.authStore,
      storage: createJSONStorage(() => zustandMmkvStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        driverProfile: state.driverProfile,
        lastRole: state.lastRole,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}

export function getUserRole(): UserRole | null {
  return useAuthStore.getState().user?.role ?? null;
}
