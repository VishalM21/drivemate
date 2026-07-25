import { create } from 'zustand';

import type { Coordinates } from '@/types';

interface LocationState {
  currentDeviceCoords: Coordinates | null;
  currentHeading: number | null;
  trackedDriverCoords: Coordinates | null;
  trackedDriverHeading: number | null;
}

interface LocationActions {
  setCurrentDeviceCoords: (coords: Coordinates, heading?: number | null) => void;
  setTrackedDriverCoords: (coords: Coordinates, heading?: number | null) => void;
  clearTrackedDriver: () => void;
}

type LocationStore = LocationState & LocationActions;

export const useLocationStore = create<LocationStore>()((set) => ({
  currentDeviceCoords: null,
  currentHeading: null,
  trackedDriverCoords: null,
  trackedDriverHeading: null,

  setCurrentDeviceCoords: (coords, heading = null) =>
    set({ currentDeviceCoords: coords, currentHeading: heading }),
  setTrackedDriverCoords: (coords, heading = null) =>
    set({ trackedDriverCoords: coords, trackedDriverHeading: heading }),
  clearTrackedDriver: () =>
    set({ trackedDriverCoords: null, trackedDriverHeading: null }),
}));
