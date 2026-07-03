const User          = require('../models/User');
const RiderLocation = require('../models/RiderLocation');
const Order         = require('../models/Order');
const { success, error } = require('../utils/apiResponse');

// PUT /api/v1/rider/status
const setOnlineStatus = async (req, res) => {
  try {
    const { isOnline } = req.body;
    const rider = await User.findByIdAndUpdate(req.user._id, { isOnline }, { new: true });
    res.json(success(`You are now ${isOnline ? 'online' : 'offline'}`, { isOnline: rider.isOnline }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

// POST /api/v1/rider/location
const updateLocation = async (req, res) => {
  try {
    const { lat, lng, heading, speed } = req.body;
    if (!lat || !lng) return res.status(400).json(error('lat and lng required'));

    const location = await RiderLocation.findOneAndUpdate(
      { rider: req.user._id },
      { lat, lng, heading: heading || 0, speed: speed || 0 },
      { upsert: true, new: true }
    );

    // Broadcast to active order rooms
    const activeOrder = await Order.findOne({
      rider: req.user._id,
      status: { $in: ['accepted', 'picked_up', 'in_transit'] },
    });
    if (activeOrder) {
      req.io?.to(activeOrder._id.toString()).emit('rider_location', { lat, lng, heading });
    }

    res.json(success('Location updated', location));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

// POST /api/v1/rider/fcm-token — device ka push token save karo taaki screen
// lock/app background me bhi naya-order notification bheja ja sake.
const updateFcmToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json(error('fcmToken required'));
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    res.json(success('FCM token saved'));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

// GET /api/v1/rider/earnings
const getEarnings = async (req, res) => {
  try {
    const rider = await User.findById(req.user._id).select('totalEarnings totalDeliveries rating ratingCount');

    const now    = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart  = new Date(todayStart); weekStart.setDate(todayStart.getDate() - todayStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayOrders, weekOrders, monthOrders] = await Promise.all([
      Order.find({ rider: req.user._id, status: 'delivered', deliveredAt: { $gte: todayStart } }),
      Order.find({ rider: req.user._id, status: 'delivered', deliveredAt: { $gte: weekStart } }),
      Order.find({ rider: req.user._id, status: 'delivered', deliveredAt: { $gte: monthStart } }),
    ]);

    const sum = arr => arr.reduce((s, o) => s + (o.riderEarning || 0), 0);

    res.json(success('Earnings fetched', {
      total:    rider.totalEarnings,
      today:    { amount: sum(todayOrders),  count: todayOrders.length },
      week:     { amount: sum(weekOrders),   count: weekOrders.length },
      month:    { amount: sum(monthOrders),  count: monthOrders.length },
      rating:   rider.rating,
      totalDeliveries: rider.totalDeliveries,
    }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

module.exports = { setOnlineStatus, updateLocation, updateFcmToken, getEarnings };
