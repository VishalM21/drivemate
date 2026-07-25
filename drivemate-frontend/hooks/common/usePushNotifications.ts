import * as Notifications from 'expo-notifications';
import messaging from '@react-native-firebase/messaging';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useAuthStore } from '@/store/authStore';
import { saveFcmToken } from '@/services/common/notificationService';

// Configure foreground notifications presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  } as any),
});

export function usePushNotifications() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const isRegistered = useRef(false);

  useEffect(() => {
    if (!accessToken || !user) {
      isRegistered.current = false;
      return;
    }

    if (isRegistered.current) return;
    isRegistered.current = true;

    let tokenRefreshUnsubscribe: (() => void) | undefined;

    async function registerForPushNotificationsAsync() {
      try {
        // 1. Request permissions (Expo Notifications)
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.warn('Failed to get push token for push notification!');
          return;
        }

        // 2. Request FCM permission (react-native-firebase/messaging)
        if (Platform.OS === 'ios') {
          const authStatus = await messaging().requestPermission();
          const enabled =
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL;
          if (!enabled) {
            console.warn('FCM Permission denied');
            return;
          }
        }

        // 3. Get Native FCM Token
        const fcmToken = await messaging().getToken();
        if (fcmToken) {
          await saveFcmToken({ fcmToken });
        }

        // 4. Listen to token refresh
        tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (token) => {
          if (useAuthStore.getState().accessToken) {
            await saveFcmToken({ fcmToken: token });
          }
        });
      } catch (error) {
        console.error('Error registering for push notifications:', error);
      }
    }

    registerForPushNotificationsAsync();

    // Invalidation and routing helper
    function handleNotificationData(data: any) {
      if (!data) return;

      const { type, bookingId, totalAmount } = data;

      // Invalidate queries so that cache updates immediately
      queryClient.invalidateQueries({ queryKey: ['activeBooking'] });
      queryClient.invalidateQueries({ queryKey: ['bookingHistory'] });
      queryClient.invalidateQueries({ queryKey: ['driverEarnings'] });

      if (!bookingId) return;

      switch (type) {
        case 'booking_created':
          // Route driver to incoming booking screen
          router.push({
            pathname: '/(driver)/incoming-booking',
            params: { bookingId },
          });
          break;

        case 'booking_cancelled':
          if (useAuthStore.getState().user?.role === 'driver') {
            router.replace('/(driver)');
          } else {
            router.replace('/(customer)');
          }
          break;

        case 'driver_accepted':
        case 'driver_arriving':
        case 'driver_arrived':
        case 'trip_started':
          // Route customer to tracking screen
          router.push({
            pathname: '/(customer)/ride-tracking',
            params: { bookingId },
          });
          break;

        case 'trip_completed':
          if (useAuthStore.getState().user?.role === 'customer') {
            router.push({
              pathname: '/(customer)/ride-completed',
              params: {
                bookingId,
                totalAmount: totalAmount || '0',
              },
            });
          } else {
            router.push({
              pathname: '/(driver)/booking-details',
              params: { bookingId },
            });
          }
          break;

        default:
          break;
      }
    }

    // 5. Handle foreground notification received
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      // Invalidate query cache when notification is received in foreground
      queryClient.invalidateQueries({ queryKey: ['activeBooking'] });
      queryClient.invalidateQueries({ queryKey: ['bookingHistory'] });
    });

    // 6. Handle notification click (background & foreground click)
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      handleNotificationData(data);
    });

    // 7. Check if app was opened from a notification (Killed state)
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        handleNotificationData(data);
      }
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
      if (tokenRefreshUnsubscribe) {
        tokenRefreshUnsubscribe();
      }
    };
  }, [accessToken, user, queryClient]);
}
