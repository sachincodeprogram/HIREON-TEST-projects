import { FareEstimate, LocationInfo, ParcelInfo, PaymentMethod } from '../types';

export type RootStackParamList = {
  Splash:   undefined;
  Auth:     undefined;
  Customer: undefined;
  Rider:    undefined;
};

export type AuthStackParamList = {
  Login:      undefined;
  Signup:     { phone: string };
  RoleSelect: { name: string; phone: string };
};

export type CustomerTabParamList = {
  Dashboard:  undefined;
  BookParcel: undefined;
  History:    undefined;
  Profile:    undefined;
};

export type CustomerStackParamList = {
  CustomerTabs:  undefined;
  FareEstimate:  { pickup: LocationInfo; delivery: LocationInfo; parcel: ParcelInfo; estimate: FareEstimate; paymentMethod: PaymentMethod };
  LiveTracking:  { orderId: string };
};

export type RiderTabParamList = {
  Dashboard: undefined;
  History:   undefined;
  Earnings:  undefined;
  Profile:   undefined;
};

export type RiderStackParamList = {
  RiderTabs:      undefined;
  ActiveDelivery: { orderId: string };
  Wallet:         undefined;
  Navigation: {
    orderId:            string;
    destination:        { lat: number; lng: number };
    label:              string;   // "Pickup" | "Delivery"
    destinationAddress: string;
  };
};
