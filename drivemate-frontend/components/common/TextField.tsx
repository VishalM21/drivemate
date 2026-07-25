import React, { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  prefix?: string;
}

export function TextField({ label, error, prefix, ...inputProps }: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-textSecondary dark:text-gray-400">{label}</Text>
      <View
        className={`flex-row items-center rounded-2xl border px-4 bg-white dark:bg-[#161823] ${
          error
            ? 'border-danger'
            : isFocused
            ? 'border-brand dark:border-brand-light'
            : 'border-border dark:border-[#2C2E3E]'
        }`}
      >
        {prefix ? (
          <Text className="mr-2 text-base font-medium text-textPrimary dark:text-[#F3F4F6]">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          placeholderTextColor="#6B7280"
          className="h-14 flex-1 text-base text-textPrimary dark:text-[#F3F4F6]"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...inputProps}
        />
      </View>
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
}

