import RazorpayCheckout from 'react-native-razorpay';
import { COLORS } from '../constants/api';
import { RazorpayOrder } from '../types';

interface CheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface PrefillInfo {
  name?: string;
  email?: string;
  contact?: string;
}

// Razorpay Checkout apne aap saare enabled methods dikhata hai — UPI apps
// (GPay/PhonePe/Paytm/WhatsApp Pay), QR, cards, netbanking — dashboard config
// se, yahan alag se method list dene ki zaroorat nahi.
export const openRazorpayCheckout = (
  order: RazorpayOrder,
  description: string,
  prefill?: PrefillInfo,
): Promise<CheckoutResult> => {
  return RazorpayCheckout.open({
    key:         order.keyId,
    order_id:    order.razorpayOrderId,
    amount:      order.amount,
    currency:    order.currency,
    name:        'HIREON',
    description,
    theme:       { color: COLORS.primary },
    prefill:     prefill || {},
  });
};

// Razorpay reject karta hai to error.code/description milta hai (user cancel
// bhi isi path se aata hai — code 0/'Payment Cancelled' jaisa kuch).
export const isUserCancelled = (err: any) =>
  err?.code === 0 || /cancel/i.test(err?.description || err?.message || '');
