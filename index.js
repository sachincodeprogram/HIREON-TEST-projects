/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { displayOrderRing } from './src/services/orderRingNotification';
import { declineOrder } from './src/services/orderService';

// Naya-order push data-only aata hai (backend/src/utils/push.js) taaki screen
// off / app background / app band — har haal me yeh handler chale aur hum
// call-jaisi full-screen ring notification dikha saken (system tray ki chup
// notification ki jagah). Tap/full-screen se app khulne par RiderDashboard
// notifee getInitialNotification / onForegroundEvent se ring modal kholta hai.
messaging().setBackgroundMessageHandler(async remoteMessage => {
  if (remoteMessage?.data?.type === 'new_order_request') {
    await displayOrderRing(remoteMessage.data);
  }
});

// Lock screen ka "❌ Decline" button app khole BINA yahin handle hota hai —
// notification cancel = ring band (call decline jaisa), aur backend ko bhi
// decline batao taaki sab notified riders ke mana karne par dispatch agli
// tier turant fire kare. Accept launchActivity ke saath aata hai, wo
// RiderDashboard me handle hota hai.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'decline') {
    const nid = detail.notification?.id;
    if (nid) await notifee.cancelNotification(nid);
    const orderId = detail.notification?.data?.orderId;
    if (typeof orderId === 'string') {
      // Headless me bhi auth token mil jaata hai (Firebase user persisted);
      // fail ho jaye to bhi ring to band ho hi gayi — tier timer se badhegi.
      try { await declineOrder(orderId); } catch { /* chup raho */ }
    }
  }
});

AppRegistry.registerComponent(appName, () => App);
