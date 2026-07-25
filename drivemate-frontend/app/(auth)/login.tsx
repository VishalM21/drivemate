import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Text, View } from 'react-native';
import { z } from 'zod';

import { Button, ScreenContainer, TextField } from '@/components/common';
import { useLoginFlow } from '@/hooks/common';
import { getErrorMessage } from '@/utils/errorMessages';

const phoneSchema = z.object({
  phoneNumber: z.string().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

type PhoneFormValues = z.infer<typeof phoneSchema>;

export default function LoginScreen() {
  const { sendOtp, isSendingOtp, sendOtpError } = useLoginFlow();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: '' },
  });

  const onSubmit = handleSubmit(async ({ phoneNumber }) => {
    console.log("onSubmit triggered with phone number:", phoneNumber);
    try {
      await sendOtp(`+91${phoneNumber}`);
      router.push('/(auth)/otp');
    } catch (err) {
      console.error("sendOtp failed with error:", err);
      // surfaced via sendOtpError below
    }
  });

  return (
    <ScreenContainer>
      <View className="flex-1 justify-center gap-8">
        <View className="gap-2">
          <Text className="text-3xl font-extrabold text-textPrimary dark:text-[#F3F4F6]">Welcome to DriveMate</Text>
          <Text className="text-base text-textSecondary dark:text-gray-400">
            Enter your mobile number to sign in or create an account.
          </Text>
        </View>

        <Controller
          control={control}
          name="phoneNumber"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextField
              label="Mobile number"
              prefix="+91"
              placeholder="98765 43210"
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
              value={value}
              onChangeText={(text) => {
                console.log("onChangeText:", text);
                onChange(text);
              }}
              onBlur={onBlur}
              error={errors.phoneNumber?.message}
            />
          )}
        />

        {sendOtpError ? (
          <Text className="text-sm text-danger">{getErrorMessage(sendOtpError)}</Text>
        ) : null}

        <Button
          label="Continue"
          onPress={() => {
            console.log("Continue button pressed!");
            onSubmit();
          }}
          isLoading={isSendingOtp}
        />
      </View>
    </ScreenContainer>
  );
}
