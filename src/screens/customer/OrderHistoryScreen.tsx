import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomerStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import useAppSelector   from '../../hooks/useAppSelector';
import { setOrders, setOrderLoading } from '../../store/slices/orderSlice';
import { getMyOrders } from '../../services/orderService';
import StatusBadge   from '../../components/common/StatusBadge';
import ScreenHeader  from '../../components/navigation/ScreenHeader';
import { Order } from '../../types';
import { formatCurrency, formatDateTime, formatDistance, truncateAddress } from '../../utils/formatters';
import { useTranslation } from '../../i18n';

const OrderHistoryScreen = () => {
  const dispatch   = useAppDispatch();
  const { t }      = useTranslation();
  const orders     = useAppSelector(s => s.order.orders);
  const loading    = useAppSelector(s => s.order.loading);
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();

  const loadOrders = useCallback(async () => {
    dispatch(setOrderLoading(true));
    try { dispatch(setOrders(await getMyOrders())); } catch { /* silent */ }
    finally { dispatch(setOrderLoading(false)); }
  }, []);

  // Focus par fresh list — tracking/rating se wapas aane par status aur
  // rating turant updated dikhe (pehle sirf mount par load hota tha).
  useFocusEffect(useCallback(() => { loadOrders(); }, [loadOrders]));

  const renderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      // Delivered orders bhi khulte hain — wahan rating card hai (pending
      // me rider-search screen). Sirf cancelled ke liye kholne ko kuch nahi.
      onPress={() =>
        item.status !== 'cancelled'
          ? navigation.navigate('LiveTracking', { orderId: item._id })
          : null
      }
      activeOpacity={0.85}>
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.orderId}># {item.orderId}</Text>
            <Text style={styles.dateText}>{formatDateTime(item.createdAt)}</Text>
          </View>
          <StatusBadge status={item.status} />
        </View>

        <View style={styles.routeWrap}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
            <Text style={styles.routeText} numberOfLines={1}>{truncateAddress(item.pickup.address)}</Text>
          </View>
          <View style={styles.connector} />
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
            <Text style={styles.routeText} numberOfLines={1}>{truncateAddress(item.delivery.address)}</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <Text style={styles.fare}>{formatCurrency(item.fare.estimated)}</Text>
          <Text style={styles.distance}>{formatDistance(item.fare.distance)}</Text>
          {['accepted', 'picked_up', 'in_transit'].includes(item.status) && (
            <Text style={styles.trackBtn}>{t('hist.track')}</Text>
          )}
          {item.status === 'delivered' && (
            item.rating
              ? <Text style={styles.ratedText}>{'★'.repeat(item.rating)} {item.rating}.0</Text>
              : <Text style={styles.trackBtn}>{t('hist.rate')}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={t('hist.title')}
        subtitle={orders.length > 0 ? t('hist.countTotal', { n: orders.length }) : t('hist.subtitle')}
      />
      <FlatList
        data={orders}
        keyExtractor={o => o._id}
        renderItem={renderItem}
        extraData={t}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadOrders} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>{t('cdash.noOrders')}</Text>
              <Text style={styles.emptySubtitle}>{t('hist.emptySub')}</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.background },
  pageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  pageTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  pageCount: { fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  list:      { paddingHorizontal: 16, paddingBottom: 32 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14,
  },
  orderId:  { fontSize: 13, fontWeight: '700', color: COLORS.text },
  dateText: { fontSize: 11, color: COLORS.textLight, marginTop: 3 },

  routeWrap:  { marginBottom: 12 },
  routeRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  connector:  { width: 1, height: 12, backgroundColor: COLORS.border, marginLeft: 3.5, marginVertical: 3 },
  routeText:  { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },

  cardBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10,
  },
  fare:     { fontSize: 16, fontWeight: '800', color: COLORS.primary, flex: 1 },
  distance: { fontSize: 12, color: COLORS.textMuted },
  trackBtn:  { fontSize: 13, fontWeight: '700', color: COLORS.secondary },
  ratedText: { fontSize: 13, fontWeight: '800', color: '#F5A623' },

  emptyState:    { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:     { fontSize: 52, marginBottom: 14 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted },
});

export default OrderHistoryScreen;
