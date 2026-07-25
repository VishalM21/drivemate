import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  InteractionManager,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { showAlert } from '@/utils/alert';

import { Button, ScreenContainer, TextField } from '@/components/common';
import { useLocationStore } from '@/store/locationStore';
import { useCustomerBooking } from '@/hooks/customer';
import { fetchCurrentUser } from '@/services/common/authService';
import type { ServiceType, Vehicle } from '@/types';

export default function BookingScreen() {
  const { driverId, driverName, pricePerTrip, dropAddress, dropLatitude, dropLongitude, serviceType } = useLocalSearchParams<{
    driverId: string;
    driverName: string;
    pricePerTrip: string;
    dropAddress: string;
    dropLatitude: string;
    dropLongitude: string;
    serviceType: ServiceType;
  }>();

  const { currentDeviceCoords } = useLocationStore();

  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [defaultVehicle, setDefaultVehicle] = useState<Vehicle | null>(null);
  // true once the customer taps "Edit" to override their saved default just
  // for this ride — keeps handleConfirmBooking from silently overwriting it.
  const [overrideForThisRide, setOverrideForThisRide] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Defer until the push transition into this screen has fully settled —
    // firing the fetch (and its setState on resolve) immediately on mount
    // races the in-flight native-stack transition and was crashing the
    // screen with a "navigation context" error.
    const task = InteractionManager.runAfterInteractions(() => {
      fetchCurrentUser()
        .then((me) => {
          if (cancelled || !me.defaultVehicle) return;
          setDefaultVehicle(me.defaultVehicle);
          setVehicleNumber(me.defaultVehicle.vehicleNumber);
          setVehicleModel(me.defaultVehicle.vehicleModel ?? '');
        })
        .catch(() => {
          // No saved vehicle yet (or fetch failed) — fields just start empty,
          // same as before this feature existed.
        });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  const { createBooking, isCreatingBooking } = useCustomerBooking();

  // Fare calculations matching backend services
  const baseTripFare = parseFloat(pricePerTrip || '0');
  const platformFee = 50; // flat rate platform convenience fee
  const taxRate = 0.18; // 18% GST tax
  const taxAmount = Math.round((baseTripFare + platformFee) * taxRate * 100) / 100;
  const totalAmount = baseTripFare + platformFee + taxAmount;

  const handleConfirmBooking = async () => {
    if (!currentDeviceCoords) {
      showAlert('Error', 'Please wait for your pickup location coordinates to load.');
      return;
    }
    if (!vehicleNumber.trim()) {
      showAlert('Error', 'Please enter your vehicle license number.');
      return;
    }

    try {
      const data = await createBooking({
        driverId: driverId!,
        serviceType: serviceType || 'local',
        pickupLatitude: currentDeviceCoords.latitude,
        pickupLongitude: currentDeviceCoords.longitude,
        pickupAddress: 'Current Location',
        dropAddress: dropAddress || 'Destination Address',
        dropLatitude: dropLatitude ? parseFloat(dropLatitude) : currentDeviceCoords.latitude + 0.02,
        dropLongitude: dropLongitude ? parseFloat(dropLongitude) : currentDeviceCoords.longitude + 0.02,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        vehicleModel: vehicleModel.trim() || undefined,
        // No default yet -> this becomes it. Editing an existing default for
        // just this ride -> leave the saved default untouched.
        setAsDefault: !defaultVehicle || !overrideForThisRide,
      });

      router.replace({
        pathname: '/(customer)/booking-success',
        params: {
          bookingId: data.id,
          bookingNumber: data.bookingNumber,
        },
      });
    } catch (err: any) {
      showAlert('Booking Failed', err.message || 'Something went wrong while booking.');
    }
  };

  return (
    <ScreenContainer className="px-0">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2C2E3E] bg-white dark:bg-[#161823]">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
        >
          <Ionicons name="arrow-back" size={20} color="#0F62FE" />
        </Pressable>
        <Text className="text-lg font-bold text-textPrimary dark:text-[#F3F4F6]">Confirm Booking</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }} showsVerticalScrollIndicator={false} className="bg-gray-50 dark:bg-[#0B0C10]">
        <View className="gap-5 flex-1">
          {/* Driver summary card */}
          <View className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-2xl p-4 gap-2 shadow-sm">
            <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Assigned Driver</Text>
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                <Ionicons name="person" size={18} color="#0F62FE" />
              </View>
              <View>
                <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6]">{driverName}</Text>
                <Text className="text-xs text-gray-500 dark:text-gray-400 capitalize">Mode: {serviceType || 'local'}</Text>
              </View>
            </View>
          </View>

          {/* Location route card */}
          <View className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-2xl p-4 gap-3 shadow-sm">
            <Text className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Route Details</Text>
            <View className="gap-2.5">
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-blue-500" />
                <Text className="text-xs text-textPrimary dark:text-[#F3F4F6] font-semibold flex-1" numberOfLines={1}>
                  Pickup: Current Location
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className="h-2 w-2 rounded-full bg-red-500" />
                <Text className="text-xs text-textPrimary dark:text-[#F3F4F6] font-semibold flex-1" numberOfLines={1}>
                  Drop: {dropAddress || 'Destination Address'}
                </Text>
              </View>
            </View>
          </View>

          {/* Vehicle Info — always the same tree shape (never swapped for a
              different subtree); only `editable` toggles, so there's nothing
              here that mounts/unmounts as defaultVehicle loads or Edit is
              tapped. */}
          <View className="flex-row items-center justify-between mt-2">
            <Text className="text-sm font-bold text-textSecondary dark:text-gray-400">
              Vehicle Information{defaultVehicle && !overrideForThisRide ? ' (Default)' : ''}
            </Text>
            <Pressable
              onPress={() => setOverrideForThisRide(true)}
              style={{ opacity: defaultVehicle && !overrideForThisRide ? 1 : 0 }}
              pointerEvents={defaultVehicle && !overrideForThisRide ? 'auto' : 'none'}
              className="flex-row items-center gap-1 px-3 py-1 rounded-full bg-brand/10 active:bg-brand/20"
            >
              <Ionicons name="pencil" size={12} color="#0F62FE" />
              <Text className="text-xs font-bold text-brand">Change for this ride</Text>
            </Pressable>
          </View>

          <View className="gap-4">
            <TextField
              label="Vehicle License Number"
              placeholder="e.g. MH12AB1234"
              autoCapitalize="characters"
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              editable={!(defaultVehicle && !overrideForThisRide)}
            />
            <TextField
              label="Vehicle Model Name"
              placeholder="e.g. Maruti Suzuki Swift"
              value={vehicleModel}
              onChangeText={setVehicleModel}
              editable={!(defaultVehicle && !overrideForThisRide)}
            />
          </View>

          {/* Payment Fare Breakdown Card */}
          <Text className="text-sm font-bold text-textSecondary dark:text-gray-400 mt-2">Fare Details (Cash on Delivery)</Text>
          <View className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-2xl p-4 gap-2 shadow-sm">
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-500 dark:text-gray-400">Trip Base Fare</Text>
              <Text className="text-xs font-semibold text-textPrimary dark:text-[#F3F4F6]">₹{baseTripFare}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-500 dark:text-gray-400">Convenience Platform Fee</Text>
              <Text className="text-xs font-semibold text-textPrimary dark:text-[#F3F4F6]">₹{platformFee}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-500 dark:text-gray-400">GST Tax & levies (18%)</Text>
              <Text className="text-xs font-semibold text-textPrimary dark:text-[#F3F4F6]">₹{taxAmount}</Text>
            </View>
            <View className="flex-row justify-between border-t border-gray-100 dark:border-[#2C2E3E] pt-2 mt-1">
              <Text className="text-sm font-bold text-textPrimary dark:text-[#F3F4F6]">Total Cash Due</Text>
              <Text className="text-sm font-extrabold text-brand">₹{totalAmount}</Text>
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View className="pt-6">
          <Button
            label={`Confirm Booking (₹${totalAmount})`}
            onPress={handleConfirmBooking}
            isLoading={isCreatingBooking}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
