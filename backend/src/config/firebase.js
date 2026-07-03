const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');

// Sirf ek baar initialize karo
if (getApps().length === 0) {
  let serviceAccount = null;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      // Aksar Render dashboard me paste karte waqt single-line JSON toot jaata hai.
      console.error('[Firebase] FIREBASE_SERVICE_ACCOUNT valid JSON nahi hai — poora content EK hi line me paste karo (koi line break nahi).');
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${e.message}`);
    }
  }

  if (serviceAccount) {
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'hireon-8e1c0' });
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      console.log('[Firebase] Using Auth Emulator at', process.env.FIREBASE_AUTH_EMULATOR_HOST);
    } else {
      console.warn('[Firebase] No service account — set FIREBASE_SERVICE_ACCOUNT for production');
    }
  }
}

// auth()/messaging() return karo taaki baaki files use kar sakein
module.exports = { auth: getAuth, messaging: getMessaging };
