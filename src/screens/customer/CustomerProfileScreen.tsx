import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { COLORS } from '../../constants/api';
import useAppSelector from '../../hooks/useAppSelector';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { clearAuth } from '../../store/slices/authSlice';
import { clearDevPhone } from '../../services/apiClient';
import Card   from '../../components/common/Card';
import Input  from '../../components/common/Input';
import Button from '../../components/common/Button';
import { updateProfile, deleteAccount } from '../../services/authService';
import { setProfile } from '../../store/slices/authSlice';

const CustomerProfileScreen = () => {
  const dispatch = useAppDispatch();
  const profile  = useAppSelector(s => s.auth.profile);
  const orders   = useAppSelector(s => s.order.orders);

  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState(profile?.name || '');
  const [phone,   setPhone]   = useState(profile?.phone || '');
  const [loading, setLoading] = useState(false);

  const delivered = orders.filter(o => o.status === 'delivered').length;
  const initial   = (profile?.name || 'U')[0].toUpperCase();

  const handleSave = async () => {
    try {
      setLoading(true);
      const updated = await updateProfile({ name, phone });
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
      'This permanently deletes your profile, saved addresses, and order history. This cannot be undone. Are you sure?',
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
            <Text style={styles.rolePillText}>Customer</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{orders.length}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.success }]}>{delivered}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.warning }]}>{orders.length - delivered}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
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
                <Input label="Full Name"     value={name}  onChangeText={setName}  placeholder="Your name" leftIcon="👤" />
                <Input label="Phone Number"  value={phone} onChangeText={setPhone} placeholder="10-digit number" keyboardType="phone-pad" leftIcon="📞" />
                <View style={styles.editActions}>
                  <Button title="Save Changes" onPress={handleSave} loading={loading} style={{ flex: 1 }} />
                  <Button title="Cancel" onPress={() => setEditing(false)} variant="ghost" style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <>
                {[
                  { label: 'Full Name', value: profile?.name },
                  { label: 'Email',     value: profile?.email },
                  { label: 'Phone',     value: profile?.phone || 'Not set' },
                ].map((item, i, arr) => (
                  <View key={item.label} style={[styles.infoRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                    <Text style={styles.infoLabel}>{item.label}</Text>
                    <Text style={styles.infoValue}>{item.value}</Text>
                  </View>
                ))}
              </>
            )}
          </Card>
        </View>

        {/* Logout */}
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
    backgroundColor: COLORS.primary,
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
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4,
  },
  rolePillText: { fontSize: 12, fontWeight: '700', color: '#fff' },

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
  statValue:   { fontSize: 24, fontWeight: '900', color: COLORS.primary },
  statLabel:   { fontSize: 11, color: COLORS.textMuted, marginTop: 3 },
  statDivider: { width: 1, backgroundColor: COLORS.border },

  section:     { paddingHorizontal: 16, marginTop: 20 },
  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:{ fontSize: 15, fontWeight: '800', color: COLORS.text },
  editBtn:     { backgroundColor: COLORS.primaryBg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  editBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  editActions: { flexDirection: 'row', gap: 10, marginTop: 8 },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  infoLabel: { fontSize: 13, color: COLORS.textMuted },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, maxWidth: '60%', textAlign: 'right' },

  deleteAccountBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteAccountText: { fontSize: 13, fontWeight: '700', color: COLORS.textMuted, textDecorationLine: 'underline' },
});

export default CustomerProfileScreen;
