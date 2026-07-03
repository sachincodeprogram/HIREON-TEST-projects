import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import apiClient from './apiClient';

// Rider ke device ka FCM token backend ko bhejo — isi se screen lock/off,
// app background ya app band hone par bhi naya-order push notification aata
// hai. Push optional luxury nahi, rider ke liye core hai; par fail ho jaye to
// app crash nahi karti (socket wala live ring to hai hi).
export async function registerRiderPush(): Promise<void> {
  try {
    if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }
    await messaging().requestPermission();
    const token = await messaging().getToken();
    if (token) {
      await apiClient.post('/rider/fcm-token', { fcmToken: token });
    }
  } catch {
    // Push register na ho paya — socket wala flow phir bhi chalega.
  }
}

// FCM kabhi-kabhi token rotate karta hai — naya token chupchaap backend bhejo.
export function subscribePushTokenRefresh(): () => void {
  return messaging().onTokenRefresh(token => {
    apiClient.post('/rider/fcm-token', { fcmToken: token }).catch(() => {});
  });
}
