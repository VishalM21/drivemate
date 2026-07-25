import React, { forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import NativeMapView, { Marker as NativeMarker, Polyline as NativePolyline, PROVIDER_GOOGLE } from 'react-native-maps';
import type { WebView } from 'react-native-webview';
import { LEAFLET_CSS, LEAFLET_JS } from './LeafletAssets';

export { PROVIDER_GOOGLE };

// Parser to extract markers and polylines from children
const parseChildren = (children: React.ReactNode) => {
  const parsedMarkers: any[] = [];
  const parsedPolylines: any[] = [];

  const traverse = (node: React.ReactNode) => {
    React.Children.forEach(node, (child) => {
      if (!child || !React.isValidElement(child)) return;

      if (child.type === React.Fragment) {
        traverse((child as any).props.children);
        return;
      }

      const typeName = (child.type as any).name || '';
      const props: any = (child as any).props;

      const hasCoordinate = props && props.coordinate;
      const hasCoordinates = props && props.coordinates;

      if (hasCoordinate && !props.coordinates) {
        const titleLower = (props.title || '').toLowerCase();
        const isDriverMarker = 
          props.isDriver === true || 
          titleLower.includes('driver') || 
          titleLower.includes('your location') || 
          typeName === 'AnimatedMarker' || 
          typeName.includes('Animated');

        parsedMarkers.push({
          latitude: props.coordinate?.latitude,
          longitude: props.coordinate?.longitude,
          title: props.title || '',
          description: props.description || '',
          isDriver: isDriverMarker,
        });
      } else if (typeName === 'Polyline' || hasCoordinates) {
        parsedPolylines.push({
          coords: props.coordinates || [],
          color: props.strokeColor || '#0F62FE',
          width: props.strokeWidth || 4,
          dashPattern: props.lineDashPattern || null,
        });
      } else if (props.children) {
        traverse(props.children);
      }
    });
  };

  traverse(children);
  return { markers: parsedMarkers, polylines: parsedPolylines };
};

// HTML content for Leaflet Map using Cloudflare CDN
const LEAFLET_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    ${LEAFLET_CSS}
  </style>
  <script>
    ${LEAFLET_JS}
  </script>
  <style>
    body { padding: 0; margin: 0; }
    html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background-color: #FAFAFC; }
    
    /* Custom style for markers */
    .pickup-icon {
      background-color: #3b82f6;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .destination-icon {
      background-color: #ef4444;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
      font-weight: bold;
    }
    .driver-icon {
      background-color: #10b981;
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 14px;
    }
    .my-location-icon {
      background-color: #0F62FE;
      border: 2.5px solid white;
      border-radius: 50%;
      box-shadow: 0 0 0 4px rgba(15, 98, 254, 0.35), 0 2px 6px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Forward errors and console logs to React Native console
    window.onerror = function(message, source, lineno, colno, error) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          message: message + ' (' + source + ':' + lineno + ':' + colno + ')'
        }));
      }
      return true;
    };
    console.log = function(msg) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'log',
          message: String(msg)
        }));
      }
    };

    var map = L.map('map', { zoomControl: false }).setView([26.4499, 80.3319], 13);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      subdomains: 'abcd',
      attribution: '© OpenStreetMap, © CARTO'
    }).addTo(map);

    map.on('moveend', function() {
      var center = map.getCenter();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'centerChanged',
          lat: center.lat,
          lng: center.lng
        }));
      }
    });

    var markers = {};
    var polylines = [];

    function createPickupIcon() {
      return L.divIcon({
        className: 'pickup-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
    }

    function createDestinationIcon() {
      return L.divIcon({
        className: 'destination-icon',
        html: '🏁',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
    }

    function createDriverIcon() {
      return L.divIcon({
        className: 'driver-icon',
        html: '🚗',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
    }

    function createMyLocationIcon() {
      return L.divIcon({
        className: 'my-location-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
    }

    function handleBridgeMessage(event) {
      try {
        var message = JSON.parse(event.data);

        if (message.type === 'init') {
          var lat = parseFloat(message.lat);
          var lng = parseFloat(message.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            try {
              map.invalidateSize();
              map.setView([lat, lng], message.zoom || 14);
            } catch(err) {
              console.error("setView init error:", err.message);
            }
          }
        } else if (message.type === 'animateToRegion') {
          var lat = parseFloat(message.lat);
          var lng = parseFloat(message.lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            try {
              map.invalidateSize();
              map.setView([lat, lng], message.zoom || 14, { animate: true, duration: 1 });
            } catch(err) {
              console.error("setView animateToRegion error:", err.message);
            }
          }
        } else if (message.type === 'fitToCoordinates') {
          if (message.coords && message.coords.length > 0) {
            var validCoords = message.coords.filter(function(c) {
              return c && !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude));
            }).map(function(c) {
              return [parseFloat(c.latitude), parseFloat(c.longitude)];
            });
            if (validCoords.length > 0) {
              var bounds = L.latLngBounds(validCoords);
              try {
                map.invalidateSize();
                map.fitBounds(bounds, { padding: [50, 50] });
              } catch(err) {
                console.error("fitBounds error:", err.message);
              }
            }
          }
        } else if (message.type === 'updateData') {
          // Clear old markers
          Object.keys(markers).forEach(function(key) {
            map.removeLayer(markers[key]);
          });
          markers = {};
          
          // Clear old polylines
          polylines.forEach(function(pl) {
            map.removeLayer(pl);
          });
          polylines = [];

          // Add markers
          message.markers.forEach(function(m, idx) {
            var lat = parseFloat(m.latitude);
            var lng = parseFloat(m.longitude);
            if (isNaN(lat) || isNaN(lng)) return;
            
            var icon;
            var titleLower = (m.title || '').toLowerCase();
            
            if (titleLower.indexOf('my location') > -1 || titleLower.indexOf('current location') > -1) {
              icon = createMyLocationIcon();
            } else if (m.isDriver || titleLower.indexOf('driver') > -1) {
              icon = createDriverIcon();
            } else if (titleLower.indexOf('destination') > -1 || titleLower.indexOf('drop') > -1 || titleLower.indexOf('flag') > -1) {
              icon = createDestinationIcon();
            } else {
              icon = createPickupIcon();
            }

            var marker = L.marker([lat, lng], { icon: icon }).addTo(map);
            if (m.title) {
              marker.bindPopup('<b>' + m.title + '</b>' + (m.description ? '<br>' + m.description : ''));
            }
            markers[idx] = marker;
          });

          // Add polylines
          message.polylines.forEach(function(p) {
            if (!p.coords || p.coords.length < 2) return;
            var validCoords = p.coords.filter(function(c) {
              return c && !isNaN(parseFloat(c.latitude)) && !isNaN(parseFloat(c.longitude));
            }).map(function(c) {
              return [parseFloat(c.latitude), parseFloat(c.longitude)];
            });
            if (validCoords.length < 2) return;

            var pl = L.polyline(validCoords, {
              color: p.color || '#0F62FE',
              weight: p.width || 4,
              dashArray: p.dashPattern ? p.dashPattern.join(',') : null
            }).addTo(map);
            polylines.push(pl);
          });
        }
      } catch (e) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'error',
            message: 'bridge message handling failed: ' + e.message
          }));
        }
      }
    }

    // Android's injected postMessage bridge has historically dispatched on
    // document in some react-native-webview versions and window in others —
    // listen on both so marker/polyline updates aren't silently dropped.
    window.addEventListener('message', handleBridgeMessage);
    document.addEventListener('message', handleBridgeMessage);

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: 'map script initialized' }));
    }
  </script>
