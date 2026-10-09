import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants/api';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import useAppSelector   from '../../hooks/useAppSelector';
import { setOrders, setOrderLoading } from '../../store/slices/orderSlice';
import { getMyOrders } from '../../services/orderService';
import StatusBadge  from '../../components/common/StatusBadge';
import ScreenHeader from '../../components/navigation/ScreenHeader';
import { Order } from '../../types';
import { formatCurrency, formatDateTime, truncateAddress } from '../../utils/formatters';
import { useTranslation } from '../../i18n';

const RiderOrderHistoryScreen = () => {
  const dispatch = useAppDispatch();
  const { t }    = useTranslation();
  const orders   = useAppSelector(s => s.order.orders);
  const loading  = useAppSelector(s => s.order.loading);

  const load = useCallback(async () => {
    dispatch(setOrderLoading(true));
    try { dispatch(setOrders(await getMyOrders())); } catch { /* silent */ }
    finally { dispatch(setOrderLoading(false)); }
  }, []);

  useEffect(() => { load(); }, []);

  const totalEarned = orders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.riderEarning || 0), 0);

  const renderItem = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.orderId}># {item.orderId}</Text>
          <Text style={styles.date}>{formatDateTime(item.createdAt)}</Text>
        </View>
        <StatusBadge status={item.status} />
      </View>

      <View style={styles.routeBlock}>
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

      {item.status === 'delivered' && (
        <View style={styles.cardBottom}>
          <Text style={styles.earnedLabel}>{t('profile.earned')}</Text>
          <Text style={styles.earnedValue}>{formatCurrency(item.riderEarning || 0)}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title={t('rhist.title')}
        subtitle={orders.length > 0 ? t('rhist.summary', { n: orders.length, amount: formatCurrency(totalEarned) }) : t('hist.subtitle')}
        variant="primary"
        rightElement={null}
      />

      <FlatList
        data={orders}
        keyExtractor={o => o._id}
        renderItem={renderItem}
        extraData={t}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[COLORS.secondary]} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🚴</Text>
              <Text style={styles.emptyTitle}>{t('rhist.empty')}</Text>
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pageTitle: { fontSize: 22, fontWeight: '900', color: COLORS.text },
  pageCount: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  totalEarnedBadge: {
    backgroundColor: COLORS.successBg, borderRadius: 12, padding: 10, alignItems: 'flex-end',
    borderWidth: 1, borderColor: COLORS.success + '30',
  },
  totalEarnedLabel: { fontSize: 10, color: COLORS.success, fontWeight: '600', marginBottom: 2 },
  totalEarnedValue: { fontSize: 18, fontWeight: '900', color: COLORS.success },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14,
  },
  orderId: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  date:    { fontSize: 11, color: COLORS.textLight, marginTop: 3 },

  routeBlock:  { marginBottom: 0 },
  routeRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot:         { width: 8, height: 8, borderRadius: 4 },
  connector:   { width: 1, height: 12, backgroundColor: COLORS.border, marginLeft: 3.5, marginVertical: 3 },
  routeText:   { flex: 1, fontSize: 13, color: COLORS.text, fontWeight: '500' },

  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  earnedLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  earnedValue: { fontSize: 18, fontWeight: '900', color: COLORS.success },

  emptyState:    { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:     { fontSize: 52, marginBottom: 14 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: COLORS.textMuted },
});

export default RiderOrderHistoryScreen;
