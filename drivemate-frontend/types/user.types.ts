export type UserRole = 'customer' | 'driver' | 'admin';

export interface User {
  id: string;
  phone: string;
  role: UserRole;
  fullName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  rideOtp?: string | null;
  createdAt: string;
}
