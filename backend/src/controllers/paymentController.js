const crypto = require('crypto');
const Order  = require('../models/Order');
const { creditWallet } = require('../utils/wallet');
const { dispatchOrder } = require('../utils/dispatch');
const { buildOrderPayload } = require('./orderController');

// POST /api/v1/payments/webhook — Razorpay ka authoritative server-to-server
// confirm. Route raw body (Buffer) se mount hota hai (server.js) taaki
// signature verify raw bytes par ho sake, JSON-parsed body par nahi.
const razorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret     = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!signature || !secret) return res.status(400).send('Webhook not configured');

    const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    let validSignature = false;
    try {
      validSignature = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      validSignature = false;
    }
    if (!validSignature) return res.status(400).send('Invalid signature');

    const payload = JSON.parse(req.body.toString('utf8'));

    if (payload.event === 'payment.captured') {
      const payment = payload.payload.payment.entity;
      const notes   = payment.notes || {};

      if (notes.purpose === 'WALLET_RECHARGE' && notes.riderId) {
        await creditWallet({
          riderId: notes.riderId,
          type: 'RECHARGE',
          amountPaise: payment.amount,
          razorpayOrderId:   payment.order_id,
          razorpayPaymentId: payment.id,
          description: 'Wallet recharge via Razorpay (webhook)',
        });
      }

      if (notes.purpose === 'ORDER_PAYMENT' && notes.orderId) {
        const order = await Order.findById(notes.orderId);
        if (order && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'paid';
          order.razorpayPaymentId = payment.id;
          order.timeline.push({ status: order.status, note: 'Payment received (webhook)' });
          await order.save();

          dispatchOrder(req.io, req.onlineRiders, {
            orderId: order._id,
            pickup:  order.pickup.coordinates,
            payload: buildOrderPayload(order),
          });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    res.status(500).json({ received: false, message: err.message });
  }
};

module.exports = { razorpayWebhook };