</body>
</html>
`;

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface FreeMapViewProps {
  children?: React.ReactNode;
  initialRegion?: MapRegion;
  region?: MapRegion;
  style?: any;
  className?: string;
  provider?: any;
  onCenterChanged?: (latitude: number, longitude: number) => void;
}

export const FreeMapView = forwardRef((props: FreeMapViewProps, ref) => {
  const { children, initialRegion, region, style, className, provider, ...rest } = props;
  
  const iosRef = useRef<NativeMapView | null>(null);
  const androidRef = useRef<WebView | null>(null);
  
  // Convert latDelta/lonDelta to rough zoom level
  const getZoomLevel = (regionData?: MapRegion) => {
    if (!regionData) return 14;
    const delta = Math.max(regionData.latitudeDelta, regionData.longitudeDelta);
    if (delta > 1) return 8;
    if (delta > 0.5) return 10;
    if (delta > 0.1) return 12;
    if (delta > 0.05) return 13;
    if (delta > 0.02) return 14;
    if (delta > 0.005) return 16;
    return 18;
  };

  const centerLat = region?.latitude ?? initialRegion?.latitude ?? 26.4499;
  const centerLng = region?.longitude ?? initialRegion?.longitude ?? 80.3319;
  const zoom = getZoomLevel(region ?? initialRegion);

  // Send update messages to WebView on Android
  useEffect(() => {
    if (Platform.OS === 'android' && androidRef.current) {
      const { markers, polylines } = parseChildren(children);
      console.log('[FreeMapView] pushing to WebView:', markers.length, 'markers,', polylines.length, 'polylines', JSON.stringify(markers));
      const timer = setTimeout(() => {
        androidRef.current?.postMessage(
          JSON.stringify({
            type: 'updateData',
            markers,
            polylines,
          })
        );
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [children]);

  // Expose ref functions to match react-native-maps methods
  useImperativeHandle(ref, () => ({
    animateToRegion: (targetRegion: MapRegion, duration?: number) => {
      if (Platform.OS === 'ios') {
        iosRef.current?.animateToRegion(targetRegion, duration);
      } else {
        androidRef.current?.postMessage(
          JSON.stringify({
            type: 'animateToRegion',
            lat: targetRegion.latitude,
            lng: targetRegion.longitude,
            zoom: getZoomLevel(targetRegion),
          })
        );
      }
    },
    fitToCoordinates: (coordinates: Array<{ latitude: number; longitude: number }>, options?: { edgePadding?: any; animated?: boolean }) => {
      if (Platform.OS === 'ios') {
        iosRef.current?.fitToCoordinates(coordinates, options);
      } else {
        androidRef.current?.postMessage(
          JSON.stringify({
            type: 'fitToCoordinates',
            coords: coordinates,
          })
        );
      }
    },
  }));

  if (Platform.OS === 'ios') {
    return (
      <NativeMapView
        ref={iosRef}
        initialRegion={initialRegion}
        region={region}
        style={style}
        className={className}
        onRegionChangeComplete={(r) => props.onCenterChanged?.(r.latitude, r.longitude)}
        {...rest}
        provider={undefined} // Force Apple Maps on iOS to avoid Google Maps billing requirements
      >
        {children}
      </NativeMapView>
    );
  }

  // Android: WebView Leaflet Map
  const { WebView } = require('react-native-webview');

  return (
    <View style={[styles.container, style]} className={className}>
      <WebView
        ref={androidRef}
        originWhitelist={['*']}
        source={{ html: LEAFLET_HTML }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) DriveMateApp/1.0"
        onMessage={(e: any) => {
          try {
            const data = JSON.parse(e.nativeEvent.data);
            if (data.type === 'log') {
              console.log('[Leaflet Map Log]:', data.message);
            } else if (data.type === 'error') {
              console.error('[Leaflet Map Error]:', data.message);
            } else if (data.type === 'centerChanged') {
              props.onCenterChanged?.(data.lat, data.lng);
            }
          } catch (err) {
            console.error('Error parsing WebView message:', err);
          }
        }}
        onLoadEnd={() => {
          console.log('[FreeMapView] WebView onLoadEnd fired');
          // Initialize map view coordinates on load
          androidRef.current?.postMessage(
            JSON.stringify({
              type: 'init',
              lat: centerLat,
              lng: centerLng,
              zoom: zoom,
            })
          );
          // Load current markers/polylines
          const { markers, polylines } = parseChildren(children);
          androidRef.current?.postMessage(
            JSON.stringify({
              type: 'updateData',
              markers,
              polylines,
            })
          );
        }}
      />
    </View>
  );
});

// Mock markers and polyline for export
export function Marker(props: any) {
  if (Platform.OS === 'ios') {
    return <NativeMarker {...props} />;
  }
  return null;
}

export function Polyline(props: any) {
  if (Platform.OS === 'ios') {
    return <NativePolyline {...props} />;
  }
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#FAFAFC',
  },
});

export default FreeMapView;

