import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';

import { ScreenContainer, ThemeToggle } from '@/components/common';
import { useAuthSession } from '@/hooks/common';

export default function DriverSettingsScreen() {
  const { logout, driverProfile } = useAuthSession();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [gpsEnabled, setGpsEnabled] = useState(true);

  const handleLogout = async () => {
    showAlert('Sign Out', 'Are you sure you want to sign out of your driver account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

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
        <Text className="text-lg font-bold text-textPrimary dark:text-[#F3F4F6]">Settings</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }} showsVerticalScrollIndicator={false}>
        {/* Appearance Group */}
        <View className="gap-2.5">
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1">
            Appearance
          </Text>
          <View className="bg-white dark:bg-[#161823] rounded-3xl border border-gray-100 dark:border-[#2C2E3E] shadow-sm p-3">
            <ThemeToggle />
          </View>
        </View>

        {/* Profile verification status */}
        <View className="gap-2.5">
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1">
            Status
          </Text>
          <View className="bg-white dark:bg-[#161823] rounded-3xl border border-gray-100 dark:border-[#2C2E3E] shadow-sm p-4 flex-row justify-between items-center">
            <View>
              <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Verification Status</Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Checked by administrator</Text>
            </View>
            <View className={`rounded-full px-3 py-1 border ${
              driverProfile?.isVerified
                ? 'bg-green-100 dark:bg-[#11241C] border-green-200 dark:border-[#1E3D2F]'
                : 'bg-amber-100 dark:bg-[#2A1E10] border-amber-200 dark:border-[#5E3E1A]'
            }`}>
              <Text className={`text-[10px] font-black uppercase ${
                driverProfile?.isVerified ? 'text-green-800 dark:text-[#34D399]' : 'text-amber-800 dark:text-[#FBBF24]'
              }`}>
                {driverProfile?.isVerified ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>

        {/* Profile management */}
        <View className="gap-2.5">
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1">
            Profile
          </Text>
          <View className="bg-white dark:bg-[#161823] rounded-3xl border border-gray-100 dark:border-[#2C2E3E] shadow-sm p-2">
            <Pressable
              onPress={() => router.push('/(driver)/profile')}
              className="flex-row justify-between items-center p-3 active:bg-gray-50 dark:active:bg-[#1E2030]"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="card" size={20} color="#12805C" />
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Edit License & Info</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>

        {/* System parameters switches */}
        <View className="gap-2.5">
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1">
            System Preferences
          </Text>
          <View className="bg-white dark:bg-[#161823] rounded-3xl border border-gray-100 dark:border-[#2C2E3E] shadow-sm p-2">
            <View className="flex-row justify-between items-center p-3 border-b border-gray-50 dark:border-[#2C2E3E]">
              <View className="flex-row items-center gap-3">
                <Ionicons name="notifications" size={20} color="#12805C" />
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Booking Notifications</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: '#D1D5DB', true: '#12805C' }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View className="flex-row justify-between items-center p-3">
              <View className="flex-row items-center gap-3">
                <Ionicons name="location" size={20} color="#12805C" />
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">GPS Location Sync</Text>
              </View>
              <Switch
                value={gpsEnabled}
                onValueChange={setGpsEnabled}
                trackColor={{ false: '#D1D5DB', true: '#12805C' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Legal & App Details Group */}
        <View className="gap-2.5">
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1">
            Driver Partner Program
          </Text>
          <View className="bg-white dark:bg-[#161823] rounded-3xl border border-gray-100 dark:border-[#2C2E3E] shadow-sm p-2">
            <Pressable
              onPress={() => showAlert('Agreement', 'Standard Driver Partner terms apply.')}
              className="flex-row justify-between items-center p-3 border-b border-gray-50 dark:border-[#2C2E3E] active:bg-gray-50 dark:active:bg-[#1E2030]"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="document-text" size={20} color="#12805C" />
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Partner Agreement</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
            <View className="flex-row justify-between items-center p-3">
              <View className="flex-row items-center gap-3">
                <Ionicons name="build" size={20} color="#12805C" />
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Driver Version</Text>
              </View>
              <Text className="text-xs font-bold text-gray-400 dark:text-gray-500">1.0.0 (Expo SDK 57)</Text>
            </View>
          </View>
        </View>

        {/* Sign out Button */}
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center justify-center gap-2 py-4 mt-2 bg-red-50 dark:bg-[#2A1414] border border-red-100 dark:border-[#4A1F1F] rounded-2xl active:bg-red-100 dark:active:bg-[#3A1A1A] shadow-sm"
        >
          <Ionicons name="log-out" size={20} color="#DC2626" />
          <Text className="text-sm font-bold text-red-600 dark:text-red-400">Sign Out Partner Portal</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
