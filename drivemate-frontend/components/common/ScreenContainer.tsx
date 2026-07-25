import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, View, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ScreenContainerProps extends PropsWithChildren {
  className?: string;
}

export function ScreenContainer({ children, className }: ScreenContainerProps) {
  const isDark = useColorScheme() === 'dark';
  const backgroundColor = isDark ? '#0B0C10' : '#FAFAFC';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className={`flex-1 px-6 bg-[#FAFAFC] dark:bg-[#0B0C10] ${className ?? ''}`}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

