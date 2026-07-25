import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/common';
import { useAuthSession } from '@/hooks/common';
import { fetchCurrentUser } from '@/services/common/authService';

export default function CustomerProfileScreen() {
  const { user } = useAuthSession();

  // Fetch latest profile state from API
  const { data: profile, isLoading } = useQuery({
    queryKey: ['currentUserProfile'],
    queryFn: fetchCurrentUser,
    initialData: user ?? undefined,
  });

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <ScreenContainer className="px-0 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shadow-sm">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <Ionicons name="arrow-back" size={20} color="#111318" />
        </Pressable>
        <Text className="text-lg font-bold text-textPrimary">Your Profile</Text>
        <View className="w-10" />
      </View>

      <View className="p-6 items-center bg-white border-b border-gray-100 gap-3 shadow-sm">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-brand/10 border-2 border-brand/20">
          <Ionicons name="person" size={40} color="#0F62FE" />
        </View>
        <View className="items-center">
          <Text className="text-xl font-bold text-textPrimary">
            {profile?.fullName || 'DriveMate Member'}
          </Text>
          <Text className="text-xs text-gray-400 mt-1 capitalize">Role: {profile?.role}</Text>
        </View>
      </View>

      {/* Info items list */}
      <View className="p-6 gap-4">
        <Text className="text-xs font-bold text-textSecondary uppercase tracking-widest pl-1">
          Account Information
        </Text>

        <View className="bg-white rounded-3xl border border-gray-100 p-5 gap-4 shadow-sm">
          {/* Phone number */}
          <View className="flex-row items-center justify-between border-b border-gray-50 pb-3">
            <View className="flex-row items-center gap-3">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                <Ionicons name="call" size={16} color="#0F62FE" />
              </View>
              <View>
                <Text className="text-[10px] text-gray-400 font-bold uppercase">Mobile Number</Text>
                <Text className="text-sm font-semibold text-textPrimary mt-0.5">
                  {profile?.phone || 'N/A'}
                </Text>
              </View>
            </View>
            <View className="bg-green-100 rounded-full px-2 py-0.5">
              <Text className="text-[9px] font-black text-green-800 uppercase">Verified</Text>
            </View>
          </View>

          {/* Email address */}
          <View className="flex-row items-center gap-3 border-b border-gray-50 pb-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-50">
              <Ionicons name="mail" size={16} color="#0F62FE" />
            </View>
            <View>
              <Text className="text-[10px] text-gray-400 font-bold uppercase">Email Address</Text>
              <Text className="text-sm font-semibold text-textPrimary mt-0.5">
                {profile?.email || 'Not provided'}
              </Text>
            </View>
          </View>

          {/* Member since */}
          <View className="flex-row items-center gap-3 border-b border-gray-50 pb-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-50">
              <Ionicons name="calendar" size={16} color="#0F62FE" />
            </View>
            <View>
              <Text className="text-[10px] text-gray-400 font-bold uppercase">Registered Date</Text>
              <Text className="text-sm font-semibold text-textPrimary mt-0.5">
                {formatDate(profile?.createdAt)}
              </Text>
            </View>
          </View>

          {/* Ride OTP */}
          {profile?.rideOtp && (
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-50">
                  <Ionicons name="keypad" size={16} color="#0F62FE" />
                </View>
                <View>
                  <Text className="text-[10px] text-gray-400 font-bold uppercase">Start Ride OTP</Text>
                  <Text className="text-sm font-semibold text-textPrimary mt-0.5">
                    {profile.rideOtp}
                  </Text>
                </View>
              </View>
              <View className="bg-blue-50 rounded-full px-2 py-0.5 border border-blue-100">
                <Text className="text-[9px] font-bold text-blue-700 uppercase">Fixed Code</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}
