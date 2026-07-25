import type { User, UserRole } from './user.types';
import type { DriverProfile } from './driver.types';
import type { Vehicle } from './booking.types';

export interface CreateSessionRequest {
  firebaseIdToken: string;
  role: UserRole;
}

export interface SessionResponse {
  accessToken: string;
  tokenType: 'bearer';
  user: User;
}

export interface AuthMeResponse extends User {
  driverProfile?: DriverProfile;
  defaultVehicle?: Vehicle;
}

export interface SaveFcmTokenRequest {
  fcmToken: string;
}

export interface SaveFcmTokenResponse {
  saved: true;
}

export interface LogoutResponse {
  loggedOut: true;
}
