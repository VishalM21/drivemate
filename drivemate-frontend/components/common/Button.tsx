import { ActivityIndicator, Pressable, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface ButtonProps {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  label,
  onPress,
  isLoading = false,
  disabled = false,
  variant = 'primary',
}: ButtonProps) {
  const isDisabled = disabled || isLoading;
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const variantClasses =
    variant === 'primary'
      ? 'bg-brand dark:bg-brand'
      : 'border border-border dark:border-[#2C2E3E] bg-white dark:bg-[#161823]';
  const textClasses =
    variant === 'primary'
      ? 'text-base font-bold text-white'
      : 'text-base font-bold text-textPrimary dark:text-[#F3F4F6]';

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: 100, easing: Easing.out(Easing.quad) });
        opacity.value = withTiming(0.88, { duration: 100 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) });
        opacity.value = withTiming(1, { duration: 120 });
      }}
      style={animatedStyle}
      className={`h-14 items-center justify-center rounded-2xl ${variantClasses} ${
        isDisabled ? 'opacity-50' : ''
      }`}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : '#0F62FE'} />
      ) : (
        <Text className={textClasses}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}
