import apiClient from './apiClient';
import { Order, FareEstimate, LocationInfo, ParcelInfo, PaymentMethod, RazorpayOrder } from '../types';

interface CreateOrderPayload {
  pickup: LocationInfo;
  delivery: LocationInfo;
  parcel: ParcelInfo;
  paymentMethod: PaymentMethod;
}

interface EstimatePayload {
  pickup: { lat: number; lng: number };
  delivery: { lat: number; lng: number };
  parcel: ParcelInfo;
}

export const estimateFare = async (payload: EstimatePayload): Promise<FareEstimate> => {
  const { data } = await apiClient.post('/orders/estimate', payload);
  return data.data;
};

export const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
  const { data } = await apiClient.post('/orders', payload);
  return data.data;
};

// ONLINE order ke liye Razorpay order banao — customer isse checkout kholta hai.
export const createOrderPaymentOrder = async (orderId: string): Promise<RazorpayOrder> => {
  const { data } = await apiClient.post(`/orders/${orderId}/pay/order`);
  return data.data;
};

interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const verifyOrderPayment = async (orderId: string, payload: VerifyPaymentPayload): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${orderId}/pay/verify`, payload);
  return data.data;
};

export const getMyOrders = async (): Promise<Order[]> => {
  const { data } = await apiClient.get('/orders');
  return data.data;
};

export const getOrderById = async (id: string): Promise<Order> => {
  const { data } = await apiClient.get(`/orders/${id}`);
  return data.data;
};

export const getPendingOrders = async (): Promise<Order[]> => {
  const { data } = await apiClient.get('/orders/pending');
  return data.data;
};

export const acceptOrder = async (id: string): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${id}/accept`);
  return data.data;
};

// Rider ne ring thukra di — backend ko batao taaki sab notified riders ke
// mana karne par dispatch agli tier turant fire kare (90s ka wait na ho).
// Fire-and-forget: fail ho jaye to bhi local ring band hoti hai, tier apne
// timer se aage badh hi jaati hai.
export const declineOrder = async (id: string): Promise<void> => {
  await apiClient.post(`/orders/${id}/decline`);
};

export const confirmPickup = async (id: string, otp: string): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${id}/pickup`, { otp });
  return data.data;
};

export const confirmDelivery = async (id: string, otp: string): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${id}/deliver`, { otp });
  return data.data;
};

// Deliver hone tak customer delivery address badal sakta hai — backend fare
// nayi doori se recalc karke rider ko room me live update bhejta hai.
export const updateDeliveryAddress = async (id: string, delivery: LocationInfo): Promise<Order> => {
  const { data } = await apiClient.patch(`/orders/${id}/delivery-address`, delivery);
  return data.data;
};

// Delivery ke baad customer rider ko 1-5 star deta hai (ek hi baar).
export const rateOrder = async (id: string, rating: number, review?: string): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${id}/rate`, { rating, review });
  return data.data;
};

export const cancelOrder = async (id: string, note?: string): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${id}/cancel`, { note });
  return data.data;
};

// Pickup ke 5km ke andar online riders ke coords (searching map ke dots ke liye)
export const getNearbyRiders = async (id: string): Promise<{ lat: number; lng: number }[]> => {
  const { data } = await apiClient.get(`/orders/${id}/nearby-riders`);
  return data.data;
};

// "Order Again" — pending order ko dobara nearby riders ko dispatch karo
export const redispatchOrder = async (id: string): Promise<Order> => {
  const { data } = await apiClient.post(`/orders/${id}/redispatch`);
  return data.data;
};
