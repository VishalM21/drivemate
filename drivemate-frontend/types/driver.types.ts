import type { Coordinates } from './location.types';

export interface DriverProfile {
  id: string;
  userId: string;
  rating: number;
  totalTrips: number;
  experienceYears: number;
  languages: string[];
  pricePerTrip: number;
  isVerified: boolean;
  isAvailable: boolean;
  serviceLocal: boolean;
  serviceOutstation: boolean;
  serviceAirport: boolean;
  serviceMonthly: boolean;
  serviceNight: boolean;
  licenseNumber: string;
  email: string | null;
}

export interface NearbyDriver {
  id: string;
  userId: string;
  name: string;
  phone: string;
  avatar: string;
  rating: number;
  totalTrips: number;
  experience: string;
  languages: string[];
  pricePerTrip: number;
  isVerified: boolean;
  isAvailable: boolean;
  location: Coordinates;
  distanceKm: number;
  etaMinutes: number;
  serviceLocal: boolean;
  serviceOutstation: boolean;
  serviceAirport: boolean;
  serviceMonthly: boolean;
  serviceNight: boolean;
}

export interface NearbyDriversResponse {
  drivers: NearbyDriver[];
}

export interface NearbyDriversQuery {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  serviceType?: string;
}

export interface UpsertDriverProfileRequest {
  pricePerTrip?: number;
  experienceYears?: number;
  languages?: string[];
  licenseNumber?: string;
  email?: string;
  serviceLocal?: boolean;
  serviceOutstation?: boolean;
  serviceAirport?: boolean;
  serviceMonthly?: boolean;
  serviceNight?: boolean;
}

export interface SetAvailabilityRequest {
  isAvailable: boolean;
}

export interface UpdateDriverLocationRequest {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  isOnline?: boolean;
}

export interface DriverLocation {
  driverId: string;
  latitude: number | null;
  longitude: number | null;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  isOnline: boolean;
  updatedAt: string;
}

export interface DriverEarnings {
  today: number;
  week: number;
  month: number;
  total: number;
  totalTrips: number;
  averagePerTrip: number;
}
