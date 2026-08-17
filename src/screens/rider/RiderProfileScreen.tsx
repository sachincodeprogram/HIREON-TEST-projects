import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import auth from '@react-native-firebase/auth';
import Sound from 'react-native-sound';
import { COLORS } from '../../constants/api';
import { RiderStackParamList } from '../../navigation/types';
import useAppSelector from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { clearAuth, setProfile } from '../../store/slices/authSlice';
import { clearDevPhone } from '../../services/apiClient';
import Card   from '../../components/common/Card';
import Input  from '../../components/common/Input';
import Button from '../../components/common/Button';
import { updateProfile, deleteAccount } from '../../services/authService';
import { RINGTONES, Ringtone } from '../../constants/ringtones';
import { getSavedRingtoneId, saveRingtoneId } from '../../services/ringtoneService';

Sound.setCategory('Playback');

const RiderProfileScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RiderStackParamList>>();
  const dispatch = useAppDispatch();
  const profile  = useAppSelector(s => s.auth.profile);
  const earnings = useAppSelector(s => s.rider.earnings);

  const [editing,       setEditing]       = useState(false);
  const [name,          setName]          = useState(profile?.name || '');
  const [phone,         setPhone]         = useState(profile?.phone || '');
  const [vehicleType,   setVehicleType]   = useState(profile?.vehicleType || '');
  const [vehicleNumber, setVehicleNumber] = useState(profile?.vehicleNumber || '');
  const [loading,       setLoading]       = useState(false);

  // ── Ring sound selection ──
  const [selectedRingId, setSelectedRingId] = useState<string | null>(null);
  const previewSound = useRef<Sound | null>(null);

  useEffect(() => {
    getSavedRingtoneId().then(setSelectedRingId);
  }, []);

  useEffect(() => () => {
    previewSound.current?.stop();
    previewSound.current?.release();
    previewSound.current = null;
  }, []);

  const previewRingtone = (rt: Ringtone) => {
    previewSound.current?.stop();
    previewSound.current?.release();
    previewSound.current = null;
    const s = new Sound(rt.file, Sound.MAIN_BUNDLE, err => {
      if (err) { console.warn('[RING] preview load failed:', JSON.stringify(err)); return; }
      s.setVolume(1.0);
      previewSound.current = s;
      s.play(() => {
        s.release();
        if (previewSound.current === s) previewSound.current = null;
      });
    });
  };

  const handleSelectRingtone = (rt: Ringtone) => {
    setSelectedRingId(rt.id);
    saveRingtoneId(rt.id);
    previewRingtone(rt);
  };

  const totalEarnings  = earnings?.total || profile?.totalEarnings || 0;
  const totalDeliveries = earnings?.totalDeliveries || profile?.totalDeliveries || 0;
  const rating          = (earnings?.rating || profile?.rating || 5.0).toFixed(1);
  const initial         = (profile?.name || 'R')[0].toUpperCase();

  const handleSave = async () => {
    try {
      setLoading(true);
      const updated = await updateProfile({ name, phone, vehicleType, vehicleNumber });
      dispatch(setProfile(updated));
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout', style: 'destructive', onPress: async () => {
          clearDevPhone();
          try { await auth().signOut(); } catch {}
          dispatch(clearAuth());
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your profile, location history, and delivery history. This cannot be undone. If you have a wallet balance, settle it first from My Wallet. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: () => {
            Alert.alert('Confirm Deletion', 'Tap "Delete Forever" to permanently delete your account.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete Forever', style: 'destructive', onPress: async () => {
                  try {
                    setLoading(true);
                    await deleteAccount();
                    clearDevPhone();
                    try { await auth().signOut(); } catch {}
                    dispatch(clearAuth());
                  } catch (e: any) {
                    Alert.alert('Could not delete account', e.message);
                  } finally {
                    setLoading(false);
                  }
                },
              },
            ]);
          },
        },
      ],
    );
  };

  const infoRows = editing ? null : [
    { label: 'Full Name',      value: profile?.name,           icon: '👤' },
    { label: 'Email',          value: profile?.email,          icon: '📧' },
    { label: 'Phone',          value: profile?.phone || 'Not set', icon: '📞' },
    { label: 'Vehicle Type',   value: profile?.vehicleType || '—',   icon: '🚗' },
    { label: 'Vehicle Number', value: profile?.vehicleNumber || '—', icon: '🔢' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{profile?.name}</Text>
          {profile?.email ? <Text style={styles.heroEmail}>{profile.email}</Text> : null}
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>🏍️  Rider</Text>
          </View>

          {/* Vehicle Info */}
          {profile?.vehicleType && (
            <View style={styles.vehicleRow}>
              <Text style={styles.vehicleText}>
                {profile.vehicleType}{profile.vehicleNumber ? ` · ${profile.vehicleNumber}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{totalDeliveries}</Text>
            <Text style={styles.statLabel}>Deliveries</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.secondary }]}>
              ₹{(totalEarnings / 1000).toFixed(1)}K
            </Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.warning }]}>⭐ {rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
        </View>

        {/* Wallet */}
        <View style={styles.section}>
          <Card onPress={() => navigation.navigate('Wallet')} style={styles.walletRow}>
            <View style={styles.walletIconChip}>
              <Text style={styles.walletIconText}>👛</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletTitle}>My Wallet</Text>
              <Text style={styles.walletSub}>Balance, recharge & transaction history</Text>
            </View>
            <Text style={styles.walletArrow}>›</Text>
          </Card>
        </View>

        {/* Profile Info */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Profile Information</Text>
            {!editing && (
              <TouchableOpacity onPress={() => setEditing(true)} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <Card>
            {editing ? (
              <>
                <Input label="Full Name"      value={name}          onChangeText={setName}         leftIcon="👤" />
                <Input label="Phone"          value={phone}         onChangeText={setPhone}        keyboardType="phone-pad" leftIcon="📞" />
                <Input label="Vehicle Type"   value={vehicleType}   onChangeText={setVehicleType}  placeholder="Bike, Scooter…" leftIcon="🚗" />
                <Input label="Vehicle Number" value={vehicleNumber} onChangeText={setVehicleNumber} placeholder="DL01AB1234" leftIcon="🔢" />
                <View style={styles.editActions}>
                  <Button title="Save" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
                  <Button title="Cancel" onPress={() => setEditing(false)} variant="ghost" style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              infoRows!.map((item, i) => (
                <View key={item.label} style={[styles.infoRow, i === infoRows!.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={styles.infoLabelWrap}>
                    <Text style={styles.infoIcon}>{item.icon}</Text>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                  </View>
                  <Text style={styles.infoValue}>{item.value}</Text>
                </View>
              ))
            )}
          </Card>
        </View>

        {/* Ring Sound */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>New Order Ring Sound</Text>
          </View>
          <Text style={styles.ringHint}>Tap to preview & set. Plays when a new order arrives.</Text>
          <Card>
            {RINGTONES.map((rt, i) => {
              const active = selectedRingId === rt.id;
              return (
                <TouchableOpacity
                  key={rt.id}
                  activeOpacity={0.7}
                  onPress={() => handleSelectRingtone(rt)}
                  style={[styles.ringRow, i === RINGTONES.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.ringEmoji}>{rt.emoji}</Text>
                  <Text style={[styles.ringLabel, active && styles.ringLabelActive]}>{rt.label}</Text>
                  {active
                    ? <View style={styles.ringCheck}><Text style={styles.ringCheckText}>✓</Text></View>
                    : <Text style={styles.ringPreview}>▶</Text>}
                </TouchableOpacity>
              );
            })}
          </Card>
        </View>

        <View style={styles.section}>
          <Button title="Logout" onPress={handleLogout} variant="danger" />
        </View>

        {/* Delete Account */}
        <View style={styles.section}>
          <TouchableOpacity onPress={handleDeleteAccount} style={styles.deleteAccountBtn}>
            <Text style={styles.deleteAccountText}>Delete Account</Text>
          </TouchableOpacity>
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
    alignItems: 'center',
    paddingTop: 32, paddingBottom: 40,
  },
  avatarRing: {
    width: 92, height: 92, borderRadius: 46,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: '900' },
  heroName:   { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 4 },
  heroEmail:  { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10 },
  rolePill: {
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 4, marginBottom: 8,
  },
  rolePillText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  vehicleRow: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  vehicleText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    marginHorizontal: 16, marginTop: -20,
    borderRadius: 16, paddingVertical: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statItem:    { flex: 1, alignItems: 'center' },
  statValue:   { fontSize: 20, fontWeight: '900', marginBottom: 3 },
  statLabel:   { fontSize: 11, color: COLORS.textMuted },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  section:     { paddingHorizontal: 16, marginTop: 20 },
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:{ fontSize: 15, fontWeight: '800', color: COLORS.text },
  editBtn:     { backgroundColor: COLORS.secondaryBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.secondary },

  editActions: { flexDirection: 'row', gap: 10, marginTop: 8 },

  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  walletIconChip: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.secondaryBg,
    alignItems: 'center', justifyContent: 'center',
  },
  walletIconText: { fontSize: 20 },
  walletTitle: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  walletSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  walletArrow: { fontSize: 26, color: COLORS.textLight, fontWeight: '300' },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoIcon:  { fontSize: 14 },
  infoLabel: { fontSize: 13, color: COLORS.textMuted },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, maxWidth: '55%', textAlign: 'right' },

  ringHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 10, marginTop: -2 },
  ringRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  ringEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
  ringLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.text },
  ringLabelActive: { color: COLORS.secondary, fontWeight: '800' },
  ringCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.secondary,
    alignItems: 'center', justifyContent: 'center',
  },
  ringCheckText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  ringPreview: { fontSize: 13, color: COLORS.textLight, width: 24, textAlign: 'center' },

  deleteAccountBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteAccountText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textDecorationLine: 'underline' },
});

export default RiderProfileScreen;
