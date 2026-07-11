const Order         = require('../models/Order');
const User          = require('../models/User');
const RiderLocation = require('../models/RiderLocation');
const { haversineKm } = require('./fareCalculator');
const { sendOrderPush } = require('./push');

// Tiered radius dispatch — Dunzo/Porter style. Pehle paas wale riders ko bhejo,
// koi accept na kare to ring badha do: 1km -> 3km -> 5km. Har tier ko 1:30 min.
const TIERS = [
  { radiusKm: 1, delayMs: 0 },        // 0:00 - 1:30  -> 1km ke andar
  { radiusKm: 3, delayMs: 90000 },    // 1:30 - 3:00  -> 3km tak
  { radiusKm: 5, delayMs: 180000 },   // 3:00 - 4:30  -> 5km tak
];
// 4:30 (270s) tak bhi koi rider na le to customer ko "rider uplabdh nahi" bata do.
const NO_RIDER_MS = 270000;
// Aakhri tier ka radius — isse door (ya isse pehle ki tier me unknown-location)
// rider ko order kabhi nahi jaana chahiye.
const MAX_RADIUS_KM = TIERS[TIERS.length - 1].radiusKm;

// orderId(string) -> { timers: NodeJS.Timeout[], notified: Set<riderId>,
//   declined: Set<riderId>, tierIdx, ctx: { io, onlineRiders, id, pickup, payload } }
const active = new Map();

// Cancel any pending tier timers for an order (accept/cancel ho gaya).
const cancelDispatch = (orderId) => {
  const id = orderId.toString();
  const entry = active.get(id);
  if (!entry) return;
  entry.timers.forEach(clearTimeout);
  active.delete(id);
};

// Notify on-duty riders within `radiusKm` of pickup who haven't been pinged yet.
// Duty ka source DB ka isOnline flag hai, socket connection NAHI — screen lock/
// app background me socket toot jaata hai par rider duty par hi hota hai.
// Har eligible rider ko: socket (app khuli ho to live ring) + FCM push
// (lock screen / background / app band — notification sound ke saath).
//
// Doori HAMESHA last-known location se naapi jaati hai — purani ho tab bhi.
// Pehle stale/missing location par radius filter skip hota tha ("paas hoga"
// maan ke pehli tier se bhej do) — nateeja: 5km+ door ke riders ko bhi order
// ring ho raha tha. Ab 5km ke bahar (last-known ke hisaab se) kabhi nahi jaata.
// Jis rider ka location record HI nahi (permission deny, GPS band, POST kabhi
// nahi hua) use bilkul chhod bhi nahi sakte — warna woh online hoke bhi kabhi
// order nahi dekhta (10-phone field test me yahi hua). Aise rider ko sirf
// aakhri (5km) tier me bhejo: paas walon ko pehla mauka, par yeh bhi anokha nahi.
const notifyTier = async (io, onlineRiders, { id, pickup, payload }, radiusKm, entry) => {
  // Order abhi bhi pending hai? warna ruk jao.
  const fresh = await Order.findById(id).select('status');
  if (!fresh || fresh.status !== 'pending') { cancelDispatch(id); return; }

  const riders = await User.find({ role: 'rider', isOnline: true })
    .select('_id fcmToken').lean();
  if (riders.length === 0) return;

  const locs = await RiderLocation.find({ rider: { $in: riders.map((r) => r._id) } }).lean();
  const locByRider = new Map(locs.map((l) => [l.rider.toString(), l]));

  riders.forEach((rider) => {
    const rid = rider._id.toString();
    if (entry.notified.has(rid)) return;                 // pehle hi ping kar diya

    const loc = locByRider.get(rid);
    if (loc) {
      const km = haversineKm(pickup.lat, pickup.lng, loc.lat, loc.lng);
      if (km > radiusKm) return;                         // door hai — is tier me nahi (5km+ kabhi nahi)
    } else if (radiusKm < MAX_RADIUS_KM) {
      return;                                            // location record hi nahi — sirf aakhri tier me
    }

    const socketId = onlineRiders.get(rid);
    const fcmToken = rider.fcmToken;
    // Na socket na push token — abhi pahunchane ka koi raasta nahi. `notified`
    // me mat daalo taaki agli tier tak socket reconnect ho jaye to mil jaye.
    if (!socketId && !fcmToken) return;
    entry.notified.add(rid);

    if (socketId) io.to(socketId).emit('new_order_request', payload);

    if (fcmToken) {
      sendOrderPush(fcmToken, payload).then((result) => {
        // Token mar chuka hai (app uninstall/re-install) — saaf kar do.
        if (result === 'invalid-token') {
          User.updateOne({ _id: rid }, { fcmToken: '' }).catch(() => {});
        }
      }).catch(() => {});
    }
  });
};

