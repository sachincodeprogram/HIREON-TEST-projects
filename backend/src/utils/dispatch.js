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

// orderId(string) -> { timers: NodeJS.Timeout[], notified: Set<riderId> }
const active = new Map();

// Cancel any pending tier timers for an order (accept/cancel ho gaya).
const cancelDispatch = (orderId) => {
  const id = orderId.toString();
  const entry = active.get(id);
  if (!entry) return;
  entry.timers.forEach(clearTimeout);
  active.delete(id);
};

// Itni purani location ko bharosemand mat maano — rider shayad kahin aur hai
// (ya uska GPS/location bhejna band ho gaya hai).
const LOC_FRESH_MS = 10 * 60 * 1000;

// Notify on-duty riders within `radiusKm` of pickup who haven't been pinged yet.
// Duty ka source DB ka isOnline flag hai, socket connection NAHI — screen lock/
// app background me socket toot jaata hai par rider duty par hi hota hai.
// Har eligible rider ko: socket (app khuli ho to live ring) + FCM push
// (lock screen / background / app band — notification sound ke saath).
//
// ZAROORI: loop SAB online riders par hai, sirf location wale par nahi. Jis
// rider ki location missing/purani hai (permission deny, GPS band, POST fail)
// use door maan ke chhodna nahi — pehli tier se hi bhej do. Warna woh rider
// online hoke bhi kabhi order nahi dekhta (10-phone field test me yahi hua).
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
    const locFresh = loc && (Date.now() - new Date(loc.updatedAt).getTime()) <= LOC_FRESH_MS;
    if (locFresh) {
      const km = haversineKm(pickup.lat, pickup.lng, loc.lat, loc.lng);
      if (km > radiusKm) return;                         // pakka door hai — is tier me nahi
    }
    // (location missing/purani -> radius filter skip, rider ko bhejo)

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
  const entry = { timers: [], notified: new Set() };
  active.set(id, entry);

  TIERS.forEach(({ radiusKm, delayMs }) => {
    const t = setTimeout(() => {
      notifyTier(io, onlineRiders, { id, pickup, payload }, radiusKm, entry).catch(() => {});
    }, delayMs);
    entry.timers.push(t);
  });

  const noRiderTimer = setTimeout(() => {
    notifyNoRider(io, id).catch(() => {});
  }, NO_RIDER_MS);
  entry.timers.push(noRiderTimer);
};

module.exports = { dispatchOrder, cancelDispatch };
