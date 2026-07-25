import { Stack } from 'expo-router';

import { useAuthStore } from '@/store/authStore';
import { useDriverLocationTracking } from '@/hooks/driver';

export default function DriverLayout() {
  const driverProfile = useAuthStore((state) => state.driverProfile);
  useDriverLocationTracking(!!driverProfile?.isAvailable && !!driverProfile?.isVerified);

  return <Stack screenOptions={{ headerShown: false }} />;
}
