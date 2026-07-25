import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';

import { ScreenContainer } from '@/components/common';
import { fetchBookingHistory } from '@/services/common';
import type { Booking } from '@/types';

export default function CustomerHistory() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['bookingHistory'],
    queryFn: fetchBookingHistory,
  });

  const bookings = data?.bookings ?? [];

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'completed':
        return { bg: 'bg-green-100', text: 'text-green-800' };
      case 'cancelled':
        return { bg: 'bg-red-100', text: 'text-red-800' };
      case 'pending':
      case 'driver_notified':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800' };
      case 'driver_accepted':
      case 'driver_arriving':
      case 'arrived':
      case 'started':
        return { bg: 'bg-blue-100', text: 'text-blue-800' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800' };
    }
  };

  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Date not available';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ScreenContainer className="px-0">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
        <Pressable
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200"
        >
          <Ionicons name="arrow-back" size={20} color="#111318" />
        </Pressable>
        <Text className="text-lg font-bold text-textPrimary">Your Bookings</Text>
        <Pressable
          onPress={() => refetch()}
          className="h-10 w-10 items-center justify-center rounded-xl bg-gray-100 active:bg-gray-200"
        >
          <Ionicons name="refresh" size={18} color="#111318" />
        </Pressable>
      </View>

      {/* Main List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0F62FE" />
          <Text className="mt-2 text-sm text-gray-500">Loading history...</Text>
        </View>
      ) : bookings.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6 gap-2">
          <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
          <Text className="text-base font-bold text-textPrimary">No bookings found</Text>
          <Text className="text-sm text-gray-500 text-center">
            You haven't made any driver bookings yet. Book your first ride from the dashboard!
          </Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16 }}
          renderItem={({ item }) => {
            const badge = getStatusBadge(item.status);
            return (
              <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 shadow-sm gap-3">
                <View className="flex-row justify-between items-center">
                  <View>
                    <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      Trip ID: {item.bookingNumber}
                    </Text>
                    <Text className="text-xs text-gray-500">{formatDate(item.createdAt)}</Text>
                  </View>
                  <View className={`${badge.bg} rounded-full px-2.5 py-1`}>
                    <Text className={`text-[10px] font-bold uppercase ${badge.text}`}>
                      {item.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                {/* Addresses */}
                <View className="gap-2">
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-blue-500" />
                    <Text className="text-xs text-textPrimary flex-1 font-medium" numberOfLines={1}>
                      {item.pickupAddress || 'Pickup Address'}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View className="h-2 w-2 rounded-full bg-red-500" />
                    <Text className="text-xs text-textPrimary flex-1 font-medium" numberOfLines={1}>
                      {item.dropAddress || 'Destination'}
                    </Text>
                  </View>
                </View>

                {/* Fare & Mode */}
                <View className="flex-row justify-between items-center border-t border-gray-50 pt-3">
                  <View className="flex-row gap-2">
                    <View className="bg-gray-100 px-2 py-0.5 rounded">
                      <Text className="text-[10px] text-gray-500 capitalize">{item.serviceType}</Text>
                    </View>
                    <View className="bg-blue-50 px-2 py-0.5 rounded">
                      <Text className="text-[10px] text-brand uppercase">{item.paymentMethod}</Text>
                    </View>
                  </View>
                  <Text className="font-bold text-textPrimary">₹{item.totalAmount}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}
