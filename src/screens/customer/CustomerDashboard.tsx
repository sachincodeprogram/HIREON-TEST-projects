import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, StatusBar, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomerStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { SPACING, RADIUS, ELEVATION, glow } from '../../constants/theme';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import useAppSelector   from '../../hooks/useAppSelector';
import { setOrders, setOrderLoading } from '../../store/slices/orderSlice';
import { getMyOrders } from '../../services/orderService';
import Card        from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatCurrency, formatDateTime, truncateAddress } from '../../utils/formatters';

const TRACKABLE = ['accepted', 'picked_up', 'in_transit'];
const SCREEN_W = Dimensions.get('window').width;
const HEADER_H = 216;

// Premium gradient header background (deep maroon → brand red) with soft
// decorative orbs. Uses react-native-svg (already linked) so no native rebuild.
const HeaderBg = () => (
  <Svg width={SCREEN_W} height={HEADER_H} style={StyleSheet.absoluteFill}>
    <Defs>
      <SvgLinearGradient id="hdr" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0"   stopColor="#7A0010" />
        <Stop offset="0.55" stopColor={COLORS.primary} />
        <Stop offset="1"   stopColor="#9B1B1B" />
      </SvgLinearGradient>
    </Defs>
    <Rect width={SCREEN_W} height={HEADER_H} fill="url(#hdr)" />
    <Circle cx={SCREEN_W - 30} cy={26} r={120} fill="rgba(255,255,255,0.07)" />
    <Circle cx={SCREEN_W - 70} cy={140} r={64} fill="rgba(255,255,255,0.05)" />
    <Circle cx={20} cy={HEADER_H - 10} r={80} fill="rgba(0,0,0,0.07)" />
  </Svg>
);

