import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect, useRef } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ScreenContainer, Skeleton, FreeMapView as MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/common';
import { useLocationStore } from '@/store/locationStore';
import { useNearbyDrivers } from '@/hooks/customer';
import type { NearbyDriver, ServiceType } from '@/types';

export default function NearbyDriversScreen() {
  const { dropAddress, dropLatitude, dropLongitude, serviceType, pickupLatitude, pickupLongitude } = useLocalSearchParams<{
    dropAddress: string;
    dropLatitude: string;
    dropLongitude: string;
    serviceType: ServiceType;
    pickupLatitude?: string;
    pickupLongitude?: string;
  }>();

  const { currentDeviceCoords } = useLocationStore();
  const pickupCoords = pickupLatitude && pickupLongitude ? {
    latitude: parseFloat(pickupLatitude),
    longitude: parseFloat(pickupLongitude)
  } : currentDeviceCoords;

  const [selectedDriver, setSelectedDriver] = useState<NearbyDriver | null>(null);
  const [radius, setRadius] = useState<number>(10);
  const mapRef = useRef<any | null>(null);

  // Fetch nearby drivers using React Query Hook
  const { data: nearbyDriversData, isLoading, error, refetch } = useNearbyDrivers({
    latitude: pickupCoords?.latitude ?? null,
    longitude: pickupCoords?.longitude ?? null,
    radiusKm: radius,
    serviceType: serviceType || 'local',
    enabled: !!pickupCoords,
  });

  const nearbyDrivers = nearbyDriversData?.drivers ?? [];

  const handleSelectDriver = (driver: NearbyDriver) => {
    setSelectedDriver(driver);
    router.push({
      pathname: '/(customer)/driver-details',
      params: {
        driverId: driver.id,
        dropAddress,
        dropLatitude,
        dropLongitude,
        serviceType,
        pickupLatitude: pickupCoords ? String(pickupCoords.latitude) : undefined,
        pickupLongitude: pickupCoords ? String(pickupCoords.longitude) : undefined,
        radiusKm: String(radius),
      },
    });
  };

  const centerLat = pickupCoords?.latitude ?? 26.4499;
  const centerLng = pickupCoords?.longitude ?? 80.3319;

  const SkeletonItem = () => (
    <View className="flex-row items-center justify-between p-4 mb-3 bg-gray-50 dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-2xl">
      <View className="flex-row items-center gap-3 flex-1">
        <Skeleton width={48} height={48} borderRadius={24} />
        <View className="flex-1 gap-2">
          <Skeleton width={120} height={16} />
          <Skeleton width={160} height={12} />
        </View>
      </View>
      <View className="items-end gap-2">
        <Skeleton width={60} height={18} />
        <Skeleton width={40} height={12} />
      </View>
    </View>
  );

  const dropLatNum = dropLatitude ? parseFloat(dropLatitude) : null;
  const dropLngNum = dropLongitude ? parseFloat(dropLongitude) : null;

  useEffect(() => {
    if (currentDeviceCoords && dropLatNum && dropLngNum) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: currentDeviceCoords.latitude, longitude: currentDeviceCoords.longitude },
            { latitude: dropLatNum, longitude: dropLngNum },
          ],
          {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true,
          }
        );
      }, 500);
    }
  }, [currentDeviceCoords, dropLatNum, dropLngNum]);

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
        <Text className="text-lg font-bold text-textPrimary dark:text-[#F3F4F6]">Available Drivers</Text>
        <Pressable
          onPress={() => refetch()}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
        >
          <Ionicons name="refresh" size={18} color="#0F62FE" />
        </Pressable>
      </View>

      {/* Map Segment (Top half) */}
      <View className="h-64 border-b border-gray-100 dark:border-[#2C2E3E]">
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          className="h-full w-full"
          initialRegion={{
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          }}
        >
          {/* Pickup Marker */}
          {pickupCoords && (
            <Marker coordinate={{ latitude: centerLat, longitude: centerLng }} title="Pickup">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-500 border-2 border-white shadow">
                <Ionicons name="location" size={16} color="white" />
              </View>
            </Marker>
          )}

          {/* Dropoff Marker */}
          {dropLatNum && dropLngNum && (
            <Marker coordinate={{ latitude: dropLatNum, longitude: dropLngNum }} title="Dropoff">
              <View className="h-8 w-8 items-center justify-center rounded-full bg-red-500 border-2 border-white shadow">
                <Ionicons name="flag" size={16} color="white" />
              </View>
            </Marker>
          )}

          {/* Route Polyline */}
          {currentDeviceCoords && dropLatNum && dropLngNum && (
            <Polyline
              coordinates={[
                { latitude: currentDeviceCoords.latitude, longitude: currentDeviceCoords.longitude },
                { latitude: dropLatNum, longitude: dropLngNum },
              ]}
              strokeColor="#0F62FE"
              strokeWidth={4}
            />
          )}

          {/* Drivers Markers */}
          {nearbyDrivers.map((driver) => (
            <Marker
              key={driver.id}
              coordinate={driver.location}
              title={driver.name}
              description={`₹${driver.pricePerTrip}/trip`}
            >
              <View className="h-7 w-7 items-center justify-center rounded-full bg-emerald-500 border-2 border-white shadow">
                <Ionicons name="car-sport" size={14} color="white" />
              </View>
            </Marker>
          ))}
        </MapView>
      </View>

      {/* Drivers List Segment (Bottom half) */}
      <View className="flex-1 bg-white dark:bg-[#0B0C10]">
        {/* Radius Selector */}
        <View className="flex-row items-center justify-between px-6 py-3 border-b border-gray-100 dark:border-[#2C2E3E]">
          <Text className="text-xs font-bold text-gray-500 dark:text-gray-400">Search Radius:</Text>
          <View className="flex-row gap-2">
            {[1, 2, 5, 10].map((r) => (
              <Pressable
                key={r}
                onPress={() => setRadius(r)}
                className={`px-3 py-1 rounded-full border ${
                  radius === r
                    ? 'bg-brand border-brand'
                    : 'bg-transparent border-gray-200 dark:border-[#2C2E3E]'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    radius === r ? 'text-white' : 'text-textPrimary dark:text-[#F3F4F6]'
                  }`}
                >
                  {r} km
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {isLoading ? (
          <FlatList
            data={[1, 2, 3, 4]}
            keyExtractor={(item) => String(item)}
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
            renderItem={() => <SkeletonItem />}
          />
        ) : error ? (
          <View className="flex-1 items-center justify-center px-6 gap-3">
            <Ionicons name="alert-circle-outline" size={40} color="#DC2626" />
            <Text className="text-sm text-red-600 text-center font-semibold">Failed to find drivers.</Text>
            <Pressable
              onPress={() => refetch()}
              className="px-5 py-2.5 rounded-full bg-brand active:opacity-90 shadow-sm"
            >
              <Text className="text-white text-xs font-bold">Retry Search</Text>
            </Pressable>
          </View>
        ) : nearbyDrivers.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6 gap-3">
            <Ionicons name="car-outline" size={48} color="#9CA3AF" />
            <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6]">No drivers nearby</Text>
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-center px-4">
              There are no available drivers verified for {serviceType || 'local'} trips in your area within {radius} km.
            </Text>
            <Pressable
              onPress={() => router.back()}
              className="px-5 py-2 rounded-full border border-border dark:border-[#2C2E3E] active:bg-gray-50 dark:active:bg-[#1E2030]"
            >
              <Text className="text-textPrimary dark:text-[#F3F4F6] text-xs font-bold">Go Back</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={nearbyDrivers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 60).duration(350)}>
                <Pressable
                  onPress={() => handleSelectDriver(item)}
                  className={`flex-row items-center justify-between p-4 mb-3 bg-gray-50 dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-2xl active:scale-[0.99] active:opacity-95 ${
                    selectedDriver?.id === item.id ? 'border-brand bg-brand/5 dark:bg-brand/10' : ''
                  }`}
                >
                  <View className="flex-row items-center gap-3 flex-1 mr-4">
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-brand/10 border border-brand/20">
                      <Text className="font-bold text-base text-brand">{item.avatar}</Text>
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-textPrimary dark:text-[#F3F4F6] text-sm">{item.name}</Text>
                      <Text className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-semibold">
                        ⭐ {item.rating} • {item.experience} • {item.distanceKm} km away
                      </Text>
                      <Text className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                        🗣️ {item.languages.slice(0, 2).join(', ')}
                      </Text>
                    </View>
                  </View>
                  <View className="items-end">
                    <Text className="font-extrabold text-brand text-base">₹{item.pricePerTrip}</Text>
                    <Text className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">ETA: {item.etaMinutes} mins</Text>
                  </View>
                </Pressable>
              </Animated.View>
            )}
          />
        ) }
      </View>
    </ScreenContainer>
  );
}

