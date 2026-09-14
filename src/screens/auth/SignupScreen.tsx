import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import Input  from '../../components/common/Input';
import Button from '../../components/common/Button';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Signup'>;
  route:      RouteProp<AuthStackParamList, 'Signup'>;
};

const isValidPhone = (num: string) => /^[6-9]\d{9}$/.test(num.trim());

const SignupScreen: React.FC<Props> = ({ navigation, route }) => {
  // Phone-OTP login se aaya user: route.params.phone already Firebase-verified
  // hai (readonly). Google login se aaya user: ye khaali hota hai — usko yahin
  // ek plain text field dete hain taaki OTP ke bina number add kar sake.
  const { phone: verifiedPhone } = route.params;
  const isGoogleFlow = !verifiedPhone;
  const [name,       setName]       = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  useEffect(() => {
    if (__DEV__) setName('Test User');
    // NOTE: yahan jaan-bujhke auto-focus NAHI karte. Android release me screen
    // navigate hone ke baad programmatic focus() field ko "focused" to kar deta
    // hai par soft keyboard nahi dikhata — phir user ke tap pe focus change na
    // hone ki wajah se keyboard kabhi nahi khulta. Field ko un-focused rakho;
    // user ka pehla tap reliably keyboard khol dega.
  }, []);

  const handleNext = () => {
    if (!name.trim()) {
      Alert.alert('Name Required', 'Please enter your full name to continue.');
      return;
    }
    if (name.trim().length < 2) {
      Alert.alert('Invalid Name', 'Name must be at least 2 characters.');
      return;
    }
    let phone = verifiedPhone;
    if (isGoogleFlow && phoneInput.trim()) {
      if (!isValidPhone(phoneInput)) {
        Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9 — or leave it blank and add it later from Profile.');
        return;
      }
      phone = phoneInput.trim();
    }
    navigation.navigate('RoleSelect', { name: name.trim(), phone });
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View style={styles.iconCircle}>
              <Text style={styles.waveEmoji}>👋</Text>
            </View>
            <Text style={styles.headerTitle}>Almost there!</Text>
            <Text style={styles.headerSub}>One last step to set up your account</Text>
          </View>
        </SafeAreaView>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap}>
        <ScrollView
          contentContainerStyle={styles.sheet}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {isGoogleFlow ? (
            <>
              <Text style={styles.inputSectionTitle}>Mobile Number (optional)</Text>
              <Input
                value={phoneInput}
                onChangeText={t => setPhoneInput(t.replace(/[^0-9]/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                leftIcon="📞"
                keyboardType="phone-pad"
              />
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Signed in with Google — no OTP needed. Add your number now, or
                  skip and add it later from Profile.
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedDot} />
              <View style={styles.verifiedText}>
                <Text style={styles.verifiedLabel}>Verified Mobile</Text>
                <Text style={styles.verifiedPhone}>{verifiedPhone}</Text>
              </View>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          )}

          <Text style={styles.inputSectionTitle}>Your Name</Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            leftIcon="👤"
          />

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Your name will be shown to riders and customers during deliveries.
            </Text>
          </View>

          <Button title="Continue" onPress={handleNext} style={styles.btn} />

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: COLORS.primary },

  header: { backgroundColor: COLORS.primary },
  headerContent: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  waveEmoji:   { fontSize: 36 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginBottom: 6 },
  headerSub:   { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },

  sheetWrap: { flex: 1 },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 28, paddingBottom: 40, flexGrow: 1,
  },

  verifiedRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.successBg,
    borderRadius: 14, padding: 16, marginBottom: 28,
    borderWidth: 1, borderColor: COLORS.success + '30',
    gap: 12,
  },
  verifiedDot:   { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success },
  verifiedText:  { flex: 1 },
  verifiedLabel: { fontSize: 11, color: COLORS.success, fontWeight: '600', marginBottom: 2 },
  verifiedPhone: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  checkmark:     { fontSize: 18, color: COLORS.success, fontWeight: '700' },

  inputSectionTitle: {
    fontSize: 13, fontWeight: '700', color: COLORS.textMuted,
    letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10,
  },

  infoBox: {
    backgroundColor: COLORS.secondaryBg, borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 28,
  },
  infoText: { fontSize: 13, color: COLORS.secondary, lineHeight: 18 },

  btn: { marginTop: 'auto' as any },
});

export default SignupScreen;
