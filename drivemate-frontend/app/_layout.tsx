import '../global.css';

import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProviders } from '@/providers';
import { usePushNotifications } from '@/hooks/common';
import { AppAlert } from '@/components/common';

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

