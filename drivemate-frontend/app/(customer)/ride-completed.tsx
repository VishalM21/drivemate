import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { showAlert } from '@/utils/alert';

import { Button, ScreenContainer } from '@/components/common';
import { createReview } from '@/services/customer/reviewService';

export default function RideCompletedScreen() {
  const queryClient = useQueryClient();
  const { bookingId, totalAmount } = useLocalSearchParams<{
    bookingId: string;
    totalAmount: string;
  }>();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Submit Review Mutation
  const createReviewMutation = useMutation({
    mutationFn: createReview,
    onSuccess: () => {
      // Home's useCustomerBooking() mounts fresh right after this and reads
      // ['bookingHistory'] to decide whether to bounce back into the ride
      // flow — a plain invalidate still serves the pre-completion cache on
      // that first render, so remove it outright to force a clean refetch.
      queryClient.removeQueries({ queryKey: ['bookingHistory'] });
      showAlert('Review Submitted', 'Thank you for your valuable feedback.');
      router.replace('/(customer)');
    },
    onError: (err: any) => {
      showAlert('Error', err.message || 'Could not submit review.');
    },
  });

  const handleSubmit = () => {
    if (!bookingId) return;
    createReviewMutation.mutate({
      bookingId,
      rating,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <ScreenContainer className="px-6 justify-center gap-6 bg-white dark:bg-[#0B0C10]">
      <View className="items-center gap-2">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-[#1E302A] border-2 border-emerald-100 dark:border-[#1E3D30] shadow-md">
          <Ionicons name="flag" size={28} color="#12805C" />
        </View>
        <Text className="text-2xl font-black text-textPrimary dark:text-[#F3F4F6] text-center">Trip Completed</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400 text-center px-4">
          You have successfully completed your trip. Please pay the driver the amount due below in Cash (COD).
        </Text>
      </View>

      {/* Cash collected box */}
      <View className="bg-gray-50 dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-5 items-center gap-1 shadow-sm">
        <Text className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">COD Cash Amount Due</Text>
        <Text className="text-3xl font-black text-brand">₹{totalAmount || '0'}</Text>
      </View>

      {/* Interactive Rating stars */}
      <View className="items-center gap-2 pt-2">
        <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase">Rate Your Driver</Text>
        <View className="flex-row gap-4 py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable
              key={star}
              onPress={() => setRating(star)}
              className="p-1 active:scale-125"
            >
              <Ionicons
                name={star <= rating ? 'star' : 'star-outline'}
                size={34}
                color="#D97706"
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Comment section */}
      <View className="gap-2">
        <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase">Add a Comment</Text>
        <TextInput
          className="h-24 bg-gray-50 dark:bg-[#1E2030] border border-border dark:border-[#2C2E3E] rounded-2xl px-4 py-3 text-sm text-textPrimary dark:text-[#F3F4F6]"
          placeholder="Leave a message about your driver..."
          placeholderTextColor="#6B7280"
          value={comment}
          onChangeText={setComment}
          multiline
          textAlignVertical="top"
        />
      </View>

      {/* Submit Button */}
      <View className="pt-2">
        <Button
          label="Submit Feedback & Exit"
          onPress={handleSubmit}
          isLoading={createReviewMutation.isPending}
        />
      </View>
    </ScreenContainer>
  );
}
