import { colors } from './colors';
import { radius, spacing } from './spacing';
import { typography } from './typography';

export * from './colors';
export * from './spacing';
export * from './typography';

export const theme = {
  colors,
  spacing,
  radius,
  typography,
} as const;
