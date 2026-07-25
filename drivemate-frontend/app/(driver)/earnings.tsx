import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/common';
import { fetchDriverEarnings } from '@/services/driver/earningsService';
import { formatMoney } from '@/utils/currency';
import type { DriverEarnings } from '@/types';

export default function DriverEarningsScreen() {
  const { data: earnings, isLoading, error, refetch } = useQuery<DriverEarnings>({
    queryKey: ['driverEarningsDetails'],
    queryFn: fetchDriverEarnings,
  });

  return (
    <ScreenContainer className="px-0 bg-gray-50 dark:bg-[#0B0C10]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2C2E3E] bg-white dark:bg-[#161823] shadow-sm">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
        >
          <Ionicons name="arrow-back" size={20} color="#12805C" />
        </Pressable>
        <Text className="text-lg font-bold text-textPrimary dark:text-[#F3F4F6]">Earnings Analysis</Text>
        <Pressable
          onPress={() => refetch()}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
        >
          <Ionicons name="refresh" size={18} color="#12805C" />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center bg-gray-50 dark:bg-[#0B0C10]">
          <ActivityIndicator size="large" color="#12805C" />
          <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">Loading earnings breakdown...</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6 gap-3 bg-gray-50 dark:bg-[#0B0C10]">
          <Ionicons name="alert-circle" size={40} color="#DC2626" />
          <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6]">Could not fetch earnings</Text>
          <Pressable
            onPress={() => refetch()}
            className="px-5 py-2.5 rounded-full bg-driver active:opacity-90"
          >
            <Text className="text-white text-xs font-bold">Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }} showsVerticalScrollIndicator={false} className="bg-gray-50 dark:bg-[#0B0C10]">
          <View className="gap-6 pb-10">
            {/* Primary Net payout highlight */}
            <View className="bg-emerald-950 dark:bg-[#062419] rounded-3xl p-6 items-center gap-1 shadow-md border border-emerald-800 dark:border-[#0F3D2A]">
              <Text className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Today's Earnings Payout</Text>
              <Text className="text-4xl font-black text-emerald-400">₹{formatMoney(earnings?.today)}</Text>
            </View>

            {/* Performance Grid Cards */}
            <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1">
              Performance Statistics
            </Text>
            <View className="flex-row flex-wrap gap-4">
              <View className="flex-1 min-w-[45%] bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-4 shadow-sm">
                <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Weekly Net Payout</Text>
                <Text className="text-xl font-black text-textPrimary dark:text-[#F3F4F6] mt-1">₹{formatMoney(earnings?.week)}</Text>
              </View>
              <View className="flex-1 min-w-[45%] bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-4 shadow-sm">
                <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Monthly Net Payout</Text>
                <Text className="text-xl font-black text-textPrimary dark:text-[#F3F4F6] mt-1">₹{formatMoney(earnings?.month)}</Text>
              </View>
              <View className="flex-1 min-w-[45%] bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-4 shadow-sm">
                <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Total completed Trips</Text>
                <Text className="text-xl font-black text-textPrimary dark:text-[#F3F4F6] mt-1">{earnings?.totalTrips ?? 0}</Text>
              </View>
              <View className="flex-1 min-w-[45%] bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-4 shadow-sm">
                <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Average Per Trip</Text>
                <Text className="text-xl font-black text-driver dark:text-[#10B981] mt-1">₹{formatMoney(earnings?.averagePerTrip)}</Text>
              </View>
            </View>

            {/* Additional info notice */}
            <View className="bg-emerald-50 dark:bg-[#11241C] rounded-2xl p-4 border border-emerald-100 dark:border-[#1E3D2F] flex-row gap-3">
              <Ionicons name="information-circle" size={20} color="#12805C" />
              <Text className="text-xs text-emerald-800 dark:text-[#10B981] flex-1 leading-4">
                Payout statistics are calculated based on bookings marked status 'completed' where payment has been marked 'paid' (cash or online). Platform fees are already deducted.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
