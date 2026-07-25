export type NotificationDataType =
  | 'booking_created'
  | 'driver_accepted'
  | 'booking_declined'
  | 'driver_arrived'
  | 'trip_started'
  | 'trip_completed'
  | 'booking_cancelled'
  | 'cod_collected'
  | 'online_payment_verified';

export interface PushNotificationData {
  type: NotificationDataType;
  bookingId: string;
  amount?: string;
}
