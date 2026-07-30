import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { showAlert } from '@/utils/alert';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Button, ScreenContainer, AnimatedMarker, FreeMapView as MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/common';
import { fetchBooking } from '@/services/common/bookingService';
import {
  completeTrip,
  markDriverArrived,
  startTrip,
} from '@/services/driver/bookingService';
import { useLocationStore } from '@/store/locationStore';
import { useBookingRealtime, useRoadRoute } from '@/hooks/common';
import { haversineKm, etaMinutes } from '@/utils/distance';
import { formatMoney } from '@/utils/currency';
import type { Booking } from '@/types';


export default function DriverRideScreen() {
  const queryClient = useQueryClient();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { currentDeviceCoords } = useLocationStore();
  const [enteredOtp, setEnteredOtp] = useState('');
  const insets = useSafeAreaInsets();

  // Query details of active booking (polls every 4 seconds)
  const { data: booking, isLoading } = useQuery<Booking>({
    queryKey: ['activeBooking', bookingId],
    queryFn: () => fetchBooking(bookingId!),
    enabled: !!bookingId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'cancelled') {
        return false;
      }
      return 4000;
    },
  });

  // Subscribe to real-time updates for booking status
  useBookingRealtime(bookingId, undefined);

  const pickupPoint = booking?.pickupLatitude != null && booking?.pickupLongitude != null
    ? { latitude: booking.pickupLatitude, longitude: booking.pickupLongitude }
    : null;
  const dropPoint = booking?.dropLatitude != null && booking?.dropLongitude != null
    ? { latitude: booking.dropLatitude, longitude: booking.dropLongitude }
    : null;
  // Planned pickup -> drop route, following actual roads.
  const plannedRouteCoords = useRoadRoute(pickupPoint, dropPoint);

  const liveRouteTarget = booking ? (booking.status === 'started' ? dropPoint : pickupPoint) : null;
  // My own live road route to wherever I'm headed next.
  const liveRouteCoords = useRoadRoute(currentDeviceCoords, liveRouteTarget);


  // Redirect to booking details COD collection upon completion
  useEffect(() => {
    if (booking?.status === 'completed') {
      // Dashboard's ['driverBookings'] query has been inactive (unmounted)
      // this whole trip, so its cache is stale — clear it so the dashboard
      // mounts fresh instead of briefly acting on old status data.
      queryClient.removeQueries({ queryKey: ['driverBookings'] });
      router.replace({
        pathname: '/(driver)/booking-details',
        params: { bookingId: booking.id },
      });
    } else if (booking?.status === 'cancelled') {
      queryClient.removeQueries({ queryKey: ['driverBookings'] });
      showAlert('Trip Cancelled', 'The customer cancelled this ride request.');
      router.replace('/(driver)');
    }
  }, [booking?.status]);

  const arrivedMutation = useMutation({
    mutationFn: markDriverArrived,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeBooking', bookingId] });
      showAlert('Status Updated', 'You have marked yourself as arrived.');
    },
  });

  const startMutation = useMutation({
    mutationFn: startTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeBooking', bookingId] });
      showAlert('Trip Started', 'Drive carefully to the drop-off destination.');
      setEnteredOtp('');
    },
    onError: (err: any) => {
      showAlert('Start Trip Failed', err.message || 'Invalid OTP. Please check the OTP with the customer.');
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeBooking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['driverEarnings'] });
    },
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-[#0B0C10]">
        <ActivityIndicator size="large" color="#12805C" />
        <Text className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading trip tracking map...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-[#0B0C10] px-6 gap-3">
        <Ionicons name="warning" size={40} color="#DC2626" />
        <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6]">Trip Unavailable</Text>
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          This booking has been cancelled, completed, or is no longer assigned to you.
        </Text>
        <Button label="Go to Dashboard" onPress={() => router.replace('/(driver)')} />
      </View>
    );
  }

  const centerLat = currentDeviceCoords?.latitude ?? booking.pickupLatitude ?? 26.4499;
  const centerLng = currentDeviceCoords?.longitude ?? booking.pickupLongitude ?? 80.3319;

  const liveEta = (() => {
    if (!currentDeviceCoords) return null;
    const isStarted = booking.status === 'started';
    const destLat = isStarted ? booking.dropLatitude : booking.pickupLatitude;
    const destLng = isStarted ? booking.dropLongitude : booking.pickupLongitude;
    if (destLat && destLng) {
      const dist = haversineKm(currentDeviceCoords.latitude, currentDeviceCoords.longitude, destLat, destLng);
      return etaMinutes(dist);
    }
    return null;
  })();

  return (
    <View className="flex-1 bg-gray-50 dark:bg-[#0B0C10]">
      {/* Header */}
      <View className="absolute top-12 left-4 right-4 z-10 flex-row items-center justify-between rounded-full bg-white/95 dark:bg-[#161823]/95 px-4 py-3 shadow-lg border border-gray-100 dark:border-[#2C2E3E]">
        <Pressable
          onPress={() => router.replace('/(driver)')}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
        >
          <Ionicons name="home" size={18} color="#111318" />
        </Pressable>
        <Text className="text-sm font-bold text-textPrimary dark:text-[#F3F4F6] capitalize">
          Trip: {booking.status.replace('_', ' ')}
          {liveEta !== null ? ` (ETA: ${liveEta}m)` : ''}
        </Text>
        <View className="w-10" />
      </View>

      {/* Open turn-by-turn navigation in Google Maps — an alternative to the
          in-app map above, driver's choice. Targets pickup until the trip
          starts, then the drop-off. Live location pinging keeps running in
          the background regardless of which one is used to actually drive. */}
      <Pressable
        onPress={() => {
          const isStarted = booking.status === 'started';
          const destLat = isStarted ? booking.dropLatitude : booking.pickupLatitude;
          const destLng = isStarted ? booking.dropLongitude : booking.pickupLongitude;
          if (destLat == null || destLng == null) return;
          Linking.openURL(
            `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`
          );
        }}
        className="absolute top-28 right-4 z-10 h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-[#161823] shadow-lg border border-gray-100 dark:border-[#2C2E3E] active:bg-gray-50 dark:active:bg-[#1E2030]"
      >
        <Ionicons name="navigate" size={22} color="#12805C" />
      </Pressable>

      {/* Map View */}
      <View className="flex-1">
        <MapView
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
          <Marker
            coordinate={{
              latitude: booking.pickupLatitude ?? centerLat,
              longitude: booking.pickupLongitude ?? centerLng,
            }}
            title="Pickup Address"
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-500 border-2 border-white shadow">
              <Ionicons name="location" size={16} color="white" />
            </View>
          </Marker>

          {/* Drop-off Marker */}
          {booking.dropLatitude && booking.dropLongitude && (
            <>
              <Marker
                coordinate={{
                  latitude: booking.dropLatitude,
                  longitude: booking.dropLongitude,
                }}
                title="Drop-off Destination"
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-red-500 border-2 border-white shadow">
                  <Ionicons name="flag" size={16} color="white" />
                </View>
              </Marker>
              {/* Static plan, shown only until the live route below is
                  available — once it is, that's the single source of truth
                  so the two lines don't overlap/conflict. */}
              {!(currentDeviceCoords && liveRouteCoords.length >= 2) && (
                <Polyline
                  coordinates={plannedRouteCoords}
                  strokeColor="#12805C"
                  strokeWidth={4}
                />
              )}
            </>
          )}

          {/* Live route from driver to pickup (then drop-off once started),
              following actual roads — re-fetched as the driver's position
              changes, so it reflects whatever road they're actually on. */}
          {currentDeviceCoords && liveRouteCoords.length >= 2 && (
            <Polyline
              coordinates={liveRouteCoords}
              strokeColor="#10B981"
              strokeWidth={4}
            />
          )}

          {/* Driver Location Marker */}
          {currentDeviceCoords && (
            <AnimatedMarker coordinate={currentDeviceCoords} title="Your Location">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-600 border-2 border-white shadow-lg">
                <Ionicons name="car" size={18} color="white" />
              </View>
            </AnimatedMarker>
          )}

        </MapView>
      </View>

      {/* Bottom Sheet Control Panel */}
      <Animated.View
        entering={SlideInDown.duration(380)}
        style={{ paddingBottom: 24 + insets.bottom }}
        className="bg-white dark:bg-[#161823] rounded-t-3xl shadow-2xl px-6 pt-5 border-t border-gray-100 dark:border-[#2C2E3E] gap-4"
      >
        <View className="flex-row justify-between items-center border-b border-gray-100 dark:border-[#2C2E3E] pb-3">
          <View>
            <Text className="text-xs text-gray-400 dark:text-gray-500">Booking: {booking.bookingNumber}</Text>
            <Text className="text-[10px] font-bold text-driver uppercase tracking-widest mt-0.5">
              Service: {booking.serviceType} Mode
            </Text>
          </View>
          <View className="bg-emerald-50 dark:bg-[#11241C] rounded-full px-3 py-1 border border-emerald-100 dark:border-[#1E3D2F]">
            <Text className="text-xs font-bold text-driver uppercase">Payout: ₹{formatMoney(booking.driverFee)}</Text>
          </View>
        </View>

        {/* Route labels */}
        <View className="gap-2.5">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-blue-500" />
            <Text className="text-xs text-textPrimary dark:text-[#F3F4F6] font-semibold flex-1" numberOfLines={1}>
              From: {booking.pickupAddress || 'Customer Pickup Address'}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-red-500" />
            <Text className="text-xs text-textPrimary dark:text-[#F3F4F6] font-semibold flex-1" numberOfLines={1}>
              To: {booking.dropAddress || 'Destination Drop Address'}
            </Text>
          </View>
        </View>

        {/* Contact Customer Panel */}
        <View className="flex-row items-center justify-between bg-gray-50 dark:bg-[#1E2030] p-4 rounded-2xl border border-gray-100 dark:border-[#2C2E3E]">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-[#11241C]">
              <Ionicons name="person" size={18} color="#12805C" />
            </View>
            <View>
              <Text className="text-sm font-bold text-textPrimary dark:text-[#F3F4F6]">Customer Owner</Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500">Total COD Collected: ₹{formatMoney(booking.totalAmount)}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => Linking.openURL('tel:+919999999999')}
            className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-[#11241C] active:bg-emerald-100 dark:active:bg-[#1E3D2F]"
          >
            <Ionicons name="call" size={18} color="#12805C" />
          </Pressable>
        </View>

        {/* M3 Ride Lifecycle Action Buttons */}
        {booking.status === 'driver_accepted' || booking.status === 'driver_arriving' ? (
          <Button
            label="Mark as Arrived"
            onPress={() => arrivedMutation.mutate({ bookingId: booking.id })}
            isLoading={arrivedMutation.isPending}
          />
        ) : booking.status === 'arrived' ? (
          <View className="gap-3">
            <View className="bg-gray-50 dark:bg-[#1E2030] border border-gray-100 dark:border-[#2C2E3E] rounded-2xl p-4 gap-2">
              <Text className="text-xs font-bold text-textPrimary dark:text-[#F3F4F6]">Enter Customer's Ride OTP</Text>
              <Text className="text-[10px] text-gray-400 dark:text-gray-500">Ask the customer for the 4-digit code shown on their tracking screen.</Text>
              <TextInput
                className="bg-white dark:bg-[#161823] border border-gray-200 dark:border-[#2C2E3E] rounded-xl px-4 py-3 text-center text-xl font-bold tracking-widest text-textPrimary dark:text-[#F3F4F6] mt-1"
                placeholder="0 0 0 0"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={4}
                value={enteredOtp}
                onChangeText={(val) => setEnteredOtp(val.replace(/[^0-9]/g, ''))}
              />
            </View>
            <Button
              label="Start Trip"
              onPress={() => startMutation.mutate({ bookingId: booking.id, otp: enteredOtp })}
              disabled={enteredOtp.length !== 4}
              isLoading={startMutation.isPending}
            />
          </View>
        ) : booking.status === 'started' ? (
          <Button
            label="Complete Trip"
            onPress={() => completeMutation.mutate({ bookingId: booking.id })}
            isLoading={completeMutation.isPending}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}
