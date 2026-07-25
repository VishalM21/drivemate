import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/authStore';
import { fetchDriverEarnings } from '@/services/driver/earningsService';
import { setDriverAvailability, upsertDriverProfile } from '@/services/driver/profileService';
import { updateDriverLocation } from '@/services/driver/locationService';
import type { DriverEarnings, SetAvailabilityRequest, UpdateDriverLocationRequest, UpsertDriverProfileRequest } from '@/types';

export function useDriverDashboard() {
  const queryClient = useQueryClient();
  const setDriverProfile = useAuthStore((state) => state.setDriverProfile);
  const driverProfile = useAuthStore((state) => state.driverProfile);

  // Fetch driver earnings (today, week, month)
  const { data: earnings, refetch: refetchEarnings, isLoading: isLoadingEarnings } = useQuery<DriverEarnings>({
    queryKey: ['driverEarnings'],
    queryFn: fetchDriverEarnings,
    enabled: !!driverProfile,
  });

  // Toggling Availability
  const toggleAvailabilityMutation = useMutation({
    mutationFn: (body: SetAvailabilityRequest) => setDriverAvailability(body),
    onSuccess: (data) => {
      setDriverProfile(data);
    },
  });

  // Location Updates
  const updateLocationMutation = useMutation({
    mutationFn: (body: UpdateDriverLocationRequest) => updateDriverLocation(body),
  });

  // Profile Setup / Update
  const updateProfileMutation = useMutation({
    mutationFn: (body: UpsertDriverProfileRequest) => upsertDriverProfile(body),
    onSuccess: (data) => {
      setDriverProfile(data);
      queryClient.invalidateQueries({ queryKey: ['driverEarnings'] });
    },
  });

  return {
    earnings,
    isLoadingEarnings,
    refetchEarnings,
    driverProfile,

    toggleAvailability: toggleAvailabilityMutation.mutateAsync,
    isTogglingAvailability: toggleAvailabilityMutation.isPending,
    toggleAvailabilityError: toggleAvailabilityMutation.error,

    updateLocation: updateLocationMutation.mutateAsync,
    isUpdatingLocation: updateLocationMutation.isPending,

    updateProfile: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
    updateProfileError: updateProfileMutation.error,
  };
}
