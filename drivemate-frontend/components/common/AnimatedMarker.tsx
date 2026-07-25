import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Marker, AnimatedRegion } from 'react-native-maps';

interface AnimatedMarkerProps {
  coordinate: { latitude: number; longitude: number };
  title?: string;
  description?: string;
  children?: React.ReactNode;
}

export function AnimatedMarker({ coordinate, title, description, children }: AnimatedMarkerProps) {
  if (Platform.OS === 'android') {
    return null;
  }

  const animatedCoordinate = useRef(
    new AnimatedRegion({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;

  useEffect(() => {
    (animatedCoordinate as any).timing({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      duration: 1000,
      useNativeDriver: false, // AnimatedRegion timing animation does not support native driver
    }).start();
  }, [coordinate.latitude, coordinate.longitude, animatedCoordinate]);


  return (
    <Marker.Animated
      coordinate={animatedCoordinate as any}
      title={title}
      description={description}
    >
      {children}
    </Marker.Animated>
  );
}

