import apiClient from './apiClient';
import { UserProfile, UserRole } from '../types';

interface RegisterPayload {
  name: string;
  phone: string;
  role: UserRole;
  vehicleType?: string;
  vehicleNumber?: string;
}

export const registerUser = async (payload: RegisterPayload): Promise<UserProfile> => {
  const { data } = await apiClient.post('/auth/register', payload);
  return data.data;
};

export const getMyProfile = async (): Promise<UserProfile> => {
  const { data } = await apiClient.get('/auth/me');
  return data.data;
};

export const updateProfile = async (updates: Partial<UserProfile>): Promise<UserProfile> => {
  const { data } = await apiClient.put('/auth/profile', updates);
  return data.data;
};

export const deleteAccount = async (): Promise<void> => {
  await apiClient.delete('/auth/account');
};
