import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  InteractionManager,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { showAlert } from '@/utils/alert';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, ScreenContainer, TextField } from '@/components/common';
import { useAuthSession } from '@/hooks/common';
import { useAuthStore } from '@/store/authStore';
import { useDriverDashboard, useDriverBookingFlow } from '@/hooks/driver';
import { fetchCurrentUser } from '@/services/common/authService';
import { formatMoney } from '@/utils/currency';
import type { DriverProfile } from '@/types';

export default function DriverDashboard() {
  const { user, driverProfile, isRestoring } = useAuthSession();
  const setDriverProfile = useAuthStore((state) => state.setDriverProfile);

  const [isAvailable, setIsAvailable] = useState(driverProfile?.isAvailable ?? false);

  useEffect(() => {
    if (driverProfile) {
      setIsAvailable(driverProfile.isAvailable);
    }
  }, [driverProfile]);

  // `driverProfile.isAvailable` in the store is only ever set at session
  // restore or by this screen's own toggle mutation — it's never refreshed
  // after accept/complete/cancel, all of which can change is_available
  // server-side (busy-on-trip lock). Without this, the toggle shows whatever
  // it was before the trip started (stale "online") while the backend
  // correctly holds the driver offline/busy. Re-sync on every dashboard
  // mount — this is scoped to just the profile fetch, not the token-gated
  // session restore in useAuthSession, so it can't reintroduce the "complete
  // your profile" flash that guard was built to prevent.
  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchCurrentUser()
        .then((me) => {
          if (!cancelled && me.driverProfile) setDriverProfile(me.driverProfile);
        })
        .catch(() => {
          // Best-effort — keep whatever profile state we already have.
        });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [setDriverProfile]);

  // Dashboard state and mutations hook
  const {
    earnings,
    toggleAvailability,
  } = useDriverDashboard();

  // Booking history and active booking detection hook
  const {
    activeBooking,
    pendingCodBooking,
  } = useDriverBookingFlow({ isAvailable });

  // Redirect to correct screens based on trip lifecycle
  useEffect(() => {
    let redirectTimeout: any;
    if (activeBooking) {
      redirectTimeout = setTimeout(() => {
        if (activeBooking.status === 'pending' || activeBooking.status === 'driver_notified') {
          router.replace({
            pathname: '/(driver)/incoming-booking',
            params: { bookingId: activeBooking.id },
          });
        } else {
          router.replace({
            pathname: '/(driver)/ride-screen',
            params: { bookingId: activeBooking.id },
          });
        }
      }, 0);
    } else if (pendingCodBooking) {
      redirectTimeout = setTimeout(() => {
        router.replace({
          pathname: '/(driver)/booking-details',
          params: { bookingId: pendingCodBooking.id },
        });
      }, 0);
    }
    return () => {
      if (redirectTimeout) clearTimeout(redirectTimeout);
    };
  }, [activeBooking, pendingCodBooking]);

  // Location pinging now lives in the (driver) layout (useDriverLocationTracking)
  // so it keeps running across screens during an active trip, not just here.

  const handleToggleOnline = async (value: boolean) => {
    if (!driverProfile?.isVerified) {
      showAlert('Verification Required', 'Your account is pending verification by admin.');
      return;
    }
    try {
      await toggleAvailability({ isAvailable: value });
      setIsAvailable(value);
      showAlert(
        value ? 'You are Online' : 'You are Offline',
        value
          ? 'You will now receive booking requests in this area.'
          : 'You will no longer receive booking requests.'
      );
    } catch (err: any) {
      setIsAvailable(driverProfile?.isAvailable ?? false);
      showAlert('Status Toggle Failed', err.message || 'Could not change status.');
    }
  };

  // Session restore is in flight (e.g. right after boot or a token refresh)
  // — don't judge profile completeness off a store that hasn't settled yet.
  if (isRestoring) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-[#0B0C10]">
        <ActivityIndicator size="large" color="#12805C" />
      </View>
    );
  }

  // If driver doesn't have a profile yet, render the Creation Form
  if (!driverProfile) {
    return <FirstTimeProfileForm onSaved={(p) => setDriverProfile(p)} />;
  }

  return (
    <ScreenContainer className="px-0">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white dark:bg-[#161823] border-b border-gray-100 dark:border-[#2C2E3E] shadow-sm">
        <Pressable
          onPress={() => router.push('/(driver)/profile')}
          className="flex-row items-center gap-3 active:opacity-75"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-driver/10 border border-driver/20">
            <Ionicons name="person" size={20} color="#12805C" />
          </View>
          <View>
            <Text className="text-[10px] text-gray-400 dark:text-gray-500">Driver Partner</Text>
            <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]" numberOfLines={1}>
              {user?.fullName || user?.phone || 'Driver'}
            </Text>
          </View>
        </Pressable>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push('/(driver)/history')}
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
          >
            <Ionicons name="time-outline" size={20} color="#12805C" />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(driver)/settings')}
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
          >
            <Ionicons name="settings-outline" size={20} color="#12805C" />
          </Pressable>
        </View>
      </View>

      <View className="flex-1 bg-gray-50 dark:bg-[#0B0C10]">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }} showsVerticalScrollIndicator={false}>
          {/* Verification Status Warning / Banner */}
          {!driverProfile.isVerified ? (
            <View className="bg-amber-50 dark:bg-[#2A1E10] border border-amber-200 dark:border-[#5E3E1A] rounded-3xl p-4 mb-6 flex-row gap-3">
              <Ionicons name="warning" size={24} color="#D97706" />
              <View className="flex-1">
                <Text className="text-sm font-bold text-amber-800 dark:text-[#FBBF24]">Verification Pending</Text>
                <Text className="text-xs text-amber-700 dark:text-[#F59E0B] mt-1">
                  Your driving license is being verified. Once approved, you can start toggling availability to accept ride bookings.
                </Text>
              </View>
            </View>
          ) : (
            /* Online / Offline Switch card */
            <Animated.View
              entering={FadeInDown.duration(400)}
              className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-5 mb-6 flex-row justify-between items-center shadow-sm"
            >
              <View className="flex-row items-center gap-3">
                <View
                  className={`h-3.5 w-3.5 rounded-full ${
                    isAvailable ? 'bg-green-500 shadow shadow-green-500' : 'bg-gray-300'
                  }`}
                />
                <View>
                  <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6]">
                    {isAvailable ? 'Online & Available' : 'Offline'}
                  </Text>
                  <Text className="text-xs text-gray-400 dark:text-gray-500">
                    {isAvailable ? 'Ready for ride offers' : 'Offline - no bookings'}
                  </Text>
                </View>
              </View>
              <Switch
                value={isAvailable}
                onValueChange={handleToggleOnline}
                trackColor={{ false: '#D1D5DB', true: '#12805C' }}
                thumbColor="#FFFFFF"
              />
            </Animated.View>
          )}

          {/* Today's Earnings Summary Card */}
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1 mb-3">
            Overview
          </Text>
          <Animated.View
            entering={FadeInDown.delay(80).duration(400)}
            className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-6 shadow-sm gap-4 mb-6"
          >
            <View className="items-center">
              <Text className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase">Today's Total Earnings</Text>
              <Text className="text-4xl font-black text-driver dark:text-[#10B981] mt-1.5">₹{formatMoney(earnings?.today)}</Text>
            </View>
            <View className="h-px bg-gray-100 dark:bg-[#2C2E3E] w-full" />
            <View className="flex-row justify-between">
              <View className="items-center flex-1">
                <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Weekly Share</Text>
                <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6] mt-0.5">₹{formatMoney(earnings?.week)}</Text>
              </View>
              <View className="h-8 w-px bg-gray-100 dark:bg-[#2C2E3E]" />
              <View className="items-center flex-1">
                <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Monthly Share</Text>
                <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6] mt-0.5">₹{formatMoney(earnings?.month)}</Text>
              </View>
            </View>
          </Animated.View>

          {/* Action Options */}
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1 mb-3">
            Account Tools
          </Text>
          <Animated.View
            entering={FadeInDown.delay(160).duration(400)}
            className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl shadow-sm overflow-hidden"
          >
            <Pressable
              onPress={() => router.push('/(driver)/earnings')}
              className="flex-row justify-between items-center p-4 border-b border-gray-50 dark:border-[#2C2E3E] active:bg-gray-50 dark:active:bg-[#1E2030]"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-[#1E302A]">
                  <Ionicons name="cash" size={18} color="#12805C" />
                </View>
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Earnings Analysis</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(driver)/profile')}
              className="flex-row justify-between items-center p-4 border-b border-gray-50 dark:border-[#2C2E3E] active:bg-gray-50 dark:active:bg-[#1E2030]"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-[#1E302A]">
                  <Ionicons name="card" size={18} color="#12805C" />
                </View>
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Edit License & Info</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(driver)/history')}
              className="flex-row justify-between items-center p-4 active:bg-gray-50 dark:active:bg-[#1E2030]"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-[#1E302A]">
                  <Ionicons name="time" size={18} color="#12805C" />
                </View>
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Ride History Log</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

/* Local first time profile setup sub-component */
function FirstTimeProfileForm({ onSaved }: { onSaved: (profile: DriverProfile) => void }) {
  const [license, setLicense] = useState('');
  const [experience, setExperience] = useState('');
  const [price, setPrice] = useState('');
  const [email, setEmail] = useState('');
  const [languageList, setLanguageList] = useState('Hindi, English');

  const { updateProfile, isUpdatingProfile } = useDriverDashboard();

  const handleSave = async () => {
    if (!license.trim()) {
      showAlert('Error', 'Driving license number is required.');
      return;
    }
    const expYears = parseInt(experience, 10);
    if (isNaN(expYears) || expYears < 0) {
      showAlert('Error', 'Enter a valid number of years of experience.');
      return;
    }
    const basePrice = parseFloat(price);
    if (isNaN(basePrice) || basePrice <= 0) {
      showAlert('Error', 'Enter a valid base trip pricing.');
      return;
    }

    try {
      const data = await updateProfile({
        licenseNumber: license.trim().toUpperCase(),
        experienceYears: expYears,
        pricePerTrip: basePrice,
        email: email.trim() || undefined,
        languages: languageList.split(',').map((l) => l.trim()).filter(Boolean),
        serviceLocal: true,
        serviceOutstation: false,
        serviceAirport: true,
      });
      onSaved(data);
      showAlert('Profile Saved', 'Your driver profile details have been submitted for verification.');
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not save profile.');
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingVertical: 24 }} showsVerticalScrollIndicator={false}>
        <View className="gap-2 mb-6">
          <Text className="text-3xl font-bold text-textPrimary dark:text-[#F3F4F6]">Complete Driver Profile</Text>
          <Text className="text-sm text-textSecondary dark:text-gray-400">
            Register your driver details to start receiving trips.
          </Text>
        </View>

        <View className="gap-4 mb-6">
          <TextField
            label="Driving License Number"
            placeholder="e.g. MH1220130012345"
            autoCapitalize="characters"
            value={license}
            onChangeText={setLicense}
          />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                label="Experience (Years)"
                placeholder="e.g. 5"
                keyboardType="number-pad"
                value={experience}
                onChangeText={setExperience}
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Price Per Trip (₹)"
                placeholder="e.g. 400"
                keyboardType="decimal-pad"
                value={price}
                onChangeText={setPrice}
              />
            </View>
          </View>

          <TextField
            label="Email Address (Optional)"
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextField
            label="Languages (comma separated)"
            placeholder="e.g. Hindi, English, Marathi"
            value={languageList}
            onChangeText={setLanguageList}
          />
        </View>

        <Button
          label="Submit Profile for Verification"
          onPress={handleSave}
          isLoading={isUpdatingProfile}
        />
      </ScrollView>
    </ScreenContainer>
  );
}
