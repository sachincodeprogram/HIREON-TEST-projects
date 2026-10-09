import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { COLORS } from '../../constants/api';
import { RADIUS } from '../../constants/theme';
import Button from './Button';
import { reverseGeocode } from '../../services/locationService';
import { Coordinates } from '../../types';
import { useTranslation } from '../../i18n';

interface Props {
  visible: boolean;
  initialCoords: Coordinates;
  initialAddress: string;
  title?: string;
  onConfirm: (address: string, coords: Coordinates) => void;
  onClose: () => void;
}

// Porter/Dunzo style "pin lagao" screen. Google ke paas India ke bahut se
// house/plot numbers ke exact coords hote hi nahi (geocoder area-level
// APPROXIMATE deta hai) — isliye search ke baad customer khud map ghuma ke
// pin ko apne ghar par rakhta hai. Address text user ka likha hua hi rehta
// hai (house no. samet); coords hamesha pin se aate hain — wahi rider ko
// milte hain.
const MapPinConfirm: React.FC<Props> = ({
  visible, initialCoords, initialAddress,
  title,
  onConfirm, onClose,
}) => {
  const { t } = useTranslation();
  const [coords, setCoords]     = useState<Coordinates>(initialCoords);
  const [address, setAddress]   = useState(initialAddress);
  const [areaHint, setAreaHint] = useState('');
  const [moving, setMoving]     = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Har baar modal khulne par fresh initial values lo.
  useEffect(() => {
    if (visible) {
      setCoords(initialCoords);
      setAddress(initialAddress);
      setAreaHint('');
    }
  }, [visible, initialCoords, initialAddress]);

  useEffect(() => () => { if (hintTimer.current) clearTimeout(hintTimer.current); }, []);

  // Map ghoomna band hua -> center hi naya pin hai. Neeche chhota sa area
  // hint dikhate hain taaki user ko pata rahe pin kahan hai.
  const handleRegionChangeComplete = (region: Region) => {
    const c = { lat: region.latitude, lng: region.longitude };
    setCoords(c);
    setMoving(false);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(async () => {
      try {
        const r = await reverseGeocode(c);
        setAreaHint(r.address);
      } catch { /* hint optional hai */ }
    }, 500);
  };

  const handleConfirm = () => {
    const finalAddress = address.trim();
    if (!finalAddress) return;
    onConfirm(finalAddress, coords);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {visible && (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title || t('map.pinTitle')}</Text>
              <Text style={styles.subtitle}>{t('map.pinSub')}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Map + fixed center pin */}
          <View style={styles.mapWrap}>
            <MapView
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: initialCoords.lat,
                longitude: initialCoords.lng,
                latitudeDelta: 0.004,
                longitudeDelta: 0.004,
              }}
              onPanDrag={() => setMoving(true)}
              onRegionChangeComplete={handleRegionChangeComplete}
              showsUserLocation
              showsMyLocationButton
              toolbarEnabled={false}
            />
            {/* Pin map ke center par fixa hai — map neeche ghoomta hai */}
            <View pointerEvents="none" style={styles.pinWrap}>
              <Text style={[styles.pin, moving && styles.pinLifted]}>📍</Text>
              <View style={styles.pinDot} />
            </View>
          </View>

          {/* Bottom card */}
          <View style={styles.bottomCard}>
            {areaHint ? (
              <Text style={styles.areaHint} numberOfLines={2}>{t('map.pinHere', { area: areaHint })}</Text>
            ) : (
              <Text style={styles.areaHint}>{t('map.moveToHome')}</Text>
            )}
            <Text style={styles.inputLabel}>{t('map.fullAddress')}</Text>
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder={t('map.addressPh')}
              placeholderTextColor={COLORS.textLight}
              multiline
            />
            <Button
              title={t('map.confirm')}
              icon="✓"
              size="lg"
              onPress={handleConfirm}
              disabled={!address.trim()}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  title:    { fontSize: 16, fontWeight: '800', color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surface2,
    borderWidth: 1, borderColor: COLORS.border,
  },
  closeText: { fontSize: 15, fontWeight: '700', color: COLORS.text },

  mapWrap: { flex: 1 },
  pinWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  // Pin ka tip center par aaye isliye upar shift; drag ke waqt thoda aur uthta hai.
  pin:       { fontSize: 40, marginBottom: 38 },
  pinLifted: { marginBottom: 50 },
  pinDot: {
    position: 'absolute',
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.primary,
    borderWidth: 1.5, borderColor: '#fff',
  },

  bottomCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 16, paddingBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 12,
  },
  areaHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 10 },
  inputLabel: {
    fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6,
  },
  addressInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: COLORS.text,
    minHeight: 60, maxHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
});

export default MapPinConfirm;
