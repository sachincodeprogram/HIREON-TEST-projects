import apiClient from './apiClient';
import { Wallet, WalletTransaction, RazorpayOrder } from '../types';

export const getWallet = async (): Promise<Wallet> => {
  const { data } = await apiClient.get('/wallet');
  return data.data;
};

export const getWalletTransactions = async (page = 1): Promise<{
  transactions: WalletTransaction[]; page: number; total: number; pages: number;
}> => {
  const { data } = await apiClient.get('/wallet/transactions', { params: { page } });
  return data.data;
};

export const createRechargeOrder = async (amountPaise: number): Promise<RazorpayOrder> => {
  const { data } = await apiClient.post('/wallet/recharge/order', { amountPaise });
  return data.data;
};

interface VerifyPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const verifyRecharge = async (payload: VerifyPayload): Promise<{ balance: number }> => {
  const { data } = await apiClient.post('/wallet/recharge/verify', payload);
  return data.data;
};
