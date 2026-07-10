const { messaging } = require('../config/firebase');

// Rider ko naya-order FCM push — screen lock / app background / app band hone
// par bhi order RING kare (sirf chup notification nahi). Isliye yeh DATA-ONLY
// message hai: notification payload hota to system tray khud dikha deta aur
// app ka background handler kabhi nahi chalta. Data-only + priority high se
// app ka setBackgroundMessageHandler (index.js) har haal me chalta hai aur
// notifee se call-jaisi full-screen looping-ring notification dikhata hai.
// Title/body bhi data me jaate hain (FCM data values sirf string hoti hain).
// Return: 'invalid-token' agar token expire/uninstall ho gaya (caller saaf kare).
const sendOrderPush = async (fcmToken, order) => {
  if (!fcmToken) return null;
  try {
    await messaging().send({
      token: fcmToken,
      data: {
        type: 'new_order_request',
        orderId: order._id ? order._id.toString() : String(order._id),
        title: `🔔 Naya Order! ₹${order.riderEarning || ''} kamai`,
        body: `📦 Pickup: ${order.pickup?.address || 'app me dekho'}\n📍 Drop: ${order.delivery?.address || 'app me dekho'}`,
      },
      android: {
        priority: 'high', // Doze me bhi turant deliver ho
      },
    });
    return 'sent';
  } catch (e) {
    if (e.code === 'messaging/registration-token-not-registered' ||
        e.code === 'messaging/invalid-registration-token') {
      return 'invalid-token';
    }
    console.warn('[PUSH] send failed:', e.message);
    return null;
  }
};

// Rider ko address-change push — socket toota ho / app background me ho tab
// bhi naya delivery address pahunch jaye (order_update sirf room me jaata hai,
// jo reconnect par miss ho sakta hai).
const sendAddressChangePush = async (fcmToken, order) => {
  if (!fcmToken) return null;
  try {
    await messaging().send({
      token: fcmToken,
      notification: {
        title: '📍 Delivery Address Badla',
        body: `Naya address: ${order.delivery?.address || 'app me dekho'}`,
      },
      data: {
        type: 'address_changed',
        orderId: order._id ? order._id.toString() : String(order._id),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'orders',
          sound: 'default',
          defaultVibrateTimings: true,
          priority: 'max',
          visibility: 'public',
        },
      },
    });
    return 'sent';
  } catch (e) {
    if (e.code === 'messaging/registration-token-not-registered' ||
        e.code === 'messaging/invalid-registration-token') {
      return 'invalid-token';
    }
    console.warn('[PUSH] address-change send failed:', e.message);
    return null;
  }
};

module.exports = { sendOrderPush, sendAddressChangePush };
