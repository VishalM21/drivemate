import { useCallback, useEffect, useState } from 'react';

import { signOutFirebase } from '@/firebase/auth';
import { fetchCurrentUser, logout as logoutRequest } from '@/services/common/authService';
import { useAuthStore } from '@/store/authStore';
import type { AuthMeResponse } from '@/types';

// Module-level (not a per-component ref): this hook is called from many
// screens (splash, driver/customer index/profile/settings), each of which
// mounts and unmounts as the user navigates. Keying the "already restored"
// guard to a ref would re-run the /auth-me restore — and re-set
// `driverProfile` from its response — on every one of those remounts, e.g.
// right after `router.replace('/(driver)')` post-cash-collection, which is
// what caused the "complete your profile" form to reappear post-signup.
// Keying it to the token value instead means it fires once per login
// session (and again after a genuine re-auth issues a new token) but never
// merely because a screen remounted with the same session still active.
let restoredForToken: string | null = null;

/**
 * Restores a persisted session on app boot (validating the token against
 * /auth-me — api/client's interceptor transparently re-authenticates via
 * Firebase if it has expired), and exposes logout. Drive the Splash screen's
 * redirect off `isRestoring` / `isAuthenticated`.
 */
export function useAuthSession() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const driverProfile = useAuthStore((state) => state.driverProfile);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const setUser = useAuthStore((state) => state.setUser);
  const setDriverProfile = useAuthStore((state) => state.setDriverProfile);
  const clearSession = useAuthStore((state) => state.clearSession);

  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    if (!isHydrated) return;

    if (!accessToken) {
      restoredForToken = null;
      setIsRestoring(false);
      return;
    }

    if (restoredForToken === accessToken) {
      setIsRestoring(false);
      return;
    }
    restoredForToken = accessToken;

    let cancelled = false;

    (async () => {
      try {
        const me: AuthMeResponse = await fetchCurrentUser();
        if (cancelled) return;
        setUser(me);
        setDriverProfile(me.driverProfile ?? null);
      } catch (err: any) {
        if (!cancelled) {
          // Only tear down the session on a genuine auth failure — a plain
          // network blip on this restore shouldn't log an otherwise-valid
          // driver out and wipe their saved profile. (A 401 here means
          // api/client's own re-auth attempt already failed, and it clears
          // the session itself — this is a backstop for that case.)
          if (err?.status === 401) {
            restoredForToken = null;
            clearSession();
          }
        }
      } finally {
        if (!cancelled) setIsRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, accessToken, setUser, setDriverProfile, clearSession]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Best-effort server-side cleanup — the local session is cleared regardless.
    }
    clearSession();
    try {
      await signOutFirebase();
    } catch {
      // No active Firebase session to sign out of; safe to ignore.
    }
  }, [clearSession]);

  return {
    user,
    driverProfile,
    accessToken,
    isAuthenticated: Boolean(accessToken && user),
    isRestoring: !isHydrated || isRestoring,
    logout,
  };
}
