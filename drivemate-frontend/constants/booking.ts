import type { RouteType, ServiceType } from '@/types';

export const SERVICE_TYPES: ServiceType[] = ['local', 'outstation', 'airport', 'monthly'];
export const ROUTE_TYPES: RouteType[] = ['one_way', 'round_trip', 'hourly'];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  local: 'Local',
  outstation: 'Outstation',
  airport: 'Airport',
  monthly: 'Monthly',
};

export const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  one_way: 'One way',
  round_trip: 'Round trip',
  hourly: 'Hourly',
};

export const DEFAULT_NEARBY_RADIUS_KM = 10;
export const MAX_NEARBY_RADIUS_KM = 100;
export const CURRENCY_SYMBOL = '₹';
