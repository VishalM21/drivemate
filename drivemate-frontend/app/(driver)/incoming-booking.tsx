import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { showAlert } from '@/utils/alert';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button, ScreenContainer, FreeMapView as MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/common';
import { fetchBooking } from '@/services/common/bookingService';
import { acceptBooking, declineBooking } from '@/services/driver/bookingService';
import { useLocationStore } from '@/store/locationStore';
import { haversineKm, etaMinutes } from '@/utils/distance';
import { formatMoney } from '@/utils/currency';
import type { Booking } from '@/types';

export default function IncomingBookingScreen() {
  const queryClient = useQueryClient();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { currentDeviceCoords } = useLocationStore();

  // Fetch offer details
  const { data: booking, isLoading } = useQuery<Booking>({
    queryKey: ['bookingOfferDetails', bookingId],
    queryFn: () => fetchBooking(bookingId!),
    enabled: !!bookingId,
    refetchInterval: 3000, // poll to check if booking is cancelled or expired
  });

  // Automatically go back if booking status changes (cancelled, accepted, etc.)
  useEffect(() => {
    if (booking && !['pending', 'driver_notified'].includes(booking.status)) {
      if (booking.status === 'driver_accepted' || booking.status === 'driver_arriving') {
        router.replace({
          pathname: '/(driver)/ride-screen',
          params: { bookingId: booking.id },
        });
      } else {
        // Dashboard's ['driverBookings'] cache has been inactive since it
        // first sent us here (it was still 'pending' at that point) — clear
        // it so the dashboard mounts fresh instead of reading that stale
        // status and bouncing straight back to this screen.
        queryClient.removeQueries({ queryKey: ['driverBookings'] });
        router.replace('/(driver)');
      }
    }
  }, [booking]);

  const acceptMutation = useMutation({
    mutationFn: acceptBooking,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverBookings'] });
      router.replace({
        pathname: '/(driver)/ride-screen',
        params: { bookingId },
      });
    },
    onError: (err: any) => {
      queryClient.removeQueries({ queryKey: ['driverBookings'] });
      showAlert('Accept Failed', err.message || 'Could not accept this booking offer.');
      router.replace('/(driver)');
    },
  });

  const declineMutation = useMutation({
    mutationFn: declineBooking,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['driverBookings'] });
      router.replace('/(driver)');
    },
    onError: (err: any) => {
      queryClient.removeQueries({ queryKey: ['driverBookings'] });
      showAlert('Decline Failed', err.message || 'Could not decline booking.');
      router.replace('/(driver)');
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#12805C" />
        <Text className="mt-2 text-sm text-gray-500 font-medium font-semibold">Loading ride offer details...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-[#0B0C10] px-6 gap-3">
        <Ionicons name="alert-circle-outline" size={44} color="#DC2626" />
        <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6]">Ride Offer Expired</Text>
        <Text className="text-xs text-gray-400 dark:text-gray-500 text-center">
          This booking request has been cancelled by the customer or assigned to another driver partner.
        </Text>
        <Button label="Go to Dashboard" onPress={() => router.replace('/(driver)')} />
      </View>
    );
  }

  const pickupLat = booking.pickupLatitude;
  const pickupLng = booking.pickupLongitude;
  const dropLat = booking.dropLatitude;
  const dropLng = booking.dropLongitude;
  const hasDrop = dropLat != null && dropLng != null;

  const tripDistanceKm =
    pickupLat != null && pickupLng != null && hasDrop
      ? haversineKm(pickupLat, pickupLng, dropLat!, dropLng!)
      : null;

  const distanceToPickupKm =
    currentDeviceCoords && pickupLat != null && pickupLng != null
      ? haversineKm(currentDeviceCoords.latitude, currentDeviceCoords.longitude, pickupLat, pickupLng)
      : null;

  const mapCenterLat = pickupLat ?? currentDeviceCoords?.latitude ?? 26.4499;
  const mapCenterLng = pickupLng ?? currentDeviceCoords?.longitude ?? 80.3319;
  const otherLat = hasDrop ? dropLat! : currentDeviceCoords?.latitude ?? mapCenterLat;
  const otherLng = hasDrop ? dropLng! : currentDeviceCoords?.longitude ?? mapCenterLng;
  const latitudeDelta = Math.max(Math.abs(mapCenterLat - otherLat) * 1.8, 0.035);
  const longitudeDelta = Math.max(Math.abs(mapCenterLng - otherLng) * 1.8, 0.035);
  const regionLat = hasDrop ? (mapCenterLat + otherLat) / 2 : mapCenterLat;
  const regionLng = hasDrop ? (mapCenterLng + otherLng) / 2 : mapCenterLng;

  return (
    <ScreenContainer className="px-0 bg-emerald-950">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 24, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sparkles Offer Ring */}
        <View className="items-center gap-2">
          <Animated.View
            entering={FadeIn.duration(300)}
            className="h-16 w-16 items-center justify-center rounded-full bg-emerald-800 border-2 border-emerald-600 shadow-md"
          >
            <Ionicons name="sparkles" size={30} color="#10B981" />
          </Animated.View>
          <Text className="text-2xl font-black text-white text-center">New Ride Offer!</Text>
          <Text className="text-xs font-semibold text-emerald-300 uppercase tracking-widest">
            ID: {booking.bookingNumber}
          </Text>
        </View>

        {/* Fare card */}
        <Animated.View
          entering={FadeInDown.delay(120).duration(400)}
          className="bg-emerald-900 border border-emerald-800 rounded-3xl p-5 items-center gap-1 shadow-md"
        >
          <Text className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">Your Payout Earnings</Text>
          <Text className="text-4xl font-black text-emerald-400">₹{formatMoney(booking.driverFee)}</Text>
          <Text className="text-[10px] text-emerald-400 mt-1">Platform Total: ₹{formatMoney(booking.totalAmount)} (COD Cash)</Text>
        </Animated.View>

        {/* Map preview of pickup -> drop route */}
        <View className="rounded-3xl overflow-hidden border border-emerald-800" style={{ height: 200 }}>
          <MapView
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: regionLat,
              longitude: regionLng,
              latitudeDelta,
              longitudeDelta,
            }}
          >
            {pickupLat != null && pickupLng != null && (
              <Marker coordinate={{ latitude: pickupLat, longitude: pickupLng }} title="Pickup">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-500 border-2 border-white shadow">
                  <Ionicons name="location" size={16} color="white" />
                </View>
              </Marker>
            )}
            {hasDrop && (
              <Marker coordinate={{ latitude: dropLat!, longitude: dropLng! }} title="Drop-off">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-red-500 border-2 border-white shadow">
                  <Ionicons name="flag" size={16} color="white" />
                </View>
              </Marker>
            )}
            {hasDrop && pickupLat != null && pickupLng != null && (
              <Polyline
                coordinates={[
                  { latitude: pickupLat, longitude: pickupLng },
                  { latitude: dropLat!, longitude: dropLng! },
                ]}
                strokeColor="#10B981"
                strokeWidth={4}
              />
            )}
            {currentDeviceCoords && (
              <Marker coordinate={currentDeviceCoords} title="You">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-emerald-500 border-2 border-white shadow">
                  <Ionicons name="car" size={16} color="white" />
                </View>
              </Marker>
            )}
          </MapView>
        </View>

        {/* Route card */}
        <View className="bg-emerald-900/60 border border-emerald-800 rounded-3xl p-5 gap-3.5 shadow-sm">
          <Text className="text-xs font-bold text-emerald-300 uppercase tracking-wider pl-1">
            Route & Location
          </Text>
          <View className="gap-2.5">
            <View className="flex-row items-center gap-2.5">
              <View className="h-2 w-2 rounded-full bg-blue-400" />
              <Text className="text-xs text-white font-medium flex-1" numberOfLines={1}>
                Pickup: {booking.pickupAddress || 'Customer Location'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2.5">
              <View className="h-2 w-2 rounded-full bg-red-400" />
              <Text className="text-xs text-white font-medium flex-1" numberOfLines={1}>
                Drop: {booking.dropAddress || 'Destination Address'}
              </Text>
            </View>
          </View>
          <View className="h-px bg-emerald-800" />
          <View className="flex-row justify-between">
            <View>
              <Text className="text-[10px] text-emerald-400 uppercase font-bold">Distance to Pickup</Text>
              <Text className="text-sm font-bold text-white mt-0.5">
                {distanceToPickupKm != null
                  ? `${distanceToPickupKm.toFixed(1)} km • ${etaMinutes(distanceToPickupKm)} min`
                  : 'Unknown'}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] text-emerald-400 uppercase font-bold">Trip Distance</Text>
              <Text className="text-sm font-bold text-white mt-0.5">
                {tripDistanceKm != null ? `${tripDistanceKm.toFixed(1)} km` : 'Unknown'}
              </Text>
            </View>
          </View>
        </View>

        {/* Details Row */}
        <View className="flex-row justify-between bg-emerald-900/40 p-4 rounded-2xl border border-emerald-800/80">
          <Text className="text-xs font-bold text-emerald-300 capitalize">Mode: {booking.serviceType}</Text>
          <Text className="text-xs font-bold text-emerald-300 uppercase">Method: {booking.paymentMethod}</Text>
        </View>

        {/* Control Buttons */}
        <View className="flex-row gap-4 mt-2">
          <Pressable
            onPress={() => declineMutation.mutate({ bookingId })}
            disabled={declineMutation.isPending}
            className="flex-1 items-center justify-center h-14 border border-emerald-700 bg-emerald-900/50 rounded-2xl active:bg-emerald-900"
          >
            <Text className="text-base font-semibold text-white">Decline</Text>
          </Pressable>

          <Pressable
            onPress={() => acceptMutation.mutate({ bookingId })}
            disabled={acceptMutation.isPending}
            className="flex-1 items-center justify-center h-14 bg-emerald-500 rounded-2xl active:opacity-90 shadow-md"
          >
            {acceptMutation.isPending ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-emerald-950">Accept</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
