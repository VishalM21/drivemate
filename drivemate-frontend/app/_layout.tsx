import '../global.css';

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/providers';
import { usePushNotifications } from '@/hooks/common';
import { AppAlert } from '@/components/common';
// Importing this here (not just where ThemeToggle is used) is what makes it
// rehydrate — and re-apply nativewind's explicit colorScheme — at app boot,
// not only once the user happens to open Settings.
import '@/store/themeStore';

function AppContent() {
  usePushNotifications();
  return (
    <>
      <Slot />
      <AppAlert />
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="auto" />
      <AppContent />
    </AppProviders>
  );
}

