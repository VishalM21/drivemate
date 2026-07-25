import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { z } from 'zod';

import { ApiRequestError } from '@/api/client';
import { Button, ScreenContainer, TextField } from '@/components/common';
import { useCountdown, useLoginFlow } from '@/hooks/common';
import { getRouteGroupForRole } from '@/navigation';
import { getErrorMessage } from '@/utils/errorMessages';

const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

type OtpFormValues = z.infer<typeof otpSchema>;

const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const {
    phoneNumber,
    lastRole,
    confirmOtp,
    isConfirmingOtp,
    confirmOtpError,
    completeSession,
    isCompletingSession,
    completeSessionError,
    resendOtp,
    isSendingOtp,
  } = useLoginFlow();

  // Captured once at mount so it isn't affected by the flow store resetting
  // after a successful login later in this screen's lifetime.
  const initialPhoneNumber = useRef(phoneNumber).current;
  const { remaining, restart, isActive } = useCountdown(RESEND_SECONDS);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpFormValues>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: '' },
  });

  useEffect(() => {
    if (!initialPhoneNumber) {
      router.replace('/(auth)/login');
    }
  }, [initialPhoneNumber]);

  const onSubmit = handleSubmit(async ({ code }) => {
    try {
      await confirmOtp(code);

      if (lastRole) {
        try {
          const session = await completeSession(lastRole);
          router.replace(getRouteGroupForRole(session.user.role));
          return;
        } catch (error) {
          if (error instanceof ApiRequestError && error.code === 'FORBIDDEN') {
            router.replace('/(auth)/role-selection');
            return;
          }
          throw error;
        }
      }

      router.replace('/(auth)/role-selection');
    } catch {
      // surfaced via confirmOtpError / completeSessionError below
    }
  });

  const handleResend = () => {
    resendOtp();
    restart();
  };

  const combinedError = confirmOtpError ?? completeSessionError;

  return (
    <ScreenContainer>
      <View className="flex-1 justify-center gap-8">
        <View className="gap-2">
          <Text className="text-3xl font-extrabold text-textPrimary dark:text-[#F3F4F6]">Verify your number</Text>
          <Text className="text-base text-textSecondary dark:text-gray-400">
            {initialPhoneNumber
              ? `Enter the 6-digit code sent to ${initialPhoneNumber}`
              : 'Enter the 6-digit code sent to your phone'}
          </Text>
        </View>

        <Controller
          control={control}
          name="code"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="Verification code"
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.code?.message}
            />
          )}
        />

        {combinedError ? (
          <Text className="text-sm text-danger">{getErrorMessage(combinedError)}</Text>
        ) : null}

        <Button
          label="Verify"
          onPress={onSubmit}
          isLoading={isConfirmingOtp || isCompletingSession}
        />

        <Button
          label={isActive ? `Resend code in ${remaining}s` : 'Resend code'}
          onPress={handleResend}
          variant="secondary"
          disabled={isActive}
          isLoading={isSendingOtp}
        />
      </View>
    </ScreenContainer>
  );
}
