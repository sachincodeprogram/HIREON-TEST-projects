import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Switch, Alert, ActivityIndicator,
  StatusBar, Modal, Vibration, Animated, Easing, Dimensions, AppState,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import { RiderStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { SPACING, RADIUS, ELEVATION, glow } from '../../constants/theme';
import { fetchRoute } from '../../services/routeService';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import useAppSelector from '../../hooks/useAppSelector';
import { setOnlineStatus } from '../../store/slices/riderSlice';
import { setActiveOrder } from '../../store/slices/orderSlice';
import { getMyOrders, acceptOrder, declineOrder, getOrderById } from '../../services/orderService';
import { connectSocket, getSocket } from '../../services/socketService';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { registerRiderPush, subscribePushTokenRefresh } from '../../services/pushService';
import { cancelOrderRing, RING_WINDOW_MS } from '../../services/orderRingNotification';
import { requestLocationPermission, getCurrentPosition } from '../../services/locationService';
import { getSavedRingtoneId } from '../../services/ringtoneService';
import { getRingtoneById, DEFAULT_RINGTONE_ID } from '../../constants/ringtones';
import apiClient from '../../services/apiClient';
import { Order, Coordinates } from '../../types';
import { formatCurrency, formatDistance, truncateAddress } from '../../utils/formatters';
import Sound from 'react-native-sound';
import { useTranslation, translate } from '../../i18n';

Sound.setCategory('Playback');

// Accept window (RING_WINDOW_MS = ek tier, 1:30 min) orderRingNotification se
// aata hai taaki in-app popup aur lock-screen notification ek saath timeout hon.

const SCREEN_W = Dimensions.get('window').width;
const HEADER_H = 152;

// Premium blue gradient header (rider identity) with soft decorative orbs.
// react-native-svg already linked — no native rebuild needed.
const HeaderBg = () => (
  <Svg width={SCREEN_W} height={HEADER_H} style={StyleSheet.absoluteFill}>
    <Defs>
      <SvgLinearGradient id="rhdr" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0"    stopColor="#16299E" />
        <Stop offset="0.55" stopColor={COLORS.secondary} />
        <Stop offset="1"    stopColor="#2747C9" />
      </SvgLinearGradient>
    </Defs>
    <Rect width={SCREEN_W} height={HEADER_H} fill="url(#rhdr)" />
    <Circle cx={SCREEN_W - 28} cy={22} r={110} fill="rgba(255,255,255,0.08)" />
    <Circle cx={SCREEN_W - 64} cy={130} r={56} fill="rgba(255,255,255,0.05)" />
    <Circle cx={18} cy={HEADER_H - 6} r={70} fill="rgba(0,0,0,0.08)" />
  </Svg>
);

const RiderDashboard = () => {
  const dispatch   = useAppDispatch();
  const { t }      = useTranslation();
  const profile    = useAppSelector(s => s.auth.profile);
  const isOnline   = useAppSelector(s => s.rider.isOnline);
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const insets      = useSafeAreaInsets();
  // CustomerDashboard me jo edge-to-edge inset-race fix kiya tha (insets.top
  // kabhi-kabhi 0 aata hai, header status bar ke peeche chala jaata hai),
  // wahi floor yahan bhi — same header pattern hai.
  const headerTopPad = Math.max(insets.top, 28);
  const goProfile     = () => navigation.navigate('RiderTabs', { screen: 'Profile' } as any);

  const [togglingOnline, setTogglingOnline] = useState(false);
  const [refreshing,     setRefreshing]     = useState(false);
  const [accepting,      setAccepting]      = useState<string | null>(null);
  const [riderPos,       setRiderPos]       = useState<Coordinates | null>(null);
  // Rider ka chalu order (accepted/picked_up/in_transit) — home par pending list ki jagah yahi dikhta hai.
  const [currentOrder,   setCurrentOrder]   = useState<Order | null>(null);
  // Aaj ki snapshot (kamai/deliveries/rating) home par.
  const [today,          setToday]          = useState<{ amount: number; count: number } | null>(null);
  const [rating,         setRating]         = useState<number>(5);

  // New order ring modal
  const [ringOrder,      setRingOrder]      = useState<Order | null>(null);
  const [routeDistance,  setRouteDistance]  = useState<number | null>(null);
  const [routeDuration,  setRouteDuration]  = useState<number | null>(null);
  // OSRM route polylines for the ring-modal mini map (Directions API is disabled)
  const [ringRiderRoute,  setRingRiderRoute]  = useState<{ latitude: number; longitude: number }[]>([]);
  const [ringParcelRoute, setRingParcelRoute] = useState<{ latitude: number; longitude: number }[]>([]);

  const ringAnim       = useRef(new Animated.Value(1)).current;
  const ringProgress   = useRef(new Animated.Value(0)).current;
  const locationWatchId = useRef<number | null>(null);
  const ringSound       = useRef<Sound | null>(null);
  const ringLoaded      = useRef(false);
  const ringFile        = useRef<string>(getRingtoneById(DEFAULT_RINGTONE_ID).file);
  const ringId          = useRef<string | null>(null);

  // (Re)load a ringtone file into the preloaded player, releasing the previous one.
  const loadRingtone = useCallback((file: string) => {
    ringSound.current?.stop();
    ringSound.current?.release();
    ringSound.current  = null;
    ringLoaded.current = false;
    ringFile.current   = file;
    const s = new Sound(file, Sound.MAIN_BUNDLE, err => {
      if (err) {
        console.warn('[RING] sound load failed:', JSON.stringify(err));
        return;
      }
      s.setNumberOfLoops(-1); // loop until rider accepts/declines
      s.setVolume(1.0);
      ringLoaded.current = true;
      ringSound.current  = s;
    });
  }, []);

  // Pick up the rider's chosen ringtone — re-checks on focus so a change made
  // in the profile screen takes effect when they return to the dashboard.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSavedRingtoneId().then(id => {
        if (!active) return;
        if (ringId.current === id && ringSound.current) return; // already loaded
        ringId.current = id;
        loadRingtone(getRingtoneById(id).file);
      });
      return () => { active = false; };
    }, [loadRingtone]),
  );

  // Release the player when the dashboard unmounts for good.
  useEffect(() => () => {
    ringSound.current?.stop();
    ringSound.current?.release();
    ringSound.current = null;
    ringLoaded.current = false;
  }, []);

  const playRing = () => {
    const s = ringSound.current;
    if (s && ringLoaded.current) {
      s.stop(() => s.play(ok => { if (!ok) console.warn('[RING] playback failed'); }));
      return;
    }
    // Fallback: preloaded instance not ready — load a fresh one and play on load
    console.warn('[RING] preloaded sound not ready, loading on demand');
    const fresh = new Sound(ringFile.current, Sound.MAIN_BUNDLE, err => {
      if (err) { console.warn('[RING] on-demand load failed:', JSON.stringify(err)); return; }
      fresh.setNumberOfLoops(-1);
      fresh.setVolume(1.0);
      ringSound.current  = fresh;
      ringLoaded.current = true;
      fresh.play(ok => { if (!ok) console.warn('[RING] on-demand playback failed'); });
    });
  };
  const stopRing = () => { ringSound.current?.stop(); };

  // Naya order aane par ek hi jagah se ring karao — socket se aaye ya FCM
  // notification-tap se, dono raste yahi use karte hain.
  const ringForOrder = useCallback((order: Order) => {
    Vibration.vibrate([300, 200, 300, 200, 500]);
    // Agar tray me isi order ki notifee ring pehle se baj rahi hai to use HI
    // ringer rehne do, in-app sound mat chhedo — full-screen relaunch ke baad
    // navigator settle hote waqt dashboard remount hota hai, aur notification
    // hi wo cheez hai jo remounts ke paar bajti rehti hai (yahan cancel kar
    // dete to dusra mount ring dobara khol hi nahi pata). Cancel sirf
    // accept/decline/timeout/close par hota hai.
    notifee.getDisplayedNotifications()
      .then(list => { if (!list.some(n => n.id === order._id)) playRing(); })
      .catch(() => playRing());
    setRingOrder(order);
    setRouteDistance(null);
    setRouteDuration(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pulse animation for ring modal
  useEffect(() => {
    if (!ringOrder) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [ringOrder]);

  // Accept window progress bar (ease-out: shuru fast, end slow). Bharne par popup khud band.
  useEffect(() => {
    if (!ringOrder) return;
    ringProgress.setValue(0);
    const anim = Animated.timing(ringProgress, {
      toValue: 1,
      duration: RING_WINDOW_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) { stopRing(); cancelOrderRing(ringOrder._id); setRingOrder(null); }
    });
    return () => anim.stop();
  }, [ringOrder?._id]);

  // Fetch road routes for the ring-modal mini map via OSRM (Google Directions is
  // disabled on the key — see reference-google-maps-apis). Draws rider→pickup
  // (green) + pickup→delivery (red) as Polylines, with straight-line fallback,
  // and derives the distance/ETA chips from the rider→pickup leg.
  useEffect(() => {
    if (!ringOrder) { setRingRiderRoute([]); setRingParcelRoute([]); return; }
    const pickup   = ringOrder.pickup.coordinates;
    const delivery = ringOrder.delivery.coordinates;
    const straight = (a: Coordinates, b: Coordinates) => [
      { latitude: a.lat, longitude: a.lng },
      { latitude: b.lat, longitude: b.lng },
    ];
    let cancelled = false;
    (async () => {
      if (pickup && delivery) {
        const r = await fetchRoute(pickup, delivery);
        if (!cancelled) setRingParcelRoute(r?.coords?.length ? r.coords : straight(pickup, delivery));
      }
      if (riderPos && pickup) {
        const r = await fetchRoute(riderPos, pickup);
        if (!cancelled) {
          setRingRiderRoute(r?.coords?.length ? r.coords : straight(riderPos, pickup));
          if (r) { setRouteDistance(r.distance / 1000); setRouteDuration(r.duration / 60); }
        }
      }
    })();
    return () => { cancelled = true; };
  }, [ringOrder?._id, riderPos]);

  // App restart/reload ke baad redux `isOnline` false se shuru hota hai jabki
  // backend me rider online hi hota hai — sync karo, warna GPS watch shuru
  // nahi hota (location stale ho jaati hai) aur socket ring bhi ignore hoti hai.
  useEffect(() => {
    if (profile?.isOnline && !isOnline) dispatch(setOnlineStatus(true));
  }, [profile?.isOnline]);

  // Start GPS when online
  useEffect(() => {
    if (!isOnline) {
      if (locationWatchId.current !== null) {
        Geolocation.clearWatch(locationWatchId.current);
        locationWatchId.current = null;
      }
      return;
    }
    requestLocationPermission().then(status => {
      if (status !== 'granted') {
        // Bina location ke bhi order milenge (backend fallback), par rider ko
        // batao — warna use pata hi nahi chalta ki GPS share nahi ho raha.
        Alert.alert(
          translate('rdash.locNeeded'),
          translate('rdash.locNeededMsg'),
        );
        return;
      }
      // Turant ek fix backend ko bhejo taaki order aane se pehle hi server ko
      // pata ho rider kahan hai (radius dispatch isi pe depend karta hai).
      getCurrentPosition()
        .then(c => {
          setRiderPos(c);
          apiClient.post('/rider/location', { lat: c.lat, lng: c.lng, heading: 0 }).catch(() => {});
        })
        .catch(() => {});
      locationWatchId.current = Geolocation.watchPosition(
        pos => {
          const { latitude: lat, longitude: lng, heading } = pos.coords;
          setRiderPos({ lat, lng });
          // Live location server ko bhejo — dispatch + tracking dono iske liye.
          apiClient.post('/rider/location', { lat, lng, heading: heading || 0 }).catch(() => {});
        },
        () => {},
        { enableHighAccuracy: true, distanceFilter: 30, interval: 6000, fastestInterval: 4000 },
      );
    });
    return () => {
      if (locationWatchId.current !== null) {
        Geolocation.clearWatch(locationWatchId.current);
        locationWatchId.current = null;
      }
    };
  }, [isOnline]);

  const loadCurrent = useCallback(async () => {
    setRefreshing(true);
    try {
      const orders = await getMyOrders();
      const active = orders.find(o => ['accepted', 'picked_up', 'in_transit'].includes(o.status)) || null;
      setCurrentOrder(active);
    } catch { /* silent */ }
    // Aaj ki kamai/deliveries/rating snapshot bhi le aao.
    try {
      const { data } = await apiClient.get('/rider/earnings');
      // Backend envelope { success, message, data } hai — pehle `data?.today`
      // padha ja raha tha jo hamesha undefined tha, isliye "Aaj ki kamai"
      // card delivery ke baad bhi kabhi update nahi hota tha.
      const earnings = data?.data;
      setToday(earnings?.today || null);
      if (typeof earnings?.rating === 'number') setRating(earnings.rating);
    } catch { /* silent */ }
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    let mounted = true;
    connectSocket().then(socket => {
      socket.on('new_order_request', (order: Order) => {
        if (!mounted || !isOnline) return;
        // Naya order — sirf real-time ring popup (koi persistent pending list nahi).
        ringForOrder(order);
      });
    });
    return () => {
      mounted = false;
      getSocket()?.off('new_order_request');
    };
  }, [isOnline, ringForOrder]);

  // FCM push: screen lock/off ya app background/band hone par bhi order RING
  // kare. Backend data-only push bhejta hai; background me index.js ka handler
  // notifee se call-jaisi full-screen ring notification dikhata hai. Wahan se
  // app khulne par (full-screen launch ya tap) yahan order fetch karke in-app
  // ring modal kholo (agar tab tak kisi aur ne accept na kiya ho).
  useEffect(() => {
    registerRiderPush();
    const unsubToken = subscribePushTokenRefresh();

    // Cold-start par getInitialNotification aur PRESS event dono aa sakte
    // hain — ek hi order ke liye modal do baar mat kholo.
    let lastHandled = '';
    // autoAccept: lock-screen notification ka "✅ Accept" button — call answer
    // jaisa, order seedha accept karke ActiveDelivery par le jao (modal skip).
    const openFromPush = async (data?: { [key: string]: any }, autoAccept = false) => {
      if (data?.type !== 'new_order_request') return;
      const orderId = data?.orderId;
      if (!orderId || typeof orderId !== 'string' || orderId === lastHandled) return;
      lastHandled = orderId;
      try {
        const order = await getOrderById(orderId);
        if (order.status === 'pending' && !order.rider) {
          if (autoAccept) handleAccept(order);
          else ringForOrder(order);
        } else {
          cancelOrderRing(orderId);
          Alert.alert(translate('rdash.orderGone'), translate('rdash.orderGoneMsg'));
        }
      } catch { /* order fetch fail — chup raho */ }
    };

    // App band thi — full-screen launch (screen off) ya notification/Accept tap
    // se khuli. YAHAN kabhi auto-accept mat karna: full-screen launch par
    // notifee ka initial pressAction galat 'accept' report kar sakta hai
    // (PendingIntent extras collision — device test me bina tap ke order accept
    // ho gaya tha). Cold start par hamesha ring modal kholo; rider wahan
    // Accept dabata hai. Asli button-tap ACTION_PRESS event se hi aata hai.
    notifee.getInitialNotification().then(init => {
      if (init) openFromPush(init.notification.data);
    });
    // App background me thi — notifee press/action se wapas aayi
    const unsubNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) openFromPush(detail.notification?.data);
      if (type === EventType.ACTION_PRESS) {
        const actionId = detail.pressAction?.id;
        if (actionId === 'accept') {
          openFromPush(detail.notification?.data, true);
        } else if (actionId === 'decline') {
          // Call decline jaisa — ring band, modal (agar khula ho) bhi band,
          // aur backend ko decline batao (tier jaldi aage badhe).
          const orderId = detail.notification?.data?.orderId;
          if (typeof orderId === 'string') {
            cancelOrderRing(orderId);
            declineOrder(orderId).catch(() => {});
          }
          stopRing();
          setRingOrder(null);
        }
      }
    });
    // App khuli hai par socket toota hua hai (rare) — data-only push foreground
    // me yahan aata hai; socket connected ho to wahi ring karayega, double mat karo.
    const unsubMsg = messaging().onMessage(async m => {
      if (getSocket()?.connected) return;
      openFromPush(m.data);
    });

    // App process zinda thi aur full-screen intent ne use samne la diya (screen
    // off wala case) — tab na getInitialNotification milta hai na PRESS event.
    // Isliye: active hote hi dekho koi ring notification tray me baj rahi hai
    // kya — hai to usi se modal khol do. Mount par bhi ek baar (warm relaunch).
    const openDisplayedRing = async () => {
      try {
        const displayed = await notifee.getDisplayedNotifications();
        const ring = displayed.find(n => n.notification?.data?.type === 'new_order_request');
        if (ring) openFromPush(ring.notification.data);
      } catch { /* chup raho */ }
    };
    openDisplayedRing();
    const appStateSub = AppState.addEventListener('change', s => {
      if (s === 'active') openDisplayedRing();
    });

    return () => { unsubToken(); unsubNotifee(); unsubMsg(); appStateSub.remove(); };
  }, [ringForOrder]);

  // Chalu order load karo — mount par aur jab dashboard wapas focus me aaye (delivery se laut ke).
  useFocusEffect(useCallback(() => { loadCurrent(); }, [loadCurrent]));

  const toggleOnline = async (value: boolean) => {
    try {
      setTogglingOnline(true);
      await apiClient.put('/rider/status', { isOnline: value });
      dispatch(setOnlineStatus(value));
    } catch (e: any) {
      Alert.alert(translate('common.error'), e.message);
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleAccept = async (order: Order) => {
    stopRing();
    cancelOrderRing(order._id);
    try {
      setAccepting(order._id);
      const accepted = await acceptOrder(order._id);
      dispatch(setActiveOrder(accepted));
      setCurrentOrder(accepted);
      setRingOrder(null);
      navigation.navigate('ActiveDelivery', { orderId: accepted._id });
    } catch (e: any) {
      const message = e.message || translate('rdash.notAvailable');
      // Backend wallet floor se neeche COD accept reject karta hai (order
      // "kisi aur ne le liya" wala generic error nahi) — is case me rider ko
      // seedha Wallet screen par recharge karne ka rasta do.
      if (/wallet recharge/i.test(message)) {
        Alert.alert(translate('rdash.rechargeNeeded'), message, [
          { text: translate('rdash.later'), style: 'cancel' },
          { text: translate('rdash.rechargeNow'), onPress: () => navigation.navigate('Wallet') },
        ]);
      } else {
        // Order kisi aur rider ne le liya / cancel ho gaya — bata do.
        Alert.alert(translate('rdash.orderGone'), message);
      }
      setRingOrder(null);
    } finally {
      setAccepting(null);
    }
  };

  const handleDecline = (orderId: string) => {
    stopRing();
    cancelOrderRing(orderId);
    if (ringOrder?._id === orderId) setRingOrder(null);
    // Backend ko batao — sab notified riders mana kar den to agli tier
    // turant fire ho (fire-and-forget, fail par local decline to ho hi gaya).
    declineOrder(orderId).catch(() => {});
  };

  const firstName = profile?.name?.split(' ')[0] || 'Rider';

  // Home page par dikhne wala chalu-order card (pending list ki jagah).
  const renderCurrentOrder = () => {
    if (!currentOrder) return null;
    const statusLabel = currentOrder.status === 'accepted' ? t('rdash.goPickup')
      : currentOrder.status === 'picked_up' ? t('rdash.goDelivery') : t('rdash.inProgress');
    return (
      <TouchableOpacity
        style={styles.currentCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('ActiveDelivery', { orderId: currentOrder._id })}>
        <View style={styles.currentTop}>
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>{t('rdash.activeDelivery')}</Text>
          </View>
          <Text style={styles.currentStatus}>{statusLabel}</Text>
        </View>
        <Text style={styles.currentOrderId}># {currentOrder.orderId}</Text>
        <View style={styles.routeBlock}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
            <Text style={styles.routeText} numberOfLines={1}>{truncateAddress(currentOrder.pickup.address)}</Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.routeText} numberOfLines={1}>{truncateAddress(currentOrder.delivery.address)}</Text>
          </View>
        </View>
        <View style={styles.currentBottom}>
          <Text style={styles.earningPillText}>+{formatCurrency(currentOrder.riderEarning || 0)}</Text>
          <View style={styles.resumeBtn}>
            <Text style={styles.resumeBtnText}>{t('rdash.resume')}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ringPickupLatLng = ringOrder?.pickup.coordinates
    ? { latitude: ringOrder.pickup.coordinates.lat, longitude: ringOrder.pickup.coordinates.lng }
    : null;
  const ringDeliveryLatLng = ringOrder?.delivery.coordinates
    ? { latitude: ringOrder.delivery.coordinates.lat, longitude: ringOrder.delivery.coordinates.lng }
    : null;
  const riderLatLng = riderPos ? { latitude: riderPos.lat, longitude: riderPos.lng } : null;

  const ringProgressWidth = ringProgress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="transparent" translucent barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadCurrent} colors={[COLORS.secondary]} tintColor={COLORS.secondary} progressViewOffset={60} />}>

        {/* ── Gradient header ── */}
        <View style={styles.header}>
          <HeaderBg />
          <View style={{ paddingTop: headerTopPad }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>{t('rdash.hey', { name: firstName })}</Text>
                <Text style={styles.subGreeting}>{t('rdash.ready')}</Text>
              </View>
              <TouchableOpacity
                style={styles.walletBtn}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('Wallet')}>
                <Text style={styles.walletBtnIcon}>👛</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatar} onPress={goProfile} activeOpacity={0.8}>
                <Text style={styles.avatarText}>{firstName[0].toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Floating online toggle ── */}
        <View style={styles.onlineWrap}>
          <View style={[styles.onlineCard, isOnline ? styles.onlineCardActive : styles.onlineCardInactive]}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? COLORS.online : COLORS.offline }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.onlineLabel}>{isOnline ? t('rdash.youOnline') : t('rdash.youOffline')}</Text>
              <Text style={styles.onlineSub}>{isOnline ? t('rdash.receiving') : t('rdash.goOnline')}</Text>
            </View>
            {togglingOnline
              ? <ActivityIndicator color={COLORS.secondary} size="small" />
              : <Switch value={isOnline} onValueChange={toggleOnline} thumbColor="#fff" trackColor={{ true: COLORS.online, false: COLORS.border }} />
            }
          </View>
        </View>

        {/* ── Aaj ki snapshot ── */}
        {isOnline && (
          <View style={styles.statsRow}>
            {[
              { key: 'today',   icon: '💰', value: formatCurrency(today?.amount || 0), label: t('rdash.todayEarning'), tint: COLORS.success },
              { key: 'count',   icon: '📦', value: String(today?.count || 0),          label: t('rdash.deliveries'),   tint: COLORS.secondary },
              { key: 'rating',  icon: '⭐', value: rating.toFixed(1),                  label: t('rdash.rating'),       tint: COLORS.warning },
            ].map(s => (
              <View key={s.key} style={styles.statBox}>
                <View style={[styles.statIconChip, { backgroundColor: s.tint + '16' }]}>
                  <Text style={styles.statIcon}>{s.icon}</Text>
                </View>
                <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Body ── */}
        <View style={styles.body}>
          {currentOrder ? (
            renderCurrentOrder()
          ) : isOnline ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconChip}><Text style={styles.emptyIcon}>🔍</Text></View>
              <Text style={styles.emptyTitle}>{t('rdash.waiting')}</Text>
              <Text style={styles.emptySub}>{t('rdash.waitingSub')}</Text>
            </View>
          ) : (
            <View style={styles.offlineWrap}>
              <View style={styles.offlineIconBox}><Text style={styles.offlineIcon}>😴</Text></View>
              <Text style={styles.offlineTitle}>{t('rdash.offlineTitle')}</Text>
              <Text style={styles.offlineSub}>{t('rdash.offlineSub')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── New Order Ring Modal ─── */}
      <Modal visible={!!ringOrder} transparent animationType="slide" onRequestClose={() => { if (ringOrder) handleDecline(ringOrder._id); }}>
        <View style={styles.modalOverlay}>
          {/* SafeArea bottom: 3-button nav wale phones par Accept/Decline OS
              nav bar ke neeche dab jaate the — tap hi nahi lagta tha. */}
          <SafeAreaView edges={['bottom']} style={styles.modalSafe}>
          <Animated.View style={[styles.modalCard, { transform: [{ scale: ringAnim }] }]}>

            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalRingIcon}>🔔</Text>
              <Text style={styles.modalTitle}>{t('rdash.newOrder')}</Text>
              <Text style={styles.modalSub}># {ringOrder?.orderId}</Text>
            </View>

            {/* Mini Map */}
            {ringPickupLatLng && ringDeliveryLatLng && (
              <View style={styles.modalMapBox}>
                <MapView
                  style={styles.modalMap}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={{
                    latitude:  (ringPickupLatLng.latitude + ringDeliveryLatLng.latitude) / 2,
                    longitude: (ringPickupLatLng.longitude + ringDeliveryLatLng.longitude) / 2,
                    latitudeDelta:  Math.abs(ringPickupLatLng.latitude  - ringDeliveryLatLng.latitude)  * 2.5 + 0.05,
                    longitudeDelta: Math.abs(ringPickupLatLng.longitude - ringDeliveryLatLng.longitude) * 2.5 + 0.05,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  pitchEnabled={false}
                  rotateEnabled={false}>

                  {/* Rider → Pickup route (green, OSRM) */}
                  {riderLatLng && ringRiderRoute.length > 0 && (
                    <Polyline
                      coordinates={ringRiderRoute}
                      strokeWidth={3}
                      strokeColor={COLORS.success}
                      lineCap="round"
                      lineJoin="round"
                    />
                  )}

                  {/* Pickup → Delivery route (red, OSRM) */}
                  {ringParcelRoute.length > 0 && (
                    <Polyline
                      coordinates={ringParcelRoute}
                      strokeWidth={3}
                      strokeColor={COLORS.primary}
                      lineCap="round"
                      lineJoin="round"
                    />
                  )}

                  {riderLatLng && <Marker coordinate={riderLatLng} title={t('rdash.you')}><View style={styles.riderDot} /></Marker>}
                  <Marker coordinate={ringPickupLatLng} title={t('fare.pickup')} pinColor="green" />
                  <Marker coordinate={ringDeliveryLatLng} title={t('fare.delivery')} pinColor={COLORS.primary} />
                </MapView>

                {/* Route chips on map */}
                <View style={styles.mapChips}>
                  {routeDistance !== null && (
                    <View style={styles.mapChip}>
                      <Text style={styles.mapChipTxt}>{t('rdash.kmAway', { km: routeDistance.toFixed(1) })}</Text>
                    </View>
                  )}
                  {routeDuration !== null && (
                    <View style={[styles.mapChip, { backgroundColor: COLORS.warningBg }]}>
                      <Text style={[styles.mapChipTxt, { color: COLORS.warning }]}>
                        🕐 {t('unit.min', { n: Math.round(routeDuration) })}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Order Details */}
            {ringOrder && (
              <View style={styles.modalDetails}>
                <View style={styles.routeBlock}>
                  <View style={styles.routeRow}>
                    <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
                    <Text style={styles.routeText} numberOfLines={2}>{ringOrder.pickup.address}</Text>
                  </View>
                  <View style={styles.routeConnector} />
                  <View style={styles.routeRow}>
                    <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
                    <Text style={styles.routeText} numberOfLines={2}>{ringOrder.delivery.address}</Text>
                  </View>
                </View>

                <View style={styles.modalMetaRow}>
                  <View style={styles.modalMetaBox}>
                    <Text style={styles.modalMetaLabel}>{t('rdash.earning')}</Text>
                    <Text style={styles.modalMetaValue}>{formatCurrency(ringOrder.riderEarning || 0)}</Text>
                  </View>
                  <View style={styles.modalMetaBox}>
                    <Text style={styles.modalMetaLabel}>{t('rdash.parcelDist')}</Text>
                    <Text style={styles.modalMetaValue}>{formatDistance(ringOrder.fare?.distance || 0)}</Text>
                  </View>
                  <View style={styles.modalMetaBox}>
                    <Text style={styles.modalMetaLabel}>{t('rdash.customer')}</Text>
                    <Text style={styles.modalMetaValue}>{formatCurrency(ringOrder.fare?.estimated || 0)}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Accept window timer bar (ease-out) — bharne par popup khud band */}
            {ringOrder && (
              <View style={styles.ringTimerWrap}>
                <View style={styles.ringTimerTrack}>
                  <Animated.View style={[styles.ringTimerFill, { width: ringProgressWidth }]} />
                </View>
                <Text style={styles.ringTimerText}>{t('rdash.hurry')}</Text>
              </View>
            )}

            {/* Action Buttons */}
            {ringOrder && (
              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={() => handleDecline(ringOrder._id)}
                  activeOpacity={0.8}>
                  <Text style={styles.declineBtnText}>{t('rdash.decline')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={() => handleAccept(ringOrder)}
                  activeOpacity={0.85}>
                  {accepting === ringOrder._id
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.acceptBtnText}>{t('rdash.accept')}</Text>}
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },

  /* Gradient header */
  header: {
    height: HEADER_H,
    paddingHorizontal: SPACING.xl,
    borderBottomLeftRadius: 30, borderBottomRightRadius: 30,
    overflow: 'hidden',
    ...glow(COLORS.secondary, 0.28),
  },
  headerRow:   { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  greeting:    { fontSize: 23, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  subGreeting: { fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 3 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  walletBtn: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
    marginRight: SPACING.sm,
  },
  walletBtnIcon: { fontSize: 20 },

  /* Floating online toggle */
  onlineWrap: { paddingHorizontal: SPACING.lg, marginTop: -38 },
  onlineCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.xl, padding: 16, borderWidth: 2,
    ...ELEVATION.md,
  },
  onlineCardActive:   { backgroundColor: '#F0FDF4', borderColor: COLORS.online },
  onlineCardInactive: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  statusDot:   { width: 10, height: 10, borderRadius: 5 },
  onlineLabel: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  onlineSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  /* Aaj ki snapshot */
  statsRow: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  statBox: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, paddingVertical: SPACING.md, paddingHorizontal: 6,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    ...ELEVATION.xs,
  },
  statIconChip: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 7 },
  statIcon:  { fontSize: 17 },
  statValue: { fontSize: 15.5, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 10.5, fontWeight: '600', color: COLORS.textMuted, marginTop: 3 },

  /* Body */
  body: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },

  // Current (chalu) order card on home
  currentCard: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.xl, padding: 18,
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 4, borderLeftColor: COLORS.secondary,
    ...ELEVATION.card,
  },
  currentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  currentBadge: { backgroundColor: COLORS.secondaryBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  currentBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.secondary },
  currentStatus: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  currentOrderId: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5, marginBottom: 12 },
  currentBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 6, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12,
  },
  resumeBtn: { backgroundColor: COLORS.secondary, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  resumeBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  listHeaderText: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  countPill: { backgroundColor: COLORS.secondary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  requestCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 10,
    borderWidth: 2, borderColor: COLORS.secondary + '40',
    shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  orderId: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },
  earningPill: { backgroundColor: COLORS.successBg, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  earningPillText: { fontSize: 14, fontWeight: '800', color: COLORS.success },

  routeBlock:    { marginBottom: 12 },
  routeRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeConnector:{ width: 1, height: 12, backgroundColor: COLORS.border, marginLeft: 3.5, marginVertical: 3 },
  routeText:     { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },

  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  metaPill: { backgroundColor: COLORS.secondaryBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  metaPillText: { fontSize: 12, fontWeight: '700', color: COLORS.secondary },
  customerFare: { fontSize: 12, color: COLORS.textMuted, marginLeft: 'auto' },

  btnRow: { flexDirection: 'row', gap: 10 },

  emptyWrap:  { alignItems: 'center', paddingTop: 44, paddingHorizontal: 32 },
  emptyIconChip: { width: 84, height: 84, borderRadius: 42, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon:  { fontSize: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  emptySub:   { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },

  offlineWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 44 },
  offlineIconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  offlineIcon:  { fontSize: 48 },
  offlineTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 10 },
  offlineSub:   { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSafe: { backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 16,
  },
  modalHeader: { alignItems: 'center', paddingTop: 20, paddingBottom: 12 },
  modalRingIcon: { fontSize: 36, marginBottom: 6 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  modalSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  modalMapBox: { height: 190, marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', marginBottom: 14, position: 'relative' },
  modalMap: { flex: 1 },
  mapChips: { position: 'absolute', bottom: 8, left: 8, flexDirection: 'row', gap: 6 },
  mapChip: { backgroundColor: COLORS.primaryBg, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: COLORS.primary + '40' },
  mapChipTxt: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  riderDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.secondary, borderWidth: 2, borderColor: '#fff' },

  modalDetails: { paddingHorizontal: 16, marginBottom: 12 },
  modalMetaRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  modalMetaBox: {
    flex: 1, backgroundColor: COLORS.surface2, borderRadius: 12, padding: 12, alignItems: 'center',
  },
  modalMetaLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '600', marginBottom: 4 },
  modalMetaValue: { fontSize: 15, fontWeight: '800', color: COLORS.text },

  ringTimerWrap: { paddingHorizontal: 16, marginBottom: 12 },
  ringTimerTrack: {
    height: 8, borderRadius: 4, backgroundColor: COLORS.primary + '22', overflow: 'hidden',
  },
  ringTimerFill: { height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  ringTimerText: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },

  modalBtnRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16 },
  declineBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14, borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  declineBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textMuted },
  acceptBtn: {
    flex: 2, paddingVertical: 15, borderRadius: 14,
    backgroundColor: COLORS.success,
    alignItems: 'center', justifyContent: 'center',
  },
  acceptBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

export default RiderDashboard;
