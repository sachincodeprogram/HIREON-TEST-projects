const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: { type: String, required: true, unique: true, index: true },
  email:        { type: String, required: false, default: '', lowercase: true },
  name:         { type: String, required: true },
  phone:        { type: String, default: '' },
  avatar:       { type: String, default: '' },
  role:         { type: String, enum: ['customer', 'rider'], required: true },

  // FCM device token — screen lock/app background me push bhejne ke liye
  fcmToken:     { type: String, default: '' },

  // Rider-only fields
  vehicleType:       { type: String, default: '' },
  vehicleNumber:     { type: String, default: '' },
  isOnline:          { type: Boolean, default: false },
  totalEarnings:     { type: Number, default: 0 },
  totalDeliveries:   { type: Number, default: 0 },
  rating:            { type: Number, default: 5.0, min: 1, max: 5 },
  ratingCount:       { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
