import { apiClient, ENDPOINTS, unwrap } from '@/api';
import type { ApiResponse, Vehicle } from '@/types';

export interface UpsertDefaultVehicleRequest {
  vehicleNumber: string;
  vehicleModel?: string;
}

export function upsertDefaultVehicle(body: UpsertDefaultVehicleRequest): Promise<Vehicle> {
  return unwrap(apiClient.post<ApiResponse<Vehicle>>(ENDPOINTS.vehiclesUpsert, body));
}
