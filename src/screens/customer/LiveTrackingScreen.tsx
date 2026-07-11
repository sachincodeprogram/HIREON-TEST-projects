import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Linking, Animated, Easing, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, AnimatedRegion, MarkerAnimated } from 'react-native-maps';
import { CustomerStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setActiveOrder, setRiderCoords } from '../../store/slices/orderSlice';
import { connectSocket, trackOrder, getSocket, onSocketReconnect } from '../../services/socketService';
import { getOrderById, cancelOrder, getNearbyRiders, redispatchOrder, updateDeliveryAddress, rateOrder } from '../../services/orderService';
import { fetchRoute } from '../../services/routeService';
import StatusBadge from '../../components/common/StatusBadge';
import Button      from '../../components/common/Button';
import AddressSearchInput from '../../components/common/AddressSearchInput';
import { Order, Coordinates, UserProfile } from '../../types';
import { formatCurrency, truncateAddress } from '../../utils/formatters';

type Route = RouteProp<CustomerStackParamList, 'LiveTracking'>;

// Rider dhoondhne ka total window: 1km + 3km + 5km, har tier 1:30 min = 4:30 total.
const SEARCH_TOTAL_MS = 270000;
// Backend ke dispatch tiers ke saath sync — har 1:30 me daayra badhta hai.
// Search card ke neeche wali tier line inhi rangon me bharti hai.
const TIER_MS = 90000;
const SEARCH_TIERS = [
  { km: 1, color: COLORS.success },
  { km: 3, color: COLORS.warning },
  { km: 5, color: COLORS.error },
];

// Live rider marker with a pulsing "ping" ring — professional tracking feel.
const LiveRiderMarker = () => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const scale   = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2.8] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  return (
    <View style={styles.riderMarkerWrap}>
      <Animated.View style={[styles.riderPulse, { transform: [{ scale }], opacity }]} />
      <View style={styles.riderMarker}><Text style={{ fontSize: 18 }}>🏍️</Text></View>
    </View>
  );
};

// Play Store download jaisi "snake" wave bar — asli progress halki tint me
// peeche dikhta hai, aur ek solid patti track par lagataar left→right behti
// rehti hai (native driver, seamless loop — kabhi rukti nahi).
const SearchWaveBar = ({ progress }: { progress: Animated.Value }) => {
  const [trackW, setTrackW] = useState(0);
  const wave = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (trackW <= 0) return;
    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [trackW]);

  const fillWidth  = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const snakeW     = Math.max(46, trackW * 0.35);
  // Snake track ke bahar se enter/exit karti hai taaki loop seamless lage.
  const translateX = wave.interpolate({
    inputRange: [0, 1],
    outputRange: [-snakeW * 1.4, trackW + snakeW * 0.4],
  });

  return (
    <View style={styles.searchBarTrack} onLayout={e => setTrackW(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.searchBarFill, { width: fillWidth }]} />
      {trackW > 0 && (
        <Animated.View
          style={[styles.searchWave, { width: snakeW, transform: [{ translateX }, { skewX: '-18deg' }] }]}
        />
      )}
    </View>
  );
};

// Branded circular pin (pickup/delivery) with a pointer tail — cleaner than default pins.
const PlacePin = ({ color, icon }: { color: string; icon: string }) => (
  <View style={styles.placePinWrap}>
    <View style={[styles.placePin, { backgroundColor: color }]}>
      <Text style={styles.placePinIcon}>{icon}</Text>
    </View>
    <View style={[styles.placePinTail, { borderTopColor: color }]} />
  </View>
);

