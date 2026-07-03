/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Background/killed state me FCM data handle karne ke liye handler register
// karna zaroori hai (warna lib warning deta hai). Notification khud system
// tray dikhata hai — yahan kuch karna nahi; tap hone par RiderDashboard
// getInitialNotification/onNotificationOpenedApp se order modal kholta hai.
messaging().setBackgroundMessageHandler(async () => {});

AppRegistry.registerComponent(appName, () => App);
