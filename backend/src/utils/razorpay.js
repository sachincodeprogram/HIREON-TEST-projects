const Razorpay = require('razorpay');

// Lazy init — server boot ko keys missing hone par crash nahi karna chahiye,
// sirf jab actually koi payment route hit ho tab keys chahiye.
let client = null;

function getRazorpay() {
  if (!client) {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay keys missing — set RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env');
    }
    client = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  }
  return client;
}

module.exports = { getRazorpay };
