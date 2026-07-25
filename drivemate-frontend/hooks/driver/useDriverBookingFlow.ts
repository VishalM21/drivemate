import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchBookingHistory } from '@/services/common/bookingService';
import {
  acceptBooking,
  completeTrip,
  declineBooking,
  markDriverArrived,
  startTrip,
} from '@/services/driver/bookingService';
import { markCodCollected } from '@/services/driver/paymentService';
import type { Booking, BookingIdRequest, DeclineBookingRequest } from '@/types';

interface UseDriverBookingFlowParams {
  isAvailable?: boolean;
}

export function useDriverBookingFlow({ isAvailable = false }: UseDriverBookingFlowParams = {}) {
  const queryClient = useQueryClient();

  // Fetch driver booking history (which contains current assigned pending/active trips)
  const { data: historyData, refetch: refetchHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['driverBookings'],
    queryFn: fetchBookingHistory,
    refetchInterval: isAvailable ? 5000 : 15000, // Poll faster when online looking for requests
  });

  const bookings = historyData?.bookings ?? [];

  // Active assignment/request
  const activeBooking = bookings.find(
    (b) =>
      b.status !== 'completed' &&
      b.status !== 'cancelled' &&
      b.status !== 'expired'
  );

  // Completed booking awaiting COD collection
  const pendingCodBooking = bookings.find(
    (b) => b.status === 'completed' && b.paymentStatus === 'pending'
  );

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: (body: BookingIdRequest) => acceptBooking(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverBookings'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (body: DeclineBookingRequest) => declineBooking(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverBookings'] });
    },
  });

  const arrivedMutation = useMutation({
    mutationFn: (body: BookingIdRequest) => markDriverArrived(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverBookings'] });
    },
  });

  const startMutation = useMutation({
    mutationFn: (body: BookingIdRequest) => startTrip(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverBookings'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (body: BookingIdRequest) => completeTrip(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverBookings'] });
      queryClient.invalidateQueries({ queryKey: ['driverEarnings'] });
    },
  });

  const collectCodMutation = useMutation({
    mutationFn: (body: BookingIdRequest) => markCodCollected(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverBookings'] });
      queryClient.invalidateQueries({ queryKey: ['driverEarnings'] });
    },
  });

  return {
    bookings,
    activeBooking,
    pendingCodBooking,
    isLoadingHistory,
    refetchHistory,

    acceptBooking: acceptMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,
    acceptError: acceptMutation.error,

    declineBooking: declineMutation.mutateAsync,
    isDeclining: declineMutation.isPending,
    declineError: declineMutation.error,

    markArrived: arrivedMutation.mutateAsync,
    isMarkingArrived: arrivedMutation.isPending,
    arrivedError: arrivedMutation.error,

    startTrip: startMutation.mutateAsync,
    isStartingTrip: startMutation.isPending,
    startTripError: startMutation.error,

    completeTrip: completeMutation.mutateAsync,
    isCompletingTrip: completeMutation.isPending,
    completeTripError: completeMutation.error,

    collectCod: collectCodMutation.mutateAsync,
    isCollectingCod: collectCodMutation.isPending,
    collectCodError: collectCodMutation.error,
  };
}
