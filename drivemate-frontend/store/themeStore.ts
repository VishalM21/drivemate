import { DevSettings } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { colorScheme } from 'nativewind';

import { STORAGE_KEYS } from '@/constants/storageKeys';
import { zustandMmkvStorage } from '@/utils/mmkv';

export type AppTheme = 'light' | 'dark';

interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

let hasBooted = false;

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Explicit and fixed — never follows the OS theme, so the app can't
      // "flicker" between light/dark as you navigate or as the system theme
      // changes underneath it.
      theme: 'light',
      setTheme: (theme) => {
        set({ theme });
        // colorScheme.set() flips every `dark:` class in the whole tree at
        // once, synchronously — including inside react-native-screens' own
        // nativewind-styled navigator wrapper. Calling it live (even
        // deferred a tick with InteractionManager) reliably tore that
        // wrapper's navigation context down mid-flight ("Couldn't find a
        // navigation context"). A full JS reload sidesteps it entirely:
        // colorScheme.set() then only ever runs once, at a clean boot,
        // never while a navigator is already mounted.
        DevSettings.reload();
      },
    }),
    {
      name: STORAGE_KEYS.themeStore,
      storage: createJSONStorage(() => zustandMmkvStorage),
      onRehydrateStorage: () => (state) => {
        // Runs once per boot (this module is only evaluated once) — safe to
        // apply directly here, this is exactly the "clean boot" case.
        if (state && !hasBooted) {
          hasBooted = true;
          colorScheme.set(state.theme);
        }
      },
    },
  ),
);
