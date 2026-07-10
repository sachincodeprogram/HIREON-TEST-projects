const { messaging } = require('../config/firebase');

// Rider ko naya-order FCM push — screen lock / app background / app band hone
// par bhi order dikhe. Notification payload system tray me khud dikhta hai
// (heads-up + lock screen, "orders" HIGH-importance channel par), aur data me
// orderId jaata hai taaki tap karne par app ring modal khol sake.
// Return: 'invalid-token' agar token expire/uninstall ho gaya (caller saaf kare).
const sendOrderPush = async (fcmToken, order) => {
  if (!fcmToken) return null;
  try {
    await messaging().send({
      token: fcmToken,
      notification: {
        title: `🔔 Naya Order! ₹${order.riderEarning || ''} kamai`,
        body: `Pickup: ${order.pickup?.address || 'address dekhne ke liye kholo'}`,
      },
      data: {
        type: 'new_order_request',
        orderId: order._id ? order._id.toString() : String(order._id),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'orders',
          sound: 'default',
          defaultVibrateTimings: true,
          priority: 'max',
          visibility: 'public', // lock screen par bhi content dikhe
        },
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
