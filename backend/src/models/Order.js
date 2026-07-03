const mongoose = require('mongoose');

const coordinatesSchema = new mongoose.Schema({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
}, { _id: false });

const locationSchema = new mongoose.Schema({
  address:      { type: String, required: true },
  coordinates:  { type: coordinatesSchema, required: true },
  contactName:  { type: String, default: '' },
  contactPhone: { type: String, default: '' },
}, { _id: false });

const timelineSchema = new mongoose.Schema({
  status:    String,
  note:      { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId:  { type: String, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rider:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  pickup:   { type: locationSchema, required: true },
  delivery: { type: locationSchema, required: true },

  parcel: {
    description: { type: String, default: 'Parcel' },
    weight:      { type: Number, default: 1 },   // kg
    size:        { type: String, enum: ['small', 'medium', 'large'], default: 'small' },
    isFragile:   { type: Boolean, default: false },
  },

  fare: {
    estimated: { type: Number, required: true },
    final:     { type: Number, default: 0 },
    distance:  { type: Number, default: 0 },     // km
  },

  status: {
    type: String,
    enum: ['pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending',
    index: true,
  },

  pickupOtp:   { type: String, default: '' },
  deliveryOtp: { type: String, default: '' },

  timeline:    [timelineSchema],

  // Customer ki rating (delivery ke baad, ek hi baar) — rider ke aggregate me
  // jaati hai. 0 = abhi nahi di; 1-5 ki validation controller me hai (schema
  // me min:1 rakhne se default 0 par hi order create fail ho jaata tha).
  rating:  { type: Number, default: 0 },
  review:  { type: String, default: '' },

  cancelledBy:     { type: String, enum: ['customer', 'rider', 'admin', ''], default: '' },
  cancellationNote: { type: String, default: '' },
  riderEarning:    { type: Number, default: 0 },
  deliveredAt:     { type: Date },
}, { timestamps: true });

orderSchema.pre('save', function () {
  if (!this.orderId) {
    this.orderId = 'ORD' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  }
});

module.exports = mongoose.model('Order', orderSchema);
