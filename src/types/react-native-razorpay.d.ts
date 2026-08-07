declare module 'react-native-razorpay' {
  interface CheckoutOptions {
    key: string;
    order_id?: string;
    amount?: number;
    currency?: string;
    name?: string;
    description?: string;
    image?: string;
    theme?: { color?: string };
    prefill?: { name?: string; email?: string; contact?: string };
    [key: string]: unknown;
  }

  interface CheckoutSuccess {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }

  const RazorpayCheckout: {
    open(options: CheckoutOptions): Promise<CheckoutSuccess>;
  };

  export default RazorpayCheckout;
}
