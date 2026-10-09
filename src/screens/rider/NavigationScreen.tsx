import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from '@react-native-community/geolocation';
import Tts from 'react-native-tts';
import { RiderStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/api';
import { requestLocationPermission, getCurrentPosition } from '../../services/locationService';
import { connectSocket, joinOrderRoom, emitRiderLocation } from '../../services/socketService';
import apiClient from '../../services/apiClient';
import { fetchRoute, RouteStep as NavStep, LatLng } from '../../services/routeService';
import { Coordinates } from '../../types';
import { useTranslation, translate } from '../../i18n';

type Route = RouteProp<RiderStackParamList, 'Navigation'>;

/* ──────────────────────────── geo helpers ──────────────────────────── */
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

function haversine(a: Coordinates, b: Coordinates): number { // metres
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function bearing(a: Coordinates, b: Coordinates): number { // degrees 0..360
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// distance (metres) from point p to segment a→b, using a local planar projection
function distToSegment(p: Coordinates, a: Coordinates, b: Coordinates): number {
  const mLat = 111320;
  const mLng = 111320 * Math.cos(toRad(p.lat));
  const px = p.lng * mLng, py = p.lat * mLat;
  const ax = a.lng * mLng, ay = a.lat * mLat;
  const bx = b.lng * mLng, by = b.lat * mLat;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToPolyline(p: Coordinates, line: LatLng[]): number {
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const d = distToSegment(
      p,
      { lat: line[i].latitude, lng: line[i].longitude },
      { lat: line[i + 1].latitude, lng: line[i + 1].longitude },
    );
    if (d < min) min = d;
  }
  return min;
}

/* ─────────────────────────── formatting ─────────────────────────── */
const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const fmtDur  = (s: number) => {
  const min = Math.max(1, Math.round(s / 60));
  return min < 60
    ? translate('unit.min', { n: min })
    : translate('unit.hMin', { h: Math.floor(min / 60), m: min % 60 });
};
const etaClock = (s: number) => {
  const d = new Date(Date.now() + s * 1000);
  let h = d.getHours();
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${mm} ${ap}`;
};

/* ════════════════════════════ component ════════════════════════════ */
const NavigationScreen = () => {
  const route      = useRoute<Route>();
  const navigation = useNavigation<any>();
  const { t }      = useTranslation();
  const { orderId, destination, label, destinationAddress } = route.params;
  // `label` English me aata hai ('Pickup'/'Delivery') — voice ke liye wahi, screen par translated.
  const labelText = label === 'Pickup' ? t('fare.pickup') : label === 'Delivery' ? t('fare.delivery') : label;

  const destRef = useRef<Coordinates>({ lat: destination.lat, lng: destination.lng });
  const dest = destRef.current;

  const mapRef          = useRef<MapView>(null);
  const watchId         = useRef<number | null>(null);
  const lastPosRef      = useRef<Coordinates | null>(null);
  const headingRef      = useRef(0);
  const stepsRef        = useRef<NavStep[]>([]);
  const stepIdxRef      = useRef(0);
  const routeCoordsRef  = useRef<LatLng[]>([]);
  const totalsRef       = useRef({ dist: 0, dur: 0 });
  const offRouteCount   = useRef(0);
  const lastRecalc      = useRef(0);
  const recalcing       = useRef(false);
  const followRef       = useRef(true);   // camera auto-follow on/off
  const voiceOnRef      = useRef(true);   // mirror of voiceOn for use inside onPosition
  const announcedFar    = useRef<Set<number>>(new Set()); // steps voiced at ~300m
  const announcedNear   = useRef<Set<number>>(new Set()); // steps voiced at the turn
  const arrivedSpoken   = useRef(false);

  const [riderPos,      setRiderPos]      = useState<Coordinates | null>(null);
  const [heading,       setHeading]       = useState(0);
  const [routeCoords,   setRouteCoords]   = useState<LatLng[]>([]);
  const [steps,         setSteps]         = useState<NavStep[]>([]);
  const [stepIdx,       setStepIdx]       = useState(0);
  const [remainingDist, setRemainingDist] = useState(0);
  const [remainingDur,  setRemainingDur]  = useState(0);
  const [recalculating, setRecalculating] = useState(false);
  const [arrived,       setArrived]       = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [voiceOn,       setVoiceOn]       = useState(true);

  // Speak an instruction aloud (no-op when muted or if TTS is unavailable)
  const speak = useCallback((text: string) => {
    if (!voiceOnRef.current || !text) return;
    try { Tts.stop(); Tts.speak(text); } catch { /* TTS unavailable */ }
  }, []);

  const loadRoute = useCallback(async (origin: Coordinates, isRecalc = false) => {
    try {
      if (isRecalc) setRecalculating(true);
      const r = await fetchRoute(origin, destRef.current);
      if (!r) return;
      routeCoordsRef.current = r.coords;          setRouteCoords(r.coords);
      stepsRef.current = r.steps;                 setSteps(r.steps);
      stepIdxRef.current = 0;                      setStepIdx(0);
      totalsRef.current = { dist: r.distance, dur: r.duration };
      setRemainingDist(r.distance);
      setRemainingDur(r.duration);
      // fresh route → reset voice announcements
      announcedFar.current = new Set();
      announcedNear.current = new Set();
      if (isRecalc) { announcedNear.current.add(0); speak('Route recalculated'); }
    } catch { /* keep previous route */ }
    finally {
      setLoading(false);
      if (isRecalc) setRecalculating(false);
    }
  }, [speak]);

  const moveCamera = useCallback((c: Coordinates, hd: number, duration = 800) => {
    mapRef.current?.animateCamera(
      { center: { latitude: c.lat, longitude: c.lng }, heading: hd, pitch: 55, zoom: 17 },
      { duration },
    );
  }, []);

  // Stable position handler — reads/writes refs only, so watchPosition can be set up once.
  const onPosition = useCallback((cur: Coordinates, devHeading: number, speed: number) => {
    // heading: prefer device course when moving, else derive from movement
    let hd = headingRef.current;
    if (typeof devHeading === 'number' && devHeading >= 0 && (speed ?? 0) > 0.5) hd = devHeading;
    else if (lastPosRef.current && haversine(lastPosRef.current, cur) > 3) hd = bearing(lastPosRef.current, cur);

    lastPosRef.current = cur;
    headingRef.current = hd;
    setRiderPos(cur);
    setHeading(hd);

    if (followRef.current) moveCamera(cur, hd);

    // broadcast live location (real-time tracking + customer map)
    apiClient.post('/rider/location', { lat: cur.lat, lng: cur.lng, heading: hd }).catch(() => {});
    emitRiderLocation(orderId, cur.lat, cur.lng, hd);

    const stepsArr = stepsRef.current;
    const line     = routeCoordsRef.current;
    if (!stepsArr.length || !line.length) return;

    // arrival
    if (haversine(cur, destRef.current) < 30) {
      setArrived(true);
      if (!arrivedSpoken.current) { arrivedSpoken.current = true; speak(`You have arrived at ${label}`); }
      return;
    }

    // advance to next maneuver
    let idx = stepIdxRef.current;
    if (idx < stepsArr.length - 1) {
      const step = stepsArr[idx];
      const d = haversine(cur, step.location);
      const reached = step.type === 'depart' ? d > 25 : d < 30;
      if (reached) { idx += 1; stepIdxRef.current = idx; setStepIdx(idx); }
    }

    // voice turn alerts for the upcoming maneuver
    const curIdx  = stepIdxRef.current;
    const curStep = stepsArr[curIdx];
    if (curStep) {
      const dToMan = haversine(cur, curStep.location);
      // early heads-up ~120–350 m before the turn
      if (!announcedFar.current.has(curIdx) && dToMan <= 350 && dToMan >= 120) {
        announcedFar.current.add(curIdx);
        speak(`In ${Math.round(dToMan / 10) * 10} meters, ${curStep.text}`);
      }
      // final call at the turn (<80 m) — also covers the initial "Head …"
      if (!announcedNear.current.has(curIdx) && dToMan < 80) {
        announcedNear.current.add(curIdx);
        speak(curStep.text);
      }
    }

    // remaining distance / time
    const i = stepIdxRef.current;
    let rem = haversine(cur, stepsArr[i].location);
    for (let k = i; k < stepsArr.length; k++) rem += stepsArr[k].distance;
    const { dist: tDist, dur: tDur } = totalsRef.current;
    rem = tDist > 0 ? Math.min(rem, tDist) : rem;
    setRemainingDist(rem);
    setRemainingDur(tDist > 0 ? tDur * (rem / tDist) : 0);

    // off-route → recalculate
    if (distanceToPolyline(cur, line) > 50) {
      offRouteCount.current += 1;
      if (offRouteCount.current >= 2 && !recalcing.current && Date.now() - lastRecalc.current > 8000) {
        recalcing.current  = true;
        lastRecalc.current = Date.now();
        offRouteCount.current = 0;
        loadRoute(cur, true).finally(() => { recalcing.current = false; });
      }
    } else {
      offRouteCount.current = 0;
    }
  }, [orderId, moveCamera, loadRoute, speak, label]);

  useEffect(() => {
    let mounted = true;
    // init text-to-speech (best-effort)
    try {
      Tts.setDefaultRate(0.5);
      Tts.setDefaultPitch(1.0);
      Tts.setDefaultLanguage('en-IN').catch(() => { Tts.setDefaultLanguage('en-US').catch(() => {}); });
    } catch { /* TTS unavailable */ }

    (async () => {
      const perm = await requestLocationPermission();
      if (perm !== 'granted') { setLoading(false); return; }

      let start: Coordinates | null = null;
      try { start = await getCurrentPosition(); } catch { /* fall through */ }
      if (start && mounted) {
        lastPosRef.current = start;
        setRiderPos(start);
        await loadRoute(start);
        moveCamera(start, 0, 500);
      } else if (mounted) {
        setLoading(false);
      }

      try { await connectSocket(); joinOrderRoom(orderId); } catch { /* tracking optional */ }

      watchId.current = Geolocation.watchPosition(
        pos => onPosition(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          pos.coords.heading as number,
          pos.coords.speed as number,
        ),
        err => console.warn('[Nav] watchPosition error', err?.message),
        { enableHighAccuracy: true, distanceFilter: 5, interval: 1000, fastestInterval: 1000 },
      );
    })();
    return () => {
      mounted = false;
      if (watchId.current !== null) Geolocation.clearWatch(watchId.current);
      try { Tts.stop(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recenter = () => {
    followRef.current = true;
    if (riderPos) moveCamera(riderPos, headingRef.current, 500);
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    voiceOnRef.current = next;
    if (!next) { try { Tts.stop(); } catch { /* noop */ } }
    else { const s = stepsRef.current[stepIdxRef.current]; if (s) speak(s.text); }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
        <Text style={styles.loadingText}>{t('nav.loadingRoute')}</Text>
      </View>
    );
  }

  const currentStep    = steps[stepIdx];
  const distToManeuver = riderPos && currentStep ? haversine(riderPos, currentStep.location) : 0;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude:  riderPos?.lat ?? dest.lat,
          longitude: riderPos?.lng ?? dest.lng,
          latitudeDelta: 0.01, longitudeDelta: 0.01,
        }}
        showsCompass={false}
        showsUserLocation={false}
        onMapReady={() => { if (lastPosRef.current) moveCamera(lastPosRef.current, headingRef.current, 0); }}
        onPanDrag={() => { followRef.current = false; }}>

        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#1A73E8" strokeWidth={9} lineCap="round" lineJoin="round" />
        )}

        {/* Destination */}
        <Marker coordinate={{ latitude: dest.lat, longitude: dest.lng }} anchor={{ x: 0.5, y: 1 }}>
          <View style={styles.destPin}><Text style={styles.destPinIcon}>📍</Text></View>
        </Marker>

        {/* Rider — chevron that points in travel direction (flat + rotated, camera also rotates) */}
        {riderPos && (
          <Marker
            coordinate={{ latitude: riderPos.lat, longitude: riderPos.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={heading}>
            <View style={styles.navArrowWrap}>
              <View style={styles.navArrow}><Text style={styles.navArrowChar}>▲</Text></View>
            </View>
          </Marker>
        )}
      </MapView>

      {/* ── Top: turn instruction ── */}
      <SafeAreaView edges={['top']} style={styles.topSafe} pointerEvents="box-none">
        <View style={styles.instrCard}>
          <Text style={styles.instrIcon}>{arrived ? '🏁' : currentStep?.icon ?? '⬆️'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.instrText} numberOfLines={2}>
              {arrived ? t('nav.arrived') : currentStep?.text ?? t('nav.continue')}
            </Text>
            {!arrived && <Text style={styles.instrDist}>{fmtDist(distToManeuver)}</Text>}
          </View>
        </View>
        {recalculating && (
          <View style={styles.reroute}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.rerouteText}>{t('nav.rerouting')}</Text>
          </View>
        )}
      </SafeAreaView>

      {/* ── Voice mute / unmute ── */}
      <TouchableOpacity style={styles.voiceBtn} onPress={toggleVoice} activeOpacity={0.85}>
        <Text style={styles.voiceIcon}>{voiceOn ? '🔊' : '🔇'}</Text>
      </TouchableOpacity>

      {/* ── Recenter ── */}
      <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.85}>
        <Text style={styles.recenterIcon}>🧭</Text>
      </TouchableOpacity>

      {/* ── Bottom: ETA + distance ── */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe} pointerEvents="box-none">
        <View style={styles.bottomCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.etaBig}>{arrived ? t('nav.arrivedShort') : fmtDur(remainingDur)}</Text>
            <Text style={styles.etaMeta}>
              {fmtDist(remainingDist)}{arrived ? '' : `  ·  ${t('nav.eta', { time: etaClock(remainingDur) })}`}
            </Text>
            <Text style={styles.destLabel} numberOfLines={1}>{labelText}: {destinationAddress}</Text>
          </View>
          <TouchableOpacity style={styles.exitBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.exitText}>✕</Text>
            <Text style={styles.exitLabel}>{t('nav.exit')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textMuted, fontSize: 14, fontWeight: '600' },

  topSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  instrCard: {
    backgroundColor: '#1A73E8', margin: 12, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 8,
  },
  instrIcon: { fontSize: 34 },
  instrText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  instrDist: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', marginTop: 2 },

  reroute: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center',
    backgroundColor: COLORS.warning, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  rerouteText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  recenterBtn: {
    position: 'absolute', right: 16, bottom: 170,
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  recenterIcon: { fontSize: 24 },

  voiceBtn: {
    position: 'absolute', right: 16, bottom: 230,
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  voiceIcon: { fontSize: 22 },

  bottomSafe: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  bottomCard: {
    backgroundColor: '#fff', margin: 12, borderRadius: 18, padding: 18,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 10,
  },
  etaBig:    { fontSize: 24, fontWeight: '900', color: COLORS.success },
  etaMeta:   { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 2 },
  destLabel: { fontSize: 12, fontWeight: '500', color: COLORS.textMuted, marginTop: 4 },
  exitBtn: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primaryBg,
    alignItems: 'center', justifyContent: 'center', marginLeft: 12,
  },
  exitText:  { fontSize: 20, fontWeight: '900', color: COLORS.primary, lineHeight: 22 },
  exitLabel: { fontSize: 10, fontWeight: '700', color: COLORS.primary },

  navArrowWrap: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44 },
  navArrow: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A73E8',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6,
  },
  navArrowChar: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: -2 },

  destPin: { alignItems: 'center', justifyContent: 'center' },
  destPinIcon: { fontSize: 36 },
});

export default NavigationScreen;
