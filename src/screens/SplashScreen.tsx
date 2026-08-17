import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import Svg, { Rect, Path, Ellipse } from 'react-native-svg';

const { width: W } = Dimensions.get('window');
const C = '#3A3A3A'; // monument silhouette color

const MonumentsSilhouette = () => (
  <Svg
    width={W}
    height={160}
    viewBox="0 0 414 160"
    preserveAspectRatio="none">

    {/* === LEFT BUILDINGS === */}
    <Rect x={0}  y={130} width={20} height={30} fill={C} />
    <Rect x={22} y={112} width={16} height={48} fill={C} />
    {/* Qutub Minar style spire */}
    <Rect x={41} y={88}  width={13} height={72} fill={C} rx={3} />
    <Ellipse cx={47.5} cy={84} rx={9}  ry={11} fill={C} />
    <Ellipse cx={47.5} cy={76} rx={5}  ry={7}  fill={C} />
    <Rect x={57} y={110} width={20} height={50} fill={C} />
    <Rect x={79} y={120} width={14} height={40} fill={C} />

    {/* === INDIA GATE (x~100) === */}
    {/* top beam */}
    <Rect x={95}  y={95}  width={68} height={11} fill={C} />
    {/* left pillar */}
    <Rect x={97}  y={106} width={14} height={54} fill={C} />
    {/* right pillar */}
    <Rect x={147} y={106} width={14} height={54} fill={C} />
    <Path
      d="M 97 122 Q 129 82 161 122 Z"
      fill={C}
    />

    {/* === SMALL BUILDING between India Gate & Taj === */}
    <Rect x={168} y={118} width={16} height={42} fill={C} />

    {/* === TAJ MAHAL — CENTER PIECE (cx=227) === */}
    {/* Outer base platform */}
    <Rect x={178} y={130} width={120} height={30} fill={C} />
    {/* Main body */}
    <Rect x={190} y={100} width={96} height={34} fill={C} />
    {/* Main dome */}
    <Path d="M 194 100 Q 194 56 238 44 Q 282 56 282 100 Z" fill={C} />
    {/* Finial */}
    <Rect x={236} y={37} width={5} height={10} fill={C} />
    {/* Small bulb on finial */}
    <Ellipse cx={238.5} cy={35} rx={4} ry={5} fill={C} />
    {/* Inner left minaret */}
    <Rect x={192} y={72} width={10} height={62} fill={C} rx={2} />
    <Ellipse cx={197} cy={68} rx={6} ry={9} fill={C} />
    {/* Inner right minaret */}
    <Rect x={274} y={72} width={10} height={62} fill={C} rx={2} />
    <Ellipse cx={279} cy={68} rx={6} ry={9} fill={C} />
    {/* Outer left minaret */}
    <Rect x={179} y={80} width={9} height={54} fill={C} rx={2} />
    <Ellipse cx={183.5} cy={76} rx={5} ry={8} fill={C} />
    {/* Outer right minaret */}
    <Rect x={288} y={80} width={9} height={54} fill={C} rx={2} />
    <Ellipse cx={292.5} cy={76} rx={5} ry={8} fill={C} />

    {/* === SMALL BUILDING right of Taj === */}
    <Rect x={300} y={120} width={16} height={40} fill={C} />

    {/* === LOTUS TEMPLE style dome (x~340) === */}
    <Rect x={318} y={118} width={58} height={42} fill={C} />
    <Path d="M 318 118 Q 318 88 347 78 Q 376 88 376 118 Z" fill={C} />
    <Ellipse cx={347} cy={74} rx={5} ry={8} fill={C} />

    {/* === RIGHT BUILDINGS === */}
    <Rect x={378} y={108} width={16} height={52} fill={C} />
    <Rect x={396} y={122} width={18} height={38} fill={C} />

    {/* === GROUND LINE === */}
    <Rect x={0} y={157} width={414} height={3} fill={C} />
  </Svg>
);

interface Props {
  onDone: () => void;
}

const SplashScreen: React.FC<Props> = ({ onDone }) => {
  const logoScale   = useRef(new Animated.Value(0.15)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity  = useRef(new Animated.Value(0)).current;
  const miiOpacity  = useRef(new Animated.Value(0)).current;
  const silOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo spring entrance
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 45,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1, duration: 500, useNativeDriver: true,
      }),
    ]).start();

    const fade = (anim: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]).start();

    fade(textOpacity, 350);
    fade(tagOpacity,  650);
    fade(miiOpacity,  950);
    fade(silOpacity,  700);

    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#000000" barStyle="light-content" />

      {/* ── CENTER CONTENT ── */}
      <View style={styles.center}>
        {/* Logo box */}
        <Animated.View
          style={[
            styles.logoWrap,
            { transform: [{ scale: logoScale }], opacity: logoOpacity },
          ]}>
          <View style={styles.logoBox}>
            <Text style={styles.logoLetter}>H</Text>
          </View>
        </Animated.View>

        {/* HIREON */}
        <Animated.Text style={[styles.brandName, { opacity: textOpacity }]}>
          HIREON
        </Animated.Text>

        {/* Divider */}
        <Animated.View style={[styles.divider, { opacity: tagOpacity }]} />

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
          Your Delivery Partner
        </Animated.Text>
      </View>

      {/* ── BOTTOM SECTION ── */}
      <View style={styles.bottom}>
        {/* Made in India */}
        <Animated.View style={[styles.madeInIndiaRow, { opacity: miiOpacity }]}>
          <Text style={styles.madeInIndia}>🇮🇳  Made In India</Text>
        </Animated.View>

        {/* Monuments silhouette */}
        <Animated.View style={{ opacity: silOpacity }}>
          <MonumentsSilhouette />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 20,
  },
  logoWrap: {
    marginBottom: 20,
  },
  logoBox: {
    width: 90,
    height: 90,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  logoLetter: {
    fontSize: 52,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -2,
  },
  brandName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 10,
    marginBottom: 16,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: '#444444',
    borderRadius: 1,
    marginBottom: 14,
  },
  tagline: {
    fontSize: 15,
    color: '#888888',
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '400',
  },
  bottom: {
    alignItems: 'center',
  },
  madeInIndiaRow: {
    marginBottom: 12,
  },
  madeInIndia: {
    fontSize: 12,
    color: '#555555',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
});

export default SplashScreen;
