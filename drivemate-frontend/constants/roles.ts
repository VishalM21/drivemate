import type { UserRole } from '@/types';

export type AppRole = Extract<UserRole, 'customer' | 'driver'>;

export const APP_ROLES: AppRole[] = ['customer', 'driver'];

export const ROLE_LABELS: Record<UserRole, string> = {
  customer: 'Customer',
  driver: 'Driver',
  admin: 'Admin',
};
