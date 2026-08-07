const mongoose = require('mongoose');

// Har credit/debit ki full audit-trail entry — dispute resolution ke liye
// (amount, type, orderId, balanceAfter, timestamp sab yahan hai).
const walletTransactionSchema = new mongoose.Schema({
  rider:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', required: true },

  // amount hamesha positive paise — direction 'type' se pata chalti hai.
  type:         { type: String, enum: ['EARNING', 'COMMISSION_DEBIT', 'RECHARGE', 'REFUND'], required: true },
  amount:       { type: Number, required: true },
  balanceAfter: { type: Number, required: true },

  order:             { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  razorpayOrderId:   { type: String, default: null },
  razorpayPaymentId: { type: String, default: null },
  description:       { type: String, default: '' },
}, { timestamps: true });

// Idempotency: ek Razorpay payment kabhi do baar credit na ho (webhook + client
// verify dono aa jaayein, ya webhook retry ho jaaye, to bhi ek hi entry bane).
walletTransactionSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: 'string' } } }
);

// Idempotency: ek order ka EARNING ya COMMISSION_DEBIT settlement exactly ek
// baar ho — confirm-delivery retry se double debit/credit na ho jaaye.
walletTransactionSchema.index(
  { order: 1, type: 1 },
  { unique: true, partialFilterExpression: { order: { $type: 'objectId' } } }
);

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
