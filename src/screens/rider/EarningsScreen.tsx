import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../constants/api';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import useAppSelector   from '../../hooks/useAppSelector';
import { setEarnings }  from '../../store/slices/riderSlice';
import apiClient        from '../../services/apiClient';
import { formatCurrency } from '../../utils/formatters';
import { useTranslation } from '../../i18n';

const EarningsScreen = () => {
  const dispatch  = useAppDispatch();
  const { t }     = useTranslation();
  const earnings  = useAppSelector(s => s.rider.earnings);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await apiClient.get('/rider/earnings');
      dispatch(setEarnings(data.data));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [dispatch]);

  // Tab pe har baar aane par fresh earnings laao — mount-only fetch ek failed
  // request ke baad screen ko hamesha ke liye ₹0 par atka deta tha.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const periods = [
    { key: 'today', label: t('earn.today'),     icon: '☀️', amount: earnings?.today?.amount || 0, count: earnings?.today?.count || 0, color: COLORS.warning },
    { key: 'week',  label: t('earn.thisWeek'),  icon: '💵', amount: earnings?.week?.amount  || 0, count: earnings?.week?.count  || 0, color: COLORS.secondary },
    { key: 'month', label: t('earn.thisMonth'), icon: '💰', amount: earnings?.month?.amount || 0, count: earnings?.month?.count || 0, color: COLORS.success },
  ];

  const rating = (earnings?.rating || 5.0).toFixed(1);
  const totalDeliveries = earnings?.totalDeliveries || 0;
  const total = earnings?.total || 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} colors={[COLORS.secondary]} />}>
        <StatusBar backgroundColor={COLORS.secondary} barStyle="light-content" />

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t('active.totalEarning')}</Text>
          <Text style={styles.heroAmount}>{formatCurrency(total)}</Text>
          <Text style={styles.heroSub}>{t('earn.completed', { n: totalDeliveries })}</Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{totalDeliveries}</Text>
              <Text style={styles.heroStatLabel}>{t('profile.deliveries')}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>⭐ {rating}</Text>
              <Text style={styles.heroStatLabel}>{t('profile.rating')}</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{formatCurrency(totalDeliveries > 0 ? total / totalDeliveries : 0)}</Text>
              <Text style={styles.heroStatLabel}>{t('earn.avgOrder')}</Text>
            </View>
          </View>
        </View>

        {/* Period Cards */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('earn.byPeriod')}</Text>
        </View>

        <View style={styles.periodGrid}>
          {periods.map(p => (
            <View key={p.key} style={styles.periodCard}>
              <View style={[styles.periodIconBox, { backgroundColor: p.color + '18' }]}>
                <Text style={styles.periodIcon}>{p.icon}</Text>
              </View>
              <Text style={styles.periodLabel}>{p.label}</Text>
              <Text style={[styles.periodAmount, { color: p.color }]}>{formatCurrency(p.amount)}</Text>
              <Text style={styles.periodCount}>{t('earn.orders', { n: p.count })}</Text>
            </View>
          ))}
        </View>

        {/* Rating Card */}
        <View style={styles.ratingCard}>
          <View style={styles.ratingLeft}>
            <Text style={styles.ratingTitle}>{t('earn.customerRating')}</Text>
            <Text style={styles.ratingSubtitle}>{t('earn.ratingBasis')}</Text>
          </View>
          <View style={styles.ratingRight}>
            <Text style={styles.ratingStars}>{'⭐'.repeat(Math.round(parseFloat(rating)))}</Text>
            <Text style={styles.ratingValue}>{rating} / 5.0</Text>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  hero: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32,
    alignItems: 'center',
  },
  heroLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, marginBottom: 6 },
  heroAmount: { fontSize: 52, fontWeight: '900', color: '#fff', letterSpacing: -1, marginBottom: 4 },
  heroSub:    { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 24 },

  heroStats: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, width: '100%',
  },
  heroStat:        { flex: 1, alignItems: 'center' },
  heroStatValue:   { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 3 },
  heroStatLabel:   { fontSize: 10, color: 'rgba(255,255,255,0.65)' },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },

  sectionHeader: { paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: COLORS.text },

  periodGrid: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  periodCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  periodIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  periodIcon:    { fontSize: 22 },
  periodLabel:   { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', marginBottom: 6 },
  periodAmount:  { fontSize: 17, fontWeight: '900', marginBottom: 2 },
  periodCount:   { fontSize: 10, color: COLORS.textLight },

  ratingCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, marginHorizontal: 16, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  ratingLeft:     { flex: 1 },
  ratingTitle:    { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  ratingSubtitle: { fontSize: 12, color: COLORS.textMuted },
  ratingRight:    { alignItems: 'flex-end' },
  ratingStars:    { fontSize: 14, marginBottom: 4 },
  ratingValue:    { fontSize: 20, fontWeight: '900', color: COLORS.warning },
});

export default EarningsScreen;