const LiveTrackingScreen = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation();
  const dispatch   = useAppDispatch();
  const { orderId } = route.params;

  const mapRef     = useRef<MapView>(null);
  const [order,    setOrder]    = useState<Order | null>(null);
  const [riderPos, setRiderPos] = useState<Coordinates | null>(null);
  const [hasRider, setHasRider] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const riderAnim = useRef<AnimatedRegion | null>(null);
  const [routeCoords,   setRouteCoords]   = useState<{ latitude: number; longitude: number }[]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const lastRouteOrigin = useRef<Coordinates | null>(null);
  const lastRouteTarget = useRef<Coordinates | null>(null);

  // Deliver hone tak customer delivery address badal sakta hai (fare recalc hota hai)
  const [editingAddress, setEditingAddress] = useState(false);
  const [savingAddress,  setSavingAddress]  = useState(false);

  // Delivery ke baad rider ko 1-5 star rating (ek hi baar)
  const [pendingStars,     setPendingStars]     = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Rider search (order pending hone tak): 5km ke andar online riders + progress bar
  const [nearbyRiders, setNearbyRiders] = useState<Coordinates[]>([]);
  const [noRider,       setNoRider]      = useState(false);
  const [retrying,      setRetrying]     = useState(false);
  const [searchStart,   setSearchStart]  = useState<number>(0);
  const searchProgress = useRef(new Animated.Value(0)).current;

  const searching = !!order && order.status === 'pending' && !noRider;
  // Rider assign hone tak order-info sheet 70% screen leti hai (map ~30%);
  // tracking shuru hote hi map ko wapas poori jagah mil jaati hai.
  const tallSheet = searching || noRider;

  // Tier ticker: har second elapsed update — 1:30 par tier line ka rang/segment badalta hai.
  const [searchElapsed, setSearchElapsed] = useState(0);
  useEffect(() => {
    if (!searching || !searchStart) return;
    const tick = () => setSearchElapsed(Math.max(0, Date.now() - searchStart));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [searching, searchStart]);
  const tierIdx = Math.min(SEARCH_TIERS.length - 1, Math.floor(searchElapsed / TIER_MS));

  useEffect(() => {
    let mounted = true;

    // Reconnect / app foreground par order fresh laao — disconnect ke beech ke
    // status/address updates miss ho jaate hain (room re-join socketService
    // khud karta hai).
    const refetchOrder = () => {
      getOrderById(orderId)
        .then(o => { if (mounted) { setOrder(o); dispatch(setActiveOrder(o)); } })
        .catch(() => {});
    };
    const offReconnect = onSocketReconnect(refetchOrder);
    const appStateSub = AppState.addEventListener('change', s => {
      if (s === 'active') refetchOrder();
    });

    const init = async () => {
      try {
        const o = await getOrderById(orderId);
        if (mounted) { setOrder(o); dispatch(setActiveOrder(o)); }
        const socket = await connectSocket();
        trackOrder(orderId);
        socket.on('rider_location', (coords: Coordinates) => {
          if (!mounted) return;
          setRiderPos(coords);
          dispatch(setRiderCoords(coords));
          // Smoothly glide the rider marker to the new fix instead of teleporting.
          const next = { latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0, longitudeDelta: 0 };
          if (!riderAnim.current) {
            riderAnim.current = new AnimatedRegion(next);
            setHasRider(true);
          } else {
            riderAnim.current.timing({ ...next, duration: 1000, useNativeDriver: false } as any).start();
          }
        });
        socket.on('order_update', (update: Partial<Order> & { status: Order['status'] }) => {
          if (mounted) setOrder(prev => prev ? { ...prev, ...update } : prev);
        });
        // 4:30 tak koi rider na mile to backend yeh bhejta hai.
        socket.on('order_no_rider', () => { if (mounted) setNoRider(true); });
      } catch { /* silent */ }
    };
    init();
    return () => {
      mounted = false;
      offReconnect();
      appStateSub.remove();
      getSocket()?.off('rider_location');
      getSocket()?.off('order_update');
      getSocket()?.off('order_no_rider');
    };
  }, [orderId]);

  // Order load hote hi (rider ki location aane se pehle bhi) map ko
  // pickup + delivery par fit karo — pehle default Delhi par atka rehta tha.
  const hasRiderFix = !!riderPos;
  useEffect(() => {
    if (!order || riderPos) return;
    const pts = [order.pickup.coordinates, order.delivery.coordinates]
      .filter(Boolean)
      .map(c => ({ latitude: c.lat, longitude: c.lng }));
    if (pts.length === 0) return;
    // Map mount/layout hone ka thoda wait — warna fitToCoordinates ignore ho jaata hai.
    // Search ke waqt map sirf ~30% screen hota hai — bade paddings (110/340)
    // map ki height se zyada ho jaate hain aur fit hi nahi hota.
    const pad = tallSheet
      ? { top: 40, right: 40, bottom: 40, left: 40 }
      : { top: 110, right: 60, bottom: 340, left: 60 };
    const t = setTimeout(() => {
      mapRef.current?.fitToCoordinates(pts, { edgePadding: pad, animated: true });
    }, 500);
    return () => clearTimeout(t);
  }, [order?._id, order?.delivery.coordinates.lat, order?.delivery.coordinates.lng, hasRiderFix, tallSheet]);

  // Draw the live road route rider → current target (pickup before pickup,
  // delivery after) as a blue Polyline + distance/ETA. Uses the shared
  // routeService (Google Routes → OSRM fallback) so it works even though the
  // Google Directions API is disabled on the key. Straight line if both fail.
  useEffect(() => {
    if (!riderPos || !order) return;
    const target = order.status === 'picked_up'
      ? order.delivery.coordinates
      : order.pickup.coordinates;
    if (!target) return;

    // Throttle: only refetch when the target changed or the rider moved ~150m.
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
      const coords = r?.coords?.length ? r.coords : [
        { latitude: riderPos.lat, longitude: riderPos.lng },
        { latitude: target.lat,   longitude: target.lng },
      ];
      setRouteCoords(coords);
      if (r) {
        setRouteDistance(r.distance / 1000); // metres → km
        setRouteDuration(r.duration / 60);    // seconds → min
      }
      // Professional follow-cam: naya target ho to poora route frame karo;
      // uske baad har move par sirf rider + target — camera rider ke saath
      // smoothly andar zoom hota jaata hai jaise-jaise rider paas aata hai.
      const fitPts = targetChanged ? coords : [
        { latitude: riderPos.lat, longitude: riderPos.lng },
        { latitude: target.lat,   longitude: target.lng },
      ];
      mapRef.current?.fitToCoordinates(fitPts, {
        edgePadding: { top: 110, right: 50, bottom: 340, left: 50 },
        animated: true,
      });
    })();
    return () => { cancelled = true; };
    // delivery coords bhi deps me — address edit hote hi route naya target dikhaye
  }, [riderPos?.lat, riderPos?.lng, order?.status, order?.delivery.coordinates.lat, order?.delivery.coordinates.lng]);

  // Pehli baar pending order aaye to search ki shuruaat order ke createdAt se maano.
  useEffect(() => {
    if (order && order.status === 'pending' && searchStart === 0) {
      setSearchStart(new Date(order.createdAt).getTime());
    }
  }, [order?.status, order?.createdAt]);

  // Rider search window: ease-out progress bar (shuru fast, end ke paas slow) +
  // 5km ke andar online riders ko map par dots ki tarah dikhao (har 8s refresh).
  useEffect(() => {
    if (!searching || !searchStart) return;
    const elapsed   = Math.max(0, Date.now() - searchStart);
    const remaining = Math.max(0, SEARCH_TOTAL_MS - elapsed);
    searchProgress.setValue(Math.min(1, elapsed / SEARCH_TOTAL_MS));
    const anim = Animated.timing(searchProgress, {
      toValue: 1,
      duration: remaining || 1,
      easing: Easing.out(Easing.quad),   // fast start -> slow finish
      useNativeDriver: false,
    });
    anim.start();

    let active = true;
    const load = () => {
      getNearbyRiders(orderId).then(r => { if (active) setNearbyRiders(r || []); }).catch(() => {});
    };
    load();
    const poll = setInterval(load, 8000);

    // Timeline khatam (4:30) — backend ka 'order_no_rider' event miss bhi ho
    // jaye to customer ko message zaroor dikhe (3s grace event ke liye; order
    // accept hote hi `searching` false → cleanup yeh timer clear kar deta hai).
    const doneTimer = setTimeout(() => { if (active) setNoRider(true); }, remaining + 3000);

    return () => { active = false; anim.stop(); clearInterval(poll); clearTimeout(doneTimer); };
  }, [searching, searchStart, orderId]);

  // "Order Again" — same order dobara dispatch + fresh 4:30 search.
  const handleOrderAgain = async () => {
    try {
      setRetrying(true);
      await redispatchOrder(orderId);
      searchProgress.setValue(0);
      setNoRider(false);
      setSearchStart(Date.now());
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setRetrying(false);
    }
  };

  // Naya delivery address pin-confirm hua — backend par save karo. Fare nayi
  // doori se recalc hota hai; diff customer ko alert me dikhate hain.
  const handleDeliveryEdited = async (address: string, coords: Coordinates) => {
    if (!order) return;
    try {
      setSavingAddress(true);
      const oldFare  = order.fare.estimated;
      const updated  = await updateDeliveryAddress(orderId, {
        address,
        coordinates: coords,
        contactName:  order.delivery.contactName,
        contactPhone: order.delivery.contactPhone,
      });
      setOrder(updated);
      dispatch(setActiveOrder(updated));
      setEditingAddress(false);
      const diff = updated.fare.estimated - oldFare;
      Alert.alert(
        'Delivery Address Badal Gaya ✅',
        `Naya fare: ${formatCurrency(updated.fare.estimated)}` +
          (diff > 0
            ? ` (+${formatCurrency(diff)} doori badhne se add hua)`
            : diff < 0
              ? ` (${formatCurrency(diff)} doori kam hone se ghata)`
              : ' (fare me koi badlav nahi)') +
          '\nRider ko naya address bhej diya gaya hai.',
      );
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingAddress(false);
    }
  };

  // Customer ne stars chun ke submit kiya — backend rider ka aggregate update
  // karke rider ko live batata hai.
  const handleRate = async () => {
    if (!order || pendingStars === 0) return;
    try {
      setRatingSubmitting(true);
      const updated = await rateOrder(orderId, pendingStars);
      setOrder(updated);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Order', 'Are you sure you want to cancel?', [
      { text: 'Keep Order', style: 'cancel' },
      {
        text: 'Cancel Order', style: 'destructive', onPress: async () => {
          try {
            setLoading(true);
            const updated = await cancelOrder(orderId, 'Cancelled by customer');
            setOrder(updated);
          } catch (e: any) { Alert.alert('Error', e.message); }
          finally { setLoading(false); }
        },
      },
    ]);
  };

  // Recenter / fit the map back onto the live route (or the pickup→delivery span).
  const recenter = () => {
    const pts = routeCoords.length > 0
      ? routeCoords
      : ([
          pickupCoords   ? { latitude: pickupCoords.lat,   longitude: pickupCoords.lng }   : null,
          deliveryCoords ? { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng } : null,
          riderPos       ? { latitude: riderPos.lat,       longitude: riderPos.lng }       : null,
        ].filter(Boolean) as { latitude: number; longitude: number }[]);
    if (pts.length > 0) {
      mapRef.current?.fitToCoordinates(pts, {
        edgePadding: { top: 110, right: 60, bottom: 340, left: 60 },
        animated: true,
      });
    }
  };

  const pickupCoords   = order?.pickup.coordinates;
  const deliveryCoords = order?.delivery.coordinates;

  const initialRegion = pickupCoords
    ? { latitude: pickupCoords.lat, longitude: pickupCoords.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 28.6139, longitude: 77.2090, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  const pickupLatLng   = pickupCoords
    ? { latitude: pickupCoords.lat,   longitude: pickupCoords.lng }
    : null;
  const deliveryLatLng = deliveryCoords
    ? { latitude: deliveryCoords.lat, longitude: deliveryCoords.lng }
    : null;
  // Live delivery progress (stepper) + assigned rider details for the info card.
  const cancelled = order?.status === 'cancelled';
  // Deliver/cancel hone tak hi address edit ho sakta hai.
  const canEditDelivery = !!order && ['pending', 'accepted', 'picked_up', 'in_transit'].includes(order.status);
  const stepIndex = (() => {
    switch (order?.status) {
      case 'accepted':   return 1;
      case 'picked_up':
      case 'in_transit': return 2;
      case 'delivered':  return 3;
      default:           return 0;
    }
  })();
  const rider = order && typeof order.rider === 'object' && order.rider
    ? (order.rider as UserProfile)
    : null;

  const formatDuration = (min: number) =>
    min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)}h ${Math.round(min % 60)}min`;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={initialRegion}
        showsUserLocation>

        {/* Live road route rider → pickup / delivery — white casing + blue line (nav style) */}
        {routeCoords.length > 0 && (
          <>
            <Polyline coordinates={routeCoords} strokeColor="#FFFFFF" strokeWidth={9} lineCap="round" lineJoin="round" />
            <Polyline coordinates={routeCoords} strokeColor="#1A73E8" strokeWidth={5} lineCap="round" lineJoin="round" />
          </>
        )}

        {pickupLatLng && (
          <Marker coordinate={pickupLatLng} title="Pickup" anchor={{ x: 0.5, y: 1 }}>
            <PlacePin color={COLORS.success} icon="📦" />
          </Marker>
        )}
        {deliveryLatLng && (
          <Marker coordinate={deliveryLatLng} title="Delivery" anchor={{ x: 0.5, y: 1 }}>
            <PlacePin color={COLORS.primary} icon="🏁" />
          </Marker>
        )}
        {hasRider && riderAnim.current && (
          <MarkerAnimated coordinate={riderAnim.current as any} anchor={{ x: 0.5, y: 0.5 }} title="Rider">
            <LiveRiderMarker />
          </MarkerAnimated>
        )}

        {/* Aas-paas ke online riders (5km) — sirf jab tak rider dhoondh rahe hain */}
        {searching && nearbyRiders.map((r, i) => (
          <Marker
            key={`nr-${i}`}
            coordinate={{ latitude: r.lat, longitude: r.lng }}
            anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.nearbyRider}><Text style={{ fontSize: 13 }}>🏍️</Text></View>
          </Marker>
        ))}
      </MapView>

      {/* Live ETA / distance chip — rider kitni door hai */}
      {riderPos && order && !['delivered', 'cancelled'].includes(order.status) && (routeDistance !== null || routeDuration !== null) && (
        <View style={styles.etaBanner}>
          <Text style={styles.etaIcon}>🏍️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.etaTitle}>
              {order.status === 'picked_up' ? 'Parcel aa raha hai' : 'Rider aa raha hai'}
            </Text>
            <Text style={styles.etaSub}>
              {routeDuration !== null ? formatDuration(routeDuration) : ''}
              {routeDuration !== null && routeDistance !== null ? ' · ' : ''}
              {routeDistance !== null ? `${routeDistance.toFixed(1)} km door` : ''}
            </Text>
          </View>
        </View>
      )}

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.85}>
        <Text style={styles.backBtnText}>‹</Text>
      </TouchableOpacity>

      {/* Recenter map on the live route */}
      <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.85}>
        <Text style={styles.recenterIcon}>🎯</Text>
      </TouchableOpacity>

      {/* Bottom Sheet — rider search ke waqt 70% screen (map ~30%), baad me compact */}
      <SafeAreaView edges={['bottom']} style={[styles.bottomSheet, tallSheet && styles.bottomSheetTall]}>
        {order ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.orderId}># {order.orderId}</Text>
                <Text style={styles.fare}>{formatCurrency(order.fare.estimated)}</Text>
              </View>
              <StatusBadge status={order.status} />
            </View>

            {/* Live delivery progress stepper */}
            {!cancelled && (
              <View style={styles.stepper}>
                {['Placed', 'Accepted', 'Picked', 'Delivered'].map((label, i) => (
                  <React.Fragment key={label}>
                    <View style={styles.stepItem}>
                      <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]}>
                        {i < stepIndex
                          ? <Text style={styles.stepCheck}>✓</Text>
                          : <View style={[styles.stepInner, i === stepIndex && styles.stepInnerActive]} />}
                      </View>
                      <Text style={[styles.stepLabel, i <= stepIndex && styles.stepLabelActive]}>{label}</Text>
                    </View>
                    {i < 3 && <View style={[styles.stepLine, i < stepIndex && styles.stepLineActive]} />}
                  </React.Fragment>
                ))}
              </View>
            )}

            {/* Rider dhoondhne ka progress bar (ease-out animation) */}
            {searching && (
              <View style={styles.searchCard}>
                <Text style={styles.searchTitle}>🔍 Rider dhoondh rahe hain…</Text>
                <Text style={styles.searchSub}>
                  {nearbyRiders.length > 0
                    ? `${nearbyRiders.length} rider aas-paas hain (5 km ke andar)`
                    : 'Aas-paas ke riders ko request bheji ja rahi hai'}
                </Text>
                <SearchWaveBar progress={searchProgress} />

                {/* Tier line: har 1:30 me daayra badhta hai — 1km green, 3km yellow, 5km red */}
                <View style={styles.tierRow}>
                  {SEARCH_TIERS.map((t, i) => {
                    const pct = i < tierIdx ? 1
                      : i > tierIdx ? 0
                      : Math.min(1, (searchElapsed - i * TIER_MS) / TIER_MS);
                    return (
                      <View key={t.km} style={styles.tierSeg}>
                        <View style={styles.tierTrack}>
                          <View style={[styles.tierFill, { width: `${pct * 100}%`, backgroundColor: t.color }]} />
                        </View>
                        <Text style={[styles.tierLabel, i === tierIdx && { color: t.color }]}>{t.km} km</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.tierHint, { color: SEARCH_TIERS[tierIdx].color }]}>
                  Abhi {SEARCH_TIERS[tierIdx].km} km ke daayre me rider dhoondh rahe hain
                </Text>
              </View>
            )}

            {/* 4:30 me koi rider na mila */}
            {noRider && (
              <View style={styles.noRiderCard}>
                <Text style={styles.noRiderIcon}>😕</Text>
                <Text style={styles.noRiderTitle}>Abhi koi rider nahi mil paya</Text>
                <Text style={styles.noRiderSub}>
                  Aas-paas ke sabhi riders abhi busy lag rahe hain. "Order Again" dabayein —
                  hum dobara riders dhoondhna shuru kar denge. Aapka order safe hai.
                </Text>
                <Button
                  title="Order Again"
                  onPress={handleOrderAgain}
                  loading={retrying}
                  style={{ marginTop: 12 }}
                />
              </View>
            )}

            {/* Assigned rider info + call */}
            {rider && !['delivered', 'cancelled'].includes(order.status) && (
              <View style={styles.riderCard}>
                <View style={styles.riderAvatar}>
                  <Text style={styles.riderAvatarText}>
                    {rider.name ? rider.name.charAt(0).toUpperCase() : '🏍'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.riderName} numberOfLines={1}>{rider.name || 'Your Rider'}</Text>
                  <Text style={styles.riderMeta} numberOfLines={1}>
                    {rider.vehicleType || 'Bike'}
                    {rider.vehicleNumber ? ` · ${rider.vehicleNumber}` : ''}
                    {typeof rider.rating === 'number' ? `  ⭐ ${rider.rating.toFixed(1)}` : ''}
                  </Text>
                </View>
                {rider.phone ? (
                  <TouchableOpacity
                    style={styles.callBtn}
                    onPress={() => Linking.openURL(`tel:${rider.phone}`)}
                    activeOpacity={0.85}>
                    <Text style={styles.callBtnIcon}>📞</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            <View style={styles.routeCard}>
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {truncateAddress(order.pickup.address)}
                </Text>
              </View>
              <View style={styles.routeConnector} />
              <View style={styles.routeRow}>
                <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
                <Text style={styles.routeText} numberOfLines={1}>
                  {truncateAddress(order.delivery.address)}
                </Text>
                {canEditDelivery && (
                  <TouchableOpacity
                    style={styles.editAddrBtn}
                    onPress={() => setEditingAddress(true)}
                    activeOpacity={0.8}>
                    <Text style={styles.editAddrIcon}>✏️</Text>
                    <Text style={styles.editAddrText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {order.status === 'accepted' && order.pickupOtp && (
              <View style={styles.otpCard}>
                <Text style={styles.otpCardLabel}>🔑 Pickup OTP — Rider ko batao</Text>
                <Text style={styles.otpValue}>{order.pickupOtp}</Text>
                <Text style={styles.otpHintText}>Rider pickup location pe pohonchne par yeh OTP maangega</Text>
              </View>
            )}
            {order.status === 'picked_up' && order.deliveryOtp && (
              <View style={[styles.otpCard, { backgroundColor: COLORS.secondaryBg, borderLeftColor: COLORS.secondary }]}>
                <Text style={[styles.otpCardLabel, { color: COLORS.secondary }]}>🔑 Delivery OTP — Rider ko batao</Text>
                <Text style={[styles.otpValue, { color: COLORS.secondary }]}>{order.deliveryOtp}</Text>
                <Text style={[styles.otpHintText, { color: COLORS.secondary + 'AA' }]}>Rider delivery location pe pohonchne par yeh OTP maangega</Text>
              </View>
            )}

            {order.status === 'delivered' && (
              <View style={styles.deliveredBanner}>
                <Text style={styles.deliveredIcon}>✅</Text>
                <Text style={styles.deliveredTitle}>Parcel Delivered!</Text>
                <Text style={styles.deliveredSub}>Your parcel was delivered successfully</Text>
              </View>
            )}

            {/* Delivery ke baad rider ki rating — ek baar; submit ke baad thanks card */}
            {order.status === 'delivered' && (
              order.rating ? (
                <View style={styles.ratingCard}>
                  <Text style={styles.ratingTitle}>Aapki Rating</Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <Text
                        key={i}
                        style={[styles.star, i <= (order.rating || 0) ? styles.starOn : styles.starOff]}>
                        ★
                      </Text>
                    ))}
                  </View>
                  <Text style={styles.ratingThanks}>
                    Shukriya! Aapka feedback rider tak pahunch gaya 🙏
                  </Text>
                </View>
              ) : (
                <View style={styles.ratingCard}>
                  <Text style={styles.ratingTitle}>
                    {rider?.name ? `${rider.name} ki service kaisi rahi?` : 'Rider ki service kaisi rahi?'}
                  </Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map(i => (
                      <TouchableOpacity key={i} onPress={() => setPendingStars(i)} activeOpacity={0.7}>
                        <Text style={[styles.star, i <= pendingStars ? styles.starOn : styles.starOff]}>
                          ★
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {pendingStars > 0 && (
                    <Text style={styles.ratingHint}>
                      {['', 'Bahut kharab 😞', 'Kharab 😕', 'Theek-thaak 🙂', 'Achha 😊', 'Shaandar! 🤩'][pendingStars]}
                    </Text>
                  )}
                  <Button
                    title="Rating Submit Karo"
                    icon="⭐"
                    onPress={handleRate}
                    loading={ratingSubmitting}
                    disabled={pendingStars === 0}
                    style={{ marginTop: 10 }}
                  />
                </View>
              )
            )}

            {['pending', 'accepted'].includes(order.status) && (
              <Button
                title="Cancel Order"
                onPress={handleCancel}
                variant="danger"
                loading={loading}
                style={{ marginTop: 8 }}
              />
            )}
          </ScrollView>
        ) : (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>Loading order details…</Text>
          </View>
        )}
      </SafeAreaView>

      {/* Delivery address edit overlay — deliver hone tak customer kabhi bhi
          naya address chun sakta hai (search / typed / GPS → pin-confirm). */}
      {editingAddress && order && (
        <View style={styles.editOverlay}>
          <SafeAreaView edges={['top']} style={{ flex: 1 }}>
            <View style={styles.editHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.editTitle}>Delivery Address Badlo</Text>
                <Text style={styles.editSub}>
                  Naya address pin karo — fare nayi doori ke hisaab se adjust hoga
                </Text>
              </View>
              <TouchableOpacity
                style={styles.editClose}
                onPress={() => setEditingAddress(false)}
                activeOpacity={0.7}>
                <Text style={styles.editCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.editBody}>
              <AddressSearchInput
                label="Naya Delivery Address"
                placeholder="Search new delivery address"
                leftIcon="🏁"
                biasCoords={order.delivery.coordinates}
                onSelect={handleDeliveryEdited}
              />
              {savingAddress && (
                <Text style={styles.editSaving}>Naya address save ho raha hai…</Text>
              )}
              <View style={styles.editNote}>
                <Text style={styles.editNoteText}>
                  💡 Doori badhegi to fare badhega, kam hogi to fare bhi kam ho
                  jayega. Rider ko naya address turant mil jayega.
                </Text>
              </View>
            </View>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  map:         { flex: 1 },

  // Live rider marker + pulsing ping ring
  riderMarkerWrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  riderPulse: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
  },
  riderMarker: {
    backgroundColor: '#fff', borderRadius: 22, padding: 7,
    borderWidth: 2.5, borderColor: COLORS.primary,
    elevation: 6, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35, shadowRadius: 5,
  },

  // Branded pickup/delivery pins
  placePinWrap: { alignItems: 'center' },
  placePin: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#fff',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4,
  },
  placePinIcon: { fontSize: 16 },
  placePinTail: {
    width: 0, height: 0, marginTop: -2,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
  },

  nearbyRider: {
    backgroundColor: '#fff', borderRadius: 16, padding: 4,
    borderWidth: 1.5, borderColor: COLORS.success,
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18, shadowRadius: 3, opacity: 0.95,
  },

  // Rider search progress
  searchCard: {
    backgroundColor: COLORS.primaryBg, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.primary + '22',
  },
  searchTitle: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  searchSub:   { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 10 },
  searchBarTrack: {
    height: 8, borderRadius: 4, backgroundColor: COLORS.primary + '22', overflow: 'hidden',
  },
  // Asli progress — halki tint, taaki upar behti solid snake alag dikhe
  searchBarFill: { height: 8, borderRadius: 4, backgroundColor: COLORS.primary + '55' },
  searchWave: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    borderRadius: 4, backgroundColor: COLORS.primary,
  },

  // Tier line — 1km/3km/5km segments, har segment 1:30 ka (green/yellow/red)
  tierRow:   { flexDirection: 'row', gap: 6, marginTop: 12 },
  tierSeg:   { flex: 1 },
  tierTrack: { height: 4, borderRadius: 2, backgroundColor: COLORS.border, overflow: 'hidden' },
  tierFill:  { height: 4, borderRadius: 2 },
  tierLabel: {
    fontSize: 10.5, fontWeight: '700', color: COLORS.textLight,
    marginTop: 4, textAlign: 'center',
  },
  tierHint:  { fontSize: 11.5, fontWeight: '700', marginTop: 8 },

  // No rider state
  noRiderCard: {
    backgroundColor: COLORS.surface2, borderRadius: 14, padding: 18, marginBottom: 12,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  noRiderIcon:  { fontSize: 30, marginBottom: 6 },
  noRiderTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  noRiderSub:   { fontSize: 12, fontWeight: '500', color: COLORS.textMuted, textAlign: 'center', lineHeight: 17 },

  // Delivery progress stepper
  stepper: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4,
  },
  stepItem:  { alignItems: 'center', width: 56 },
  stepDot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.surface2, borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  stepInner:     { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  stepInnerActive: { backgroundColor: '#fff' },
  stepCheck:     { color: '#fff', fontSize: 13, fontWeight: '900' },
  stepLabel:     { fontSize: 10, fontWeight: '600', color: COLORS.textMuted, marginTop: 4 },
  stepLabelActive: { color: COLORS.primary, fontWeight: '800' },
  stepLine:      { flex: 1, height: 2, backgroundColor: COLORS.border, marginTop: -16, marginHorizontal: -6 },
  stepLineActive: { backgroundColor: COLORS.primary },

  // Assigned rider card
  riderCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface2, borderRadius: 14, padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: COLORS.border,
  },
  riderAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  riderAvatarText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  riderName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  riderMeta: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.successBg,
    borderWidth: 1, borderColor: COLORS.success + '55',
    alignItems: 'center', justifyContent: 'center',
  },
  callBtnIcon: { fontSize: 20 },

  etaBanner: {
    position: 'absolute', top: 56, left: 68, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 10, elevation: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  etaIcon:  { fontSize: 22 },
  etaTitle: { fontSize: 14, fontWeight: '800', color: COLORS.text },
  etaSub:   { fontSize: 12, fontWeight: '600', color: COLORS.primary, marginTop: 1 },

  backBtn: {
    position: 'absolute', top: 56, left: 16,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  backBtnText: { fontSize: 28, fontWeight: '300', color: COLORS.text, lineHeight: 30 },

  recenterBtn: {
    position: 'absolute', top: 120, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  recenterIcon: { fontSize: 19 },

  bottomSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    maxHeight: 380,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  // Rider search ke waqt: order info 70%, map ~30% — search khatam hote hi normal.
  bottomSheetTall: { height: '70%', maxHeight: '70%' },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderId: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 4 },
  fare:    { fontSize: 24, fontWeight: '900', color: COLORS.primary },

  routeCard: {
    backgroundColor: COLORS.surface2, borderRadius: 12, padding: 14, marginBottom: 12,
  },
  routeRow:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot:       { width: 8, height: 8, borderRadius: 4 },
  routeConnector: { width: 1, height: 14, backgroundColor: COLORS.border, marginLeft: 3.5, marginVertical: 4 },
  routeText:      { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },

  otpCard: {
    backgroundColor: COLORS.warningBg, borderRadius: 12, padding: 16,
    marginBottom: 10, borderLeftWidth: 4, borderLeftColor: COLORS.warning,
    alignItems: 'center',
  },
  otpCardLabel: { fontSize: 11, color: COLORS.warning, fontWeight: '700', marginBottom: 8, letterSpacing: 0.3 },
  otpValue:     { fontSize: 40, fontWeight: '900', color: COLORS.text, letterSpacing: 12, marginBottom: 6 },
  otpHintText:  { fontSize: 11, color: COLORS.warning + 'BB', textAlign: 'center', lineHeight: 16 },

  deliveredBanner: {
    backgroundColor: COLORS.successBg, borderRadius: 14, padding: 20,
    alignItems: 'center', marginBottom: 10,
  },

  // Delivery ke baad rating card
  ratingCard: {
    backgroundColor: COLORS.surface2, borderRadius: 14, padding: 16, marginBottom: 12,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  ratingTitle:  { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 10, textAlign: 'center' },
  starRow:      { flexDirection: 'row', gap: 10, marginBottom: 6 },
  star:         { fontSize: 36, lineHeight: 40 },
  starOn:       { color: '#F5A623' },
  starOff:      { color: COLORS.border },
  ratingHint:   { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, marginTop: 2 },
  ratingThanks: { fontSize: 12.5, fontWeight: '600', color: COLORS.success, marginTop: 4, textAlign: 'center' },
  deliveredIcon:  { fontSize: 32, marginBottom: 8 },
  deliveredTitle: { fontSize: 17, fontWeight: '800', color: COLORS.success, marginBottom: 4 },
  deliveredSub:   { fontSize: 13, color: COLORS.success + 'AA' },

  loadingWrap: { padding: 24, alignItems: 'center' },
  loadingText: { fontSize: 14, color: COLORS.textMuted },

  // Delivery address edit
  editAddrBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    backgroundColor: COLORS.primaryBg,
    borderWidth: 1, borderColor: COLORS.primary + '44',
  },
  editAddrIcon: { fontSize: 11 },
  editAddrText: { fontSize: 11.5, fontWeight: '800', color: COLORS.primary },

  editOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.background,
    zIndex: 50, elevation: 20,
  },
  editHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  editTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  editSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  editClose: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface2,
    borderWidth: 1, borderColor: COLORS.border,
  },
  editCloseText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  editBody:   { padding: 16 },
  editSaving: { fontSize: 12.5, fontWeight: '600', color: COLORS.textMuted, marginTop: 8 },
  editNote: {
    backgroundColor: COLORS.warningBg, borderRadius: 12, padding: 12, marginTop: 14,
    borderLeftWidth: 3, borderLeftColor: COLORS.warning,
  },
  editNoteText: { fontSize: 12, color: COLORS.warning, lineHeight: 17 },
});

export default LiveTrackingScreen;
