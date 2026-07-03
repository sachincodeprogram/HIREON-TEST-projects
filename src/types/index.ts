export type UserRole = 'customer' | 'rider';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type ParcelSize = 'small' | 'medium' | 'large';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface LocationInfo {
  address: string;
  coordinates: Coordinates;
  contactName?: string;
  contactPhone?: string;
}

export interface ParcelInfo {
  description: string;
  weight: number;
  size: ParcelSize;
  isFragile: boolean;
}

export interface FareInfo {
  estimated: number;
  final: number;
  distance: number;
}

export interface TimelineItem {
  status: OrderStatus;
  note: string;
  timestamp: string;
}

export interface UserProfile {
  _id: string;
  firebaseUid: string;
  email: string;
  name: string;
  phone: string;
  avatar: string;
  role: UserRole;
  // rider only
  vehicleType?: string;
  vehicleNumber?: string;
  isOnline?: boolean;
  totalEarnings?: number;
  totalDeliveries?: number;
  rating?: number;
  createdAt: string;
}

export interface Order {
  _id: string;
  orderId: string;
  customer: UserProfile | string;
  rider: UserProfile | string | null;
  pickup: LocationInfo;
  delivery: LocationInfo;
  parcel: ParcelInfo;
  fare: FareInfo;
  status: OrderStatus;
  pickupOtp?: string;
  deliveryOtp?: string;
  timeline: TimelineItem[];
  riderEarning: number;
  /** Customer ki 1-5 star rating (delivery ke baad); 0/undefined = abhi nahi di */
  rating?: number;
  review?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FareEstimate {
  estimated: number;
  riderEarning: number;
  distance: number;
}

export interface EarningsData {
  total: number;
  today: { amount: number; count: number };
  week: { amount: number; count: number };
  month: { amount: number; count: number };
  rating: number;
  totalDeliveries: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
