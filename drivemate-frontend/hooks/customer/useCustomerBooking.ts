import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

import { cancelBooking, createBooking } from '@/services/customer/bookingService';
import { createReview } from '@/services/customer/reviewService';
import { fetchBooking, fetchBookingHistory } from '@/services/common/bookingService';
import type { Booking, CreateBookingRequest, CancelBookingRequest, CreateReviewRequest } from '@/types';

export function useCustomerBooking() {
  const queryClient = useQueryClient();
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);

  // Query Booking History to auto-resume active bookings
  const { data: historyData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['bookingHistory'],
    queryFn: fetchBookingHistory,
  });

  // Track and restore active booking
  useEffect(() => {
    if (historyData?.bookings) {
      const active = historyData.bookings.find(
        (b) =>
          b.status !== 'completed' &&
          b.status !== 'cancelled' &&
          b.status !== 'expired'
      );
      setActiveBookingId(active ? active.id : null);
    }
  }, [historyData]);

  // Query single booking details with status polling
  const { data: activeBooking, refetch: refetchActiveBooking } = useQuery<Booking>({
    queryKey: ['activeBooking', activeBookingId],
    queryFn: () => fetchBooking(activeBookingId!),
    enabled: !!activeBookingId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'cancelled') {
        return false;
      }
      return 4000;
    },
  });

  // Booking Mutations
  const createBookingMutation = useMutation({
    mutationFn: (body: CreateBookingRequest) => createBooking(body),
    onSuccess: (data) => {
      setActiveBookingId(data.id);
      queryClient.invalidateQueries({ queryKey: ['bookingHistory'] });
    },
  });

  const cancelBookingMutation = useMutation({
    mutationFn: (body: CancelBookingRequest) => cancelBooking(body),
    onSuccess: () => {
      setActiveBookingId(null);
      queryClient.removeQueries({ queryKey: ['bookingHistory'] });
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: (body: CreateReviewRequest) => createReview(body),
    onSuccess: () => {
      setActiveBookingId(null);
      queryClient.removeQueries({ queryKey: ['bookingHistory'] });
    },
  });

  return {
    activeBookingId,
    activeBooking,
    isLoadingHistory,
    bookingHistory: historyData?.bookings ?? [],
    setActiveBookingId,

    createBooking: createBookingMutation.mutateAsync,
    isCreatingBooking: createBookingMutation.isPending,
    createBookingError: createBookingMutation.error,

    cancelBooking: cancelBookingMutation.mutateAsync,
    isCancellingBooking: cancelBookingMutation.isPending,
    cancelBookingError: cancelBookingMutation.error,

    submitReview: submitReviewMutation.mutateAsync,
    isSubmittingReview: submitReviewMutation.isPending,
    submitReviewError: submitReviewMutation.error,
  };
}
