import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  View,
} from 'react-native';
import { showAlert } from '@/utils/alert';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Button, ScreenContainer, AnimatedMarker, FreeMapView as MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/common';
import { fetchBooking } from '@/services/common/bookingService';
import { cancelBooking } from '@/services/customer/bookingService';
import { fetchCurrentUser } from '@/services/common/authService';
import { useLocationStore } from '@/store/locationStore';
import { useBookingRealtime, useRoadRoute } from '@/hooks/common';
import { useOnlinePayment } from '@/hooks/customer';
import { useAuthStore } from '@/store/authStore';
import { haversineKm, etaMinutes } from '@/utils/distance';
import { formatMoney } from '@/utils/currency';
import type { Booking } from '@/types';


export default function RideTrackingScreen() {
  const queryClient = useQueryClient();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const { currentDeviceCoords, trackedDriverCoords } = useLocationStore();
  const { user } = useAuthStore();
  const setUser = useAuthStore((state) => state.setUser);

  // Query details of active booking (polls every 4 seconds)
  const { data: activeBooking, isLoading } = useQuery<Booking>({
    queryKey: ['activeBooking', bookingId],
    queryFn: () => fetchBooking(bookingId!),
    enabled: !!bookingId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'cancelled') return false;
      // Keep polling through 'completed' as a fallback for the realtime
      // subscription until payment is settled (cash confirmed or paid online).
      if (status === 'completed' && query.state.data?.paymentStatus === 'paid') {
        return false;
      }
      return 4000;
    },
  });

  const { payOnline, isProcessing: isPayingOnline } = useOnlinePayment(bookingId);

  // Subscribe to real-time updates for booking status and driver location
  useBookingRealtime(bookingId, activeBooking?.driverId);

  // The backend mints a fresh ride OTP every time a driver accepts (see
  // bookingService.acceptBooking). Our local `user` was only fetched once at
  // app boot, so it goes stale as soon as a driver accepts — refetch it here
  // so the OTP shown to the customer always matches what the backend expects.
  const hasRefreshedOtpRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (
      activeBooking &&
      ['driver_accepted', 'driver_arriving', 'arrived'].includes(activeBooking.status) &&
      hasRefreshedOtpRef.current !== activeBooking.id
    ) {
      hasRefreshedOtpRef.current = activeBooking.id;
      fetchCurrentUser().then(setUser).catch(() => {});
    }
  }, [activeBooking?.status, activeBooking?.id]);


  // Redirect to the rating screen only once the driver has confirmed cash
  // collected — `status` flips to 'completed' as soon as the trip ends, well
  // before payment is settled, so gate on `paymentStatus` too.
  useEffect(() => {
    if (activeBooking?.status === 'completed' && activeBooking.paymentStatus === 'paid') {
      router.replace({
        pathname: '/(customer)/ride-completed',
        params: {
          bookingId: activeBooking.id,
          totalAmount: activeBooking.totalAmount,
        },
      });
    }
  }, [activeBooking?.status, activeBooking?.paymentStatus]);

  // Cancel Booking Mutation
  const cancelBookingMutation = useMutation({
    mutationFn: cancelBooking,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['bookingHistory'] });
      showAlert('Booking Cancelled', 'Your booking request has been successfully cancelled.');
      router.replace('/(customer)');
    },
    onError: (err: any) => {
      showAlert('Error', err.message || 'Could not cancel booking.');
    },
  });

  const goToNearbyDrivers = () => {
    if (!activeBooking) return;
    router.replace({
      pathname: '/(customer)/nearby-drivers',
      params: {
        dropAddress: activeBooking.dropAddress ?? '',
        dropLatitude: String(activeBooking.dropLatitude ?? ''),
        dropLongitude: String(activeBooking.dropLongitude ?? ''),
        serviceType: activeBooking.serviceType ?? 'local',
        ...(activeBooking.pickupLatitude != null
          ? { pickupLatitude: String(activeBooking.pickupLatitude) }
          : {}),
        ...(activeBooking.pickupLongitude != null
          ? { pickupLongitude: String(activeBooking.pickupLongitude) }
          : {}),
      },
    });
  };

  // If the DRIVER cancels/declines (not us), alert the customer — the
  // "Find Another Driver" button in the bottom sheet below also covers this,
  // in case the alert gets dismissed without tapping through.
  const hasHandledDriverCancelRef = React.useRef(false);
  useEffect(() => {
    if (
      activeBooking?.status === 'cancelled' &&
      activeBooking.cancellationReason !== 'User cancelled' &&
      !hasHandledDriverCancelRef.current &&
      !cancelBookingMutation.isPending &&
      !cancelBookingMutation.isSuccess
    ) {
      hasHandledDriverCancelRef.current = true;
      showAlert(
        'Booking Cancelled by Driver',
        'Your driver cancelled this ride. Please choose another driver to continue.',
        [{ text: 'Find Another Driver', onPress: goToNearbyDrivers }]
      );
    }
  }, [activeBooking?.status]);

  const handlePayOnline = async () => {
    if (!activeBooking) return;
    try {
      await payOnline(activeBooking);
    } catch (err: any) {
      if (err?.message !== 'Payment cancelled.') {
        showAlert('Payment Failed', err?.message || 'Could not complete the payment. Please try again or pay cash.');
      }
    }
  };

  const handleCancelBooking = () => {
    if (!bookingId) return;
    showAlert('Cancel Ride', 'Are you sure you want to cancel this ride request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: () => cancelBookingMutation.mutate({ bookingId, reason: 'User cancelled' }),
      },
    ]);
  };

  const centerLat = currentDeviceCoords?.latitude ?? 26.4499;
  const centerLng = currentDeviceCoords?.longitude ?? 80.3319;

  // Driver's real position only — no simulated/interpolated fallback tied to
  // the customer's own pickup coordinates. Prefer the realtime-pushed
  // position when available (lower latency); otherwise fall back to the
  // driver location piggybacked on the booking poll (every 4s) — realtime
  // can't authenticate as this app's custom JWT, so the poll is the
  // reliable path today.
  const driverCoords = trackedDriverCoords ?? (activeBooking?.driverLocation
    ? { latitude: activeBooking.driverLocation.latitude, longitude: activeBooking.driverLocation.longitude }
    : null);

  const pickupPoint = activeBooking?.pickupLatitude != null && activeBooking?.pickupLongitude != null
    ? { latitude: activeBooking.pickupLatitude, longitude: activeBooking.pickupLongitude }
    : null;
  const dropPoint = activeBooking?.dropLatitude != null && activeBooking?.dropLongitude != null
    ? { latitude: activeBooking.dropLatitude, longitude: activeBooking.dropLongitude }
    : null;
  // Planned pickup -> drop route, following actual roads (falls back to a
  // straight line if the routing request fails).
  const plannedRouteCoords = useRoadRoute(pickupPoint, dropPoint);

  const liveRouteTarget = activeBooking
    ? (activeBooking.status === 'started' ? dropPoint : pickupPoint) ?? { latitude: centerLat, longitude: centerLng }
    : null;
  // Driver's live road route to wherever they're headed next (pickup, then
  // drop once the trip has started).
  const liveRouteCoords = useRoadRoute(driverCoords, liveRouteTarget);

  // Proximity notification (Alert customer when driver is within 50 meters)
  const hasAlertedProximity = React.useRef(false);
  useEffect(() => {
    if (!driverCoords || !activeBooking || ['arrived', 'started', 'completed', 'cancelled'].includes(activeBooking.status)) {
      return;
    }
    const pickupLat = activeBooking.pickupLatitude;
    const pickupLng = activeBooking.pickupLongitude;
    if (pickupLat && pickupLng) {
      const dist = haversineKm(driverCoords.latitude, driverCoords.longitude, pickupLat, pickupLng);
      if (dist <= 0.05) {
        if (!hasAlertedProximity.current) {
          hasAlertedProximity.current = true;
          showAlert(
            'Driver is Nearby',
            'Your driver is within 50 meters of your pickup location. Please look out for them!'
          );
        }
      } else {
        hasAlertedProximity.current = false;
      }
    }
  }, [driverCoords, activeBooking?.status]);

  const isDriverClose = (() => {
    if (!driverCoords || !activeBooking || ['arrived', 'started', 'completed', 'cancelled'].includes(activeBooking.status)) {
      return false;
    }
    const pickupLat = activeBooking.pickupLatitude;
    const pickupLng = activeBooking.pickupLongitude;
    if (pickupLat && pickupLng) {
      const dist = haversineKm(driverCoords.latitude, driverCoords.longitude, pickupLat, pickupLng);
      return dist <= 0.05;
    }
    return false;
  })();

  const getLiveEta = () => {
    if (!driverCoords || !activeBooking) return null;
    const isStarted = activeBooking.status === 'started';
    const destLat = isStarted ? activeBooking.dropLatitude : activeBooking.pickupLatitude;
    const destLng = isStarted ? activeBooking.dropLongitude : activeBooking.pickupLongitude;
    
    if (destLat && destLng) {
      const dist = haversineKm(driverCoords.latitude, driverCoords.longitude, destLat, destLng);
      return etaMinutes(dist);
    }
    return null;
  };

  const liveEta = getLiveEta();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#0F62FE" />
        <Text className="mt-2 text-sm text-gray-500 font-medium">Connecting to tracking server...</Text>
      </View>
    );
  }

  if (!activeBooking) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-6 gap-3">
        <Ionicons name="warning" size={40} color="#DC2626" />
        <Text className="text-base font-bold text-textPrimary">Trip tracking unavailable</Text>
        <Text className="text-xs text-gray-400 text-center">
          The booking has expired, been cancelled, or is no longer active.
        </Text>
        <Button label="Go to Home" onPress={() => router.replace('/(customer)')} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="absolute top-12 left-4 right-4 z-10 flex-row items-center justify-between rounded-full bg-white/95 px-4 py-3 shadow-lg border border-gray-100">
        <Pressable
          onPress={() => router.replace('/(customer)')}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
        >
          <Ionicons name="close" size={20} color="#111318" />
        </Pressable>
        <Text className="text-sm font-bold text-textPrimary">Live Ride Tracking</Text>
        <View className="w-10" />
      </View>

      {/* Map View */}
      <View className="flex-1">
        <MapView
          provider={PROVIDER_GOOGLE}
          className="h-full w-full"
          initialRegion={{
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {/* Customer's Current Location (Customer Marker) */}
          {currentDeviceCoords && (
            <Marker
              coordinate={{
                latitude: currentDeviceCoords.latitude,
                longitude: currentDeviceCoords.longitude,
              }}
              title="Your Location"
            >
              <View className="h-6 w-6 items-center justify-center rounded-full bg-brand/20 border border-brand shadow-sm">
                <View className="h-2.5 w-2.5 rounded-full bg-brand border border-white" />
              </View>
            </Marker>
          )}

          {/* Pickup Marker */}
          <Marker
            coordinate={{
              latitude: activeBooking.pickupLatitude ?? centerLat,
              longitude: activeBooking.pickupLongitude ?? centerLng,
            }}
            title="Pickup Location"
          >
            <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-500 border-2 border-white shadow">
              <Ionicons name="location" size={16} color="white" />
            </View>
          </Marker>

          {/* Drop-off Marker */}
          {activeBooking.dropLatitude && activeBooking.dropLongitude && (
            <>
              <Marker
                coordinate={{
                  latitude: activeBooking.dropLatitude,
                  longitude: activeBooking.dropLongitude,
                }}
                title="Drop-off Destination"
              >
                <View className="h-8 w-8 items-center justify-center rounded-full bg-red-500 border-2 border-white shadow">
                  <Ionicons name="flag" size={16} color="white" />
                </View>
              </Marker>
              {/* Static plan, shown only until the driver's live route below
                  is available — once it is, that's the single source of
                  truth so the two lines don't overlap/conflict. */}
              {!(driverCoords && liveRouteCoords.length >= 2) && (
                <Polyline
                  coordinates={plannedRouteCoords}
                  strokeColor="#0F62FE"
                  strokeWidth={4}
                />
              )}
            </>
          )}

          {/* Driver's live route to pickup (then drop-off once started),
              following actual roads — re-fetched as the driver's position
              changes, so it reflects whatever road they're actually on. */}
          {driverCoords && liveRouteCoords.length >= 2 && (
            <Polyline
              coordinates={liveRouteCoords}
              strokeColor="#10B981"
              strokeWidth={4}
            />
          )}

          {/* Driver Marker */}
          {driverCoords && (
            <AnimatedMarker coordinate={driverCoords} title="Driver location">
              <View className="h-9 w-9 items-center justify-center rounded-full bg-emerald-600 border-2 border-white shadow-lg">
                <Ionicons name="car" size={18} color="white" />
              </View>
            </AnimatedMarker>
          )}
        </MapView>
      </View>

      {/* Bottom status sheet */}
      <Animated.View
        entering={SlideInDown.duration(380)}
        className="bg-white rounded-t-3xl shadow-2xl px-6 pb-8 pt-5 border-t border-gray-100 gap-4"
      >
        <View className="flex-row justify-between items-center border-b border-gray-100 pb-3">
          <View>
            <Text className="text-xs text-gray-400">Trip Code: {activeBooking.bookingNumber}</Text>
            <Text className="text-lg font-bold text-textPrimary capitalize mt-0.5">
              {activeBooking.status.replace('_', ' ')}
              {liveEta !== null ? ` • ETA ${liveEta}m` : ''}
            </Text>
          </View>
          <View className="bg-emerald-50 rounded-full px-3 py-1 border border-emerald-100">
            <Text className="text-[10px] font-bold text-emerald-800 uppercase">₹{activeBooking.totalAmount}</Text>
          </View>
        </View>

        {/* Share OTP Banner */}
        {['pending', 'driver_accepted', 'driver_arriving', 'arrived'].includes(activeBooking.status) && user?.rideOtp && (
          <View className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex-row justify-between items-center my-1">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-bold text-blue-800">Share OTP to start ride</Text>
              <Text className="text-[10px] text-blue-600/80 mt-0.5">Share this 4-digit code with your driver partner when they arrive to begin the trip.</Text>
            </View>
            <View className="bg-blue-600 rounded-xl px-4 py-2 shadow-sm">
              <Text className="text-base font-bold text-white tracking-widest">{user.rideOtp}</Text>
            </View>
          </View>
        )}

        {/* Proximity Banner */}
        {isDriverClose && (
          <View className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex-row items-center gap-3 my-1">
            <Ionicons name="notifications" size={20} color="#D97706" />
            <View className="flex-1">
              <Text className="text-xs font-bold text-amber-800">Driver is almost here!</Text>
              <Text className="text-[10px] text-amber-600 mt-0.5">Your driver is within 50 meters of your pickup. Please get ready to board the vehicle.</Text>
            </View>
          </View>
        )}


        {/* Steps indicator */}
        <View className="flex-row justify-between px-2 my-1">
          {[
            { key: 'pending', label: 'Requested', icon: 'send' },
            { key: 'driver_accepted', label: 'Accepted', icon: 'checkmark-circle' },
            { key: 'arrived', label: 'Arrived', icon: 'pin' },
            { key: 'started', label: 'In Trip', icon: 'navigate' },
          ].map((step) => {
            const isActive = activeBooking.status === step.key ||
              (step.key === 'driver_accepted' && activeBooking.status === 'driver_arriving');

            const isCompleted = (() => {
              const order = ['pending', 'driver_notified', 'driver_accepted', 'driver_arriving', 'arrived', 'started', 'completed'];
              const currentIdx = order.indexOf(activeBooking.status);
              const stepIdx = order.indexOf(step.key);
              return currentIdx > stepIdx;
            })();

            return (
              <View key={step.key} className="items-center flex-1">
                <View
                  className={`h-9 w-9 items-center justify-center rounded-full border-2 ${
                    isActive
                      ? 'bg-brand border-brand text-white'
                      : isCompleted
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-white border-gray-200 text-gray-400'
                  }`}
                >
                  <Ionicons
                    name={step.icon as any}
                    size={16}
                    color={isActive || isCompleted ? 'white' : '#9CA3AF'}
                  />
                </View>
                <Text className="text-[10px] mt-1 font-semibold text-gray-500 text-center">
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Contact driver row */}
        <View className="flex-row items-center justify-between bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <View className="flex-row items-center gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
              {activeBooking.driver?.avatar ? (
                <Text className="font-bold text-sm text-brand">{activeBooking.driver.avatar.slice(0, 2).toUpperCase()}</Text>
              ) : (
                <Ionicons name="person-circle-outline" size={24} color="#0F62FE" />
              )}
            </View>
            <View>
              <Text className="text-sm font-bold text-textPrimary">
                {activeBooking.driver?.name || 'Driver Partner'}
              </Text>
              <Text className="text-xs text-gray-400 capitalize">Payment mode: {activeBooking.paymentMethod}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => {
              const phone = activeBooking.driver?.phone || '+919999999999';
              Linking.openURL(`tel:${phone}`);
            }}
            className="h-10 w-10 items-center justify-center rounded-xl bg-brand/10 active:bg-brand/20"
          >
            <Ionicons name="call" size={18} color="#0F62FE" />
          </Pressable>
        </View>

        {/* Payment due — trip has ended but payment isn't settled yet (if it
            were, the redirect effect above would already have navigated away). */}
        {activeBooking.status === 'completed' && (
          <View className="bg-amber-50 border border-amber-100 rounded-2xl p-4 gap-3">
            <View>
              <Text className="text-xs font-bold text-amber-800">Payment due</Text>
              <Text className="text-[10px] text-amber-700 mt-0.5">
                Pay ₹{formatMoney(activeBooking.totalAmount)} online now, or hand cash to your driver — you'll be
                taken to rate your trip once payment is confirmed.
              </Text>
            </View>
            <Button label="Pay Online (Card / UPI)" onPress={handlePayOnline} isLoading={isPayingOnline} />
          </View>
        )}

        {/* Cancel Button */}
        {['pending', 'driver_notified', 'driver_accepted', 'driver_arriving', 'arrived'].includes(
          activeBooking.status
        ) ? (
          <Button
            label="Cancel Ride Request"
            variant="secondary"
            onPress={handleCancelBooking}
            isLoading={cancelBookingMutation.isPending}
          />
        ) : activeBooking.status === 'cancelled' ? (
          <Button label="Find Another Driver" onPress={goToNearbyDrivers} />
        ) : null}
      </Animated.View>
    </View>
  );
}
