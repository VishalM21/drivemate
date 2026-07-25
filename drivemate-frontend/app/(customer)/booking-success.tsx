import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, ScreenContainer } from '@/components/common';

export default function BookingSuccessScreen() {
  const { bookingId, bookingNumber } = useLocalSearchParams<{
    bookingId: string;
    bookingNumber: string;
  }>();

  const handleTrackRide = () => {
    router.replace({
      pathname: '/(customer)/ride-tracking',
      params: { bookingId },
    });
  };

  const handleGoHome = () => {
    router.replace('/(customer)');
  };

  return (
    <ScreenContainer className="px-6 justify-center items-center gap-8 bg-white dark:bg-[#0B0C10]">
      {/* M3 Checkmark Banner */}
      <View className="h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-[#1E302A] border-4 border-emerald-100 dark:border-[#1E3D30] shadow-lg">
        <Ionicons name="checkmark" size={40} color="#12805C" />
      </View>

      <View className="items-center gap-2">
        <Text className="text-2xl font-black text-textPrimary dark:text-[#F3F4F6] text-center">Booking Success!</Text>
        <Text className="text-xs font-bold text-brand uppercase tracking-widest mt-1">
          Trip ID: {bookingNumber}
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center px-4 mt-2">
          Your driver has been notified of your booking request. You can now track your ride status in real time.
        </Text>
      </View>

      <View className="w-full gap-3 mt-4">
        <Button label="Track Driver Live" onPress={handleTrackRide} />
        <Button label="Return to Home" variant="secondary" onPress={handleGoHome} />
      </View>
    </ScreenContainer>
  );
}
