// Promptrip — public configuration.
// These values are identifiers, not secrets: every web app ships them in plain
// sight. What they can do is limited on the server side — CARTO's key has a
// usage quota, and the Firestore rules in firestore.rules decide who may write.

// Map tiles. CARTO's basemaps now require a (free) API key; without one every
// tile is watermarked "API KEY REQUIRED". Get a key at
// https://carto.com/basemaps/apikey and paste it between the quotes. Until it's
// set, the app falls back to the standard OpenStreetMap tiles.
window.CARTO_KEY = "cb1_3gjr_1_75f5150b46fa5dffce72d800";

// Two finished features, kept out of the interface until they're wanted. Their
// code stays in the app and keeps working — a group plan opened from its own
// link still works, and existing plans keep everything in them. Set either to
// true to bring the entry back.
window.SHOW_PLANNER_UI = false;      // "Plan with friends" in the + menu and the list
window.SHOW_LOCK_SHORTCUT = false;   // "Lock-screen shortcut" in the ⋯ menu

// Group planner ("Plan with friends"). Paste your Firebase web config here to
// share plans across everyone who opens the link — see docs/planner-setup.md
// for the one-time setup. Leave it null and the planner still works, but only
// on this device.
window.PLANNER_FIREBASE = {
  apiKey: "AIzaSyCJH05YLQkhEdM1Q8lt645JRdnqeO1eE0w",
  authDomain: "promptrip-16220.firebaseapp.com",
  projectId: "promptrip-16220",
  storageBucket: "promptrip-16220.firebasestorage.app",
  messagingSenderId: "321738543391",
  appId: "1:321738543391:web:8bd9ef4f4d5466e175e02a",
};
