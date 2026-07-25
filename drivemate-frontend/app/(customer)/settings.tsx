import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { showAlert } from '@/utils/alert';

import { Button, ScreenContainer, TextField } from '@/components/common';
import { useAuthSession } from '@/hooks/common';
import { useAuthStore } from '@/store/authStore';
import { fetchCurrentUser, updateUserProfile } from '@/services/common/authService';
import { upsertDefaultVehicle } from '@/services/customer/vehicleService';
import type { Vehicle } from '@/types';

export default function CustomerSettingsScreen() {
  const { user, logout } = useAuthSession();
  const setUser = useAuthStore((state) => state.setUser);

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  const [defaultVehicle, setDefaultVehicle] = useState<Vehicle | null>(null);
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');

  // Profile/vehicle aren't part of the persisted session — fetch fresh on
  // mount so this screen always reflects what's actually saved.
  useEffect(() => {
    let cancelled = false;
    // Deferred past the push transition into this screen — firing this
    // (and its setState on resolve) immediately on mount can race the
    // in-flight native-stack transition.
    const task = InteractionManager.runAfterInteractions(() => {
      fetchCurrentUser()
        .then((me) => {
          if (cancelled) return;
          setFullName(me.fullName ?? '');
          setEmail(me.email ?? '');
          if (me.defaultVehicle) {
            setDefaultVehicle(me.defaultVehicle);
            setVehicleNumber(me.defaultVehicle.vehicleNumber);
            setVehicleModel(me.defaultVehicle.vehicleModel ?? '');
          }
        })
        .catch(() => {
          // Best-effort — keep whatever local state we already have.
        });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  const profileMutation = useMutation({
    mutationFn: () => updateUserProfile({ fullName: fullName.trim(), email: email.trim() }),
    onSuccess: (data) => {
      setUser(data);
      showAlert('Profile Saved', 'Your name and email have been updated.');
    },
    onError: (err: any) => {
      showAlert('Error', err.message || 'Could not save profile.');
    },
  });

  const vehicleMutation = useMutation({
    mutationFn: () =>
      upsertDefaultVehicle({ vehicleNumber: vehicleNumber.trim(), vehicleModel: vehicleModel.trim() || undefined }),
    onSuccess: (data) => {
      setDefaultVehicle(data);
      showAlert('Vehicle Saved', 'This is now your default car for bookings.');
    },
    onError: (err: any) => {
      showAlert('Error', err.message || 'Could not save vehicle.');
    },
  });

  const handleLogout = async () => {
    showAlert('Sign Out', 'Are you sure you want to sign out of your account?', [
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
    <ScreenContainer className="px-0 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shadow-sm">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <Ionicons name="arrow-back" size={20} color="#111318" />
        </Pressable>
        <Text className="text-lg font-bold text-textPrimary">Settings</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Profile Group */}
        <View className="gap-2.5">
          <Text className="text-xs font-bold text-textSecondary uppercase tracking-widest pl-1">
            Profile
          </Text>
          <View className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 gap-4">
            <TextField label="Full Name" placeholder="Your name" value={fullName} onChangeText={setFullName} />
            <TextField
              label="Email Address"
              placeholder="name@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
            <Button label="Save Profile" onPress={() => profileMutation.mutate()} isLoading={profileMutation.isPending} />
          </View>
        </View>

        {/* Default Vehicle Group */}
        <View className="gap-2.5">
          <Text className="text-xs font-bold text-textSecondary uppercase tracking-widest pl-1">
            Default Vehicle
          </Text>
          <Text className="text-xs text-gray-400 pl-1 -mt-1.5">
            Used to pre-fill new bookings — you can still change it per-ride from the booking screen.
          </Text>
          <View className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 gap-4">
            <TextField
              label="Vehicle Number"
              placeholder="e.g. UP32AB1234"
              autoCapitalize="characters"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
            />
            <TextField
              label="Vehicle Name / Model"
              placeholder="e.g. Swift Dzire"
              value={vehicleModel}
              onChangeText={setVehicleModel}
            />
            <Button
              label={defaultVehicle ? 'Update Default Vehicle' : 'Save Default Vehicle'}
              onPress={() => vehicleMutation.mutate()}
              isLoading={vehicleMutation.isPending}
            />
          </View>
        </View>

        {/* Notifications Group */}
        <View className="gap-2.5">
          <Text className="text-xs font-bold text-textSecondary uppercase tracking-widest pl-1">
            Notifications
          </Text>
          <View className="bg-white rounded-3xl border border-gray-100 shadow-sm p-2">
            <View className="flex-row justify-between items-center p-3 border-b border-gray-50">
              <View className="flex-row items-center gap-3">
                <Ionicons name="notifications" size={20} color="#0F62FE" />
                <Text className="text-sm font-semibold text-textPrimary">Push Notifications</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: '#D1D5DB', true: '#0F62FE' }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View className="flex-row justify-between items-center p-3">
              <View className="flex-row items-center gap-3">
                <Ionicons name="mail" size={20} color="#0F62FE" />
                <Text className="text-sm font-semibold text-textPrimary">Email Alerts</Text>
              </View>
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{ false: '#D1D5DB', true: '#0F62FE' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Legal & App Details Group */}
        <View className="gap-2.5">
          <Text className="text-xs font-bold text-textSecondary uppercase tracking-widest pl-1">
            About App
          </Text>
          <View className="bg-white rounded-3xl border border-gray-100 shadow-sm p-2">
            <Pressable
              onPress={() => showAlert('Terms of Service', 'Standard DriveMate terms apply.')}
              className="flex-row justify-between items-center p-3 border-b border-gray-50 active:bg-gray-50"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="document-text" size={20} color="#0F62FE" />
                <Text className="text-sm font-semibold text-textPrimary">Terms of Service</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
            <Pressable
              onPress={() => showAlert('Privacy Policy', 'Standard DriveMate privacy policies apply.')}
              className="flex-row justify-between items-center p-3 border-b border-gray-50 active:bg-gray-50"
            >
              <View className="flex-row items-center gap-3">
                <Ionicons name="shield-checkmark" size={20} color="#0F62FE" />
                <Text className="text-sm font-semibold text-textPrimary">Privacy Policy</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
            <View className="flex-row justify-between items-center p-3">
              <View className="flex-row items-center gap-3">
                <Ionicons name="phone-portrait" size={20} color="#0F62FE" />
                <Text className="text-sm font-semibold text-textPrimary">App Version</Text>
              </View>
              <Text className="text-xs font-bold text-gray-400">1.0.0 (Expo SDK 57)</Text>
            </View>
          </View>
        </View>

        {/* Sign out Button */}
        <Pressable
          onPress={handleLogout}
          className="flex-row items-center justify-center gap-2 py-4 mt-2 bg-red-50 border border-red-100 rounded-2xl active:bg-red-100 shadow-sm"
        >
          <Ionicons name="log-out" size={20} color="#DC2626" />
          <Text className="text-sm font-bold text-red-600">Sign Out of Account</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
