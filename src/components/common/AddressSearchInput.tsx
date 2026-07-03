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

  // Suggestions me exact address na mile to user apna typed address hi use
  // kare: geocode se map ka approximate center nikalo, pin user khud rakhega.
  const handleUseTypedAddress = async () => {
    const text = typedText.trim();
    if (!text) return;
    setGeoLoading(true);
    try {
      const geo = await forwardGeocode(text);
      const center = geo?.coordinates || biasCoords || (await getQuickPosition());
      if (!center) {
        Alert.alert(
          'Location Nahi Mili',
          'Is address ka area nahi mila. Koi paas ka landmark search karo ya GPS use karo — phir map par pin lagao.',
        );
        return;
      }
      openMapAt(center, text);
    } finally {
      setGeoLoading(false);
    }
  };

  // minLength (3) se match — warna list to khul jaati hai par button nahi.
  const showUseTypedBtn = typedText.trim().length >= 3 && !confirmed;

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
            if (!details) return;
            const { lat, lng } = details.geometry.location;
            setTypedText(data.description);
            openMapAt({ lat, lng }, data.description);
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
      </View>

      {/* Selection status: pin confirmed -> green chip (tap = adjust) */}
      {confirmed ? (
        <TouchableOpacity
          style={styles.confirmedChip}
          onPress={() => openMapAt(confirmed.coords, confirmed.address)}
          activeOpacity={0.75}>
          <Text style={styles.confirmedIcon}>📌</Text>
          <Text style={styles.confirmedText} numberOfLines={1}>
            Exact location set hai — badalne ke liye tap karo
          </Text>
        </TouchableOpacity>
      ) : showUseTypedBtn ? (
        <TouchableOpacity
          style={styles.useTypedBtn}
          onPress={handleUseTypedAddress}
          disabled={geoLoading}
          activeOpacity={0.75}>
          {geoLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Text style={styles.gpsIcon}>🗺️</Text>
          )}
          <Text style={styles.useTypedText} numberOfLines={1}>
            {geoLoading ? 'Address dhoondh rahe hain...' : 'Yahi address use karo — map par pin lagao'}
          </Text>
        </TouchableOpacity>
      ) : null}

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
    // top 96: "Yahi address use karo" button (input ke turant neeche) hamesha
    // dikhta/tappable rahe — list usko dhak deti thi to exact-address ka
    // primary raasta hi band ho jaata tha.
    position: 'absolute', top: 96, left: -36, right: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12,
  },
  listRow: { paddingVertical: 12, paddingHorizontal: 14, backgroundColor: COLORS.surface },
  listDesc: { fontSize: 13, color: COLORS.text },
  separator: { height: 1, backgroundColor: COLORS.border },

  confirmedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.success + '60',
    backgroundColor: COLORS.successBg,
  },
  confirmedIcon: { fontSize: 14 },
  confirmedText: { fontSize: 12.5, fontWeight: '600', color: COLORS.success, flex: 1 },

  useTypedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.warning + '60',
    backgroundColor: COLORS.warningBg,
  },
  useTypedText: { fontSize: 12.5, fontWeight: '600', color: COLORS.warning, flex: 1 },

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
