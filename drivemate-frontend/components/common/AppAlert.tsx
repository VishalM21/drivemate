import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { useAlertStore } from '@/store/alertStore';
import type { AlertButtonSpec } from '@/store/alertStore';

function buttonTextClass(style: AlertButtonSpec['style'], isPrimary: boolean) {
  if (style === 'destructive') return 'text-danger font-bold';
  if (style === 'cancel') return 'text-textSecondary dark:text-gray-400 font-semibold';
  return isPrimary ? 'text-brand dark:text-brand-light font-bold' : 'text-textPrimary dark:text-[#F3F4F6] font-semibold';
}

/** Themed replacement for the native Alert.alert dialog — mount once at the
 * app root; trigger from anywhere via `showAlert()` (utils/alert.ts). */
export function AppAlert() {
  const { visible, title, message, buttons, hide } = useAlertStore();

  if (!visible) return null;

  const handlePress = (btn: AlertButtonSpec) => {
    hide();
    btn.onPress?.();
  };

  const isRow = buttons.length === 2;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={hide}>
      <Animated.View
        entering={FadeIn.duration(180)}
        exiting={FadeOut.duration(150)}
        className="flex-1 items-center justify-center bg-black/50 px-8"
      >
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          className="w-full max-w-sm bg-white dark:bg-[#161823] rounded-3xl overflow-hidden shadow-2xl"
        >
          <View className="px-6 pt-6 pb-5 gap-1.5">
            <Text className="text-lg font-black text-textPrimary dark:text-[#F3F4F6] text-center">
              {title}
            </Text>
            {message ? (
              <Text className="text-sm text-textSecondary dark:text-gray-400 text-center leading-5 mt-1">
                {message}
              </Text>
            ) : null}
          </View>

          <View className={isRow ? 'flex-row border-t border-gray-100 dark:border-[#2C2E3E]' : 'border-t border-gray-100 dark:border-[#2C2E3E]'}>
            {buttons.map((btn, index) => (
              <Pressable
                key={`${btn.text}-${index}`}
                onPress={() => handlePress(btn)}
                className={`items-center justify-center py-4 active:bg-gray-50 dark:active:bg-[#1E2030] ${
                  isRow ? 'flex-1' : ''
                } ${isRow && index === 0 ? 'border-r border-gray-100 dark:border-[#2C2E3E]' : ''} ${
                  !isRow && index > 0 ? 'border-t border-gray-100 dark:border-[#2C2E3E]' : ''
                }`}
              >
                <Text className={`text-base ${buttonTextClass(btn.style, index === buttons.length - 1)}`}>
                  {btn.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
