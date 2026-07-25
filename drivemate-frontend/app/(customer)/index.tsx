import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  FlatList,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { showAlert } from '@/utils/alert';
import { Button, ScreenContainer, TextField, FreeMapView as MapView, Marker, Polyline, PROVIDER_GOOGLE } from '@/components/common';
import { useAuthSession } from '@/hooks/common';
import { useLocationStore } from '@/store/locationStore';
import { useCustomerBooking } from '@/hooks/customer';
import { searchPlaces, fetchGooglePlaceCoordinates } from '@/services/common/placesService';
import type { PlaceSuggestion } from '@/services/common/placesService';
import type { ServiceType } from '@/types';

const DEFAULT_LATITUDE = 26.4499;
const DEFAULT_LONGITUDE = 80.3319;

export default function CustomerHome() {
  const { user } = useAuthSession();
  const { currentDeviceCoords, setCurrentDeviceCoords } = useLocationStore();

  // Location states
  const [pickupAddress, setPickupAddress] = useState(__DEV__ ? 'Kanpur, Uttar Pradesh, India' : 'Locating current position...');
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(
    __DEV__ ? { latitude: 26.4499, longitude: 80.3319 } : null
  );

  const [dropAddress, setDropAddress] = useState('');
  const [dropCoords, setDropCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [selectedService, setSelectedService] = useState<ServiceType>('local');
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [hasSyncedCoords, setHasSyncedCoords] = useState(false);

  // Map Selector Modes: null | 'pickup' | 'drop'
  const [activeSelectorMode, setActiveSelectorMode] = useState<'pickup' | 'drop' | null>(null);
  const [mapSelectorCoords, setMapSelectorCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapSelectorAddress, setMapSelectorAddress] = useState('');

  // Suggestions/Search states
  const [mapSearchText, setMapSearchText] = useState('');
  const [mapSuggestions, setMapSuggestions] = useState<PlaceSuggestion[]>([]);
  const [showMapSuggestions, setShowMapSuggestions] = useState(false);
  const [isSearchingMap, setIsSearchingMap] = useState(false);

  const mapRef = useRef<any | null>(null);
  const mapSelectorRef = useRef<any | null>(null);
  const searchTimeoutRef = useRef<any | null>(null);

  const { activeBookingId } = useCustomerBooking();

  // Redirect to tracking if there's an active booking in progress
  useEffect(() => {
    if (activeBookingId) {
      const redirectTimeout = setTimeout(() => {
        router.replace({
          pathname: '/(customer)/ride-tracking',
          params: { bookingId: activeBookingId },
        });
      }, 0);
      return () => clearTimeout(redirectTimeout);
    }
  }, [activeBookingId]);

  // Request location permission and fetch current position
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          showAlert(
            'Location Permission Denied',
            'Defaulting to fallback coordinates (Kanpur) for searching.'
          );
          setCurrentDeviceCoords({ latitude: 26.4499, longitude: 80.3319 });
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const lat = location.coords.latitude;
        const lon = location.coords.longitude;
        
        // Verify if coordinates are within India's bounding box; fallback to Kanpur if outside
        const isInsideIndia = lat >= 8 && lat <= 38 && lon >= 68 && lon <= 98;
        if (isInsideIndia) {
          setCurrentDeviceCoords({ latitude: lat, longitude: lon });
        } else {
          console.log("📍 GPS detected outside India. Defaulting to Kanpur for driver matching.");
          setCurrentDeviceCoords({ latitude: 26.4499, longitude: 80.3319 });
        }
      } catch (err) {
        setCurrentDeviceCoords({ latitude: 26.4499, longitude: 80.3319 });
      } finally {
        setIsLoadingLocation(false);
      }
    })();
  }, [setCurrentDeviceCoords]);

  // Sync GPS coordinate to pickup state on first load
  useEffect(() => {
    if (currentDeviceCoords && !hasSyncedCoords) {
      setPickupCoords(currentDeviceCoords);
      setHasSyncedCoords(true);
    }
  }, [currentDeviceCoords, hasSyncedCoords]);

  // Reverse-geocode current device coordinates to human-readable address on startup
  useEffect(() => {
    if (!currentDeviceCoords) return;

    (async () => {
      try {
        const { latitude, longitude } = currentDeviceCoords;
        const res = await fetch(
          `https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            const f = data.features[0];
            const name = f.properties.name || '';
            const city = f.properties.city || '';
            const state = f.properties.state || '';
            const displayName = [name, city, state]
              .filter(Boolean)
              .join(', ');
            setPickupAddress(displayName || 'My Location');
          }
        }
      } catch (err) {
        console.error('Error reverse geocoding current location:', err);
      }
    })();
  }, [currentDeviceCoords]);

  // Debounced reverse geocoding to resolve address name when pin center changes
  useEffect(() => {
    if (!mapSelectorCoords || !activeSelectorMode) return;

    const delayDebounce = setTimeout(async () => {
      try {
        const { latitude, longitude } = mapSelectorCoords;
        const res = await fetch(
          `https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.features && data.features.length > 0) {
            const f = data.features[0];
            const name = f.properties.name || '';
            const city = f.properties.city || '';
            const state = f.properties.state || '';
            const displayName = [name, city, state]
              .filter(Boolean)
              .join(', ');
            setMapSelectorAddress(displayName || 'Selected Location');
          } else {
            setMapSelectorAddress('Unknown Location');
          }
        }
      } catch (err) {
        console.error('Error reverse geocoding:', err);
      }
    }, 800);

    return () => clearTimeout(delayDebounce);
  }, [mapSelectorCoords, activeSelectorMode]);

  // Auto-fit main screen map bounds when both markers are set
  useEffect(() => {
    if (pickupCoords && dropCoords && mapRef.current) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates([pickupCoords, dropCoords], {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }, 500);
    }
  }, [pickupCoords, dropCoords]);

  const handleMapSearchTextChange = (text: string) => {
    setMapSearchText(text);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      if (text.trim().length < 3) {
        setMapSuggestions([]);
        setShowMapSuggestions(false);
        return;
      }
      setIsSearchingMap(true);

      const startLocation = currentDeviceCoords || { latitude: DEFAULT_LATITUDE, longitude: DEFAULT_LONGITUDE };

      try {
        // Uses Google Places (building/restaurant-level coverage) when
        // available, falling back to free OSM search automatically —
        // nothing else here needs to change once Places API is enabled.
        const results = await searchPlaces(text, startLocation);
        setMapSuggestions(results);
        setShowMapSuggestions(results.length > 0);
      } catch (err) {
        console.error('Error fetching map suggestions:', err);
      } finally {
        setIsSearchingMap(false);
      }
    }, 600);
  };

  const handleSelectMapSuggestion = async (item: PlaceSuggestion) => {
    setMapSuggestions([]);
    setShowMapSuggestions(false);
    setMapSearchText(item.name || item.description);

    let latitude = item.latitude;
    let longitude = item.longitude;

    // Google predictions don't carry coordinates — resolve them on pick,
    // not for every suggestion in the list (keeps autocomplete cheap).
    if (item.source === 'google' && (latitude == null || longitude == null)) {
      setIsSearchingMap(true);
      const coords = await fetchGooglePlaceCoordinates(item.id);
      setIsSearchingMap(false);
      if (!coords) {
        showAlert('Location Unavailable', 'Could not resolve this place. Please try another result.');
        return;
      }
      latitude = coords.latitude;
      longitude = coords.longitude;
    }
    if (latitude == null || longitude == null) return;

    setMapSelectorCoords({ latitude, longitude });
    setMapSelectorAddress(item.description);

    // Focus map selector coordinates on load
    mapSelectorRef.current?.animateToRegion({
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 1000);
  };

  const handleFindDrivers = () => {
    if (!pickupCoords) {
      showAlert('Pickup Required', 'Please choose a pickup location.');
      return;
    }
    if (!dropCoords) {
      showAlert('Destination Required', 'Please set a drop-off destination.');
      return;
    }

    router.push({
      pathname: '/(customer)/nearby-drivers',
      params: {
        dropAddress: dropAddress,
        dropLatitude: String(dropCoords.latitude),
        dropLongitude: String(dropCoords.longitude),
        pickupLatitude: String(pickupCoords.latitude),
        pickupLongitude: String(pickupCoords.longitude),
        serviceType: selectedService,
      },
    });
  };

  // FULL SCREEN MAP SELECTOR VIEW (UBER PICKER ENGINE)
  if (activeSelectorMode !== null) {
    const isPickup = activeSelectorMode === 'pickup';
    const currentCenterLat = mapSelectorCoords?.latitude ?? (isPickup ? (pickupCoords?.latitude ?? currentDeviceCoords?.latitude ?? DEFAULT_LATITUDE) : (dropCoords?.latitude ?? currentDeviceCoords?.latitude ?? DEFAULT_LATITUDE));
    const currentCenterLng = mapSelectorCoords?.longitude ?? (isPickup ? (pickupCoords?.longitude ?? currentDeviceCoords?.longitude ?? DEFAULT_LONGITUDE) : (dropCoords?.longitude ?? currentDeviceCoords?.longitude ?? DEFAULT_LONGITUDE));

    return (
      <ScreenContainer key="selector-screen" className="px-0">
        {/* Header Search Area */}
        <View className="p-4 bg-white dark:bg-[#161823] shadow-md border-b border-gray-100 dark:border-[#2C2E3E] z-20">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => {
                setActiveSelectorMode(null);
                setMapSuggestions([]);
                setShowMapSuggestions(false);
                setMapSearchText('');
              }}
              className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
            >
              <Ionicons name="arrow-back" size={20} color="#0F62FE" />
            </Pressable>
            <View className="flex-1 relative">
              <TextField
                label={isPickup ? "Search Pickup Location" : "Search Drop-off Location"}
                placeholder="Type address..."
                value={mapSearchText}
                onChangeText={handleMapSearchTextChange}
              />
              {isSearchingMap && (
                <View className="absolute right-3 bottom-3">
                  <ActivityIndicator size="small" color="#0F62FE" />
                </View>
              )}
            </View>
          </View>

          {/* Suggestions list */}
          {showMapSuggestions && mapSuggestions.length > 0 && (
            <View className="mt-2 bg-white dark:bg-[#1E2030] border border-gray-100 dark:border-[#2C2E3E] rounded-2xl max-h-48 overflow-hidden shadow-lg">
              <FlatList
                data={mapSuggestions}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => handleSelectMapSuggestion(item)}
                    className="p-3 border-b border-gray-50 dark:border-[#2C2E3E] active:bg-gray-50 dark:active:bg-[#2C2E3E]"
                  >
                    <Text className="text-xs font-bold text-textPrimary dark:text-[#F3F4F6]" numberOfLines={1}>
                      {item.name || item.description.split(',')[0]}
                    </Text>
                    <Text className="text-[10px] text-gray-400 dark:text-gray-500" numberOfLines={1}>
                      {item.description}
                    </Text>
                  </Pressable>
                )}
              />
            </View>
          )}
        </View>

        {/* Map selection viewport */}
        <View className="flex-1 relative">
          <MapView
            ref={mapSelectorRef}
            provider={PROVIDER_GOOGLE}
            style={{ width: '100%', height: '100%' }}
            initialRegion={{
              latitude: currentCenterLat,
              longitude: currentCenterLng,
              latitudeDelta: 0.015,
              longitudeDelta: 0.015,
            }}
            onCenterChanged={(lat, lng) => {
              setMapSelectorCoords({ latitude: lat, longitude: lng });
            }}
          >
            {currentDeviceCoords && (
              <Marker
                coordinate={currentDeviceCoords}
                title="My Location"
                description="Current Location"
              />
            )}
          </MapView>

          {/* Re-center GPS Button in Selector */}
          {currentDeviceCoords && (
            <Pressable
              onPress={() => {
                mapSelectorRef.current?.animateToRegion({
                  ...currentDeviceCoords,
                  latitudeDelta: 0.012,
                  longitudeDelta: 0.012,
                }, 1000);
                setMapSelectorCoords(currentDeviceCoords);
              }}
              className="absolute right-4 bottom-4 z-10 h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-[#161823] shadow-lg border border-gray-100 dark:border-[#2C2E3E] active:bg-gray-50 dark:active:bg-[#1E2030]"
            >
              <Ionicons name="locate" size={24} color="#0F62FE" />
            </Pressable>
          )}

          {/* Absolute Center Stationary Pin */}
          <View pointerEvents="none" className="absolute top-0 left-0 right-0 bottom-0 items-center justify-center">
            <View className="items-center mb-8">
              <View className="bg-brand rounded-full px-2.5 py-1.5 shadow border border-white mb-0.5">
                <Text className="text-white text-[9px] font-bold">DRAG MAP TO PIN</Text>
              </View>
              <Ionicons name="location" size={40} color={isPickup ? "#0F62FE" : "#EF4444"} style={styles.pinShadow} />
              <View style={{ transform: [{ scaleX: 1.5 }] }} className="h-2.5 w-2.5 bg-black/20 rounded-full mt-0.5" />
            </View>
          </View>
        </View>

        {/* Bottom confirmation card */}
        <View className="bg-white dark:bg-[#161823] rounded-t-3xl shadow-2xl px-6 pb-10 pt-6 border-t border-gray-100 dark:border-[#2C2E3E] gap-4">
          <View className="gap-1 flex-row items-start gap-3 bg-gray-50 dark:bg-[#1E2030] p-4 rounded-2xl border border-gray-100 dark:border-[#2D2F3F]">
            <Ionicons name={isPickup ? "navigate-circle" : "flag"} size={22} color={isPickup ? "#0F62FE" : "#EF4444"} className="mt-0.5" />
            <View className="flex-1">
              <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">
                {isPickup ? "Pickup Point" : "Dropoff Destination"}
              </Text>
              <Text className="text-xs font-bold text-textPrimary dark:text-[#F3F4F6] mt-1 leading-4">
                {mapSelectorAddress || "Locating pin location..."}
              </Text>
            </View>
          </View>

          <Button
            label="Confirm Location"
            onPress={() => {
              if (mapSelectorCoords) {
                if (isPickup) {
                  setPickupAddress(mapSelectorAddress || 'Custom Pickup Location');
                  setPickupCoords(mapSelectorCoords);
                } else {
                  setDropAddress(mapSelectorAddress || 'Custom Dropoff Location');
                  setDropCoords(mapSelectorCoords);
                }
              }
              setActiveSelectorMode(null);
              setMapSuggestions([]);
              setShowMapSuggestions(false);
              setMapSearchText('');
            }}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer key="main-screen" className="px-0">
      {/* Header Bar */}
      <View className="flex-row items-center justify-between px-6 py-4 bg-white dark:bg-[#161823] border-b border-gray-100 dark:border-[#2C2E3E]">
        <Pressable
          onPress={() => router.push('/(customer)/profile')}
          className="flex-row items-center gap-3 active:opacity-75"
        >
          <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <Ionicons name="person" size={20} color="#0F62FE" />
          </View>
          <View>
            <Text className="text-[10px] text-gray-400 dark:text-gray-500">Profile</Text>
            <Text className="text-xs font-semibold text-textPrimary dark:text-[#F3F4F6]" numberOfLines={1}>
              {user?.fullName || user?.phone || 'Guest'}
            </Text>
          </View>
        </Pressable>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push('/(customer)/history')}
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
          >
            <Ionicons name="time-outline" size={20} color={user ? '#0F62FE' : '#6B7280'} />
          </Pressable>
          <Pressable
            onPress={() => router.push('/(customer)/settings')}
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E2030] active:bg-gray-200 dark:active:bg-[#2C2E3E]"
          >
            <Ionicons name="settings-outline" size={20} color={user ? '#0F62FE' : '#6B7280'} />
          </Pressable>
        </View>
      </View>

      <View className="flex-1 bg-white dark:bg-[#0B0C10]">
        <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }} showsVerticalScrollIndicator={false}>
          {/* Welcome Hero Banner */}
          <View style={{ backgroundColor: '#0F62FE', borderRadius: 24, padding: 20, marginBottom: 24, overflow: 'hidden' }}>
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: 'white' }}>Hello, {user?.fullName?.split(' ')[0] || 'there'}!</Text>
              <Text style={{ fontSize: 12, color: '#E0E7FF', marginTop: 4 }}>Ready for a comfortable and professional ride? Book your drivemate partner today.</Text>
            </View>
          </View>

          {/* Two-Box Selector & Services Card */}
          <View className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl p-5 shadow-sm gap-5 mb-6">
            <View className="gap-1">
              <Text className="text-base font-bold text-textPrimary dark:text-[#F3F4F6]">Where can we take you?</Text>
              <Text className="text-xs text-gray-400 dark:text-gray-500 font-medium">Select your pickup and drop-off points</Text>
            </View>

            {/* Location Inputs Group */}
            <View className="bg-gray-50 dark:bg-[#1E2030] p-4 rounded-2xl border border-gray-100 dark:border-[#2C2E3E] gap-3">
              {/* Pickup Address Box */}
              <Pressable
                onPress={() => {
                  const startCoords = pickupCoords || currentDeviceCoords;
                  if (startCoords) {
                    setMapSelectorCoords(startCoords);
                  }
                  setMapSelectorAddress(pickupAddress);
                  setMapSearchText('');
                  setActiveSelectorMode('pickup');
                }}
                className="flex-row items-center justify-between py-2 border-b border-gray-100 dark:border-[#2C2E3E] active:opacity-75"
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  <View className="flex-1">
                    <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Pickup Location</Text>
                    <Text className="text-xs font-semibold text-textPrimary dark:text-[#F3F4F6] mt-0.5" numberOfLines={1}>
                      {pickupAddress}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>

              {/* Drop-off Address Box */}
              <Pressable
                onPress={() => {
                  const startCoords = dropCoords || currentDeviceCoords;
                  if (startCoords) {
                    setMapSelectorCoords(startCoords);
                  }
                  setMapSelectorAddress(dropAddress || '');
                  setMapSearchText('');
                  setActiveSelectorMode('drop');
                }}
                className="flex-row items-center justify-between py-2 active:opacity-75"
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <View className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <View className="flex-1">
                    <Text className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase">Drop-off Destination</Text>
                    <Text className={`text-xs mt-0.5 ${dropAddress ? 'font-semibold text-textPrimary dark:text-[#F3F4F6]' : 'text-gray-400 dark:text-gray-500 font-medium'}`} numberOfLines={1}>
                      {dropAddress || 'Enter destination...'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Service Mode selects */}
            <View className="gap-2">
              <Text className="text-xs font-semibold text-textSecondary dark:text-gray-400">Service Mode</Text>
              <View className="flex-row gap-2">
                {(['local', 'outstation', 'airport', 'monthly'] as ServiceType[]).map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setSelectedService(type)}
                    className={`flex-1 items-center justify-center py-3 rounded-2xl border active:scale-[0.97] transition-all ${
                      selectedService === type
                        ? 'border-brand bg-brand/5 dark:bg-brand/10'
                        : 'border-border dark:border-[#2C2E3E] bg-white dark:bg-[#1E2030]'
                    }`}
                  >
                    <Text
                      className={`text-xs font-bold capitalize ${
                        selectedService === type ? 'text-brand' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Action button */}
            <Button label="Search Available Drivers" onPress={handleFindDrivers} />
          </View>

          {/* Quick Tools */}
          <Text className="text-xs font-bold text-textSecondary dark:text-gray-400 uppercase tracking-widest pl-1 mb-3">
            Quick Tools
          </Text>
          <View className="bg-white dark:bg-[#161823] border border-gray-100 dark:border-[#2C2E3E] rounded-3xl shadow-sm overflow-hidden mb-8">
            <Pressable
              onPress={() => router.push('/(customer)/history')}
              className="flex-row justify-between items-center p-4 border-b border-gray-50 dark:border-[#2C2E3E] active:bg-gray-50 dark:active:bg-[#1E2030]"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-50 dark:bg-[#1E2A3A]">
                  <Ionicons name="time" size={18} color="#0F62FE" />
                </View>
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Booking History</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(customer)/settings')}
              className="flex-row justify-between items-center p-4 active:bg-gray-50 dark:active:bg-[#1E2030]"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-blue-50 dark:bg-[#1E2A3A]">
                  <Ionicons name="settings" size={18} color="#0F62FE" />
                </View>
                <Text className="text-sm font-semibold text-textPrimary dark:text-[#F3F4F6]">Account Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pinShadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 6,
  },
});
