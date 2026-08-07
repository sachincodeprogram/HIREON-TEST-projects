const router = require('express').Router();
const ctrl   = require('../controllers/paymentController');

// Auth yahan Razorpay ka HMAC signature hai (protect middleware nahi) —
// route ko raw body chahiye, server.js me express.json() se pehle mount hota hai.
router.post('/webhook', ctrl.razorpayWebhook);

module.exports = router;
