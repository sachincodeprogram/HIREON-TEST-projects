import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { ELEVATION } from '../../constants/theme';
import { UserRole } from '../../types';
import Input  from '../../components/common/Input';
import Button from '../../components/common/Button';
import { registerUser } from '../../services/authService';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setProfile } from '../../store/slices/authSlice';
import { useTranslation, TranslationKey } from '../../i18n';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'RoleSelect'>;
  route:      RouteProp<AuthStackParamList, 'RoleSelect'>;
};

// label/desc translation keys hain — render ke waqt t() se text banta hai.
const ROLES: { value: UserRole; label: TranslationKey; icon: string; desc: TranslationKey; color: string; bg: string }[] = [
  {
    value: 'customer', label: 'profile.customer', icon: '📦',
    desc: 'role.customerDesc',
    color: COLORS.primary, bg: COLORS.primaryBg,
  },
  {
    value: 'rider', label: 'profile.rider', icon: '🏍️',
    desc: 'role.riderDesc',
    color: COLORS.secondary, bg: COLORS.secondaryBg,
  },
];

const RoleSelectScreen: React.FC<Props> = ({ route }) => {
  const dispatch = useAppDispatch();
  const { t }    = useTranslation();
  const { name, phone } = route.params;
  const [selected,      setSelected]      = useState<UserRole | null>(null);
  const [vehicleType,   setVehicleType]   = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [loading,       setLoading]       = useState(false);

  const handleRegister = async () => {
    if (!selected) return Alert.alert(t('role.selectRole'), t('role.selectRoleMsg'));
    if (selected === 'rider' && (!vehicleType.trim() || !vehicleNumber.trim())) {
      return Alert.alert(t('role.vehicleRequired'), t('role.vehicleRequiredMsg'));
    }
    try {
      setLoading(true);
      const profile = await registerUser({ name, phone, role: selected, vehicleType, vehicleNumber });
      dispatch(setProfile(profile));
    } catch (e: any) {
      Alert.alert(t('role.registrationFailed'), e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <Text style={styles.hi}>{t('role.hi', { name: name.split(' ')[0] })}</Text>
            <Text style={styles.headerTitle}>{t('role.title')}</Text>
            <Text style={styles.headerSub}>{t('role.subtitle')}</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {ROLES.map(r => (
          <TouchableOpacity
            key={r.value}
            style={[
              styles.roleCard,
              selected === r.value && { borderColor: r.color, backgroundColor: r.bg },
            ]}
            onPress={() => setSelected(r.value)}
            activeOpacity={0.85}>
            <View style={[styles.roleIconBox, { backgroundColor: r.color + '18' }]}>
              <Text style={styles.roleIcon}>{r.icon}</Text>
            </View>
            <View style={styles.roleInfo}>
              <Text style={[styles.roleLabel, selected === r.value && { color: r.color }]}>
                {t(r.label)}
              </Text>
              <Text style={styles.roleDesc}>{t(r.desc)}</Text>
            </View>
            <View style={[
              styles.radioOuter,
              selected === r.value && { borderColor: r.color },
            ]}>
              {selected === r.value && <View style={[styles.radioInner, { backgroundColor: r.color }]} />}
            </View>
          </TouchableOpacity>
        ))}

        {selected === 'rider' && (
          <View style={styles.riderSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>{t('role.vehicleDetails')}</Text>
              <View style={styles.sectionLine} />
            </View>
            <Input
              label={t('profile.vehicleType')}
              value={vehicleType}
              onChangeText={setVehicleType}
              placeholder={t('role.vehicleTypePlaceholder')}
              leftIcon="🚗"
            />
            <Input
              label={t('profile.vehicleNumber')}
              value={vehicleNumber}
              onChangeText={setVehicleNumber}
              placeholder={t('role.vehicleNumberPlaceholder')}
              leftIcon="🔢"
            />
          </View>
        )}

        <Button
          title={t('role.getStarted')}
          onPress={handleRegister}
          loading={loading}
          style={styles.btn}
        />

        <Text style={styles.terms}>
          {t('role.terms')}
        </Text>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },

  header: { backgroundColor: COLORS.primary },
  headerContent: {
    paddingTop: 20, paddingBottom: 36, paddingHorizontal: 28,
  },
  hi:          { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 6 },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.6)' },

  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    flex: 1,
  },
  sheetContent: { padding: 24, paddingBottom: 40 },

  roleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20, padding: 18, marginBottom: 14,
    borderWidth: 2, borderColor: COLORS.border,
    gap: 14,
    ...ELEVATION.card,
  },
  roleIconBox: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  roleIcon:  { fontSize: 26 },
  roleInfo:  { flex: 1 },
  roleLabel: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 3 },
  roleDesc:  { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioInner: { width: 12, height: 12, borderRadius: 6 },

  riderSection: { marginTop: 8, marginBottom: 4 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  sectionLine:  { flex: 1, height: 1, backgroundColor: COLORS.border },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, letterSpacing: 0.5 },

  btn:   { marginTop: 24, marginBottom: 12 },
  terms: { fontSize: 11, color: COLORS.textLight, textAlign: 'center', lineHeight: 16 },
});

export default RoleSelectScreen;
