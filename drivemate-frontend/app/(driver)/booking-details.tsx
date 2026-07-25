import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { showAlert } from '@/utils/alert';

import { Button, ScreenContainer } from '@/components/common';
import { fetchBooking } from '@/services/common/bookingService';
import { markCodCollected } from '@/services/driver/paymentService';
import { formatMoney } from '@/utils/currency';
import type { Booking } from '@/types';

export default function DriverBookingDetailsScreen() {
  const queryClient = useQueryClient();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  // Fetch Booking Details (polls while payment is still pending, so the
  // "pay online" success shows up here without the driver needing to back out)
  const { data: booking, isLoading, error } = useQuery<Booking>({
    queryKey: ['driverBookingDetails', bookingId],
    queryFn: () => fetchBooking(bookingId!),
    enabled: !!bookingId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'completed' && data?.paymentStatus === 'pending') {
        return 4000;
      }
      return false;
    },
  });

  // Mark Cash Collected Mutation
  const collectCodMutation = useMutation({
    mutationFn: markCodCollected,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driverBookings'] });
      queryClient.invalidateQueries({ queryKey: ['driverEarnings'] });
      queryClient.invalidateQueries({ queryKey: ['driverBookingDetails', bookingId] });
      showAlert('Cash Confirmed', 'The Cash payment has been marked as collected.');
      router.replace('/(driver)');
    },
    onError: (err: any) => {
      showAlert('Error', err.message || 'Could not verify cash payment.');
    },
  });

  const handleCollectCash = () => {
    if (!bookingId) return;
    collectCodMutation.mutate({ bookingId });
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#12805C" />
        <Text className="mt-2 text-sm text-gray-500">Loading booking invoice details...</Text>
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View className="flex-1 items-center justify-center bg-white dark:bg-[#0B0C10] px-6 gap-3">
        <Ionicons name="alert-circle" size={40} color="#DC2626" />
        <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6]">Trip details unavailable</Text>
        <Button label="Go to Dashboard" onPress={() => router.replace('/(driver)')} />
      </View>
    );
  }

  const isPaymentPending = booking.status === 'completed' && booking.paymentStatus === 'pending';

  return (
    <ScreenContainer className="px-0 bg-gray-50 dark:bg-[#0B0C10]">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-[#2C2E3E] bg-white dark:bg-[#161823] shadow-sm">
        <Pressable
          onPress={() => router.replace('/(driver)')}
          className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
        >
          <Ionicons name="arrow-back" size={20} color="#12805C" />
        </Pressable>
        <Text className="text-lg font-bold text-textPrimary dark:text-[#F3F4F6]">Invoice Details</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }} showsVerticalScrollIndicator={false} className="bg-gray-50 dark:bg-[#0B0C10]">
        <View className="gap-5 flex-1 pb-10">
          {/* Payment collection banner */}
          {isPaymentPending ? (
            <View className="bg-amber-50 dark:bg-[#2A1E10] border border-amber-200 dark:border-[#5E3E1A] rounded-3xl p-5 gap-3 shadow-sm">
              <View className="flex-row items-center gap-2">
                <Ionicons name="cash" size={22} color="#D97706" />
                <Text className="text-sm font-bold text-amber-800 dark:text-[#FBBF24]">Awaiting Payment</Text>
              </View>
              <Text className="text-xs text-amber-700 dark:text-[#F59E0B]">
                The passenger owes <Text className="font-black">₹{formatMoney(booking.totalAmount)}</Text> — they may pay by cash or online.
                If they hand you cash, confirm it below. If they pay online instead, this screen updates on its own — no action needed from you.
              </Text>
              <Button
                label="Confirm Cash Collected"
                onPress={handleCollectCash}
                isLoading={collectCodMutation.isPending}
              />
            </View>
          ) : (
            <View className="bg-green-50 dark:bg-[#11241C] border border-green-200 dark:border-[#1E3D2F] rounded-3xl p-5 flex-row items-center gap-3">
              <Ionicons name="checkmark-circle" size={24} color="#12805C" />
              <View className="flex-1">
                <Text className="text-sm font-bold text-green-800 dark:text-[#34D399]">Payment Completed</Text>
                <Text className="text-xs text-green-700 dark:text-[#10B981] mt-0.5">
                  {booking.paymentMethod === 'cod'
                    ? `The Cash of ₹${formatMoney(booking.totalAmount)} was collected and trip invoice was closed successfully.`
                    : `₹${formatMoney(booking.totalAmount)} was paid online (${booking.paymentMethod}) and trip invoice was closed successfully.`}
                </Text>
              </View>
            </View>
          )}

          {/* Booking summary list */}
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1">
            Trip Summary
          </Text>
          <View className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-5 gap-4 shadow-sm">
            <View className="flex-row justify-between border-b border-gray-50 dark:border-[#2C2E3E] pb-3">
              <Text className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase">Booking Number</Text>
              <Text className="text-xs font-bold text-textPrimary dark:text-[#F3F4F6] uppercase">{booking.bookingNumber}</Text>
            </View>
            <View className="flex-row justify-between border-b border-gray-50 dark:border-[#2C2E3E] pb-3">
              <Text className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase">Service Mode</Text>
              <Text className="text-xs font-bold text-textPrimary dark:text-[#F3F4F6] capitalize">{booking.serviceType}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase">Trip Date</Text>
              <Text className="text-xs font-semibold text-textPrimary dark:text-[#F3F4F6]">
                {new Date(booking.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          {/* Route details */}
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1">
            Addresses
          </Text>
          <View className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-5 gap-3 shadow-sm">
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-blue-500" />
              <Text className="text-xs text-textPrimary dark:text-[#F3F4F6] font-semibold flex-1" numberOfLines={1}>
                Pickup: {booking.pickupAddress || 'Customer Location'}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full bg-red-500" />
              <Text className="text-xs text-textPrimary dark:text-[#F3F4F6] font-semibold flex-1" numberOfLines={1}>
                Drop: {booking.dropAddress || 'Destination Address'}
              </Text>
            </View>
          </View>

          {/* Fare breakdown details */}
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1">
            Earnings Invoice
          </Text>
          <View className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-5 gap-2.5 shadow-sm">
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-500 dark:text-gray-400">Customer Total Paid</Text>
              <Text className="text-xs font-bold text-textPrimary dark:text-[#F3F4F6]">₹{formatMoney(booking.totalAmount)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-500 dark:text-gray-400">Platform Convenience Fee</Text>
              <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400">- ₹{formatMoney(booking.platformFee)}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-xs text-gray-500 dark:text-gray-400">Tax & GST</Text>
              <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400">- ₹{formatMoney(booking.taxAmount)}</Text>
            </View>
            <View className="flex-row justify-between border-t border-gray-100 dark:border-[#2C2E3E] pt-2 mt-1">
              <Text className="text-sm font-bold text-textPrimary dark:text-[#F3F4F6]">Your Share Net Payout</Text>
              <Text className="text-sm font-black text-driver dark:text-[#10B981]">₹{formatMoney(booking.driverFee)}</Text>
            </View>
          </View>

          {!isPaymentPending && (
            <View className="pt-2">
              <Button label="Dashboard Home" onPress={() => router.replace('/(driver)')} />
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
