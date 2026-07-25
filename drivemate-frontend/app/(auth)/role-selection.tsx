import { router } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { ScreenContainer } from '@/components/common';
import { APP_ROLES, ROLE_LABELS, type AppRole } from '@/constants/roles';
import { useLoginFlow } from '@/hooks/common';
import { getRouteGroupForRole } from '@/navigation';
import { getErrorMessage } from '@/utils/errorMessages';

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  customer: 'Book a professional driver for your own car.',
  driver: 'Drive for customers and earn on your schedule.',
};

export default function RoleSelectionScreen() {
  const { completeSession, isCompletingSession, completeSessionError } = useLoginFlow();

  const handleSelect = async (role: AppRole) => {
    try {
      const session = await completeSession(role);
      router.replace(getRouteGroupForRole(session.user.role));
    } catch {
      // surfaced via completeSessionError below
    }
  };

  return (
    <ScreenContainer>
      <View className="flex-1 justify-center gap-8">
        <View className="gap-2">
          <Text className="text-3xl font-extrabold text-textPrimary dark:text-[#F3F4F6]">How will you use DriveMate?</Text>
          <Text className="text-base text-textSecondary dark:text-gray-400">
            You can&apos;t change this later, so pick the one that fits.
          </Text>
        </View>

        <View className="gap-4">
          {APP_ROLES.map((role) => (
            <Pressable
              key={role}
              onPress={() => handleSelect(role)}
              disabled={isCompletingSession}
              className="gap-2 rounded-2xl border border-border dark:border-[#2C2E3E] bg-white dark:bg-[#161823] px-6 py-5 active:scale-[0.98]"
            >
              <Text className="text-lg font-bold text-textPrimary dark:text-[#F3F4F6]">{ROLE_LABELS[role]}</Text>
              <Text className="text-sm text-textSecondary dark:text-gray-400">{ROLE_DESCRIPTIONS[role]}</Text>
            </Pressable>
          ))}
        </View>

        {isCompletingSession ? <ActivityIndicator color="#0F62FE" /> : null}

        {completeSessionError ? (
          <Text className="text-sm text-danger">{getErrorMessage(completeSessionError)}</Text>
        ) : null}
      </View>
    </ScreenContainer>
  );
}
