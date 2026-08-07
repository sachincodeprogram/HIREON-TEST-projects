import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../../constants/api';
import { RADIUS } from '../../constants/theme';
import Card         from '../../components/common/Card';
import Input        from '../../components/common/Input';
import Button       from '../../components/common/Button';
import ScreenHeader from '../../components/navigation/ScreenHeader';
import useAppSelector from '../../hooks/useAppSelector';
import { getWallet, getWalletTransactions, createRechargeOrder, verifyRecharge } from '../../services/walletService';
import { openRazorpayCheckout, isUserCancelled } from '../../services/razorpayCheckout';
import { Wallet, WalletTransaction } from '../../types';

const QUICK_AMOUNTS = [1, 100, 200, 500, 1000];

const TXN_META: Record<WalletTransaction['type'], { icon: string; label: string; credit: boolean }> = {
  EARNING:           { icon: '💰', label: 'Order Earning',    credit: true },
  RECHARGE:          { icon: '🔄', label: 'Wallet Recharge',  credit: true },
  REFUND:            { icon: '↩️', label: 'Refund',           credit: true },
  COMMISSION_DEBIT:  { icon: '📉', label: 'Commission',       credit: false },
};

const rupees = (paise: number) => (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const WalletScreen = () => {
  const navigation = useNavigation();
  const profile     = useAppSelector(s => s.auth.profile);

  const [wallet,       setWallet]       = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading,       setLoading]     = useState(true);
  const [refreshing,    setRefreshing]  = useState(false);
  const [customAmount,  setCustomAmount] = useState('');
  const [rechargeAmount, setRechargeAmount] = useState<number | null>(null);
  const [recharging,    setRecharging]  = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, t] = await Promise.all([getWallet(), getWalletTransactions(1)]);
      setWallet(w);
      setTransactions(t.transactions);
    } catch { /* silent — wallet card shows nothing, retry on next focus */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const selectedAmount = rechargeAmount ?? (parseFloat(customAmount) || 0);

  const handleRecharge = async () => {
    if (!selectedAmount || selectedAmount < 1) {
      return Alert.alert('Amount Daalo', 'Recharge amount kam se kam ₹1 hona chahiye.');
    }
    try {
      setRecharging(true);
      const amountPaise = Math.round(selectedAmount * 100);
      const rzpOrder = await createRechargeOrder(amountPaise);
      const result = await openRazorpayCheckout(
        rzpOrder,
        'Wallet Recharge',
        { name: profile?.name, email: profile?.email, contact: profile?.phone },
      );
      await verifyRecharge({
        razorpay_order_id:   result.razorpay_order_id,
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_signature:  result.razorpay_signature,
      });
      setRechargeAmount(null);
      setCustomAmount('');
      Alert.alert('Recharge Ho Gaya ✅', 'Wallet balance update ho gaya hai.');
      load();
    } catch (e: any) {
      if (!isUserCancelled(e)) {
        Alert.alert('Recharge Fail Ho Gaya', e.message || 'Kuch galat ho gaya. Dobara try karein.');
      }
    } finally {
      setRecharging(false);
    }
  };

  const balance = wallet?.balance ?? 0;
  const isNegative = balance < 0;
  const isBlocked = wallet ? !wallet.canAcceptCOD : false;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="My Wallet" subtitle="Balance, recharge & history" canGoBack onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.secondary]} tintColor={COLORS.secondary} />}>

        {/* Balance Hero */}
        <View style={[styles.balanceHero, isNegative && styles.balanceHeroNegative]}>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 14 }} />
          ) : (
            <Text style={styles.balanceAmount}>{isNegative ? '-' : ''}₹{rupees(Math.abs(balance))}</Text>
          )}
          {wallet && (
            <Text style={styles.balanceSub}>
              Minimum allowed: -₹{rupees(Math.abs(wallet.minBalance))}
            </Text>
          )}
        </View>

        {isBlocked && (
          <View style={styles.blockedBanner}>
            <Text style={styles.blockedIcon}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.blockedTitle}>COD Orders Blocked</Text>
              <Text style={styles.blockedText}>
                Balance minimum se neeche hai — naye COD orders lene ke liye pehle recharge karein.
              </Text>
            </View>
          </View>
        )}

        {/* Recharge */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recharge Wallet</Text>
          <Card>
            <View style={styles.chipRow}>
              {QUICK_AMOUNTS.map(amt => {
                const active = rechargeAmount === amt;
                return (
                  <Pressable
                    key={amt}
                    onPress={() => { setRechargeAmount(amt); setCustomAmount(''); }}
                    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.85 }]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>₹{amt}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Input
              label="Ya custom amount daalo"
              value={customAmount}
              onChangeText={t => { setCustomAmount(t.replace(/[^0-9.]/g, '')); setRechargeAmount(null); }}
              placeholder="₹ Amount"
              keyboardType="decimal-pad"
              leftIcon="₹"
            />
            <Text style={styles.methodsHint}>UPI · GPay · PhonePe · Paytm · WhatsApp Pay · QR · Cards</Text>
            <Button
              title={selectedAmount > 0 ? `Recharge ₹${selectedAmount}` : 'Recharge'}
              onPress={handleRecharge}
              loading={recharging}
              disabled={!selectedAmount}
              icon="💳"
              style={{ marginTop: 4 }}
            />
          </Card>
        </View>

        {/* Transaction History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <Card>
              <Text style={styles.emptyText}>Abhi tak koi transaction nahi hai.</Text>
            </Card>
          ) : (
            transactions.map((txn, i) => {
              const meta = TXN_META[txn.type];
              return (
                <View key={txn._id} style={[styles.txnRow, i === transactions.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.txnIconChip, { backgroundColor: (meta.credit ? COLORS.success : COLORS.error) + '16' }]}>
                    <Text style={styles.txnIcon}>{meta.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txnLabel}>{meta.label}</Text>
                    <Text style={styles.txnDesc} numberOfLines={1}>{txn.description}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txnAmount, { color: meta.credit ? COLORS.success : COLORS.error }]}>
                      {meta.credit ? '+' : '-'}₹{rupees(txn.amount)}
                    </Text>
                    <Text style={styles.txnDate}>{new Date(txn.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },

  balanceHero: {
    backgroundColor: COLORS.secondary, borderRadius: 20, padding: 24, alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8,
  },
  balanceHeroNegative: { backgroundColor: COLORS.error },
  balanceLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 6, letterSpacing: 0.5 },
  balanceAmount: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  balanceSub:    { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 8 },

  blockedBanner: {
    flexDirection: 'row', gap: 10, backgroundColor: COLORS.warningBg, borderRadius: 14, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: COLORS.warning + '40',
  },
  blockedIcon: { fontSize: 22 },
  blockedTitle: { fontSize: 14, fontWeight: '800', color: COLORS.warning, marginBottom: 2 },
  blockedText:  { fontSize: 12, color: COLORS.warning, lineHeight: 17 },

  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text, marginBottom: 10 },

  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.pill,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  chipActive: { borderColor: COLORS.secondary, backgroundColor: COLORS.secondaryBg },
  chipText:   { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  chipTextActive: { color: COLORS.secondary },
  methodsHint: { fontSize: 11, color: COLORS.textMuted, marginTop: -8, marginBottom: 14 },

  emptyText: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 8 },

  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  txnIconChip: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txnIcon: { fontSize: 17 },
  txnLabel: { fontSize: 13.5, fontWeight: '700', color: COLORS.text },
  txnDesc:  { fontSize: 11.5, color: COLORS.textMuted, marginTop: 1 },
  txnAmount: { fontSize: 14, fontWeight: '800' },
  txnDate:   { fontSize: 10.5, color: COLORS.textLight, marginTop: 2 },
});

export default WalletScreen;
