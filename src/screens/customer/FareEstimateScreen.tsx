import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { CustomerStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { fetchRoute } from '../../services/routeService';
import Card         from '../../components/common/Card';
import Button       from '../../components/common/Button';
import ScreenHeader from '../../components/navigation/ScreenHeader';
import { createOrder, createOrderPaymentOrder, verifyOrderPayment } from '../../services/orderService';
import { openRazorpayCheckout, isUserCancelled } from '../../services/razorpayCheckout';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import useAppSelector from '../../hooks/useAppSelector';
import { setActiveOrder, prependOrder } from '../../store/slices/orderSlice';
import { formatCurrency, formatDistance, truncateAddress } from '../../utils/formatters';
import { Order } from '../../types';

type Route = RouteProp<CustomerStackParamList, 'FareEstimate'>;

const FareEstimateScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const route      = useRoute<Route>();
  const dispatch   = useAppDispatch();
  const profile    = useAppSelector(s => s.auth.profile);
  const { pickup, delivery, parcel, estimate, paymentMethod } = route.params;
  const isOnlinePayment = paymentMethod === 'ONLINE';

  const mapRef = useRef<MapView>(null);
  const [loading,       setLoading]       = useState(false);
  const [payLoading,    setPayLoading]    = useState(false);
  // ONLINE order pehle hi create ho chuka par payment abhi baaki/cancel ho gayi —
  // isse hold karke rakhte hain taaki retry par order dobara na bane.
  const [pendingOrder,  setPendingOrder]  = useState<Order | null>(null);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [routeCoords,   setRouteCoords]   = useState<{ latitude: number; longitude: number }[]>([]);

  const pickupLatLng   = { latitude: pickup.coordinates.lat,   longitude: pickup.coordinates.lng };
  const deliveryLatLng = { latitude: delivery.coordinates.lat, longitude: delivery.coordinates.lng };

  // Road route pickup → delivery via OSRM (Google Directions is disabled on the
  // key). Draws a blue Polyline + distance/ETA chips; straight-line fallback.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchRoute(pickup.coordinates, delivery.coordinates);
      if (cancelled) return;
      const coords = r?.coords?.length ? r.coords : [pickupLatLng, deliveryLatLng];
      setRouteCoords(coords);
      if (r) { setRouteDistance(r.distance / 1000); setRouteDuration(r.duration / 60); }
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // Order create hone ke baad Razorpay checkout kholo. Order khud FareEstimate
  // screen par hi navigate nahi karta jab tak payment verify na ho jaaye —
  // taaki bina-paid order dispatch na ho (backend bhi COD/paid check karta hai).
  const payForOrder = async (order: Order) => {
    try {
      setPayLoading(true);
      const rzpOrder = await createOrderPaymentOrder(order._id);
      const result = await openRazorpayCheckout(
        rzpOrder,
        `Order #${order.orderId}`,
        { name: profile?.name, email: profile?.email, contact: profile?.phone },
      );
      const verified = await verifyOrderPayment(order._id, {
        razorpay_order_id:   result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature:  result.razorpay_signature,
      });
      dispatch(setActiveOrder(verified));
      navigation.navigate('LiveTracking', { orderId: verified._id });
    } catch (e: any) {
      if (isUserCancelled(e)) {
        Alert.alert('Payment Cancel Ho Gaya', 'Order abhi bhi pending hai — "Pay Now" dabakar dobara try karein.');
      } else {
        Alert.alert('Payment Fail Ho Gayi', e.message || 'Kuch galat ho gaya. Dobara try karein.');
      }
    } finally {
      setPayLoading(false);
    }
  };

  const handleConfirm = async () => {
    // ONLINE ka order pehle hi ban chuka (payment sirf retry ho rahi hai) —
    // dobara createOrder mat bulao, warna duplicate order ban jaayega.
    if (pendingOrder) return payForOrder(pendingOrder);

    try {
      setLoading(true);
      const order = await createOrder({ pickup, delivery, parcel, paymentMethod });
      dispatch(prependOrder(order));

      if (isOnlinePayment) {
        setPendingOrder(order);
        await payForOrder(order);
      } else {
        dispatch(setActiveOrder(order));
        navigation.navigate('LiveTracking', { orderId: order._id });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const breakdown = [
    { label: 'Base Fare',        value: '₹30' },
    { label: `Distance (${formatDistance(estimate.distance)})`, value: `₹${Math.round(estimate.distance * 10)}` },
    { label: 'Weight surcharge', value: parcel.weight > 1 ? `₹${Math.round((parcel.weight - 1) * 5)}` : '₹0' },
    { label: 'Size surcharge',   value: parcel.size === 'large' ? '₹30' : parcel.size === 'medium' ? '₹15' : '₹0' },
    { label: 'Fragile charge',   value: parcel.isFragile ? '₹20' : '₹0' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title="Fare Estimate"
        subtitle="Review before confirming"
        canGoBack
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Google Map with Route */}
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude:      (pickup.coordinates.lat + delivery.coordinates.lat) / 2,
              longitude:     (pickup.coordinates.lng + delivery.coordinates.lng) / 2,
              latitudeDelta:  Math.abs(pickup.coordinates.lat - delivery.coordinates.lat) * 2 + 0.05,
              longitudeDelta: Math.abs(pickup.coordinates.lng - delivery.coordinates.lng) * 2 + 0.05,
            }}
            onMapReady={() => {
              mapRef.current?.fitToCoordinates([pickupLatLng, deliveryLatLng], {
                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                animated: true,
              });
            }}>

            {/* Route line (OSRM) */}
            {routeCoords.length > 0 && (
              <Polyline
                coordinates={routeCoords}
                strokeWidth={4}
                strokeColor={COLORS.primary}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* Pickup Marker */}
            <Marker coordinate={pickupLatLng} title="Pickup" pinColor="green" />

            {/* Delivery Marker */}
            <Marker coordinate={deliveryLatLng} title="Delivery" pinColor={COLORS.primary} />
          </MapView>

          {/* Route Info Overlay */}
          {(routeDistance !== null || routeDuration !== null) && (
            <View style={styles.routeOverlay}>
              {routeDistance !== null && (
                <View style={styles.routeChip}>
                  <Text style={styles.routeChipText}>📏 {routeDistance.toFixed(1)} km</Text>
                </View>
              )}
              {routeDuration !== null && (
                <View style={[styles.routeChip, { backgroundColor: COLORS.secondaryBg }]}>
                  <Text style={[styles.routeChipText, { color: COLORS.secondary }]}>
                    🕐 {formatDuration(routeDuration)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Fare Hero */}
        <View style={styles.fareHero}>
          <Text style={styles.fareHeroLabel}>Estimated Fare</Text>
          <Text style={styles.fareHeroAmount}>{formatCurrency(estimate.estimated)}</Text>
          <Text style={styles.fareHeroSub}>
            {isOnlinePayment ? 'Pay Online' : 'Cash on Delivery'} · {formatDistance(estimate.distance)}
          </Text>
        </View>

        {pendingOrder && (
          <View style={styles.pendingNote}>
            <Text style={styles.pendingNoteText}>
              ⚠️ Order #{pendingOrder.orderId} ban chuka hai, payment abhi baaki hai. "Pay Now" dabakar complete karein.
            </Text>
          </View>
        )}

        {/* Route Card */}
        <Card>
          <Text style={styles.cardTitle}>Route</Text>
          <View style={styles.routeWrap}>
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>Pickup</Text>
                <Text style={styles.routeAddr}>{truncateAddress(pickup.address, 60)}</Text>
              </View>
            </View>
            <View style={styles.routeConnector} />
            <View style={styles.routeRow}>
              <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
              <View style={styles.routeInfo}>
                <Text style={styles.routeLabel}>Delivery</Text>
                <Text style={styles.routeAddr}>{truncateAddress(delivery.address, 60)}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Parcel Card */}
        <Card>
          <Text style={styles.cardTitle}>Parcel Details</Text>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Description</Text>
              <Text style={styles.detailValue}>{parcel.description}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Weight</Text>
              <Text style={styles.detailValue}>{parcel.weight} kg</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Size</Text>
              <Text style={styles.detailValue}>
                {parcel.size.charAt(0).toUpperCase() + parcel.size.slice(1)}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Fragile</Text>
              <Text style={[styles.detailValue, parcel.isFragile && { color: COLORS.warning }]}>
                {parcel.isFragile ? '⚠️ Yes' : 'No'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Fare Breakdown */}
        <Card>
          <Text style={styles.cardTitle}>Fare Breakdown</Text>
          {breakdown.map((b, i) => (
            <View
              key={b.label}
              style={[styles.breakdownRow, i === breakdown.length - 1 && { marginBottom: 0 }]}>
              <Text style={styles.breakdownLabel}>{b.label}</Text>
              <Text style={styles.breakdownValue}>{b.value}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatCurrency(estimate.estimated)}</Text>
          </View>
        </Card>

        <View style={styles.infoNote}>
          <Text style={styles.infoNoteText}>
            💡 Final fare may vary slightly based on actual distance and weight.
          </Text>
        </View>

        <Button
          title={pendingOrder ? 'Pay Now' : isOnlinePayment ? 'Pay & Place Order' : 'Confirm & Place Order'}
          onPress={handleConfirm}
          loading={loading || payLoading}
          style={{ marginBottom: 10 }}
        />
        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { paddingHorizontal: 16, paddingBottom: 32 },

  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: -16,
    marginBottom: 0,
  },
  map: { flex: 1 },
  routeOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    gap: 8,
  },
  routeChip: {
    backgroundColor: COLORS.primaryBg,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
  },
  routeChipText: {
    fontSize: 12, fontWeight: '700', color: COLORS.primary,
  },

  fareHero: {
    backgroundColor: COLORS.primary,
    borderRadius: 20, padding: 28, alignItems: 'center',
    marginHorizontal: -16, marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  fareHeroLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6, letterSpacing: 0.5 },
  fareHeroAmount: { fontSize: 52, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  fareHeroSub:    { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 },

  cardTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text, marginBottom: 14, letterSpacing: 0.2 },

  pendingNote: {
    backgroundColor: COLORS.warningBg, borderRadius: 12, padding: 12,
    marginBottom: 16, borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  pendingNoteText: { fontSize: 12, color: COLORS.warning, lineHeight: 17, fontWeight: '600' },

  routeWrap:     { gap: 0 },
  routeRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  routeDot:      { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  routeConnector:{ width: 1, height: 20, backgroundColor: COLORS.border, marginLeft: 4.5, marginVertical: 4 },
  routeInfo:     { flex: 1 },
  routeLabel:    { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginBottom: 2 },
  routeAddr:     { fontSize: 13, color: COLORS.text, fontWeight: '500', lineHeight: 18 },

  detailGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  detailItem:  { width: '50%', paddingVertical: 8, paddingRight: 8 },
  detailLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginBottom: 3 },
  detailValue: { fontSize: 14, color: COLORS.text, fontWeight: '700' },

  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  breakdownLabel: { fontSize: 13, color: COLORS.textMuted },
  breakdownValue: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 2, borderTopColor: COLORS.primary + '30',
  },
  totalLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  totalValue: { fontSize: 22, fontWeight: '900', color: COLORS.primary },

  infoNote: {
    backgroundColor: COLORS.warningBg, borderRadius: 12, padding: 12,
    marginBottom: 16, borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  infoNoteText: { fontSize: 12, color: COLORS.warning, lineHeight: 17 },
});

export default FareEstimateScreen;
