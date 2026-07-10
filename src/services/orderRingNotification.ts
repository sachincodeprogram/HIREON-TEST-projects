import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
} from '@notifee/react-native';
import { COLORS } from '../constants/api';
import { getSavedRingtoneId } from './ringtoneService';
import { getRingtoneById } from '../constants/ringtones';

// Ek rider ko order accept karne ka window — dispatch tier (1:30 min) ke barabar.
// RiderDashboard ka in-app ring popup bhi yahi window use karta hai.
export const RING_WINDOW_MS = 90000;

// Android channel ka sound create hone ke BAAD badla nahi ja sakta, isliye
// har ringtone ki apni alag channel — rider profile me ringtone badle to
// agli baar se nayi channel use hogi.
const channelIdFor = (ringtoneId: string) => `order_ring_${ringtoneId}`;

const ensureRingChannel = async (): Promise<string> => {
  const tone = getRingtoneById(await getSavedRingtoneId());
  const channelId = channelIdFor(tone.id);
  await notifee.createChannel({
    id: channelId,
    name: `Naya Order (${tone.label})`,
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    // res/raw ka file naam, bina extension ke
    sound: tone.file.replace(/\.\w+$/, ''),
    vibration: true,
    vibrationPattern: [300, 200, 300, 200],
  });
  return channelId;
};

// Data-only FCM aane par call-jaisi ring notification dikhao — fullScreenAction
// se screen off/lock hone par bhi app khul jaati hai (jaise incoming call), aur
// loopSound se ringtone tab tak bajti rehti hai jab tak notification cancel/
// dismiss na ho ya timeout na ho jaye. index.js ka background handler ise
// killed/background state me chalata hai.
export const displayOrderRing = async (data?: {
  [key: string]: string | object | undefined;
}): Promise<void> => {
  try {
    const orderId = typeof data?.orderId === 'string' ? data.orderId : '';
    if (!orderId) return;
    const channelId = await ensureRingChannel();
    const body =
      typeof data?.body === 'string' ? data.body : 'Accept karne ke liye kholo';
    await notifee.displayNotification({
      id: orderId, // ek order = ek notification; cancel bhi isi id se hota hai
      title: typeof data?.title === 'string' ? data.title : '🔔 Naya Order!',
      body,
      subtitle: 'Incoming order',
      data: { type: 'new_order_request', orderId },
      android: {
        channelId,
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        color: COLORS.secondary, // rider brand blue — call UI jaisa tinted look
        largeIcon: 'ic_launcher',
        // Poora pickup/drop expanded view me dikhe (collapsed me kat jaata hai)
        style: { type: AndroidStyle.BIGTEXT, text: body },
        loopSound: true, // call ki tarah lagataar bajti rahe
        // Incoming call jaisa: swipe se dismiss NAHI hota — Decline/Accept ya
        // timeout hi raaste hain.
        ongoing: true,
        autoCancel: true,
        // Accept window ka countdown notification par hi tick karta hai
        showChronometer: true,
        chronometerDirection: 'down',
        timestamp: Date.now() + RING_WINDOW_MS,
        // Lock screen par hi jawab do — bilkul call ke Answer/Decline jaise.
        // Accept app kholta hai (RiderDashboard order accept karke ActiveDelivery
        // le jaata hai); Decline app khole BINA background event me ring cancel
        // karta hai (index.js ka onBackgroundEvent).
        actions: [
          {
            title: '✅ Accept',
            pressAction: { id: 'accept', launchActivity: 'default' },
          },
          {
            title: '❌ Decline',
            pressAction: { id: 'decline' },
          },
        ],
        // Screen off/lock par activity seedha khol do (incoming-call behavior).
        // Manifest me USE_FULL_SCREEN_INTENT + MainActivity par showWhenLocked
        // / turnScreenOn iske liye zaroori hain.
        fullScreenAction: { id: 'default' },
        pressAction: { id: 'default', launchActivity: 'default' },
        // Tier khatam hote hi ring khud band — missed call jaisa.
        timeoutAfter: RING_WINDOW_MS,
        lightUpScreen: true,
      },
    });
  } catch (e) {
    // Notification fail ho jaye to bhi crash nahi — socket wala ring flow
    // aur system tray fallback to hai hi.
    console.warn('[RING-NOTIF] display failed:', (e as Error)?.message);
  }
};

// Ring band karo — rider ne accept/decline kar diya, order kisi aur ne le
// liya, ya app ne in-app ring modal khol liya (double ring na ho).
export const cancelOrderRing = (orderId?: string): void => {
  if (!orderId) return;
  notifee.cancelNotification(orderId).catch(() => {});
};