const CustomerDashboard = () => {
  const dispatch   = useAppDispatch();
  const profile    = useAppSelector(s => s.auth.profile);
  const orders     = useAppSelector(s => s.order.orders);
  const loading    = useAppSelector(s => s.order.loading);
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const insets      = useSafeAreaInsets();
  // Edge-to-edge devices kabhi kabhi pehle render pass me insets.top 0 de
  // dete hain (SafeAreaView race) — us case me bell/avatar y=0 par chale
  // jaate the aur taps asli OS status bar intercept kar leta tha (avatar
  // tap-to-Profile "kaam nahi karta" jaisa lagta tha). Floor lagao taaki
  // header hamesha status bar ke neeche hi rahe.
  const headerTopPad = Math.max(insets.top, 28);

  const loadOrders = useCallback(async () => {
    try {
      dispatch(setOrderLoading(true));
      const list = await getMyOrders();
      dispatch(setOrders(list));
    } catch { /* silent */ }
    finally { dispatch(setOrderLoading(false)); }
  }, []);

  // Har baar dashboard focus me aaye to fresh list lao — pehle sirf mount par
  // load hota tha, isliye order place/deliver hone ke baad bhi status badge
  // aur Active count stale ("Pending") dikhte the.
  useFocusEffect(useCallback(() => { loadOrders(); }, [loadOrders]));

  const activeOrders   = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const recentOrders   = orders.slice(0, 5);
  const deliveredCount = orders.filter(o => o.status === 'delivered').length;
  const firstName      = profile?.name?.split(' ')[0] || 'User';
  const trackable      = activeOrders.find(o => TRACKABLE.includes(o.status));

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const goBook    = () => navigation.navigate('CustomerTabs', { screen: 'BookParcel' } as any);
  const goOrders  = () => navigation.navigate('CustomerTabs', { screen: 'History' } as any);
  const goProfile = () => navigation.navigate('CustomerTabs', { screen: 'Profile' } as any);
  const goTrack   = () =>
    trackable
      ? navigation.navigate('LiveTracking', { orderId: trackable._id })
      : goOrders();

  const QUICK = [
    { key: 'track',   icon: '🛰️', label: 'Track',   bg: COLORS.secondaryBg, onPress: goTrack },
    { key: 'orders',  icon: '🧾', label: 'Orders',  bg: COLORS.warningBg,   onPress: goOrders },
    { key: 'profile', icon: '👤', label: 'Profile', bg: COLORS.successBg,   onPress: goProfile },
  ];

  const renderOrderCard = (order: any, isActive: boolean) => (
    <Card
      key={order._id}
      accent={isActive ? COLORS.primary : undefined}
      // Pending (rider-search) aur delivered (rating) bhi LiveTracking me
      // khulte hain — sirf cancelled ke liye kholne ko kuch nahi.
      onPress={order.status !== 'cancelled'
        ? () => navigation.navigate('LiveTracking', { orderId: order._id })
        : undefined}>
      <View style={styles.cardHeader}>
        <Text style={styles.orderId}># {order.orderId}</Text>
        <StatusBadge status={order.status} />
      </View>
      <View style={styles.routeBlock}>
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, { backgroundColor: COLORS.success }]} />
          <Text style={styles.routeText} numberOfLines={1}>{truncateAddress(order.pickup.address)}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeRow}>
          <View style={[styles.routeDot, { backgroundColor: COLORS.primary }]} />
          <Text style={styles.routeText} numberOfLines={1}>{truncateAddress(order.delivery.address)}</Text>
        </View>
      </View>
      <View style={styles.cardFooter}>
        <Text style={styles.fareText}>{formatCurrency(order.fare.estimated)}</Text>
        {isActive && TRACKABLE.includes(order.status) ? (
          <View style={styles.trackChip}><Text style={styles.trackChipText}>Track live →</Text></View>
        ) : (
          <Text style={styles.dateText}>{formatDateTime(order.createdAt)}</Text>
        )}
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="transparent" translucent barStyle="light-content" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: SPACING.xxl }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadOrders} colors={[COLORS.primary]} tintColor={COLORS.primary} progressViewOffset={60} />}>

        {/* ── Gradient header ── */}
        <View style={styles.header}>
          <HeaderBg />
          <View style={{ paddingTop: headerTopPad }}>
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>{getGreeting()},</Text>
                <Text style={styles.name} numberOfLines={1}>{firstName} 👋</Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={goOrders} activeOpacity={0.8}>
                <Text style={styles.iconBtnGlyph}>🔔</Text>
                {activeOrders.length > 0 && <View style={styles.iconBtnDot} />}
              </TouchableOpacity>
              <TouchableOpacity style={styles.avatar} onPress={goProfile} activeOpacity={0.8}>
                <Text style={styles.avatarText}>{firstName[0].toUpperCase()}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.trustRow}>
              <Text style={styles.trustText}>⚡ Same-day delivery</Text>
              <View style={styles.trustDivider} />
              <Text style={styles.trustText}>🔒 Secure & tracked</Text>
            </View>
          </View>
        </View>

        {/* ── Floating stats ── */}
        <View style={styles.statsRow}>
          {[
            { icon: '📦', value: orders.length,      label: 'Total',     tint: COLORS.secondary },
            { icon: '✅', value: deliveredCount,      label: 'Delivered', tint: COLORS.success },
            { icon: '🚚', value: activeOrders.length, label: 'Active',    tint: COLORS.primary },
          ].map(s => (
            <View key={s.label} style={styles.statCard}>
              <View style={[styles.statIconChip, { backgroundColor: s.tint + '16' }]}>
                <Text style={styles.statIcon}>{s.icon}</Text>
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Hero CTA ── */}
        <View style={styles.block}>
          <TouchableOpacity style={styles.bookCta} onPress={goBook} activeOpacity={0.92}>
            <View style={styles.ctaIconBox}><Text style={styles.ctaIcon}>📦</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaLabel}>READY TO SEND?</Text>
              <Text style={styles.ctaTitle}>Book a Parcel</Text>
            </View>
            <View style={styles.ctaArrow}><Text style={styles.ctaArrowGlyph}>→</Text></View>
          </TouchableOpacity>
        </View>

        {/* ── Quick actions ── */}
        <View style={[styles.block, styles.quickRow]}>
          {QUICK.map(a => (
            <TouchableOpacity key={a.key} style={styles.quickTile} onPress={a.onPress} activeOpacity={0.85}>
              <View style={[styles.quickIconChip, { backgroundColor: a.bg }]}>
                <Text style={styles.quickIcon}>{a.icon}</Text>
              </View>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Active orders ── */}
        {activeOrders.length > 0 && (
          <View style={styles.block}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Active Orders</Text>
                <View style={styles.activePill}><Text style={styles.activePillText}>{activeOrders.length}</Text></View>
              </View>
            </View>
            {activeOrders.map(o => renderOrderCard(o, true))}
          </View>
        )}

        {/* ── Recent orders ── */}
        <View style={styles.block}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>
            {recentOrders.length > 0 && (
              <TouchableOpacity onPress={goOrders} activeOpacity={0.7}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {loading && orders.length === 0 ? (
            <ActivityIndicator color={COLORS.primary} style={{ marginTop: 32 }} />
          ) : recentOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconChip}><Text style={styles.emptyIcon}>📭</Text></View>
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptySubtitle}>Book your first parcel and it'll show up here</Text>
              <TouchableOpacity style={styles.emptyCta} onPress={goBook} activeOpacity={0.88}>
                <Text style={styles.emptyCtaText}>Book a Parcel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            recentOrders.map(o => renderOrderCard(o, false))
          )}
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  /* Header */
  header: {
    height: HEADER_H,
    paddingHorizontal: SPACING.xl,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
    ...glow(COLORS.primary, 0.28),
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.82)', fontWeight: '500' },
  name:     { fontSize: 25, fontWeight: '900', color: '#fff', marginTop: 2, letterSpacing: -0.4 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  iconBtnGlyph: { fontSize: 18 },
  iconBtnDot: {
    position: 'absolute', top: 9, right: 10,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#FFD54A', borderWidth: 1.5, borderColor: COLORS.primary,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '900' },

  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  trustText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  trustDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.3)' },

  /* Floating stats */
  statsRow: {
    flexDirection: 'row', gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginTop: -46,
  },
  statCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
    ...ELEVATION.md,
  },
  statIconChip: {
    width: 38, height: 38, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginBottom: 9,
  },
  statIcon:  { fontSize: 19 },
  statValue: { fontSize: 21, fontWeight: '900', color: COLORS.text },
  statLabel: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 1, fontWeight: '600' },

  /* Generic block spacing */
  block: { paddingHorizontal: SPACING.lg, marginTop: SPACING.xl },

  /* Hero CTA */
  bookCta: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.ink,
    borderRadius: RADIUS.xl, padding: SPACING.lg,
    ...glow(COLORS.ink, 0.32),
  },
  ctaIconBox: {
    width: 54, height: 54, borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  ctaIcon:  { fontSize: 27 },
  ctaLabel: { fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginBottom: 3, fontWeight: '800', letterSpacing: 1 },
  ctaTitle: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  ctaArrow: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    ...glow(COLORS.primary, 0.5),
  },
  ctaArrowGlyph: { fontSize: 19, color: '#fff', fontWeight: '900' },

  /* Quick actions */
  quickRow: { flexDirection: 'row', gap: SPACING.md },
  quickTile: {
    flex: 1, alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg, paddingVertical: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
    ...ELEVATION.xs,
  },
  quickIconChip: {
    width: 46, height: 46, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: 9,
  },
  quickIcon:  { fontSize: 21 },
  quickLabel: { fontSize: 12.5, fontWeight: '700', color: COLORS.text },

  /* Sections */
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  sectionTitle:    { fontSize: 17, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  seeAll:          { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  activePill: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center',
  },
  activePillText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  /* Order card internals */
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md,
  },
  orderId: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },
  routeBlock:    { marginBottom: 10 },
  routeRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDot:      { width: 8, height: 8, borderRadius: 4 },
  routeConnector:{ width: 1, height: 12, backgroundColor: COLORS.border, marginLeft: 3.5, marginVertical: 2 },
  routeText:     { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10,
  },
  fareText:  { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  dateText:  { fontSize: 11, color: COLORS.textLight },
  trackChip: { backgroundColor: COLORS.secondaryBg, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  trackChipText: { fontSize: 12, color: COLORS.secondary, fontWeight: '700' },

  /* Empty state */
  emptyState: {
    alignItems: 'center', paddingVertical: 36,
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  emptyIconChip: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.surface2,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  emptyIcon:     { fontSize: 30 },
  emptyTitle:    { fontSize: 16, fontWeight: '800', color: COLORS.text, marginBottom: 5 },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingHorizontal: 24, marginBottom: 18 },
  emptyCta: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill, paddingHorizontal: 24, paddingVertical: 11,
    ...glow(COLORS.primary, 0.22),
  },
  emptyCtaText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

export default CustomerDashboard;
