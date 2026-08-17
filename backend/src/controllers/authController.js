const { auth } = require('../config/firebase');
const User         = require('../models/User');
const Order         = require('../models/Order');
const Wallet        = require('../models/Wallet');
const RiderLocation = require('../models/RiderLocation');
const { success, error } = require('../utils/apiResponse');

// POST /api/v1/auth/register
// Body: { name, phone, role, vehicleType?, vehicleNumber? }
// Header: Authorization: Bearer <Firebase ID Token>
const register = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let firebaseUid, email, picture;

    // Dev mode bypass: Bearer dev:<phone>
    if (process.env.NODE_ENV === 'development' && token?.startsWith('dev:')) {
      const phone = token.slice(4);
      firebaseUid = `dev_${phone}`;
      email   = '';
      picture = '';
    } else {
      const decoded = await auth().verifyIdToken(token);
      firebaseUid = decoded.uid;
      email   = decoded.email   || '';
      picture = decoded.picture || '';
    }

    const existing = await User.findOne({ firebaseUid });
    if (existing) return res.json(success('Already registered', existing));

    const { name, phone, role, vehicleType, vehicleNumber } = req.body;
    if (!name || !role) return res.status(400).json(error('name and role are required'));
    if (!['customer', 'rider'].includes(role)) return res.status(400).json(error('Invalid role'));

    const user = await User.create({
      firebaseUid,
      email,
      name:         name.trim(),
      phone:        phone || '',
      avatar:       picture,
      role,
      vehicleType:  role === 'rider' ? (vehicleType || '') : '',
      vehicleNumber: role === 'rider' ? (vehicleNumber || '') : '',
    });

    res.status(201).json(success('Registration successful', user));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

// GET /api/v1/auth/me
const getMe = async (req, res) => {
  res.json(success('Profile fetched', req.user));
};

// PUT /api/v1/auth/profile
const updateProfile = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'avatar', 'vehicleType', 'vehicleNumber'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json(success('Profile updated', updated));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

// DELETE /api/v1/auth/account
// Permanently deletes the user's PII per the /delete-account policy. Payment/
// transaction records (Wallet, WalletTransaction, Order fare/razorpay fields)
// are intentionally kept — retained for 90 days per Indian financial/tax
// record-keeping requirements, as disclosed on the public delete-account page.
const deleteAccount = async (req, res) => {
  try {
    const user = req.user;

    const activeOrder = await Order.findOne({
      $or: [{ customer: user._id }, { rider: user._id }],
      status: { $in: ['pending', 'accepted', 'picked_up', 'in_transit'] },
    });
    if (activeOrder) {
      return res.status(400).json(error('Cannot delete account while an order is in progress. Please complete or cancel it first.'));
    }

    if (user.role === 'rider') {
      const wallet = await Wallet.findOne({ rider: user._id });
      if (wallet && wallet.balance !== 0) {
        return res.status(400).json(error('Please settle your wallet balance before deleting your account. Contact support to arrange a payout/settlement.'));
      }
    }

    try {
      await auth().deleteUser(user.firebaseUid);
    } catch (err) {
      // dev:<phone> bypass accounts and already-removed Firebase users are expected here
      if (err.code !== 'auth/user-not-found') {
        console.error('[deleteAccount] Firebase user delete failed:', err.message);
      }
    }

    await RiderLocation.deleteOne({ rider: user._id });

    user.name          = 'Deleted User';
    user.email         = '';
    user.phone         = '';
    user.avatar        = '';
    user.fcmToken       = '';
    user.vehicleType    = '';
    user.vehicleNumber  = '';
    user.isOnline       = false;
    user.firebaseUid    = `deleted_${user._id}`;
    user.deletedAt      = new Date();
    await user.save();

    res.json(success('Account deleted', null));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

module.exports = { register, getMe, updateProfile, deleteAccount };
