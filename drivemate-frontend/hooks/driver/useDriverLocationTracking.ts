import { useEffect } from 'react';
import * as Location from 'expo-location';

import { useLocationStore } from '@/store/locationStore';
import { updateDriverLocation } from '@/services/driver/locationService';

const PING_INTERVAL_MS = 15000;

// Fixed, ~2km away from the customer's fallback (26.4499, 80.3319) so the two
// sides of a test booking never collapse onto the same point on an emulator
// without GPS. Only used when real GPS is unavailable.
const DRIVER_FALLBACK_COORDS = { latitude: 26.4679, longitude: 80.3319 };

/**
 * Keeps pushing the driver's location while `enabled` (online + verified),
 * independent of which driver screen is currently mounted — location must
 * keep flowing through incoming-booking/ride-screen, not just the dashboard.
 */
export function useDriverLocationTracking(enabled: boolean) {
  const setCurrentDeviceCoords = useLocationStore((state) => state.setCurrentDeviceCoords);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const pingLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        let coords = DRIVER_FALLBACK_COORDS;
        let heading = 0;
        let speed = 0;
        let accuracy = 0;
        let usedRealGps = false;

        if (status === 'granted') {
          try {
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const lat = location.coords.latitude;
            const lon = location.coords.longitude;
            const isInsideIndia = lat >= 8 && lat <= 38 && lon >= 68 && lon <= 98;
            if (isInsideIndia) {
              coords = { latitude: lat, longitude: lon };
              heading = location.coords.heading ?? 0;
              speed = location.coords.speed ?? 0;
              accuracy = location.coords.accuracy ?? 0;
              usedRealGps = true;
            }
          } catch (gpsErr) {
            console.log('GPS lookup failed, using fixed fallback:', gpsErr);
          }
        }

        // No real GPS fix in production: don't fabricate a location.
        if (!usedRealGps && !__DEV__) return;
        if (cancelled) return;

        // Update the driver's own local screens immediately — this shouldn't
        // block on (or get lost to) a flaky backend sync below, otherwise a
        // single dropped request leaves "distance to pickup" stuck at
        // Unknown for a full retry cycle even though we already know exactly
        // where the driver is.
        setCurrentDeviceCoords(coords);

        try {
          await updateDriverLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
            heading,
            speed,
            accuracy,
            isOnline: true,
          });
        } catch (syncErr) {
          console.warn('Driver location backend sync failed (will retry next tick):', syncErr);
        }
      } catch (err) {
        console.warn('Driver live location ping failed:', err);
      }
    };

    pingLocation();
    const intervalId = setInterval(pingLocation, PING_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [enabled, setCurrentDeviceCoords]);
}
