import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { showAlert } from '@/utils/alert';

import { Button, ScreenContainer, TextField } from '@/components/common';
import { useAuthSession } from '@/hooks/common';
import { useDriverDashboard } from '@/hooks/driver';

export default function DriverProfileScreen() {
  const { driverProfile } = useAuthSession();

  // Form states initialized with existing profile values
  const [license, setLicense] = useState(driverProfile?.licenseNumber ?? '');
  const [experience, setExperience] = useState(String(driverProfile?.experienceYears ?? ''));
  const [email, setEmail] = useState(driverProfile?.email ?? '');
  const [languages, setLanguages] = useState(driverProfile?.languages.join(', ') ?? 'Hindi, English');

  // Service toggles
  const [serviceLocal, setServiceLocal] = useState(driverProfile?.serviceLocal ?? true);
  const [serviceOutstation, setServiceOutstation] = useState(driverProfile?.serviceOutstation ?? false);
  const [serviceAirport, setServiceAirport] = useState(driverProfile?.serviceAirport ?? false);
  const [serviceMonthly, setServiceMonthly] = useState(driverProfile?.serviceMonthly ?? false);
  const [serviceNight, setServiceNight] = useState(driverProfile?.serviceNight ?? false);

  // Integrated Profile update hook
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
    try {
      await updateProfile({
        licenseNumber: license.trim().toUpperCase(),
        experienceYears: expYears,
        email: email.trim() || undefined,
        languages: languages.split(',').map((l) => l.trim()).filter(Boolean),
        serviceLocal,
        serviceOutstation,
        serviceAirport,
        serviceMonthly,
        serviceNight,
      });
      showAlert('Profile Updated', 'Your profile details have been saved successfully.');
      router.back();
    } catch (err: any) {
      showAlert('Error', err.message || 'Could not update profile.');
    }
  };

  return (
    <ScreenContainer className="px-0">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200"
        >
          <Ionicons name="arrow-back" size={20} color="#111318" />
        </Pressable>
        <Text className="text-lg font-bold text-textPrimary">Edit Profile</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }} showsVerticalScrollIndicator={false}>
        <View className="gap-5 mb-8">
          <TextField
            label="Driving License Number"
            placeholder="e.g. MH1220130012345"
            autoCapitalize="characters"
            value={license}
            onChangeText={setLicense}
          />

          <TextField
            label="Experience (Years)"
            placeholder="e.g. 5"
            keyboardType="number-pad"
            value={experience}
            onChangeText={setExperience}
          />

          <TextField
            label="Email Address"
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <TextField
            label="Languages (comma separated)"
            placeholder="e.g. Hindi, English"
            value={languages}
            onChangeText={setLanguages}
          />

          {/* Service coverage checkboxes */}
          <Text className="text-sm font-semibold text-textSecondary mt-2">Trip Coverage Offerings</Text>

          <View className="gap-3">
            {[
              { label: 'Local City Trips', val: serviceLocal, set: setServiceLocal },
              { label: 'Outstation Travel', val: serviceOutstation, set: setServiceOutstation },
              { label: 'Airport Pick / Drop', val: serviceAirport, set: setServiceAirport },
              { label: 'Monthly Driving Pack', val: serviceMonthly, set: setServiceMonthly },
              { label: 'Late Night Driving', val: serviceNight, set: setServiceNight },
            ].map((srv, idx) => (
              <View key={idx} className="flex-row justify-between items-center bg-gray-50 border border-gray-100 rounded-xl p-3">
                <Text className="text-sm font-medium text-textPrimary">{srv.label}</Text>
                <Switch
                  value={srv.val}
                  onValueChange={srv.set}
                  trackColor={{ false: '#D1D5DB', true: '#12805C' }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ))}
          </View>
        </View>

        <Button
          label="Save Profile Changes"
          onPress={handleSave}
          isLoading={isUpdatingProfile}
        />
      </ScrollView>
    </ScreenContainer>
  );
}
