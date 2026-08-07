import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Alert,
  KeyboardAvoidingView, Platform, Pressable, PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CustomerStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { RADIUS, glow } from '../../constants/theme';
import { ParcelSize, LocationInfo, ParcelInfo, Coordinates, PaymentMethod } from '../../types';
import Input          from '../../components/common/Input';
import Button         from '../../components/common/Button';
import Card           from '../../components/common/Card';
import ScreenHeader   from '../../components/navigation/ScreenHeader';
import AddressSearchInput from '../../components/common/AddressSearchInput';
import { estimateFare }   from '../../services/orderService';
import { getQuickPosition } from '../../services/locationService';
import { selectContactPhone } from 'react-native-select-contact';

const SIZES: { value: ParcelSize; label: string; desc: string; icon: string }[] = [
  { value: 'small',  label: 'Small',  icon: '📄', desc: 'Documents, phone (≤1 kg)' },
  { value: 'medium', label: 'Medium', icon: '👟', desc: 'Shoes, books (1–5 kg)' },
  { value: 'large',  label: 'Large',  icon: '📦', desc: 'Clothes, boxes (5–20 kg)' },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string; desc: string; icon: string }[] = [
  { value: 'COD',    label: 'Cash on Delivery', desc: 'Rider ko cash do delivery ke time', icon: '💵' },
  { value: 'ONLINE', label: 'Pay Online',       desc: 'UPI · Cards · Netbanking · QR', icon: '💳' },
];

const WEIGHT_PRESETS = [0.5, 1, 2, 5, 10];

// Premium section header: colored icon chip + title + Hinglish hint.
const SectionHead: React.FC<{ icon: string; color: string; title: string; sub: string; step: number }> =
  ({ icon, color, title, sub, step }) => (
  <View style={styles.sectionHead}>
    <View style={[styles.sectionChip, { backgroundColor: color + '1A', borderColor: color + '33' }]}>
      <Text style={styles.sectionChipIcon}>{icon}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSub}>{sub}</Text>
    </View>
    <View style={[styles.stepBadge, { backgroundColor: color }]}>
      <Text style={styles.stepBadgeText}>{step}</Text>
    </View>
  </View>
);

const BookParcelScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();

  // Coords sirf map pin-confirm ke baad set hote hain — koi default nahi,
  // warna galat (purani/Delhi) location par order chala jaata hai.
  const [pickupAddress,    setPickupAddress]    = useState('');
  const [pickupCoords,     setPickupCoords]     = useState<Coordinates | null>(null);
  const [pickupContact,    setPickupContact]    = useState('');
  const [pickupPhone,      setPickupPhone]      = useState('');

  const [deliveryAddress,  setDeliveryAddress]  = useState('');
  const [deliveryCoords,   setDeliveryCoords]   = useState<Coordinates | null>(null);
  const [deliveryContact,  setDeliveryContact]  = useState('');
  const [deliveryPhone,    setDeliveryPhone]    = useState('');

  // Search suggestions ko user ke area ki taraf bias karne ke liye (silent,
  // koi permission prompt nahi).
  const [searchBias, setSearchBias] = useState<Coordinates | null>(null);
  useEffect(() => {
    getQuickPosition().then(setSearchBias).catch(() => {});
  }, []);

  const [description,      setDescription]      = useState('');
  const [weight,           setWeight]           = useState('1');
  const [size,             setSize]             = useState<ParcelSize>('small');
  const [isFragile,        setIsFragile]        = useState(false);
  const [paymentMethod,    setPaymentMethod]    = useState<PaymentMethod>('COD');
  const [loading,          setLoading]          = useState(false);

  const handlePickupSelect = (address: string, coords: Coordinates) => {
    setPickupAddress(address);
    setPickupCoords(coords);
  };

  const handleDeliverySelect = (address: string, coords: Coordinates) => {
    setDeliveryAddress(address);
    setDeliveryCoords(coords);
  };

  // User ne address text badla (naya search) — purane coords ab galat hain.
  // Dobara pin-confirm hone tak estimate aage nahi badhega. Same text (jaise
  // paste) par confirmed pin mat udao — sirf sach me badla ho tab invalidate.
  const handlePickupTextChange = (text: string) => {
    if (text !== pickupAddress) setPickupCoords(null);
  };
  const handleDeliveryTextChange = (text: string) => {
    if (text !== deliveryAddress) setDeliveryCoords(null);
  };

  // Phone contacts se number uthao (manual entry ka option waise hi rehta hai).
  // selectedPhone.number set karo; agar naam khaali hai to contact ka naam bhi bhar do.
  const pickContact = async (
    setPhone: (v: string) => void,
    nameValue: string,
    setName: (v: string) => void,
  ) => {
    try {
      // Android 6+ par contacts padhne ke liye runtime permission chahiye.
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Contacts ka access',
            message: 'Saved contacts se number chunne ke liye permission chahiye.',
            buttonPositive: 'Allow',
            buttonNegative: 'Cancel',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission', 'Contacts ka access nahi mila. Aap number manually daal sakte hain.');
          return;
        }
      }
      const selection = await selectContactPhone();
      if (!selection) return; // user ne cancel kiya
      const number = (selection.selectedPhone.number || '').replace(/[^0-9+]/g, '');
      if (number) setPhone(number);
      if (!nameValue.trim() && selection.contact.name) setName(selection.contact.name);
    } catch (e: any) {
      console.log('[CONTACT] picker error:', e?.message || String(e), JSON.stringify(e));
      Alert.alert('Contacts', 'Contact nahi khul paya. Aap number manually bhi daal sakte hain.');
    }
  };

  const handleEstimate = async () => {
    if (!pickupAddress.trim() || !pickupCoords) {
      return Alert.alert(
        'Pickup Location Set Karo',
        'Pickup address chuno aur map par exact location pin karo.',
      );
    }
    if (!deliveryAddress.trim() || !deliveryCoords) {
      return Alert.alert(
        'Delivery Location Set Karo',
        'Delivery address chuno aur map par exact location pin karo.',
      );
    }
    try {
      setLoading(true);
      const parcel: ParcelInfo = {
        description: description || 'Parcel',
        weight: parseFloat(weight) || 1,
        size,
        isFragile,
      };
      const pickup: LocationInfo = {
        address: pickupAddress,
        coordinates: pickupCoords,
        contactName: pickupContact,
        contactPhone: pickupPhone,
      };
      const delivery: LocationInfo = {
        address: deliveryAddress,
        coordinates: deliveryCoords,
        contactName: deliveryContact,
        contactPhone: deliveryPhone,
      };
      const estimate = await estimateFare({ pickup: pickupCoords, delivery: deliveryCoords, parcel });
      navigation.navigate('FareEstimate', { pickup, delivery, parcel, estimate, paymentMethod });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader title="Book Parcel" subtitle="Schedule a new delivery" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled>

          {/* Pickup */}
          <View style={styles.sectionBlock}>
            <SectionHead icon="📍" color={COLORS.success} title="Pickup Location" sub="Kahan se uthana hai" step={1} />
            <Card style={{ zIndex: 20, overflow: 'visible' }}>
              <AddressSearchInput
                label="Address"
                placeholder="Search pickup address"
                leftIcon="📍"
                showCurrentLocation
                biasCoords={searchBias}
                onSelect={handlePickupSelect}
                onTextChange={handlePickupTextChange}
              />
              <Input
                label="Contact Name"
                value={pickupContact}
                onChangeText={setPickupContact}
                placeholder="Sender's name"
                leftIcon="👤"
              />
              <Input
                label="Contact Phone"
                value={pickupPhone}
                onChangeText={setPickupPhone}
                placeholder="Sender's phone"
                keyboardType="phone-pad"
                leftIcon="📞"
                rightIcon="👥"
                onRightIconPress={() => pickContact(setPickupPhone, pickupContact, setPickupContact)}
              />
            </Card>
          </View>

          {/* Delivery */}
          <View style={styles.sectionBlock}>
            <SectionHead icon="🏁" color={COLORS.primary} title="Delivery Location" sub="Kahan pohonchana hai" step={2} />
            <Card style={{ zIndex: 10, overflow: 'visible' }}>
              <AddressSearchInput
                label="Address"
                placeholder="Search delivery address"
                leftIcon="🏁"
                biasCoords={pickupCoords || searchBias}
                onSelect={handleDeliverySelect}
                onTextChange={handleDeliveryTextChange}
              />
              <Input
                label="Contact Name"
                value={deliveryContact}
                onChangeText={setDeliveryContact}
                placeholder="Receiver's name"
                leftIcon="👤"
              />
              <Input
                label="Contact Phone"
                value={deliveryPhone}
                onChangeText={setDeliveryPhone}
                placeholder="Receiver's phone"
                keyboardType="phone-pad"
                leftIcon="📞"
                rightIcon="👥"
                onRightIconPress={() => pickContact(setDeliveryPhone, deliveryContact, setDeliveryContact)}
              />
            </Card>
          </View>

          {/* Parcel Info */}
          <View style={styles.sectionBlock}>
            <SectionHead icon="📦" color={COLORS.warning} title="Parcel Details" sub="Kya bhej rahe ho" step={3} />
            <Card>
              <Input
                label="Description (optional)"
                value={description}
                onChangeText={setDescription}
                placeholder="What are you sending?"
                leftIcon="📝"
              />
              <Input
                label="Weight (kg)"
                value={weight}
                onChangeText={setWeight}
                placeholder="1.0"
                keyboardType="decimal-pad"
                leftIcon="⚖️"
              />
              <View style={styles.weightChips}>
                {WEIGHT_PRESETS.map(v => {
                  const active = parseFloat(weight) === v;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => setWeight(String(v))}
                      style={({ pressed }) => [
                        styles.weightChip,
                        active && styles.weightChipActive,
                        pressed && { opacity: 0.85 },
                      ]}>
                      <Text style={[styles.weightChipText, active && styles.weightChipTextActive]}>
                        {v} kg
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Parcel Size</Text>
              <View style={styles.sizeGrid}>
                {SIZES.map(s => {
                  const active = size === s.value;
                  return (
                    <Pressable
                      key={s.value}
                      style={({ pressed }) => [
                        styles.sizeCard,
                        active && styles.sizeCardActive,
                        pressed && { transform: [{ scale: 0.97 }] },
                      ]}
                      onPress={() => setSize(s.value)}>
                      {active && (
                        <View style={styles.sizeCheck}>
                          <Text style={styles.sizeCheckText}>✓</Text>
                        </View>
                      )}
                      <Text style={styles.sizeIcon}>{s.icon}</Text>
                      <Text style={[styles.sizeLabel, active && styles.sizeLabelActive]}>
                        {s.label}
                      </Text>
                      <Text style={styles.sizeDesc} numberOfLines={2}>{s.desc}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={[styles.switchRow, isFragile && styles.switchRowActive]}>
                <Text style={styles.switchIcon}>🛡️</Text>
                <View style={styles.switchLeft}>
                  <Text style={styles.switchLabel}>Fragile Item</Text>
                  <Text style={styles.switchSub}>Extra care handling (+₹20)</Text>
                </View>
                <Switch
                  value={isFragile}
                  onValueChange={setIsFragile}
                  thumbColor="#fff"
                  trackColor={{ true: COLORS.primary, false: COLORS.border }}
                />
              </View>
            </Card>
          </View>

          {/* Payment Method */}
          <View style={styles.sectionBlock}>
            <SectionHead icon="💳" color={COLORS.secondary} title="Payment Method" sub="Kaise pay karoge" step={4} />
            <View style={styles.paymentGrid}>
              {PAYMENT_METHODS.map(pm => {
                const active = paymentMethod === pm.value;
                return (
                  <Pressable
                    key={pm.value}
                    style={({ pressed }) => [
                      styles.paymentCard,
                      active && styles.paymentCardActive,
                      pressed && { transform: [{ scale: 0.97 }] },
                    ]}
                    onPress={() => setPaymentMethod(pm.value)}>
                    {active && (
                      <View style={styles.sizeCheck}>
                        <Text style={styles.sizeCheckText}>✓</Text>
                      </View>
                    )}
                    <Text style={styles.sizeIcon}>{pm.icon}</Text>
                    <Text style={[styles.sizeLabel, active && styles.sizeLabelActive]}>{pm.label}</Text>
                    <Text style={styles.sizeDesc} numberOfLines={2}>{pm.desc}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Button
            title="Get Fare Estimate"
            onPress={handleEstimate}
            loading={loading}
            icon="→"
            size="lg"
            style={styles.btn}
          />
          <View style={{ height: 12 }} />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content:   { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },

  sectionBlock: { marginBottom: 4 },
  sectionHead:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, marginTop: 18 },
  sectionChip: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionChipIcon: { fontSize: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.text, letterSpacing: -0.2 },
  sectionSub:   { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  stepBadge: {
    width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  stepBadgeText: { fontSize: 11, fontWeight: '900', color: '#fff' },

  fieldLabel: {
    fontSize: 13, fontWeight: '700', color: COLORS.text,
    marginBottom: 12, marginTop: 4,
  },

  weightChips: { flexDirection: 'row', gap: 8, marginTop: -6, marginBottom: 16, flexWrap: 'wrap' },
  weightChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.pill,
    borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface,
  },
  weightChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg },
  weightChipText:   { fontSize: 13, fontWeight: '700', color: COLORS.textMuted },
  weightChipTextActive: { color: COLORS.primary },

  sizeGrid: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  paymentGrid: { flexDirection: 'row', gap: 10 },
  paymentCard: {
    flex: 1, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', backgroundColor: COLORS.surface,
    position: 'relative',
  },
  paymentCardActive: {
    borderColor: COLORS.secondary, backgroundColor: COLORS.secondaryBg,
    ...glow(COLORS.secondary, 0.18),
  },
  sizeCard: {
    flex: 1, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center', backgroundColor: COLORS.surface,
    position: 'relative',
  },
  sizeCardActive: {
    borderColor: COLORS.primary, backgroundColor: COLORS.primaryBg,
    ...glow(COLORS.primary, 0.18),
  },
  sizeCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sizeCheckText:  { fontSize: 11, fontWeight: '900', color: '#fff' },
  sizeIcon:       { fontSize: 26, marginBottom: 6 },
  sizeLabel:      { fontSize: 13, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  sizeLabelActive:{ color: COLORS.primary },
  sizeDesc:       { fontSize: 10, color: COLORS.textMuted, textAlign: 'center', lineHeight: 13 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 16, marginTop: 4, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  switchRowActive: {
    borderTopColor: 'transparent', backgroundColor: COLORS.primaryBg,
    borderRadius: RADIUS.md, paddingHorizontal: 12, paddingBottom: 12, marginHorizontal: -4,
  },
  switchIcon: { fontSize: 22 },
  switchLeft: { flex: 1 },
  switchLabel:{ fontSize: 14, fontWeight: '700', color: COLORS.text },
  switchSub:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  btn: { marginTop: 10 },
});

export default BookParcelScreen;
