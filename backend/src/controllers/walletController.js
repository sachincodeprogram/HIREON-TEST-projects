const crypto = require('crypto');
const WalletTransaction = require('../models/WalletTransaction');
const { getOrCreateWallet, creditWallet } = require('../utils/wallet');
const { walletMinBalancePaise } = require('../utils/commission');
const { getRazorpay } = require('../utils/razorpay');
const { success, error } = require('../utils/apiResponse');

// GET /api/v1/wallet
const getWallet = async (req, res) => {
  try {
    const wallet = await getOrCreateWallet(req.user._id);
    const floor  = walletMinBalancePaise();
    res.json(success('Wallet fetched', {
      balance:      wallet.balance,
      minBalance:   floor,
      canAcceptCOD: wallet.balance >= floor,
    }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

// GET /api/v1/wallet/transactions
const getTransactions = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ rider: req.user._id })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('order', 'orderId'),
      WalletTransaction.countDocuments({ rider: req.user._id }),
    ]);

    res.json(success('Transactions fetched', { transactions, page, total, pages: Math.ceil(total / limit) }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

// POST /api/v1/wallet/recharge/order  { amountPaise }
const createRechargeOrder = async (req, res) => {
  try {
    const amountPaise = Math.round(Number(req.body.amountPaise));
    if (!Number.isInteger(amountPaise) || amountPaise < 100) {
      return res.status(400).json(error('amountPaise chahiye, kam se kam 100 (₹1)'));
    }

    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      // Razorpay receipt max length is 40 chars — full ObjectId + ms timestamp
      // overflows that, so timestamp goes in base36 (+ hard slice as a safety
      // net since base36 length grows by a digit every few decades).
      receipt:  `wallet_${req.user._id}_${Date.now().toString(36)}`.slice(0, 40),
      notes:    { purpose: 'WALLET_RECHARGE', riderId: req.user._id.toString() },
    });

    res.json(success('Recharge order created', {
      razorpayOrderId: rzpOrder.id,
      amount:   rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
    }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

// POST /api/v1/wallet/recharge/verify  { razorpay_order_id, razorpay_payment_id, razorpay_signature }
// Client-side confirm — webhook (paymentController) authoritative baaki hai;
// donon idempotent hain (razorpayPaymentId unique index) to jo pehle aaye woh credit karta hai.
const verifyRecharge = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json(error('razorpay_order_id, razorpay_payment_id, razorpay_signature chahiye'));
    }

    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json(error('Signature verification failed'));
    }

    const razorpay = getRazorpay();
    const payment  = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.status !== 'captured') {
      return res.status(400).json(error(`Payment not captured (status: ${payment.status})`));
    }

    const { wallet, transaction, duplicate } = await creditWallet({
      riderId:  req.user._id,
      type:     'RECHARGE',
      amountPaise: payment.amount,
      razorpayOrderId:   razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      description: 'Wallet recharge via Razorpay',
    });

    res.json(success(duplicate ? 'Already processed' : 'Wallet recharged', { balance: wallet.balance, transaction }));
  } catch (err) {
    res.status(500).json(error(err.message));
  }
};

module.exports = { getWallet, getTransactions, createRechargeOrder, verifyRecharge };
