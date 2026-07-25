import type { UserRole } from '@/types';

export type RootRouteGroup = '/(auth)' | '/(customer)' | '/(driver)';

export function getRouteGroupForRole(role: UserRole | null): RootRouteGroup {
  if (role === 'driver') return '/(driver)';
  if (role === 'customer' || role === 'admin') return '/(customer)';
  return '/(auth)';
}
