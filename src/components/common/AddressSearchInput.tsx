import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Vibration, Alert, Keyboard,
} from 'react-native';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import { COLORS, GOOGLE_MAPS_API_KEY } from '../../constants/api';
import { getCurrentLocation, forwardGeocode, getQuickPosition } from '../../services/locationService';
import MapPinConfirm from './MapPinConfirm';
import { Coordinates } from '../../types';

interface Props {
  label: string;
  placeholder: string;
  leftIcon?: string;
  showCurrentLocation?: boolean;
  /** Search results ko is location ke aas-paas bias karo (e.g. user ka current
   *  area, ya delivery ke liye pickup point). */
  biasCoords?: Coordinates | null;
  onSelect: (address: string, coords: Coordinates) => void;
  /** User ne text change kiya (selection ke baad bhi) — parent ko purane
   *  coords invalidate karne ke liye. setAddressText se trigger NAHI hota. */
  onTextChange?: (text: string) => void;
}

// Address chunne ke teeno raste (suggestion / GPS / khud ka typed address)
// map pin-confirm se hokar jaate hain — kyunki Google ke paas India ke bahut
// se house/plot numbers ke exact coords nahi hote. Address text user ka
// likha hua rehta hai, coords pin se — wahi rider ko milte hain.

// Google suggestion me house/plot no. NAHI hota ("59, Tusiana Village..." ka
// suggestion sirf "Tusiana Village, Knowledge Park V..." aata hai). Suggestion
// tap par user ka typed detail udd jaata tha — rider ko sirf area milta tha.
// Isliye: typed text ke shuru ke jo segments (comma-separated) suggestion me
// nahi milte (house no. jaise "59" / "NS - 59"), unhe suggestion ke aage
// waapas joda jaata hai. Pehla matched segment aate hi ruk jao — aage ka
// area/city suggestion me pehle se hai.
export const mergeTypedWithSuggestion = (typed: string, suggestion: string): string => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const sNorm = norm(suggestion);
  const missing: string[] = [];
  for (const seg of typed.split(',').map(s => s.trim()).filter(Boolean)) {
    const n = norm(seg);
    if (n && !sNorm.includes(n)) missing.push(seg);
    else break;
  }
  return missing.length ? `${missing.join(', ')}, ${suggestion}` : suggestion;
};
const AddressSearchInput: React.FC<Props> = ({
  label,
  placeholder,
  leftIcon = '📍',
  showCurrentLocation = false,
  biasCoords,
  onSelect,
  onTextChange,
}) => {
  const ref = useRef<GooglePlacesAutocompleteRef>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [typedText,  setTypedText]  = useState('');
  const [confirmed,  setConfirmed]  = useState<{ address: string; coords: Coordinates } | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [mapInit,    setMapInit]    = useState<{ coords: Coordinates; address: string } | null>(null);

  const openMapAt = (coords: Coordinates, address: string) => {
    Keyboard.dismiss();
    setMapInit({ coords, address });
    setMapVisible(true);
  };

  // Map par pin confirm hua — yahi final address + coords hai.
  const handleMapConfirm = (address: string, coords: Coordinates) => {
    setMapVisible(false);
    setConfirmed({ address, coords });
    setTypedText(address);
    ref.current?.setAddressText(address);
    onSelect(address, coords);
    Vibration.vibrate(60);
  };

  // User ne khud type kiya — purani selection ab bharosemand nahi.
  const handleTypedChange = (text: string) => {
    setTypedText(text);
    if (confirmed && text !== confirmed.address) setConfirmed(null);
    onTextChange?.(text);
  };

  const handleCurrentLocation = async () => {
    Vibration.vibrate(40);
    setLocLoading(true);
    try {
      const result = await getCurrentLocation();
      const displayAddress = result.address || `${result.coordinates.lat.toFixed(5)}, ${result.coordinates.lng.toFixed(5)}`;
      openMapAt(result.coordinates, displayAddress);
    } catch {
      // Alerts are shown inside getCurrentLocation()
    } finally {
      setLocLoading(false);
    }
  };

  // Input ke andar wala 📌 pin button — exact location ka ek hi raasta.
  // Pehle ye kaam input ke NEECHE alag boxes karte the ("Yahi address use
  // karo" / confirmed chip) — suggestions ki dropdown unhe dhak deti thi,
  // isliye user exact location select hi nahi kar pata tha. Ab trigger input
  // ke andar hai — list se kabhi nahi dhakta.
  // Location pehle se confirm hai to wahin se map kholo; warna typed address
  // geocode karo, na mile to bias/GPS se approximate center — pin user rakhega.
  const handlePinPress = async () => {
    Vibration.vibrate(40);
    Keyboard.dismiss();
    if (confirmed) {
      openMapAt(confirmed.coords, confirmed.address);
      return;
    }
    const text = typedText.trim();
    setGeoLoading(true);
    try {
      let center: Coordinates | null = null;
      if (text.length >= 3) {
        const geo = await forwardGeocode(text);
        center = geo?.coordinates || null;
      }
      if (!center) center = biasCoords || (await getQuickPosition());
      if (!center) {
        Alert.alert(
          'Location Nahi Mili',
          'Pehle address type karo ya paas ka landmark search karo — phir 📌 daba ke map par pin lagao.',
        );
        return;
      }
      openMapAt(center, text);
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      {/* Search input row */}
      <View style={styles.inputBox}>
        <Text style={styles.icon}>{leftIcon}</Text>
        <GooglePlacesAutocomplete
          ref={ref}
          placeholder={placeholder}
          fetchDetails
          onPress={(data, details) => {
            if (!details) {
              // Place Details fail (network/quota) — chupchaap kuch na hone se
              // user atak jaata tha; typed-address fallback ka raasta batao.
              Alert.alert(
                'Location Load Nahi Hui',
                'Internet check karke dobara try karo, ya 📌 daba ke map par pin lagao.',
              );
              return;
            }
            const { lat, lng } = details.geometry.location;
            // User ka typed house/plot no. suggestion me merge karo — exact
            // address hi order ke saath rider tak jaata hai.
            const fullAddress = mergeTypedWithSuggestion(typedText, data.description);
            setTypedText(fullAddress);
            openMapAt({ lat, lng }, fullAddress);
          }}
          query={{
            key: GOOGLE_MAPS_API_KEY,
            language: 'en',
            components: 'country:in',
            // Aas-paas ke exact addresses upar aayen — bias, strict limit nahi.
            ...(biasCoords ? {
              location: `${biasCoords.lat},${biasCoords.lng}`,
              radius: 30000,
            } : {}),
          }}
          styles={{
            textInput: styles.textInput,
            listView: styles.listView,
            row: styles.listRow,
            description: styles.listDesc,
            separator: styles.separator,
          }}
          enablePoweredByContainer={false}
          textInputProps={{
            placeholderTextColor: COLORS.textLight,
            autoCorrect: false,
            onChangeText: handleTypedChange,
          }}
          debounce={300}
          minLength={3}
        />

        {/* 📌 Exact location — map pin-confirm kholta hai (Porter/Dunzo style) */}
        <TouchableOpacity
          style={[styles.pinBtn, confirmed && styles.pinBtnActive]}
          onPress={handlePinPress}
          disabled={geoLoading}
          activeOpacity={0.7}
          accessibilityLabel="Exact location map par pin karo">
          {geoLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.pinBtnIcon}>📌</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Pin confirmed — chhota sa status, koi alag box nahi */}
      {confirmed && (
        <Text style={styles.confirmedNote} numberOfLines={1}>
          ✓ Exact location set hai — badalne ke liye 📌 dabao
        </Text>
      )}

      {/* GPS button — separate row below input to avoid touch conflicts */}
      {showCurrentLocation && (
        <TouchableOpacity
          style={[styles.gpsBtn, locLoading && styles.gpsBtnLoading]}
          onPress={handleCurrentLocation}
          disabled={locLoading}
          activeOpacity={0.75}>
          {locLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.gpsIcon}>🎯</Text>
          )}
          <Text style={[styles.gpsBtnText, locLoading && { color: COLORS.textMuted }]}>
            {locLoading ? 'Location dhoondh rahe hain...' : 'Current Location Use Karo'}
          </Text>
        </TouchableOpacity>
      )}

      <MapPinConfirm
        visible={mapVisible}
        initialCoords={mapInit?.coords || { lat: 28.4744, lng: 77.5040 }}
        initialAddress={mapInit?.address || ''}
        title={label === 'Address' ? 'Exact Location Pin Karo' : label}
        onConfirm={handleMapConfirm}
        onClose={() => setMapVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: 14 },
  label: {
    fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    overflow: 'visible',
    zIndex: 10,
  },
  icon: { paddingTop: 13, paddingLeft: 12, fontSize: 16 },
  textInput: {
    fontSize: 14, color: COLORS.text,
    paddingHorizontal: 8, paddingVertical: 0,
    height: 44, backgroundColor: 'transparent',
    flex: 1,
  },
  listView: {
    backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    marginTop: 2, elevation: 10, zIndex: 9999,
    // Exact-location ka trigger ab input ke ANDAR (📌 button) hai — neeche
    // koi button nahi jise list dhak sake, isliye list input ke turant neeche.
    // left -36 = left icon ki width, right -43 = 📌 button (38 + 5 margin).
    position: 'absolute', top: 48, left: -36, right: -43,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12,
  },
  listRow: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: COLORS.surface },
  listDesc: { fontSize: 13, color: COLORS.text },
  separator: { height: 1, backgroundColor: COLORS.border },

  // Input ke andar wala 📌 exact-location button — confirm hone par green.
  pinBtn: {
    width: 38, height: 34,
    marginTop: 5, marginRight: 5,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primaryBg,
    borderWidth: 1, borderColor: COLORS.primary + '40',
  },
  pinBtnActive: {
    backgroundColor: COLORS.successBg,
    borderColor: COLORS.success + '60',
  },
  pinBtnIcon: { fontSize: 15 },

  confirmedNote: {
    fontSize: 11.5, fontWeight: '600', color: COLORS.success,
    marginTop: 5, marginLeft: 2,
  },

  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '60',
    backgroundColor: COLORS.primaryBg,
  },
  gpsBtnLoading: { borderColor: COLORS.border, backgroundColor: COLORS.surface2 },
  gpsIcon: { fontSize: 16 },
  gpsBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
});

export default AddressSearchInput;
