import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { useThemeStore } from '@/store/themeStore';

/** Explicit Light/Dark picker — the app never follows the OS theme, so
 * picking one here is the only thing that changes appearance, and it stays
 * put across screens and app restarts. */
export function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <View className="flex-row bg-gray-100 dark:bg-[#1E2030] rounded-2xl p-1">
      {(['light', 'dark'] as const).map((option) => {
        const active = theme === option;
        return (
          <Pressable
            key={option}
            onPress={() => setTheme(option)}
            className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl ${
              active ? 'bg-white dark:bg-[#2C2E3E] shadow-sm' : ''
            }`}
          >
            <Ionicons
              name={option === 'light' ? 'sunny' : 'moon'}
              size={14}
              color={active ? (option === 'light' ? '#D97706' : '#818CF8') : '#9CA3AF'}
            />
            <Text
              className={`text-xs font-bold capitalize ${
                active ? 'text-textPrimary dark:text-[#F3F4F6]' : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
