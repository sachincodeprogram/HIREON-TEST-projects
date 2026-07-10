import { io, Socket } from 'socket.io-client';
import auth from '@react-native-firebase/auth';
import { SOCKET_URL } from '../constants/api';
import { getDevPhone } from './apiClient';

let socket: Socket | null = null;

// Socket reconnect hone par server-side room membership udd jaati hai —
// rider/customer ko order_update (naya address, status) milna band ho jaata
// tha. Isliye joined rooms yaad rakho aur har (re)connect par dobara join karo.
type RoomMode = 'track_order' | 'join_order';
const joinedRooms = new Map<string, RoomMode>();

// Reconnect ke दौरान miss hue events (jaise address change) recover karne ke
// liye screens yahan listener laga sakti hain — reconnect par order refetch karo.
type ReconnectListener = () => void;
const reconnectListeners = new Set<ReconnectListener>();

export const onSocketReconnect = (fn: ReconnectListener): (() => void) => {
  reconnectListeners.add(fn);
  return () => reconnectListeners.delete(fn);
};

// Har (re)connection attempt par FRESH token — Firebase ID token ~1 ghante me
// expire hota hai; static auth payload hota to lambe background ke baad
// reconnect hamesha fail hota.
const freshAuth = (cb: (data: { token?: string }) => void) => {
  const devPhone = getDevPhone();
  if (__DEV__ && devPhone) { cb({ token: `dev:${devPhone}` }); return; }
  auth().currentUser?.getIdToken()
    .then(token => cb({ token }))
    .catch(() => cb({}));
};

export const connectSocket = async (): Promise<Socket> => {
  if (socket) return socket; // connected ya auto-reconnecting — dobara mat banao

  socket = io(SOCKET_URL, {
    auth: freshAuth,
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on('connect', () => {
    // Pehla connect ho ya reconnect — jo rooms join thi, sab dobara join karo.
    joinedRooms.forEach((mode, orderId) => socket?.emit(mode, orderId));
  });
  socket.on('connect_error', () => {
    // Server ne handshake reject kiya (jaise expire hua token) — is case me
    // socket.io khud retry NAHI karta (socket.active false). Thodi der baad
    // fresh token ke saath khud dobara connect karo, warna app restart tak
    // koi live update nahi aata.
    if (socket && !socket.active) {
      setTimeout(() => { if (socket && !socket.connected) socket.connect(); }, 3000);
    }
  });
  // socket.io 'reconnect' event manager par aata hai; isi par screens ko
  // refetch karwao taaki disconnect ke beech ke updates bhi mil jayen.
  socket.io.on('reconnect', () => {
    reconnectListeners.forEach(fn => { try { fn(); } catch { /* listener error ignore */ } });
  });
  return socket;
};

export const disconnectSocket = () => {
  socket?.disconnect();
  socket = null;
  joinedRooms.clear();
  reconnectListeners.clear();
};

export const getSocket = (): Socket | null => socket;

export const trackOrder = (orderId: string) => {
  joinedRooms.set(orderId, 'track_order');
  socket?.emit('track_order', orderId);
};

export const joinOrderRoom = (orderId: string) => {
  joinedRooms.set(orderId, 'join_order');
  socket?.emit('join_order', orderId);
};

export const leaveOrderRoom = (orderId: string) => {
  joinedRooms.delete(orderId);
};

export const emitRiderLocation = (orderId: string, lat: number, lng: number, heading: number) => {
  socket?.emit('rider_location', { orderId, lat, lng, heading });
};
