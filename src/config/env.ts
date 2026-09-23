/**
 * HIREON — environment configuration.
 *
 * React Native has no runtime `process.env` without a native module
 * (react-native-config). To keep this JS-only (no native rebuild needed),
 * we select the config block from the built-in `__DEV__` flag:
 *   - `__DEV__ === true`  → Metro / debug build  → `dev`  block
 *   - `__DEV__ === false` → release build         → `prod` block
 *
 * 👉 Before shipping a public release, fill in the `prod` block with your real
 *    deployed values (see PRODUCTION_CHECKLIST.md). The `dev` block is only
 *    used while running through Metro on a USB device / emulator.
 *
 * If you later want true `.env` files, install `react-native-config` and
 * replace the literals below with `Config.API_BASE_URL` etc. — nothing else
 * in the app needs to change because everything imports from here.
 */

export type AppEnv = {
  name: 'development' | 'production';
  /** REST API base, including the /api/v1 prefix */
  API_BASE_URL: string;
  /** Socket.IO base (no path) */
  SOCKET_URL: string;
  /** Google Maps / Routes API key used by the JS routing fallback */
  GOOGLE_MAPS_API_KEY: string;
  /** OSRM routing host (route line + ETA). The public demo server is NOT
   *  production-grade — self-host or use a paid provider for release. */
  OSRM_BASE_URL: string;
};

const dev: AppEnv = {
  name: 'development',
  // localhost works on a USB device via `adb reverse tcp:5000 tcp:5000`
  API_BASE_URL: 'http://localhost:5000/api/v1',
  SOCKET_URL:   'http://localhost:5000',
  GOOGLE_MAPS_API_KEY: 'AIzaSyAetnuiIq8bAsHtDf1bFwkd5dOMo7CGREM',
  OSRM_BASE_URL: 'https://router.project-osrm.org',
};

const prod: AppEnv = {
  name: 'production',
  // Live backend on Render (HTTPS).
  API_BASE_URL: 'https://hireon-2b4t.onrender.com/api/v1',
  SOCKET_URL:   'https://hireon-2b4t.onrender.com',
  // NOTE: this key is called via plain REST (Places/Geocoding/Routes JSON
  // endpoints, key as query param / X-Goog-Api-Key header) from JS — not
  // through the native Android Maps SDK. Google only accepts the
  // "Android apps" (package+SHA-1) key restriction when the request carries
  // the X-Android-Package/X-Android-Cert headers that ONLY the native SDK
  // adds. Restricting this key to Android apps will break autosuggest
  // exactly like an HTTP-referrer restriction does — restrict by API only,
  // not by app, unless this code moves to the native SDK.
  GOOGLE_MAPS_API_KEY: 'AIzaSyAetnuiIq8bAsHtDf1bFwkd5dOMo7CGREM',
  // TODO(prod): the public OSRM demo server has no SLA/rate guarantee —
  // self-host OSRM or enable Google Routes API (routeService tries Google first).
  OSRM_BASE_URL: 'https://router.project-osrm.org',
};

export const ENV: AppEnv = __DEV__ ? dev : prod;

export default ENV;
