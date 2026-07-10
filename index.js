/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';
import { displayOrderRing } from './src/services/orderRingNotification';

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
// notification cancel = ring band (call decline jaisa). Accept launchActivity
// ke saath aata hai, wo RiderDashboard me handle hota hai.
notifee.onBackgroundEvent(async ({ type, detail }) => {
  if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'decline') {
    const nid = detail.notification?.id;
    if (nid) await notifee.cancelNotification(nid);
  }
});

AppRegistry.registerComponent(appName, () => App);
