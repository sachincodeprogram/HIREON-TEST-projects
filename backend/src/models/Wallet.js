const mongoose = require('mongoose');

// Har rider ka ek hi wallet — balance PAISE me (integer), rupees me nahi,
// taaki floating point errors na aayein. ₹100 = 10000.
// Balance negative bhi ho sakta hai — COD commission due jab tak recharge na ho.
const walletSchema = new mongoose.Schema({
  rider:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  balance: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Wallet', walletSchema);