// 4:30 baad bhi pending -> customer ke order room me "no rider" bhejo.
const notifyNoRider = async (io, id) => {
  const fresh = await Order.findById(id).select('status');
  if (!fresh || fresh.status !== 'pending') { cancelDispatch(id); return; }
  io.to(id.toString()).emit('order_no_rider', { orderId: id.toString() });
  cancelDispatch(id);
};

// Kick off tiered dispatch for a freshly created (ya re-dispatch hue) order.
const dispatchOrder = (io, onlineRiders, { orderId, pickup, payload }) => {
  if (!io || !onlineRiders || !pickup) return;
  const id = orderId.toString();
  cancelDispatch(id); // safety: purane timers saaf karo
  const entry = {
    timers: [],
    notified: new Set(),
    declined: new Set(),
    tierIdx: 0,
    // registerDecline ko tier aage badhane ke liye yehi context chahiye
    ctx: { io, onlineRiders, id, pickup, payload },
  };
  active.set(id, entry);

  TIERS.forEach(({ radiusKm, delayMs }, idx) => {
    const t = setTimeout(() => {
      // Decline se tier pehle hi aage badh chuki ho to peeche mat le jao
      entry.tierIdx = Math.max(entry.tierIdx, idx);
      notifyTier(io, onlineRiders, { id, pickup, payload }, radiusKm, entry).catch(() => {});
    }, delayMs);
    entry.timers.push(t);
  });

  const noRiderTimer = setTimeout(() => {
    notifyNoRider(io, id).catch(() => {});
  }, NO_RIDER_MS);
  entry.timers.push(noRiderTimer);
};

// Rider ne order thukra diya (app ka Decline button / notification action).
// Tier ka timer 90s ka hai — par jab AB TAK ping kiye gaye SAB riders mana
// kar chuke hon to intezaar bekaar hai: agli tier turant fire karo. Nayi
// tier bhi koi naya rider na de (aur sab declined hi rahen) to cascade
// karke aage badho; aakhri tier ke baad customer ko "rider uplabdh nahi"
// foran bata do — 4:30 ka intezaar nahi.
// (Tier ke original timers chalte rehte hain — notifyTier `notified` ki wajah
// se idempotent hai, aur baad me online hue naye riders ko pakad leta hai.)
const registerDecline = async (orderId, riderId) => {
  const id = orderId.toString();
  const entry = active.get(id);
  if (!entry) return; // dispatch khatam/accept ho chuka — kuch nahi karna
  entry.declined.add(riderId.toString());

  const { io, onlineRiders, pickup, payload } = entry.ctx;
  // Jab tak "sab notified riders ne mana kiya hua hai" bana rahe, tiers
  // fire karte jao — notifyTier naya rider jod de to loop ruk jaata hai
  // (uska jawab aane ka intezaar hoga).
  while (active.has(id)) {
    const allDeclined =
      entry.notified.size > 0 &&
      [...entry.notified].every((rid) => entry.declined.has(rid));
    if (!allDeclined) return;

    const nextIdx = entry.tierIdx + 1;
    if (nextIdx >= TIERS.length) {
      console.log(`[DISPATCH] ${id}: sab riders ne decline kiya, tiers khatam — no-rider abhi`);
      await notifyNoRider(io, id);
      return;
    }
    entry.tierIdx = nextIdx;
    console.log(`[DISPATCH] ${id}: sab notified riders ne decline kiya — tier ${nextIdx + 1} (${TIERS[nextIdx].radiusKm}km) abhi fire`);
    await notifyTier(io, onlineRiders, { id, pickup, payload }, TIERS[nextIdx].radiusKm, entry);
  }
};

module.exports = { dispatchOrder, cancelDispatch, registerDecline };
