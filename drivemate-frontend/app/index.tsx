import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useAuthSession } from '@/hooks/common';
import { getRouteGroupForRole } from '@/navigation';

export default function SplashScreen() {
  const { isRestoring, isAuthenticated, user } = useAuthSession();

  useEffect(() => {
    if (isRestoring) return;

    if (isAuthenticated && user) {
      router.replace(getRouteGroupForRole(user.role));
    } else {
      router.replace('/(auth)/login');
    }
  }, [isRestoring, isAuthenticated, user]);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-white dark:bg-[#0B0C10]">
      <Text className="text-3xl font-extrabold text-brand">DriveMate</Text>
      <ActivityIndicator size="large" color="#0F62FE" />
    </View>
  );
}
