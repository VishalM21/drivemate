import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/config/supabase';
import { useLocationStore } from '@/store/locationStore';
import type { Booking } from '@/types';

// Map DB snake_case columns to frontend camelCase properties
export function mapBookingDbToApi(b: any): Partial<Booking> {
  const mapped: Record<string, any> = {};
  if (!b) return mapped;
  
  if (b.id !== undefined) mapped.id = b.id;
  if (b.booking_number !== undefined) mapped.bookingNumber = b.booking_number;
  if (b.customer_id !== undefined) mapped.customerId = b.customer_id;
  if (b.driver_id !== undefined) mapped.driverId = b.driver_id;
  if (b.vehicle_id !== undefined) mapped.vehicleId = b.vehicle_id;
  if (b.service_type !== undefined) mapped.serviceType = b.service_type;
  if (b.route_type !== undefined) mapped.routeType = b.route_type;
  if (b.pickup_address !== undefined) mapped.pickupAddress = b.pickup_address;
  if (b.pickup_latitude !== undefined) mapped.pickupLatitude = b.pickup_latitude;
  if (b.pickup_longitude !== undefined) mapped.pickupLongitude = b.pickup_longitude;
  if (b.drop_address !== undefined) mapped.dropAddress = b.drop_address;
  if (b.drop_latitude !== undefined) mapped.dropLatitude = b.drop_latitude;
  if (b.drop_longitude !== undefined) mapped.dropLongitude = b.drop_longitude;
  if (b.scheduled_at !== undefined) mapped.scheduledAt = b.scheduled_at;
  if (b.started_at !== undefined) mapped.startedAt = b.started_at;
  if (b.completed_at !== undefined) mapped.completedAt = b.completed_at;
  if (b.cancelled_at !== undefined) mapped.cancelledAt = b.cancelled_at;
  if (b.status !== undefined) mapped.status = b.status;
  if (b.driver_fee !== undefined) mapped.driverFee = Number(b.driver_fee);
  if (b.platform_fee !== undefined) mapped.platformFee = Number(b.platform_fee);
  if (b.tax_amount !== undefined) mapped.taxAmount = Number(b.tax_amount);
  if (b.total_amount !== undefined) mapped.totalAmount = Number(b.total_amount);
  if (b.payment_status !== undefined) mapped.paymentStatus = b.payment_status;
  if (b.payment_method !== undefined) mapped.paymentMethod = b.payment_method;
  if (b.cancellation_reason !== undefined) mapped.cancellationReason = b.cancellation_reason;
  if (b.created_at !== undefined) mapped.createdAt = b.created_at;
  if (b.updated_at !== undefined) mapped.updatedAt = b.updated_at;
  return mapped as Partial<Booking>;
}

export function useBookingRealtime(bookingId: string | undefined, driverId: string | undefined) {
  const queryClient = useQueryClient();
  const setTrackedDriverCoords = useLocationStore((state) => state.setTrackedDriverCoords);
  const clearTrackedDriver = useLocationStore((state) => state.clearTrackedDriver);

  // AppState foreground listener to reconnect
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        supabase.realtime.connect();
      }
    });
    return () => {
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!bookingId) return;

    // 1. Subscribe to Bookings Table
    const bookingChannel = supabase
      .channel(`booking-realtime-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          if (payload.new) {
            const updatedBooking = mapBookingDbToApi(payload.new);
            // Update React Query Cache
            queryClient.setQueryData(['activeBooking', bookingId], (old: Booking | undefined) => {
              if (!old) return old;
              return { ...old, ...updatedBooking };
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CLOSED') {
          supabase.realtime.connect();
        }
      });

    // 2. Subscribe to Driver Locations Table
    let locationChannel: any = null;
    if (driverId) {
      locationChannel = supabase
        .channel(`driver-location-realtime-${driverId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'driver_locations',
            filter: `driver_id=eq.${driverId}`,
          },
          (payload) => {
            if (payload.new) {
              const newRow = payload.new as any;
              const { latitude, longitude, heading } = newRow;
              if (latitude !== null && longitude !== null) {
                setTrackedDriverCoords(
                  { latitude, longitude },
                  heading !== null ? Number(heading) : null
                );
              }
            }
          }

        )
        .subscribe((status) => {
          if (status === 'CLOSED') {
            supabase.realtime.connect();
          }
        });
    }

    return () => {
      bookingChannel.unsubscribe();
      if (locationChannel) {
        locationChannel.unsubscribe();
      }
      clearTrackedDriver();
    };
  }, [bookingId, driverId, queryClient, setTrackedDriverCoords, clearTrackedDriver]);
}
