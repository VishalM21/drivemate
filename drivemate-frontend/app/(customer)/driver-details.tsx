import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';

import { Button, ScreenContainer } from '@/components/common';
import { fetchReviewsByDriver } from '@/services/common/reviewService';
import { fetchNearbyDrivers } from '@/services/customer/discoveryService';
import { useLocationStore } from '@/store/locationStore';
import type { ServiceType } from '@/types';

export default function DriverDetailsScreen() {
  const {
    driverId,
    dropAddress,
    dropLatitude,
    dropLongitude,
    serviceType,
    pickupLatitude,
    pickupLongitude,
    radiusKm,
  } = useLocalSearchParams<{
    driverId: string;
    dropAddress: string;
    dropLatitude: string;
    dropLongitude: string;
    serviceType: ServiceType;
    pickupLatitude?: string;
    pickupLongitude?: string;
    radiusKm?: string;
  }>();

  const { currentDeviceCoords } = useLocationStore();
  const searchLatitude = pickupLatitude ? parseFloat(pickupLatitude) : currentDeviceCoords?.latitude;
  const searchLongitude = pickupLongitude ? parseFloat(pickupLongitude) : currentDeviceCoords?.longitude;
  const searchRadiusKm = radiusKm ? parseFloat(radiusKm) : 10;

  const dropLatNum = dropLatitude ? parseFloat(dropLatitude) : undefined;
  const dropLngNum = dropLongitude ? parseFloat(dropLongitude) : undefined;

  // Query nearby drivers list again (using the exact same pickup point + radius
  // the customer searched with) to pull this specific driver's fresh profile
  // details — dropLat/dropLng included so the backend also quotes tripFare.
  const { data: nearbyDriversData, isLoading: isLoadingDriver } = useQuery({
    queryKey: ['nearbyDrivers', searchLatitude, searchLongitude, serviceType, searchRadiusKm, dropLatNum, dropLngNum],
    queryFn: () =>
      fetchNearbyDrivers({
        latitude: searchLatitude ?? 26.4499,
        longitude: searchLongitude ?? 80.3319,
        radiusKm: searchRadiusKm,
        serviceType: serviceType || 'local',
        dropLatitude: dropLatNum,
        dropLongitude: dropLngNum,
      }),
    enabled: searchLatitude != null && searchLongitude != null && !!driverId,
  });

  const driver = nearbyDriversData?.drivers?.find((d) => d.id === driverId);

  // Query driver's reviews history
  const { data: reviewsData, isLoading: isLoadingReviews } = useQuery({
    queryKey: ['driverReviews', driverId],
    queryFn: () => fetchReviewsByDriver(driverId!),
    enabled: !!driverId,
  });

  const reviewsList = reviewsData?.reviews ?? [];

  const handleProceedToBook = () => {
    if (!driver) return;
    router.push({
      pathname: '/(customer)/booking',
      params: {
        driverId: driver.id,
        driverName: driver.name,
        tripFare: driver.tripFare != null ? String(driver.tripFare) : '',
        dropAddress,
        dropLatitude,
        dropLongitude,
        serviceType,
      },
    });
  };

  if (isLoadingDriver) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#0F62FE" />
        <Text className="mt-2 text-sm text-gray-500">Loading driver details...</Text>
      </View>
    );
  }

  if (!driver) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-[#0B0C10] px-6 gap-3">
        <Ionicons name="warning-outline" size={40} color="#D97706" />
        <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6]">Driver profile not found</Text>
        <Button label="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

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
        <Text className="text-lg font-bold text-textPrimary dark:text-[#F3F4F6]">Driver Details</Text>
        <View className="w-10" />
      </View>

      <View className="flex-1">
        {/* Profile Card */}
        <View className="p-6 bg-white dark:bg-[#161823] border-b border-gray-100 dark:border-[#2C2E3E] gap-4">
          <View className="flex-row items-center gap-4">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-brand/10 border-2 border-brand/20">
              <Text className="font-bold text-2xl text-brand">{driver.avatar}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1.5">
                <Text className="text-xl font-bold text-textPrimary dark:text-[#F3F4F6]">{driver.name}</Text>
                {driver.isVerified && (
                  <Ionicons name="checkmark-circle" size={18} color="#12805C" />
                )}
              </View>
              <Text className="text-sm text-gray-500 dark:text-gray-400">⭐ {driver.rating} • {driver.experience} experience</Text>
            </View>
          </View>

          {/* Core Info Badges */}
          <View className="flex-row flex-wrap gap-2 pt-2">
            <View className="bg-gray-100 dark:bg-[#1E2030] rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300">Languages: {driver.languages.join(', ')}</Text>
            </View>
            <View className="bg-gray-100 dark:bg-[#1E2030] rounded-full px-3 py-1">
              <Text className="text-xs font-semibold text-gray-600 dark:text-gray-300">Trips: {driver.totalTrips}</Text>
            </View>
            <View className="bg-blue-50 dark:bg-brand/10 rounded-full px-3 py-1">
              <Text className="text-xs font-bold text-brand dark:text-brand-light uppercase">{serviceType || 'local'}</Text>
            </View>
          </View>

          {/* Pricing Box */}
          <View className="flex-row justify-between items-center bg-gray-50 dark:bg-[#1E2030] rounded-2xl p-4 mt-2">
            <View>
              <Text className="text-xs text-gray-400 dark:text-gray-500">Estimated Fare</Text>
              <Text className="text-lg font-bold text-textPrimary dark:text-[#F3F4F6]">
                {driver.tripFare != null ? `₹${driver.tripFare}` : 'Calculating…'}
              </Text>
              {driver.surgeMultiplier != null && driver.surgeMultiplier > 1 ? (
                <Text className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {driver.surgeMultiplier}x demand pricing
                </Text>
              ) : null}
            </View>
            <View className="items-end">
              <Text className="text-xs text-gray-400 dark:text-gray-500">Estimated Pickup ETA</Text>
              <Text className="text-sm font-bold text-gray-800 dark:text-gray-200">{driver.etaMinutes} mins away</Text>
            </View>
          </View>
        </View>

        {/* Reviews Section */}
        <View className="flex-1 px-6 py-4 bg-gray-50 dark:bg-[#0B0C10]">
          <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6] mb-4">Customer Reviews</Text>

          {isLoadingReviews ? (
            <ActivityIndicator size="small" color="#0F62FE" />
          ) : reviewsList.length === 0 ? (
            <View className="py-8 items-center gap-1.5">
              <Ionicons name="star-outline" size={24} color="#9CA3AF" />
              <Text className="text-xs text-gray-400 dark:text-gray-500">No reviews submitted yet for this driver.</Text>
            </View>
          ) : (
            <FlatList
              data={reviewsList}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <View className="bg-white dark:bg-[#161823] rounded-2xl p-4 mb-3 border border-gray-100 dark:border-[#2C2E3E] shadow-sm gap-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-xs font-bold text-textPrimary dark:text-[#F3F4F6]">⭐ {item.rating} / 5</Text>
                    <Text className="text-[10px] text-gray-400 dark:text-gray-500">
                      {new Date(item.createdAt).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  {item.comment ? (
                    <Text className="text-xs text-gray-600 dark:text-gray-300 italic">"{item.comment}"</Text>
                  ) : (
                    <Text className="text-xs text-gray-400 dark:text-gray-500 italic">No comment left.</Text>
                  )}
                </View>
              )}
            />
          )}
        </View>
      </View>

      {/* Footer Book Button */}
      <View className="px-6 pb-8 pt-4 bg-white dark:bg-[#161823] border-t border-gray-100 dark:border-[#2C2E3E]">
        <Button label="Proceed to Book Driver" onPress={handleProceedToBook} />
      </View>
    </ScreenContainer>
  );
}
