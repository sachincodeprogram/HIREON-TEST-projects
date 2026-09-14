import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { getMyProfile } from '../../services/authService';
import { setDevPhone } from '../../services/apiClient';
import { useAppDispatch } from '../../hooks/useAppDispatch';
import { setProfile } from '../../store/slices/authSlice';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

const OTP_COUNTDOWN = 60;
const TEST_PHONES = ['7017696580', '9458228157'];
const TEST_OTP = '123456';

GoogleSignin.configure({
  webClientId: '500086228953-8he1qejdf8h96g7n85b8ob10o499p8gi.apps.googleusercontent.com',
});

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();

  const [phone,         setPhone]         = useState('');
  const [sendLoading,   setSendLoading]   = useState(false);
  const [step,          setStep]          = useState<'phone' | 'otp'>('phone');
  const [otp,           setOtp]           = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [countdown,     setCountdown]     = useState(0);
  const [googleLoading, setGoogleLoading] = useState(false);

  const confirmationRef = useRef<any>(null);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const phoneInputRef   = useRef<TextInput>(null);
  const otpInputRef     = useRef<TextInput>(null);
  const finishingRef    = useRef(false);

  useEffect(() => {
    if (__DEV__) setPhone(TEST_PHONES[0]);
  }, []);

  // Sign-in ho jane ke baad ka common step: profile hai to store karo,
  // nahi hai (404) to Signup par bhejo. Network/timeout error par Signup
  // MAT bhejo — existing user galti se dobara register karne lag jaata hai.
  const finishLogin = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const p = await getMyProfile();
      dispatch(setProfile(p));
    } catch (e: any) {
      if (e?.status === 404) {
        navigation.navigate('Signup', { phone: '+91' + phone.trim() });
      } else {
        Alert.alert(
          'Connection Problem',
          'Verified, but we could not load your profile. Please check your internet and retry.',
          [{ text: 'Retry', onPress: () => { finishLogin(); } }],
        );
      }
    } finally {
      finishingRef.current = false;
    }
  };

  // Kya Firebase ne is number ko already sign-in kar rakha hai?
  const isAlreadySignedIn = () =>
    auth().currentUser?.phoneNumber === '+91' + phone.trim();

  // Real device par Firebase aksar SMS khud padh leta hai (auto-retrieval /
  // instant verification) aur user ko silently sign-in kar deta hai. Uske baad
  // user OTP type karke confirm() dabata hai to 'auth/session-expired' aata hai,
  // kyunki wo code already use ho chuka hota hai. Isliye OTP step par auth state
  // ko sunte hain — auto-verify hote hi seedha aage badh jao.
  useEffect(() => {
    if (step !== 'otp') return;
    const unsub = auth().onAuthStateChanged(u => {
      if (u && u.phoneNumber === '+91' + phone.trim()) {
        setVerifyLoading(true);
        finishLogin().finally(() => setVerifyLoading(false));
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (step === 'phone') phoneInputRef.current?.focus();
      else otpInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  const isValidPhone = (num: string) => /^[6-9]\d{9}$/.test(num.trim());

  const handleSendOtp = async () => {
    const trimmed = phone.trim();
    if (!isValidPhone(trimmed)) {
      Alert.alert('Invalid Number', 'Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
      return;
    }
    if (__DEV__ && TEST_PHONES.includes(trimmed)) {
      confirmationRef.current = {
        confirm: async (code: string) => {
          if (code !== TEST_OTP) throw { code: 'auth/invalid-verification-code' };
          setDevPhone('+91' + trimmed);
        },
      };
      setStep('otp');
      setCountdown(OTP_COUNTDOWN);
      setOtp(TEST_OTP);
      return;
    }
    try {
      setSendLoading(true);
      const confirmation = await auth().signInWithPhoneNumber('+91' + trimmed);
      // Instant verification: Play Services ne number bina SMS ke verify kar
      // diya aur user already sign-in hai — OTP screen dikhana hi nahi hai.
      // (Is case me confirm() hamesha 'Wrong OTP' / 'session-expired' deta.)
      if (auth().currentUser?.phoneNumber === '+91' + trimmed) {
        await finishLogin();
        return;
      }
      confirmationRef.current = confirmation;
      setStep('otp');
      setCountdown(OTP_COUNTDOWN);
    } catch (error: any) {
      handleFirebaseError(error);
    } finally {
      setSendLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the 6-digit OTP.');
      return;
    }
    // Auto-verify pehle hi ho chuka ho to confirm() mat karo — seedha aage.
    if (isAlreadySignedIn()) {
      setVerifyLoading(true);
      await finishLogin();
      setVerifyLoading(false);
      return;
    }
    if (!confirmationRef.current) {
      Alert.alert('Error', 'Session expired. Please request a new OTP.');
      setStep('phone');
      return;
    }
    try {
      setVerifyLoading(true);
      await confirmationRef.current.confirm(otp.trim());
      await finishLogin();
    } catch (error: any) {
      // confirm() fail hua par Firebase ne beech me auto-verify kar diya ho —
      // to error dikhane ki jagah aage badho.
      if (isAlreadySignedIn()) {
        await finishLogin();
        return;
      }
      if (error?.code === 'auth/session-expired' || error?.code === 'auth/code-expired') {
        Alert.alert('OTP Expired', 'This OTP is no longer valid. Please request a new one.');
        handleResendOtp();
        return;
      }
      handleFirebaseError(error);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setGoogleLoading(true);
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const { idToken } = userInfo.data ?? (userInfo as any);
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(googleCredential);
      try {
        await getMyProfile();
      } catch {
        navigation.navigate('Signup', { phone: '' });
      }
    } catch (error: any) {
      handleFirebaseError(error);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResendOtp = () => {
    setOtp('');
    setStep('phone');
    confirmationRef.current = null;
  };

  const handleFirebaseError = (error: any) => {
    const code = error?.code || '';
    let message = 'Something went wrong. Please try again.';
    if (code === 'auth/invalid-phone-number')          message = 'Invalid phone number.';
    else if (code === 'auth/too-many-requests')         message = 'Too many attempts. Please wait and try again.';
    else if (code === 'auth/invalid-verification-code') message = 'Wrong OTP. Please check and try again.';
    else if (code === 'auth/code-expired' ||
             code === 'auth/session-expired')           message = 'OTP expired. Please request a new one.';
    else if (code === 'auth/operation-not-allowed')     message = 'Phone auth not enabled.';
    else if (code === 'auth/network-request-failed')    message = 'Network error. Check your internet connection.';
    else if (error?.message)                            message = error.message;
    Alert.alert('Error', message);
  };

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={COLORS.primary} barStyle="light-content" />

      {/* Brand Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>H</Text>
            </View>
            <Text style={styles.appName}>HIREON</Text>
            <Text style={styles.tagline}>Fast & Reliable Parcel Delivery</Text>
          </View>
        </SafeAreaView>
      </View>

      {/* Bottom Sheet */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {step === 'phone' && (
            <View style={styles.sheet}>
              <Text style={styles.stepTitle}>Enter Mobile Number</Text>
              <Text style={styles.stepSubtitle}>We'll send a 6-digit OTP to verify your number</Text>

              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.flag}>🇮🇳</Text>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  ref={phoneInputRef}
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={text => setPhone(text.replace(/[^0-9]/g, ''))}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, sendLoading && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={sendLoading}
                activeOpacity={0.85}>
                {sendLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.primaryBtnText}>Send OTP</Text>}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
                onPress={handleGoogleLogin}
                disabled={googleLoading}
                activeOpacity={0.85}>
                {googleLoading
                  ? <ActivityIndicator color={COLORS.textMuted} size="small" />
                  : (
                    <View style={styles.googleBtnInner}>
                      <Text style={styles.googleIcon}>G</Text>
                      <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </View>
                  )}
              </TouchableOpacity>

              <Text style={styles.noteText}>
                By continuing, you agree to our Terms of Service and Privacy Policy
              </Text>
            </View>
          )}

          {step === 'otp' && (
            <View style={styles.sheet}>
              <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }} style={styles.backRow}>
                <Text style={styles.backArrow}>‹</Text>
                <Text style={styles.backText}>Change Number</Text>
              </TouchableOpacity>

              <Text style={styles.stepTitle}>Verify OTP</Text>
              <Text style={styles.stepSubtitle}>
                Code sent to{' '}
                <Text style={styles.phoneHighlight}>+91 {phone}</Text>
              </Text>

              <TextInput
                ref={otpInputRef}
                style={styles.otpInput}
                value={otp}
                onChangeText={text => setOtp(text.replace(/[^0-9]/g, ''))}
                placeholder="• • • • • •"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                maxLength={6}
                textAlign="center"
              />

              <View style={styles.resendRow}>
                {countdown > 0
                  ? <Text style={styles.countdownText}>
                      Resend in <Text style={styles.countdownNum}>{countdown}s</Text>
                    </Text>
                  : <TouchableOpacity onPress={handleResendOtp} activeOpacity={0.7}>
                      <Text style={styles.resendText}>Resend OTP</Text>
                    </TouchableOpacity>
                }
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, verifyLoading && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={verifyLoading}
                activeOpacity={0.85}>
                {verifyLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.primaryBtnText}>Verify & Continue</Text>}
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },

  header: { backgroundColor: COLORS.primary },
  headerContent: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 36,
  },
  logoBox: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 6,
  },
  logoText:  { fontSize: 40, fontWeight: '900', color: COLORS.primary },
  appName:   { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 4, marginBottom: 4 },
  tagline:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5 },

  sheetWrap: { flex: 1 },
  scroll:    { flexGrow: 1 },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 40,
    minHeight: 460,
  },

  backRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 4 },
  backArrow:  { fontSize: 26, color: COLORS.primary, fontWeight: '300', lineHeight: 28 },
  backText:   { fontSize: 14, color: COLORS.primary, fontWeight: '600' },

  stepTitle:    { fontSize: 24, fontWeight: '800', color: COLORS.text, marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: COLORS.textMuted, marginBottom: 28, lineHeight: 20 },
  phoneHighlight: { color: COLORS.primary, fontWeight: '700' },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 20,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: COLORS.surface2,
    borderRightWidth: 1.5,
    borderRightColor: COLORS.border,
    gap: 6,
  },
  flag:            { fontSize: 18 },
  countryCodeText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  phoneInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, color: COLORS.text, letterSpacing: 1,
  },

  otpInput: {
    borderWidth: 2, borderColor: COLORS.primary,
    borderRadius: 16, paddingVertical: 18,
    fontSize: 32, fontWeight: '800', color: COLORS.text,
    letterSpacing: 16, marginBottom: 16,
    backgroundColor: COLORS.surface,
    textAlign: 'center',
  },

  resendRow:     { alignItems: 'center', marginBottom: 24 },
  countdownText: { fontSize: 13, color: COLORS.textMuted },
  countdownNum:  { fontWeight: '700', color: COLORS.primary },
  resendText:    { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14, paddingVertical: 17,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
  },
  btnDisabled:    { opacity: 0.6 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { marginHorizontal: 14, fontSize: 12, color: COLORS.textMuted, fontWeight: '600', letterSpacing: 0.5 },

  googleBtn: {
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  googleBtnInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleIcon:     { fontSize: 18, fontWeight: '900', color: '#4285F4' },
  googleBtnText:  { fontSize: 15, fontWeight: '700', color: COLORS.text },

  noteText: {
    fontSize: 11, color: COLORS.textLight,
    textAlign: 'center', lineHeight: 16,
  },
});

export default LoginScreen;
