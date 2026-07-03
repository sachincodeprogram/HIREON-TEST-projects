import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Animated, TouchableOpacity, Linking, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { RiderStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setActiveOrder } from '../../store/slices/orderSlice';
import { connectSocket, joinOrderRoom, emitRiderLocation } from '../../services/socketService';
import { getOrderById, confirmPickup, confirmDelivery } from '../../services/orderService';
import { requestLocationPermission, getCurrentPosition } from '../../services/locationService';
import { fetchRoute } from '../../services/routeService';
import apiClient from '../../services/apiClient';
import Button       from '../../components/common/Button';
import StatusBadge  from '../../components/common/StatusBadge';
import ScreenHeader from '../../components/navigation/ScreenHeader';
import { Order, Coordinates, UserProfile } from '../../types';
import { formatCurrency, truncateAddress } from '../../utils/formatters';

type Route = RouteProp<RiderStackParamList, 'ActiveDelivery'>;

// Rider must be within this many metres of the target before OTP entry unlocks.
const OTP_RANGE_M = 100;

// Haversine distance in metres between two lat/lng points.
const distanceMeters = (a: Coordinates, b: Coordinates) => {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180;
  const la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// 4 alag digit-boxes wala OTP input — har dala hua digit bade size me saaf
// dikhta hai (pehle single TextInput tha jisme letterSpacing ke kaaran Android
// par digits clip ho jaate the). Peeche ek invisible TextInput input capture
// karta hai; boxes par tap karte hi keyboard khul jaata hai.
const OtpBoxes = ({
  value, onChange, color, disabled, onFocus,
}: {
  value: string; onChange: (v: string) => void; color: string; disabled: boolean;
  /** Keyboard khulne par parent screen ko scroll karne ka mauka — warna boxes
   *  keyboard ke peeche chhup jaate hain aur rider ko typed digits nahi dikhte. */
  onFocus?: () => void;
}) => {
  const inputRef = useRef<TextInput>(null);
  return (
    <Pressable
      style={styles.otpBoxWrap}
      disabled={disabled}
      onPress={() => inputRef.current?.focus()}>
      <View style={styles.otpBoxRow} pointerEvents="none">
        {[0, 1, 2, 3].map(i => (
          <View
            key={i}
            style={[
              styles.otpBox,
              { borderColor: disabled ? COLORS.border : color },
              !disabled && value.length === i && styles.otpBoxActive,
              disabled && styles.otpBoxDisabled,
            ]}>
            <Text style={[styles.otpBoxDigit, { color: disabled ? COLORS.textLight : COLORS.text }]}>
              {value[i] ?? ''}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        style={styles.otpHiddenInput}
        value={value}
        onChangeText={t => onChange(t.replace(/[^0-9]/g, '').slice(0, 4))}
        onFocus={onFocus}
        keyboardType="number-pad"
        maxLength={4}
        editable={!disabled}
        caretHidden
      />
    </Pressable>
  );
};

const ActiveDeliveryScreen = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation();
  const dispatch   = useAppDispatch();
  const { orderId } = route.params;

  const mapRef              = useRef<MapView>(null);
  const scrollRef           = useRef<ScrollView>(null);
  const bannerAnim          = useRef(new Animated.Value(0)).current;
  const [order,   setOrder]  = useState<Order | null>(null);
  const [otp,     setOtp]    = useState('');
  const [loading, setLoading] = useState(false);
  const [riderPos, setRiderPos] = useState<Coordinates | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [routeCoords, setRouteCoords] = useState<{ latitude: number; longitude: number }[]>([]);
  const [showPickupBanner, setShowPickupBanner] = useState(false);
  const locationWatchId = useRef<number | null>(null);
  const lastRouteOrigin = useRef<Coordinates | null>(null);
  const lastRouteTarget = useRef<Coordinates | null>(null);

  // OTP par focus hote hi sheet ko neeche tak scroll karo — warna keyboard
  // boxes ko dhak deta hai aur rider ko typed digits nahi dikhte.
  const scrollOtpIntoView = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  };

  // Animate pickup→delivery transition banner
  const showTransitionBanner = () => {
    setShowPickupBanner(true);
    Animated.sequence([
      Animated.timing(bannerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(2800),
      Animated.timing(bannerAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => setShowPickupBanner(false));
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const o = await getOrderById(orderId);
        if (mounted) { setOrder(o); dispatch(setActiveOrder(o)); }
      } catch { /* silent */ }

      const socket = await connectSocket();
      joinOrderRoom(orderId);
      socket.on('order_update', (update: Partial<Order> & { status: Order['status']; addressChanged?: boolean }) => {
        if (!mounted) return;
        // Customer delivery address badal sakta hai — delivery/fare bhi merge karo
        // taaki naya target + naya earning turant dikhe.
        setOrder(prev => prev ? { ...prev, ...update } : prev);
        if (update.addressChanged) {
          Alert.alert(
            '📍 Delivery Address Badla',
            'Customer ne delivery ka address update kiya hai. Naya route aur fare map par dikh raha hai.',
          );
        }
      });

      // Request location permission before starting GPS
      const permStatus = await requestLocationPermission();
      if (permStatus !== 'granted') {
        Alert.alert('Location Chahiye', 'Delivery ke liye GPS allow karo.');
        return;
      }

      // Get one immediate fix so the rider marker + route line appear right away.
      // watchPosition can take several seconds (or silently fail) for its first
      // callback, which would leave the map without a current location.
      getCurrentPosition()
        .then(c => { if (mounted) setRiderPos(c); })
        .catch(() => { /* watchPosition below may still deliver */ });

      locationWatchId.current = Geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lng, heading } = pos.coords;
          if (mounted) setRiderPos({ lat, lng });
          apiClient.post('/rider/location', { lat, lng, heading: heading || 0 }).catch(() => {});
          emitRiderLocation(orderId, lat, lng, heading || 0);
        },
        err => { console.warn('[ActiveDelivery] watchPosition error', err?.message); },
        { enableHighAccuracy: true, distanceFilter: 15, interval: 4000, fastestInterval: 2000 },
      );
    };
    init();
    return () => {
      mounted = false;
      if (locationWatchId.current !== null) Geolocation.clearWatch(locationWatchId.current);
    };
  }, [orderId]);

  // Center / fit the map on the active target as soon as the order loads
  // and on every pickup → delivery transition. Runs even without GPS or the
  // Directions API (both can be unavailable), so the pickup is always visible.
  useEffect(() => {
    if (!order || !mapRef.current) return;
    const targetCoords = order.status === 'accepted'
      ? order.pickup.coordinates
      : order.delivery.coordinates;
    if (!targetCoords) return;
    if (riderPos) {
      // GPS available — frame both the rider and the target
      mapRef.current.fitToCoordinates([
        { latitude: riderPos.lat, longitude: riderPos.lng },
        { latitude: targetCoords.lat, longitude: targetCoords.lng },
      ], { edgePadding: { top: 70, right: 50, bottom: 50, left: 50 }, animated: true });
    } else {
      // No GPS yet — still center on the target so the pickup pin is on screen
      mapRef.current.animateToRegion({
        latitude:  targetCoords.lat,
        longitude: targetCoords.lng,
        latitudeDelta:  0.02,
        longitudeDelta: 0.02,
      }, 600);
    }
  }, [order?._id, order?.status, order?.delivery.coordinates.lat, order?.delivery.coordinates.lng, riderPos]);

  // Fetch a road-following route (rider → current target) and draw it as a blue
  // Polyline. Uses the shared routeService (Google Directions → OSRM fallback),
  // so it works whether or not the Google Directions API is enabled on the key.
  // Falls back to a straight line if both providers fail.
  useEffect(() => {
    if (!riderPos || !order) return;
    const target = order.status === 'accepted'
      ? order.pickup.coordinates
      : order.delivery.coordinates;
    if (!target) return;

    // Avoid spamming the routing API: only refetch when the target changed or the
    // rider moved a meaningful distance (~150m).
    const targetChanged = !lastRouteTarget.current
      || lastRouteTarget.current.lat !== target.lat
      || lastRouteTarget.current.lng !== target.lng;
    const moved = !lastRouteOrigin.current
      || Math.hypot(lastRouteOrigin.current.lat - riderPos.lat, lastRouteOrigin.current.lng - riderPos.lng) > 0.0015;
    if (!targetChanged && !moved) return;
    lastRouteOrigin.current = riderPos;
    lastRouteTarget.current = target;

    let cancelled = false;
    (async () => {
      const r = await fetchRoute(riderPos, target);
      if (cancelled) return;
      if (r?.coords?.length) {
        setRouteCoords(r.coords);
        setRouteDistance(r.distance / 1000); // metres → km
        setRouteDuration(r.duration / 60);    // seconds → min
        mapRef.current?.fitToCoordinates(r.coords, {
          edgePadding: { top: 60, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      } else {
        // Routing unavailable — show a straight blue line so the route is still drawn
        const straight = [
          { latitude: riderPos.lat, longitude: riderPos.lng },
          { latitude: target.lat,   longitude: target.lng },
        ];
        setRouteCoords(straight);
        mapRef.current?.fitToCoordinates(straight, {
          edgePadding: { top: 60, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    })();
    return () => { cancelled = true; };
    // delivery coords bhi deps me — customer address badle to route turant redraw ho
  }, [riderPos?.lat, riderPos?.lng, order?.status, order?.delivery.coordinates.lat, order?.delivery.coordinates.lng]);

  const handlePickupConfirm = async () => {
    if (!withinRange) {
      return Alert.alert('Pickup Se Door Ho', 'OTP daalne ke liye pickup location ke 100m ke andar aao.');
    }
    if (!otp || otp.length !== 4) {
      return Alert.alert('OTP Galat Hai', 'Customer se 4-digit OTP lo aur enter karo.');
    }
    try {
      setLoading(true);
      const updated = await confirmPickup(orderId, otp);
      setOrder(updated);
      setOtp('');
      setRouteDistance(null);
      setRouteDuration(null);
      showTransitionBanner();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeliveryConfirm = async () => {
    if (!withinRange) {
      return Alert.alert('Delivery Se Door Ho', 'OTP daalne ke liye delivery location ke 100m ke andar aao.');
    }
    if (!otp || otp.length !== 4) {
      return Alert.alert('OTP Galat Hai', 'Customer se 4-digit OTP lo aur enter karo.');
    }
    try {
      setLoading(true);
      const updated = await confirmDelivery(orderId, otp);
      setOrder(updated);
      setOtp('');
      if (locationWatchId.current !== null) {
        Geolocation.clearWatch(locationWatchId.current);
        locationWatchId.current = null;
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const pickupCoords   = order?.pickup.coordinates;
  const deliveryCoords = order?.delivery.coordinates;
  const isPickup   = order?.status === 'accepted';
  const isDelivery = order?.status === 'picked_up';
  const isDone     = order?.status === 'delivered';

  // Order owner (customer) details for the contact card + call button.
  const customer = order && typeof order.customer === 'object' && order.customer
    ? (order.customer as UserProfile)
    : null;

  const startNavigation = () => {
    if (!order) return;
    const target = isPickup ? order.pickup : order.delivery;
    (navigation as any).navigate('Navigation', {
      orderId,
      destination:        target.coordinates,
      label:              isPickup ? 'Pickup' : 'Delivery',
      destinationAddress: target.address,
    });
  };

  const targetCoords = isPickup ? pickupCoords : deliveryCoords;

  // Distance from the rider to the active target — OTP only unlocks within 100m.
  const distToTarget = riderPos && targetCoords ? distanceMeters(riderPos, targetCoords) : null;
  const withinRange  = distToTarget !== null && distToTarget <= OTP_RANGE_M;
  const rangeMsg = !riderPos
    ? { text: '📍 Location le rahe hain…', ok: false }
    : withinRange
      ? { text: '✅ Aap location pe pohonch gaye — OTP daalo', ok: true }
      : { text: `📍 ${Math.round(distToTarget!)} m door — OTP daalne ke liye 100m ke andar aao`, ok: false };

  const initialRegion = targetCoords
    ? { latitude: targetCoords.lat, longitude: targetCoords.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const riderLatLng  = riderPos
    ? { latitude: riderPos.lat, longitude: riderPos.lng }
    : null;
  const pickupLatLng   = pickupCoords
    ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng }
    : null;
  const deliveryLatLng = deliveryCoords
    ? { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng }
    : null;

  const stepTitle = isPickup ? 'Pickup Pe Jao' : isDelivery ? 'Delivery Pe Jao' : 'Delivery Ho Gayi!';
  const stepSub   = isPickup
    ? 'Pickup location pe parcel lene jao'
    : isDelivery ? 'Delivery location pe parcel dene jao' : 'Sab steps complete ho gaye';

  const formatDuration = (min: number) =>
    min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={stepTitle}
        subtitle={stepSub}
        canGoBack
        onBack={() => navigation.goBack()}
      />

      {/* Map */}
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}>

          {/* Route: rider → current target (blue Polyline) */}
          {routeCoords.length > 0 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor="#1A73E8"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Rider marker */}
          {riderLatLng && (
            <Marker coordinate={riderLatLng} title="Aap">
              <View style={styles.riderDot}>
                <Text style={{ fontSize: 18 }}>🏍️</Text>
              </View>
            </Marker>
          )}

          {/* Pickup marker */}
          {pickupLatLng && (
            <Marker coordinate={pickupLatLng} title="Pickup" pinColor="green" />
          )}

          {/* Delivery marker */}
          {deliveryLatLng && (
            <Marker coordinate={deliveryLatLng} title="Delivery" pinColor={COLORS.primary} />
          )}
        </MapView>

        {/* Route info overlay */}
        {(routeDistance !== null || routeDuration !== null) && (
          <View style={styles.mapOverlay}>
            {routeDistance !== null && (
              <View style={styles.mapChip}>
                <Text style={styles.mapChipText}>📏 {routeDistance.toFixed(1)} km</Text>
              </View>
            )}
            {routeDuration !== null && (
              <View style={[styles.mapChip, { backgroundColor: COLORS.secondaryBg }]}>
                <Text style={[styles.mapChipText, { color: COLORS.secondary }]}>
                  🕐 {formatDuration(routeDuration)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Step indicator on map */}
        <View style={[styles.stepBadgeOnMap, { backgroundColor: isPickup ? COLORS.success : COLORS.primary }]}>
          <Text style={styles.stepBadgeText}>
            {isPickup ? '● Pickup' : isDone ? '✓ Done' : '● Delivery'}
          </Text>
        </View>

      </View>

      {/* Pickup → Delivery transition banner */}
      {showPickupBanner && (
        <Animated.View style={[styles.transitionBanner, { opacity: bannerAnim, transform: [{ translateY: bannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }]}>
          <Text style={styles.transitionIcon}>📦✅</Text>
          <View>
            <Text style={styles.transitionTitle}>Parcel Pick Up Ho Gaya!</Text>
            <Text style={styles.transitionSub}>Ab delivery location pe jao 🚀</Text>
          </View>
        </Animated.View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.sheet}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {order && (
          <>
            {/* Order header */}
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.orderId}># {order.orderId}</Text>
                <Text style={styles.step}>
                  {isPickup ? 'Step 1/2 — Pickup' : isDelivery ? 'Step 2/2 — Delivery' : 'Completed ✓'}
                </Text>
              </View>
              <StatusBadge status={order.status} />
            </View>

            {/* Earnings banner */}
            <View style={styles.earningBanner}>
              <Text style={styles.earningLabel}>Aapki Kamai</Text>
              <Text style={styles.earningValue}>{formatCurrency(order.riderEarning)}</Text>
            </View>

            {/* Customer contact card + call */}
            {customer && !isDone && (
              <View style={styles.customerCard}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.customerAvatarText}>
                    {customer.name ? customer.name.charAt(0).toUpperCase() : '👤'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.customerLabel}>Customer</Text>
                  <Text style={styles.customerName} numberOfLines={1}>{customer.name || 'Customer'}</Text>
                  {customer.phone ? (
                    <Text style={styles.customerPhone} numberOfLines={1}>{customer.phone}</Text>
                  ) : null}
                </View>
                {customer.phone ? (
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => Linking.openURL(`tel:${customer.phone}`)}
                    activeOpacity={0.85}>
                    <Text style={styles.callBtnIcon}>📞</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* Route summary */}
            <View style={styles.routeSummary}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>Pickup</Text>
                  <Text style={styles.routeAddr} numberOfLines={2}>{truncateAddress(order.pickup.address, 80)}</Text>
                  {order.pickup.contactName ? (
                    <Text style={styles.contactText}>👤 {order.pickup.contactName} · {order.pickup.contactPhone}</Text>
                  ) : null}
                </View>
                {isPickup && <View style={styles.activePill}><Text style={styles.activePillText}>JAO</Text></View>}
              </View>
              <View style={styles.routeConnector} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeLabel}>Delivery</Text>
                  <Text style={styles.routeAddr} numberOfLines={2}>{truncateAddress(order.delivery.address, 80)}</Text>
                  {order.delivery.contactName ? (
                    <Text style={styles.contactText}>👤 {order.delivery.contactName} · {order.delivery.contactPhone}</Text>
                  ) : null}
                </View>
                {isDelivery && <View style={[styles.activePill, { backgroundColor: COLORS.primary }]}><Text style={styles.activePillText}>JAO</Text></View>}
              </View>
            </View>

            {/* Start turn-by-turn navigation */}
            {!isDone && (
              <TouchableOpacity style={styles.navCta} onPress={startNavigation} activeOpacity={0.88}>
                <Text style={styles.navCtaIcon}>🧭</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.navCtaText}>Navigation Shuru Karo</Text>
                  <Text style={styles.navCtaSub}>{isPickup ? 'Pickup' : 'Delivery'} tak turn-by-turn directions</Text>
                </View>
                <Text style={styles.navCtaArrow}>›</Text>
              </TouchableOpacity>
            )}

            {/* OTP Section - Pickup */}
            {isPickup && (
              <View style={[styles.otpSection, { borderColor: COLORS.success + '60' }]}>
                <View style={styles.otpHeader}>
                  <Text style={styles.otpIcon}>🔑</Text>
                  <View>
                    <Text style={styles.otpTitle}>Pickup OTP Daalo</Text>
                    <Text style={styles.otpHint}>Customer se OTP lo aur yahan type karo</Text>
                  </View>
                </View>
                <View style={[styles.rangeBanner, rangeMsg.ok ? styles.rangeBannerOk : styles.rangeBannerWarn]}>
                  <Text style={[styles.rangeText, { color: rangeMsg.ok ? COLORS.success : COLORS.warning }]}>
                    {rangeMsg.text}
                  </Text>
                </View>
                <OtpBoxes value={otp} onChange={setOtp} color={COLORS.success} disabled={!withinRange} onFocus={scrollOtpIntoView} />
                <Button
                  title={withinRange ? 'Pickup Confirm Karo' : 'Pickup Ke Paas Jao'}
                  onPress={handlePickupConfirm}
                  loading={loading}
                  disabled={!withinRange}
                  variant="success"
                  style={{ marginTop: 4 }}
                />
              </View>
            )}

            {/* OTP Section - Delivery */}
            {isDelivery && (
              <View style={[styles.otpSection, { borderColor: COLORS.primary + '60' }]}>
                <View style={styles.otpHeader}>
                  <Text style={styles.otpIcon}>🔑</Text>
                  <View>
                    <Text style={styles.otpTitle}>Delivery OTP Daalo</Text>
                    <Text style={styles.otpHint}>Customer se OTP lo aur yahan type karo</Text>
                  </View>
                </View>
                <View style={[styles.rangeBanner, rangeMsg.ok ? styles.rangeBannerOk : styles.rangeBannerWarn]}>
                  <Text style={[styles.rangeText, { color: rangeMsg.ok ? COLORS.success : COLORS.warning }]}>
                    {rangeMsg.text}
                  </Text>
                </View>
                <OtpBoxes value={otp} onChange={setOtp} color={COLORS.primary} disabled={!withinRange} onFocus={scrollOtpIntoView} />
                <Button
                  title={withinRange ? 'Delivery Confirm Karo' : 'Delivery Ke Paas Jao'}
                  onPress={handleDeliveryConfirm}
                  loading={loading}
                  disabled={!withinRange}
                  variant="primary"
                  style={{ marginTop: 4 }}
                />
              </View>
            )}

            {/* Delivery Complete */}
            {isDone && (
              <View style={styles.doneBanner}>
                <Text style={styles.doneIcon}>🎉</Text>
                <Text style={styles.doneTitle}>Delivery Complete!</Text>
                <Text style={styles.doneSub}>Bahut badhiya kaam kiya! Payment settle ho jaayegi.</Text>
                <View style={styles.doneEarning}>
                  <Text style={styles.doneEarningLabel}>Total Kamai</Text>
                  <Text style={styles.doneEarningValue}>{formatCurrency(order.riderEarning)}</Text>
                </View>
                {/* Customer rating dete hi socket order_update se yahan live aa jaati hai */}
                {order.rating ? (
                  <View style={styles.doneRating}>
                    <Text style={styles.doneRatingStars}>
                      {'★'.repeat(order.rating)}
                      <Text style={styles.doneRatingStarsOff}>{'★'.repeat(5 - order.rating)}</Text>
                    </Text>
                    <Text style={styles.doneRatingText}>Customer ne {order.rating}★ rating di 🙏</Text>
                  </View>
                ) : (
                  <Text style={styles.doneRatingWait}>Customer ki rating ka intezaar…</Text>
                )}
                <Button
                  title="Dashboard Pe Jao"
                  onPress={() => navigation.goBack()}
                  style={{ marginTop: 16 }}
                />
              </View>
            )}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  mapWrapper: { height: 280, position: 'relative' },
  map:        { flex: 1 },
  mapOverlay: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', gap: 8,
  },
  mapChip: {
    backgroundColor: COLORS.primaryBg, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.primary + '40',
  },
  mapChipText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  stepBadgeOnMap: {
    position: 'absolute', top: 10, right: 10,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  stepBadgeText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  navCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1A73E8', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#1A73E8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  navCtaIcon:  { fontSize: 26 },
  navCtaText:  { color: '#fff', fontSize: 16, fontWeight: '800' },
  navCtaSub:   { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', marginTop: 1 },
  navCtaArrow: { color: '#fff', fontSize: 28, fontWeight: '300' },

  riderDot: {
    backgroundColor: '#fff', borderRadius: 20, padding: 4,
    elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },

  // Pickup→Delivery transition banner
  transitionBanner: {
    backgroundColor: COLORS.success, paddingVertical: 14, paddingHorizontal: 20,
    alignItems: 'center', flexDirection: 'row', gap: 12,
  },
  transitionIcon:  { fontSize: 22 },
  transitionTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  transitionSub:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },

  sheet: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },

  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  orderId: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  step:    { fontSize: 13, fontWeight: '700', color: COLORS.text },

  earningBanner: {
    backgroundColor: COLORS.successBg, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.success + '30',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  earningLabel: { fontSize: 13, color: COLORS.success, fontWeight: '600' },
  earningValue: { fontSize: 26, fontWeight: '900', color: COLORS.success },

  // Customer contact card
  customerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  customerAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  customerAvatarText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  customerLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.3 },
  customerName:  { fontSize: 15, fontWeight: '800', color: COLORS.text, marginTop: 1 },
  customerPhone: { fontSize: 12, fontWeight: '600', color: COLORS.secondary, marginTop: 1 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.successBg,
    borderWidth: 1, borderColor: COLORS.success + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  callBtnIcon: { fontSize: 20 },

  routeSummary: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  routeRow:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  routeDot:       { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  routeConnector: { width: 1, height: 18, backgroundColor: COLORS.border, marginLeft: 4.5, marginVertical: 4 },
  routeLabel:     { fontSize: 10, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.3, marginBottom: 2 },
  routeAddr:      { fontSize: 13, color: COLORS.text, fontWeight: '500', lineHeight: 18 },
  contactText:    { fontSize: 12, color: COLORS.secondary, fontWeight: '600', marginTop: 4 },
  activePill: {
    backgroundColor: COLORS.success, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'center', marginLeft: 6,
  },
  activePillText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },

  otpSection: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 2, borderColor: COLORS.success + '40',
  },
  otpHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  otpIcon:   { fontSize: 28 },
  otpTitle:  { fontSize: 16, fontWeight: '800', color: COLORS.text },
  otpHint:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  // OTP digit boxes — har digit apne box me, hamesha saaf dikhta hai.
  otpBoxWrap: { marginBottom: 8 },
  otpBoxRow:  { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  otpBox: {
    width: 58, height: 64, borderRadius: 14, borderWidth: 2,
    backgroundColor: COLORS.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: {
    backgroundColor: COLORS.surface,
    transform: [{ scale: 1.05 }],
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12, shadowRadius: 3,
  },
  otpBoxDisabled: { opacity: 0.45 },
  otpBoxDigit:    { fontSize: 30, fontWeight: '900' },
  otpHiddenInput: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.02, color: 'transparent', fontSize: 1,
  },

  rangeBanner: {
    borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 12,
    borderWidth: 1,
  },
  rangeBannerOk:   { backgroundColor: COLORS.successBg, borderColor: COLORS.success + '40' },
  rangeBannerWarn: { backgroundColor: COLORS.warningBg, borderColor: COLORS.warning + '40' },
  rangeText: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },

  doneBanner: {
    backgroundColor: COLORS.successBg, borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.success + '30',
  },
  doneIcon:  { fontSize: 52, marginBottom: 10 },
  doneTitle: { fontSize: 22, fontWeight: '900', color: COLORS.success, marginBottom: 6 },
  doneSub:   { fontSize: 13, color: COLORS.success + 'CC', textAlign: 'center', lineHeight: 19 },
  doneEarning: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 16,
    marginTop: 16, width: '100%', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.success + '40',
  },
  doneEarningLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600', marginBottom: 4 },
  doneEarningValue: { fontSize: 36, fontWeight: '900', color: COLORS.success },
  doneRating:         { alignItems: 'center', marginTop: 12 },
  doneRatingStars:    { fontSize: 26, color: '#F5A623', letterSpacing: 3 },
  doneRatingStarsOff: { color: COLORS.border },
  doneRatingText:     { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 4 },
  doneRatingWait:     { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginTop: 12 },
});

export default ActiveDeliveryScreen;
