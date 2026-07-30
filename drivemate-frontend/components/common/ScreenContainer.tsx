import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';

interface ScreenContainerProps extends PropsWithChildren {
  className?: string;
}

export function ScreenContainer({ children, className }: ScreenContainerProps) {
  // Nativewind's own hook, not React Native's raw one — this is the same
  // source of truth that drives every `dark:` className in the app, so this
  // screen's background can never disagree with its own children.
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
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

