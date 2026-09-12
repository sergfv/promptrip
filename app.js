/* Itinerary controller.
   - Opens on TODAY's day when the trip is in progress, else day 1.
   - Tapping a day chip isolates that day; "All" shows everything.
   - Selecting a stop opens a bottom-sheet card; prev/next step through the
     day in order. A full-screen list view mirrors the same data.
   Data comes from data.js (TRIP). */

// The URL this run started on, before any route tidies it away. On an installed
// app it is the only thing the Home Screen icon can hand over — so when someone
// reports "it opens the sample trip", this is the evidence that settles why.
const LAUNCH_HASH = location.hash;

// ── Inline icons (stroke = currentColor) ──────────────────────
const SVG = (p) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON = {
  home: SVG('<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9"/>'),
  directions: SVG('<path d="M12 3 19.5 20 12 16 4.5 20 12 3z"/>'),
  chevLeft: SVG('<path d="M15 6l-6 6 6 6"/>'),
  chevRight: SVG('<path d="M9 6l6 6-6 6"/>'),
  close: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
  list: SVG('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  stops: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 7h8M11 12h8M11 17h8"/><circle cx="5.5" cy="7" r="1.8" fill="currentColor" stroke="none"/><circle cx="5.5" cy="12" r="1.8" fill="currentColor" stroke="none"/><circle cx="5.5" cy="17" r="1.8" fill="currentColor" stroke="none"/></svg>',
  locate: SVG('<circle cx="12" cy="12" r="3.4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>'),
  warn: SVG('<path d="M12 4.5 21 20H3L12 4.5z"/><path d="M12 10v4"/><path d="M12 17h.01"/>'),
  pin: SVG('<path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>'),
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  share: SVG('<path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v13M8 7l4-4 4 4"/>'),
  bell: SVG('<path d="M10 5a2 2 0 0 1 4 0 7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6"/><path d="M9 17v1a3 3 0 0 0 6 0v-1"/>'),
  chevUp: SVG('<path d="M6 15l6-6 6 6"/>'),
  chevDown: SVG('<path d="M6 9l6 6 6-6"/>'),
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  photo: SVG('<path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/>'),
  magic: SVG('<path d="M11 3l1.6 4.4L17 9l-4.4 1.6L11 15l-1.6-4.4L5 9l4.4-1.6L11 3z"/><path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14z"/>'),
  check: SVG('<path d="M5 13l4 4L19 7"/>'),
  trash: SVG('<path d="M5 7h14M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/>'),
  layers: SVG('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 12l9 5 9-5"/>'),
  grip: SVG('<path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01"/>'),
  install: SVG('<path d="M12 4v10M8 11l4 4 4-4"/><path d="M5 20h14"/>'),
  feedback: SVG('<path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'),
  copy: SVG('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
  pencil: SVG('<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/>'),
  people: SVG('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2A4.5 4.5 0 0 1 21 18.5"/>'),
};

// Category glyphs — shown for stops that shouldn't pull a photo (restaurants,
// bars, walks, open zones…), so a recommendation reads as a clean icon rather
// than a random name/geo image. Keyed by a stop's optional `category`.
const CAT_ICON = {
  food: SVG('<path d="M5 3v6a2 2 0 0 0 4 0V3M7 11v10"/><path d="M16 3c-1.4 0-2.3 1.9-2.3 4.4S15 12 16 12v9"/>'),
  bar: SVG('<path d="M5 4h14l-7 8-7-8z"/><path d="M12 12v6M8 21h8"/>'),
  cafe: SVG('<path d="M4 8h13v3a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6V8z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2"/><path d="M8 3v2M12 3v2"/>'),
  viewpoint: SVG('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.6"/>'),
  park: SVG('<path d="M12 22v-5"/><path d="M12 17c-3 0-5.2-2-5.2-5 0-1 .4-1.9 1-2.6C7.3 8.7 7 7.9 7 7a5 5 0 0 1 10 0c0 .9-.3 1.7-.8 2.4.6.7 1 1.6 1 2.6 0 3-2.2 5-5.2 5z"/>'),
  church: SVG('<path d="M12 2v6M9.5 5h5"/><path d="M5 21v-8l7-3.5 7 3.5v8"/><path d="M10 21v-4h4v4"/>'),
  museum: SVG('<path d="M3 9l9-5 9 5"/><path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9"/><path d="M3 21h18"/>'),
  market: SVG('<path d="M4 9h16l-1.2 9.6a1 1 0 0 1-1 .9H6.2a1 1 0 0 1-1-.9L4 9z"/><path d="M8.5 9l1.8-5M15.5 9l-1.8-5"/>'),
  shop: SVG('<path d="M6 8h12l-1 12.2H7L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  beach: SVG('<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 3v18"/><path d="M3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1"/>'),
  walk: SVG('<circle cx="13" cy="4.2" r="1.8"/><path d="M13 8l-1.2 4.2 3 2 1 5.5"/><path d="M11.8 12.2 8.6 14l-1.4 4.2"/><path d="M13 8.8l3 1 2.2-1.2"/>'),
  landmark: SVG('<path d="M12 3l3 6H9l3-6z"/><path d="M10 9v9M14 9v9"/><path d="M6.5 21h11"/>'),
  area: SVG('<circle cx="12" cy="12" r="8.2" stroke-dasharray="2 3.4"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/>'),
};

// Where "Send feedback" points (a Typeform — no personal inbox exposed).
const FEEDBACK_URL = 'https://form.typeform.com/to/Z2gBNuH7';

// ── Reusable engine: data loading, sanitising, import ─────────
// The active itinerary comes from (1) a saved import on this device, else
// (2) the built-in demo (TRIP in data.js). All text from imported data is
// treated as untrusted and escaped at render; coords/colours are validated.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
const PALETTE = ['#d64038', '#e07b18', '#5b8f1f', '#2e77c2', '#7c4fd0', '#b5338f', '#be4870', '#4b6584'];
// Day colour for an auto-coloured itinerary: the curated palette first, then
// evenly-spread distinct hues (golden-angle) so long trips don't repeat colours.
function dayColor(i) {
  if (i < PALETTE.length) return PALETTE[i];
  const h = Math.round((i * 137.508) % 360);
  const l = i % 2 ? 42 : 50; // alternate lightness for extra separation
  return `hsl(${h}, 56%, ${l}%)`;
}
const toNum = (v) => (typeof v === 'number' && isFinite(v) ? v : isFinite(parseFloat(v)) ? parseFloat(v) : null);
const safeColor = (c) => (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c.trim()) ? c.trim() : null);
// A {lat,lng} endpoint (walk from/to), validated to real coordinates or null.
function parsePoint(p) {
  if (!p || typeof p !== 'object') return null;
  const lat = toNum(p.lat), lng = toNum(p.lng);
  if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// "21:00" / "9:30–11:00" → minutes past midnight, or null when there's no time.
// Anything before 05:00 counts as the small hours of the SAME evening, so a
// 00:30 nightcap sorts after a 22:00 dinner instead of leaping to breakfast.
function startMinutes(time) {
  const m = String(time || '').match(/(\d{1,2})\s*[:.]\s*(\d{2})/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return (h < 5 ? h + 24 : h) * 60 + mi;
}
// An AI can hand back a day whose stops aren't in the order it gave them times.
// Put the timed ones in clock order, in the slots they already occupy — stops
// without a time (a base, a walk between two things) don't move at all.
function orderByTime(stops) {
  const slots = [], timed = [];
  stops.forEach((s, i) => {
    const t = startMinutes(s.time);
    if (t != null) { slots.push(i); timed.push({ s, t }); }
  });
  if (timed.length < 2) return stops;
  const wasOrdered = timed.every((x, i) => i === 0 || timed[i - 1].t <= x.t);
  if (wasOrdered) return stops;
  timed.sort((a, b) => a.t - b.t);
  const out = stops.slice();
  slots.forEach((pos, k) => { out[pos] = timed[k].s; });
  return out;
}

function normalizeItinerary(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.days)) {
    throw new Error('That isn’t an itinerary — it needs a list of "days".');
  }
  const days = raw.days
    .map((d, di) => {
      const stops = (Array.isArray(d.stops) ? d.stops : [])
        .map((s) => {
          if (!s || typeof s !== 'object') return null;
          const type = s.type === 'walk' || s.type === 'area' ? s.type : 'place';
          let lat = toNum(s.lat);
          let lng = toNum(s.lng);
          // Legacy support: an older "walk" may carry only from/to (route ends)
          // rather than lat/lng — use their midpoint as the stop's single point.
          if (lat == null || lng == null) {
            const from = parsePoint(s.from);
            const to = parsePoint(s.to);
            if (type === 'walk' && from && to) {
              lat = (from.lat + to.lat) / 2;
              lng = (from.lng + to.lng) / 2;
            }
          }
          if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
          const stop = { name: String(s.name || 'Stop'), note: String(s.note || ''), lat, lng };
          if (type !== 'place') stop.type = type;
          if (typeof s.category === 'string' && s.category.trim()) stop.category = s.category.trim().toLowerCase().slice(0, 24);
          if (s.isBase) stop.isBase = true;
          if (s.conflict) stop.conflict = String(s.conflict);
          if (typeof s.wiki === 'string' && s.wiki.trim()) stop.wiki = s.wiki.trim();
          // Optional start time or range, e.g. "11:00" or "11:00–13:00" (shown on the card, list and detail).
          if (typeof s.time === 'string' && s.time.trim()) stop.time = s.time.trim().slice(0, 32);
          if (Array.isArray(s.images)) {
            const im = s.images.filter((u) => typeof u === 'string' && u.startsWith('https://upload.wikimedia.org/'));
            if (im.length) stop.images = im;
          }
          return stop;
        })
        .filter(Boolean);
      return {
        id: (typeof d.id === 'string' && d.id.replace(/[^\w-]/g, '')) || 'd' + di,
        date: typeof d.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : undefined,
        label: String(d.label || d.name || 'Day ' + (di + 1)),
        name: String(d.name || d.label || 'Day ' + (di + 1)),
        color: safeColor(d.color) || dayColor(di),
        intro: typeof d.intro === 'string' && d.intro.trim() ? String(d.intro).trim() : undefined,
        // Once someone has dragged this day into the order they want, that's
        // the order — the clock doesn't get to override a person.
        manual: d.manual === true ? true : undefined,
        stops: d.manual === true ? stops : orderByTime(stops),
      };
    })
    .filter((d) => d.stops.length);
  if (!days.length) throw new Error('No stops with valid coordinates were found.');
  const seen = {};
  days.forEach((d, i) => {
    if (seen[d.id]) d.id += '-' + i;
    seen[d.id] = 1;
  });
  const out = { title: String(raw.title || 'My itinerary'), subtitle: String(raw.subtitle || ''), days };
  if (raw._geo) out._geo = true; // "already snapped to OSM" — don't re-geocode
  return out;
}

// ── Itinerary library ────────────────────────────────────────
// Saved itineraries live in a library so importing one never overwrites
// another. Shape: { items: [{id, name, sub, savedAt, data}], activeId }.
// The built-in demo is the virtual id 'demo' (not stored).
const STORE_KEY = 'itinerary.v1'; // legacy single slot — migrated into the library
const LIB_KEY = 'library.v1';
const DEMO_ID = 'demo';

function newItId() { return 'it_' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
function saveLibrary(lib) { try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch (e) {} }
function loadLibrary() {
  let lib = null;
  try { lib = JSON.parse(localStorage.getItem(LIB_KEY)); } catch (e) {}
  if (!lib || !Array.isArray(lib.items)) lib = { items: [], activeId: DEMO_ID };
  // One-time migration of a single legacy import (so nothing is lost on upgrade).
  try {
    const old = localStorage.getItem(STORE_KEY);
    if (old) {
      const data = JSON.parse(old);
      lib.items.unshift({ id: newItId(), name: data.title || 'My itinerary', sub: data.subtitle || '', savedAt: Date.now(), data });
      lib.activeId = lib.items[0].id;
      localStorage.removeItem(STORE_KEY);
      saveLibrary(lib);
    }
  } catch (e) {}
  return lib;
}
// A short, stable fingerprint of the text an itinerary arrived as — so the same
// one landing twice (a Home Screen launch, a plan that hasn't changed) is
// recognised rather than shelved again.
function revOf(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ':' + str.length;
}
function addItinerary(data, activate, meta) {
  const lib = loadLibrary();
  const { planId, rev, shareId } = meta || {};
  // An itinerary built from a group plan replaces the last one built from that
  // same plan: the group keeps adding ideas and handing it over again, and what
  // they want is this trip brought up to date — not a shelf of near-copies.
  const { replaceId } = meta || {};
  const prev = (planId && lib.items.find((i) => i.planId === planId)) ||
    (shareId && lib.items.find((i) => i.shareId === shareId)) ||
    (replaceId && lib.items.find((i) => i.id === replaceId));
  // The same itinerary arriving again (the same link reopened) is the one they
  // already have — switch to it instead of making a copy.
  const twin = !prev && rev && lib.items.find((i) => i.rev === rev);
  if (twin) {
    if (activate) { lib.activeId = twin.id; saveLibrary(lib); }
    return twin.id;
  }
  const id = prev ? prev.id : newItId();
  const item = { id, name: data.title || 'My itinerary', sub: data.subtitle || '', savedAt: Date.now(), data };
  if (planId) item.planId = planId;
  if (shareId) item.shareId = shareId;
  if (rev) item.rev = rev;
  // A replacement keeps what the old entry was tied to: the same plan, and the
  // same shared link, so what was handed round stays pointing at this trip.
  if (prev) {
    if (!item.planId && prev.planId) item.planId = prev.planId;
    if (!item.shareId && prev.shareId) item.shareId = prev.shareId;
  }
  if (prev) lib.items[lib.items.indexOf(prev)] = item;
  else lib.items.unshift(item);
  if (activate) lib.activeId = id;
  saveLibrary(lib);
  return id;
}

// What this device holds for a given plan, and the two things the planner may
// want to do about it: put the map on screen, or hand it to the group.
window.planMapInfo = function (planId, publishedRaw) {
  try {
    const lib = loadLibrary();
    const item = lib.items.find((i) => i.planId === planId);
    const active = lib.items.find((i) => i.id === lib.activeId);
    const pubRev = publishedRaw ? revOf(publishedRaw) : null;
    return {
      has: !!item,
      onScreen: !!(item && lib.activeId === item.id),
      name: item ? item.name : '',
      // A map imported before plans could carry one won't be tagged; offering
      // the one on screen is better than pretending there's nothing to share.
      // It is NOT assumed to be the right one — see the confirm in planner.js.
      spare: !item && active ? active.name : '',
      // The group has the same version this device published or adopted. A
      // fresh import lands with a new fingerprint, so it reads as out of date.
      inSync: !!(item && item.rev && pubRev && item.rev === pubRev),
    };
  } catch (e) { return { has: false, onScreen: false, name: '', spare: '', inSync: false }; }
};
window.openPlanMap = function (planId) {
  const lib = loadLibrary();
  const item = lib.items.find((i) => i.planId === planId);
  if (!item) return false;
  lib.activeId = item.id;
  saveLibrary(lib);
  location.reload();
  return true;
};
// The map as text, ready to publish. Stamping the fingerprint afterwards is
// what stops this device adopting its own publish back again.
window.planMapPayload = function (planId) {
  const lib = loadLibrary();
  const item = lib.items.find((i) => i.planId === planId) || lib.items.find((i) => i.id === lib.activeId);
  if (!item) return null;
  const raw = JSON.stringify(item.data);
  return { raw, rev: revOf(raw), id: item.id };
};
window.stampPlanMap = function (planId, id, rev) {
  const lib = loadLibrary();
  const item = lib.items.find((i) => i.id === id);
  if (!item) return;
  item.planId = planId;
  item.rev = rev;
  saveLibrary(lib);
};

// Fetch a shared trip and put it on screen. Used by a cold start on a #t= link
// and by one tapped while the app is already open.
function openSharedTrip(shareId) {
  // The hash STAYS. It's short, and it's what "Add to Home Screen" captures —
  // an installed app launched on a bare URL has no storage of its own to fall
  // back on, so the link has to carry the trip's id.
  const go = () => {
    if (!window.tripShare) return setTimeout(go, 150);   // planner.js still loading
    window.tripShare.fetch(shareId).then((got) => {
      if (!got || !got.raw) {
        uncover('That link doesn’t point to a trip any more.', true);
        toast('That trip link doesn’t point to anything');
        return;
      }
      // adoptSharedTrip reloads when it takes the map over, so the cover stays
      // up until the new page paints. If there's nothing to do, drop it.
      if (!adoptSharedTrip(shareId, got.raw, got.updatedAt)) uncover();
    }).catch(() => {
      uncover('Couldn’t reach that trip. Check you’re online.', true);
      toast('Couldn’t open that link — check you’re online');
    });
  };
  go();
}

// A trip opened from a short link. Same rules as a plan's map: the version
// already here is left alone, and a map imported here later is never replaced
// by an older published one.
function adoptSharedTrip(shareId, raw, publishedAt) {
  let data;
  try { data = normalizeItinerary(JSON.parse(raw)); } catch (e) { toast('That trip link is damaged'); return false; }
  const rev = revOf(raw);
  const lib = loadLibrary();
  const prev = lib.items.find((i) => i.shareId === shareId);
  const localNewer = !!(prev && publishedAt && (prev.savedAt || 0) > publishedAt);
  if (prev && (prev.rev === rev || localNewer)) {
    if (lib.activeId !== prev.id) { lib.activeId = prev.id; saveLibrary(lib); location.reload(); return true; }
    return false;
  }
  const id = addItinerary(data, true, { shareId, rev });
  const l2 = loadLibrary();
  const it = l2.items.find((i) => i.id === id);
  if (it) { it.shareId = shareId; saveLibrary(l2); }
  location.reload();
  return true;
}

// The group's map, carried by the plan itself. A phone that has never imported
// anything — an iPhone's Home Screen app keeps its own storage, so that's most
// of them — gets the trip from the plan link instead of from this device.
// `force` is for someone who has just TAPPED this trip's link: they asked for
// it, so it opens. Without it (a plan updating in the background) the map only
// takes the screen if the screen wasn't already someone else's trip.
window.adoptPlanItinerary = function (planId, raw, force, publishedAt) {
  let data;
  try { data = normalizeItinerary(JSON.parse(raw)); } catch (e) { return false; }
  const rev = revOf(raw);
  const lib = loadLibrary();
  const prev = lib.items.find((i) => i.planId === planId);
  // A map imported here AFTER the group's copy was published is the newer one:
  // never overwrite it with the plan's older version — that would throw away
  // the import the organiser just made. The board offers to publish it instead.
  const localNewer = !!(prev && publishedAt && (prev.savedAt || 0) > publishedAt);
  if (prev && (prev.rev === rev || localNewer)) {
    if (force && lib.activeId !== prev.id) {   // they tapped the trip's link: open it
      lib.activeId = prev.id;
      saveLibrary(lib);
      location.reload();
      return true;
    }
    return false;
  }
  const takeOver = force || !lib.activeId || lib.activeId === DEMO_ID || (prev && lib.activeId === prev.id);
  addItinerary(data, takeOver, { planId, rev });
  // true means "the page is about to reload" — the caller should stop there.
  if (takeOver) { location.reload(); return true; }
  // It didn't take the screen, so say where it went — otherwise the group's map
  // arrives invisibly and looks like nothing happened.
  toast('The group’s map is in your itineraries');
  return false;
};
function switchItinerary(id) {
  const lib = loadLibrary();
  lib.activeId = id;
  saveLibrary(lib);
  location.hash = '';
  location.reload();
}
function deleteItinerary(id) {
  const lib = loadLibrary();
  const wasActive = lib.activeId === id;
  lib.items = lib.items.filter((i) => i.id !== id);
  if (wasActive) lib.activeId = DEMO_ID;
  saveLibrary(lib);
  if (wasActive) { location.hash = ''; location.reload(); }
  return lib;
}
// Save the current (possibly reordered) DATA back to the active library item.
function persistActive() {
  const lib = loadLibrary();
  if (!lib.activeId || lib.activeId === DEMO_ID) return;
  const item = lib.items.find((i) => i.id === lib.activeId);
  if (item) { item.data = DATA; item.name = DATA.title || item.name; saveLibrary(lib); }
}

function resolveItinerary() {
  // 1) Shared link: #i=<compressed JSON> — add to the library as active, clean URL.
  try {
    const m = location.hash.match(/^#i=(.+)$/);
    if (m && typeof LZString !== 'undefined') {
      const json = LZString.decompressFromEncodedURIComponent(m[1]);
      if (json) {
        const data = normalizeItinerary(JSON.parse(json));
        addItinerary(data, true, { rev: revOf(json) });
        history.replaceState(null, '', location.pathname + location.search);
        return data;
      }
      // The whole trip rides inside this kind of link, so it's long — and a
      // link that was cut short (a chat preview, a mail client) can't be read
      // back. Say so instead of quietly showing the sample trip.
      history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => toast('That link was cut short on the way — ask for it again, or for the short link'), 600);
    }
  } catch (e) {
    /* fall through */
  }
  // 1a) Short link: #t=<id> — the trip lives under that id, so the link is a
  // dozen characters and always opens the version the owner last published.
  // The fetch is async: clean the URL, render whatever we have, swap when it
  // arrives (the same shape as the gist path below).
  const t = location.hash.match(/^#t=([a-z0-9]{6,24})$/i);
  if (t) openSharedTrip(t[1]);
  // 1b) Short link: #g=<owner>/<gist-id> — the itinerary JSON lives in a GitHub
  // gist, fetched from GitHub's CDN (CORS-open, no account needed to read, and
  // the owner can revoke the share by deleting the gist). The fetch is async,
  // so render whatever we have now and import + reload when it arrives. Only
  // gist.githubusercontent.com is ever fetched — never an arbitrary URL.
  const g = location.hash.match(/^#g=([\w-]{1,40})\/([a-f0-9]{8,64})$/);
  if (g) {
    history.replaceState(null, '', location.pathname + location.search);
    fetch('https://gist.githubusercontent.com/' + g[1] + '/' + g[2] + '/raw')
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((raw) => { addItinerary(normalizeItinerary(raw), true, { rev: revOf(JSON.stringify(raw)) }); location.reload(); })
      .catch(() => toast('Couldn’t load the shared itinerary — ask for a fresh link'));
  }
  // 2) Active itinerary from the library.
  try {
    const lib = loadLibrary();
    if (lib.activeId && lib.activeId !== DEMO_ID) {
      const item = lib.items.find((i) => i.id === lib.activeId);
      if (item) return normalizeItinerary(item.data);
    }
  } catch (e) {
    /* fall back to demo */
  }
  // 3) Built-in demo.
  return normalizeItinerary(TRIP);
}
const DATA = resolveItinerary();

// The cover (see index.html) goes up before anything paints whenever the app is
// opened on a #t= link. Take it down as soon as we know this device already has
// that trip — then it never paints at all, and later launches are instant.
function uncover(msg, actions) {
  const root = document.documentElement;
  if (!msg) { root.classList.remove('opening-trip'); return; }
  const el = document.getElementById('op-msg');
  const acts = document.getElementById('op-acts');
  const wait = document.getElementById('op-wait');
  if (!el) { root.classList.remove('opening-trip'); return; }
  el.textContent = msg;
  // The buttons belong to a dead end, not to waiting: while it's still working
  // the spinner is the only thing to see.
  if (acts) acts.hidden = !actions;
  if (wait) wait.hidden = !!actions;
}
(() => {
  const m = LAUNCH_HASH.match(/^#t=([a-z0-9]{6,24})$/i);
  if (!m) return;
  try {
    const lib = loadLibrary();
    const item = lib.items.find((i) => i.id === lib.activeId);
    if (item && item.shareId === m[1]) uncover();     // already ours: nothing to wait for
  } catch (e) { uncover(); }
})();

// Lenient parse of an AI reply: pull JSON out of a ``` fence or the first {...}.
function parseItinerary(text) {
  if (!text || !text.trim()) throw new Error('Paste your AI’s reply first.');
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();
  else {
    const a = body.indexOf('{');
    const b = body.lastIndexOf('}');
    if (a >= 0 && b > a) body = body.slice(a, b + 1);
  }
  let raw;
  try {
    raw = JSON.parse(body);
  } catch (e) {
    throw new Error('Couldn’t read that. Paste the AI’s full reply — it should contain a JSON block.');
  }
  // The example inside the prompt, pasted back by mistake (or echoed by an AI
  // that answered with the template). It has been shared to a group once.
  if (String(raw.title || '').trim() === 'Trip name' &&
      /dates or a short tagline/i.test(String(raw.subtitle || ''))) {
    throw new Error('That’s the example from the prompt, not your trip — paste the AI’s own reply.');
  }
  return normalizeItinerary(raw);
}

// ── Geocoding at import ───────────────────────────────────────
// AI-supplied coordinates can be plausibly wrong (a pin on the wrong street).
// Once, on first view of an imported itinerary, look each stop's NAME up in
// OpenStreetMap — biased to the AI's rough coordinate so a match can't jump to
// another city — and snap the pin to the real place. "Open in Maps" already
// resolves by name; this brings the on-map pin up to the same accuracy. Fully
// optional: offline, unmatched names (small venues), or errors keep the
// original coordinate. The private home base is never geocoded.
const geoSleep = (ms) => new Promise((r) => setTimeout(r, ms));
function distKm(aLat, aLng, bLat, bLng) {
  const R = 6371, toR = Math.PI / 180;
  const dLa = (bLat - aLat) * toR, dLo = (bLng - aLng) * toR;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
async function geocodeName(name, lat, lng) {
  const D = 0.09; // ~10 km bias box around the AI coordinate — stays in the right city
  const viewbox = `${lng - D},${lat + D},${lng + D},${lat - D}`;
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0'
    + `&q=${encodeURIComponent(name)}&viewbox=${encodeURIComponent(viewbox)}&bounded=1`;
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || !j.length) return null;
    const glat = parseFloat(j[0].lat), glng = parseFloat(j[0].lon);
    if (!isFinite(glat) || !isFinite(glng)) return null;
    if (distKm(lat, lng, glat, glng) > 6) return null; // implausibly far → likely wrong match
    return { lat: glat, lng: glng };
  } catch (e) {
    return null;
  }
}
async function geocodeActiveItinerary() {
  try {
    if (!navigator.onLine) return;
    const lib = loadLibrary();
    if (!lib.activeId || lib.activeId === DEMO_ID) return; // never the built-in demo
    if (DATA._geo) return;                                  // already snapped
    for (const day of DATA.days) {
      for (let i = 0; i < day.stops.length; i++) {
        const s = day.stops[i];
        if (s.isBase) continue;                             // never geocode the private base
        const hit = await geocodeName(s.name, s.lat, s.lng);
        if (hit && (Math.abs(hit.lat - s.lat) > 1e-5 || Math.abs(hit.lng - s.lng) > 1e-5)) {
          s.lat = hit.lat; s.lng = hit.lng;
          const m = markers[key(day.id, i)];
          if (m) m.setLatLng([hit.lat, hit.lng]);
        }
        await geoSleep(1100);                               // Nominatim policy: ≤1 request/second
      }
    }
    DATA._geo = true; // mark done so we snap once, then persist the fixed coords
    persistActive();
  } catch (e) {
    /* geocoding is best-effort — never break the app over it */
  }
}

// Bumped with the service worker's cache name on every deploy, and shown at the
// foot of the ⋯ menu so "is this phone running the new version?" has an answer.
const APP_VERSION = 'v120';

const PROMPT = `Take the trip itinerary we just planned and convert it into ONE json code block and nothing else, in exactly this format:

\`\`\`json
{
  "title": "Trip name",
  "subtitle": "dates or a short tagline",
  "days": [
    {
      "label": "Mon 1",
      "name": "Mon 1 — morning theme",
      "date": "2026-07-01",
      "intro": "2–4 sentences telling the story of the day — the flow, local knowledge and recommendations that connect the stops.",
      "stops": [
        {
          "type": "place",
          "category": "museum",
          "name": "Place name",
          "note": "One or two short sentences: why go, best timing, a tip.",
          "time": "11:00–13:00 (optional: a start time or a range)",
          "lat": 0.0,
          "lng": 0.0,
          "wiki": "Exact English Wikipedia article title, or omit if none"
        },
        {
          "type": "walk",
          "category": "walk",
          "name": "The street or avenue to stroll",
          "note": "What you'll pass and why it's worth walking — put the direction here.",
          "lat": 0.0,
          "lng": 0.0
        }
      ]
    }
  ]
}
\`\`\`

Rules:
- Output ONLY the JSON code block — no text before or after it.
- Write all itinerary text (title, subtitle, day names, intros and notes) in the SAME language we've been using. Keep place names in their normal local form.
- "intro" (per day): 2–4 sentences carrying the narrative and local knowledge — how the day flows, what to look out for, the "as you'd tell a friend" voice. Include it whenever the plan has that kind of guidance.
- "type" (per stop) is one of:
   • "place" (default) — a single spot: a sight, restaurant, café, shop, viewpoint, or an open zone like a plaza, park or beach. Give REAL "lat"/"lng".
   • "walk" — a street/avenue worth strolling, shown as a single pin on the map. Name it after the actual street (e.g. "Rambla del Poblenou"), NOT an instruction, and put the direction / what you'll pass in the note.
- Coordinates matter: give the most accurate real "lat"/"lng" you can for EVERY stop, based on what we actually discussed. Use the exact place, street or stretch named in the plan. If a stop is described relative to others (e.g. "the stretch of Avinguda Diagonal between the Sagrada Família and Glòries"), place its point ON that stretch — here, roughly midway between those two — not just anywhere on the street. For a "walk", pick a point on the specific segment being recommended. If you're unsure, use the best-known location for that name rather than guessing.
- "category" (per stop): the best fit from — food, bar, cafe, viewpoint, park, church, museum, market, shop, beach, walk, landmark. It sets the stop's icon.
- Name every stop by its REAL place name so the map can find a photo. The app shows a photo for well-known public places (avenues, plazas, parks, beaches, landmarks, museums) and a clean icon for small venues (category food/bar/cafe) — so you don't need to worry about photos for restaurants.
- "wiki" (optional): the exact ENGLISH Wikipedia article title, only for places that genuinely have one (major landmarks, museums). Omit it for restaurants, bars and minor spots — it's just a photo hint.
- Order the stops within each day along the most sensible real-world route — minimise backtracking, group what's walkable, and let each stop sit in sequence where you'd actually reach it.
- "date" is optional (YYYY-MM-DD) — include it only where we set dates.
- "time" (optional, per stop): a start time or a range, like "11:00" or "11:00–13:00", only where we agreed one.
- Keep each "note" to one or two short, practical sentences.`;

// Wikimedia 500px thumb → larger 1280px version for the lightbox (a standard
// pre-cached width). Falls back to the 500px thumb if 1280 isn't available.
const bigImg = (u) => u.replace('/500px-', '/1280px-');

// ── Map ───────────────────────────────────────────────────────
const map = L.map('map', { zoomControl: false });
// CARTO Voyager: a clean, familiar OSM-based basemap. CARTO's basemaps now
// need a (free) API key — without one every tile is watermarked — so the key
// lives in config.js. Until it's set we fall back to the standard OpenStreetMap
// tiles: busier, but not watermarked. The service worker caches both hosts.
const CARTO_KEY = String(window.CARTO_KEY || '').trim();
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
L.tileLayer(
  CARTO_KEY
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=' + encodeURIComponent(CARTO_KEY)
    : 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
  subdomains: 'abcd',
  maxZoom: CARTO_KEY ? 20 : 19,
  detectRetina: !!CARTO_KEY,
  attribution: CARTO_KEY ? OSM_ATTR + ' &copy; <a href="https://carto.com/attributions">CARTO</a>' : OSM_ATTR,
}).addTo(map);
map.attributionControl.setPosition('topleft');

// ── Helpers ───────────────────────────────────────────────────
const byId = Object.fromEntries(DATA.days.map((d) => [d.id, d]));
const key = (dayId, i) => `${dayId}:${i}`;

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
const TODAY = todayISO();
const isToday = (dayId) => byId[dayId] && byId[dayId].date === TODAY;

// Google Maps link. For real places, search by name centred on the stop's
// coords so Google opens the actual place card (not a bare coordinate pin).
// The home base stays a plain coordinate pin (its location is fuzzed/private).
function mapsUrl(stop) {
  const place = stop.name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (stop.isBase || !place) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.lat + ',' + stop.lng)}`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(place)}/@${stop.lat},${stop.lng},16z`;
}

// Wikimedia thumb URL → its Commons file page (for attribution / full size).
function filePage(thumbUrl) {
  const parts = thumbUrl.split('/');
  const file = parts[parts.length - 2];
  return `https://commons.wikimedia.org/wiki/File:${file}`;
}

// ── Stop photos ──────────────────────────────────────────────
// explicit stop.images → demo GALLERY (by name) → fetched from Wikipedia (by
// title). Fetched results are cached per title so re-opening doesn't refetch.
const imgCache = {};
const normThumb = (u) => u.replace(/\/\d+px-([^/]+)$/, '/500px-$1');

// Cache key for fetched images: a stop's Wikipedia title if it has one, else a
// coordinate bucket so places without an article can still resolve photos.
const imgKey = (stop) => (stop.wiki ? 'w:' + stop.wiki : 'g:' + stop.lat.toFixed(4) + ',' + stop.lng.toFixed(4));

function galleryFor(stop) {
  if (stop.images) return stop.images;
  if (typeof GALLERY !== 'undefined' && GALLERY[stop.name]) return GALLERY[stop.name];
  const c = imgCache[imgKey(stop)];
  return Array.isArray(c) ? c : [];
}

const deburr = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
async function fetchWikiImages(title) {
  const base = 'https://en.wikipedia.org/w/api.php?origin=*&format=json&redirects=1';
  const out = [];
  const words = deburr(title).split(/[^a-z]+/).filter((w) => w.length >= 4);
  try {
    const r1 = await fetch(`${base}&action=query&prop=pageimages&piprop=thumbnail&pithumbsize=500&titles=${encodeURIComponent(title)}`);
    const p1 = Object.values((((await r1.json()) || {}).query || {}).pages || {})[0];
    if (p1 && p1.thumbnail && p1.thumbnail.source) out.push(normThumb(p1.thumbnail.source));
  } catch (e) {}
  try {
    const r2 = await fetch(`${base}&action=query&generator=images&gimlimit=25&prop=imageinfo&iiprop=url|mime&iiurlwidth=500&titles=${encodeURIComponent(title)}`);
    const pages = ((((await r2.json()) || {}).query) || {}).pages || {};
    for (const p of Object.values(pages)) {
      if (out.length >= 3) break;
      const ii = p.imageinfo && p.imageinfo[0];
      if (!ii || ii.mime !== 'image/jpeg' || !ii.thumburl) continue;
      const t = (p.title || '').toLowerCase();
      if (/logo|icon|flag|map|seal|coat|crest|diagram|wikimedia|commons-|\.svg/.test(t)) continue;
      if (!words.some((w) => t.includes(w))) continue; // keep only extras that match the place
      const u = normThumb(ii.thumburl);
      if (!out.includes(u)) out.push(u);
    }
  } catch (e) {}
  return out.slice(0, 3);
}

const nonBaseCount = (day) => day.stops.filter((s) => !s.isBase).length;
function seqNumber(day, index) {
  let n = 0;
  for (let i = 0; i <= index; i++) if (!day.stops[i].isBase) n++;
  return n;
}

// Day names are authored as "Tue 16 June — Klimt and Modernist Vienna". Split on
// the em/en-dash into a bold uppercase date line and a sentence-case title line;
// fall back to the short label if there's no dash.
function daySplit(day) {
  const parts = String(day.name || '').split(/\s*[—–]\s*/);
  if (parts.length >= 2) return { date: parts[0].trim(), title: parts.slice(1).join(' — ').trim() };
  return { date: day.label || day.name || '', title: '' };
}

// ── Markers ───────────────────────────────────────────────────
const dayLayers = {};
const markers = {};
const allBounds = [];

function pinIcon(day, index, selected) {
  const stop = day.stops[index];
  const sel = selected ? ' is-sel' : '';
  const inner = stop.isBase ? ICON.home : `<span>${seqNumber(day, index)}</span>`;
  const warn = stop.conflict ? `<span class="pin-warn">${ICON.warn}</span>` : '';
  return L.divIcon({
    className: '',
    html: `<div class="pin${sel}" style="--c:${day.color}">${inner}${warn}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// Add a stop's numbered pin to its day group. Walks are a single well-placed
// point too (kept distinct only by their category icon), so every stop is a pin.
function addStop(day, i, group) {
  const stop = day.stops[i];
  const m = L.marker([stop.lat, stop.lng], {
    icon: pinIcon(day, i, false),
    zIndexOffset: stop.isBase ? 1000 : 0,
    keyboard: false,
  });
  m.on('click', () => select(day.id, i, { center: true, closer: true }));
  group.addLayer(m);
  markers[key(day.id, i)] = m;
}

DATA.days.forEach((day) => {
  const group = L.layerGroup();
  day.stops.forEach((stop, i) => {
    addStop(day, i, group);
    allBounds.push([stop.lat, stop.lng]);
  });
  dayLayers[day.id] = group;
});

// ── State ─────────────────────────────────────────────────────
let activeDay = null; // 'all' or a day id
let selected = null; // { dayId, idx }
let lastViewed = null; // { dayId, idx } — persisted; drives where the app opens
const LV_KEY = 'lastViewed.v1';

function applyFilter() {
  DATA.days.forEach((d) => {
    const show = activeDay === 'all' || d.id === activeDay;
    if (show && !map.hasLayer(dayLayers[d.id])) dayLayers[d.id].addTo(map);
    if (!show && map.hasLayer(dayLayers[d.id])) map.removeLayer(dayLayers[d.id]);
  });
}

// Leave room at the bottom for the carousel card + day chips. The zoom cap used
// to be 15, which is about 150 m to a pin's width — a day spent in one old town
// arrived as a pile of overlapping pins. Let it go closer; the padding is what
// keeps the stops clear of the card, not the cap.
const FIT_OPTS = { paddingTopLeft: [40, 72], paddingBottomRight: [40, 300], maxZoom: 17 };
// A single stop has no spread to fit, so fitBounds would slam to the cap and
// show one pin in an empty street. Give it a little context instead.
const LONE_STOP_ZOOM = 16;
// A pin is ~40px across; two of them need this much room to read as two.
const CLEAR_PX = 64;

// Web-Mercator ground resolution: how many metres one pixel covers.
const metresPerPixel = (lat, zoom) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
// The zoom at which two stops this far apart sit CLEAR_PX apart on screen.
function zoomForGap(metres, lat) {
  if (!isFinite(metres) || metres <= 0) return LONE_STOP_ZOOM;
  // Ceil, not round: rounding down lands just inside the overlap it was meant
  // to clear, which is how a "fixed" day still arrived as a pile.
  const z = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180) * CLEAR_PX) / metres);
  return Math.max(13, Math.min(18, Math.ceil(z)));
}
const metresBetween = (a, b) => map.distance([a.lat, a.lng], [b.lat, b.lng]);
// How close the nearest other stop of the day is — that's what decides how far
// in the map has to go before this stop is distinct from its neighbour.
function nearestNeighbour(day, idx) {
  let min = Infinity;
  day.stops.forEach((s, i) => {
    if (i === idx) return;
    min = Math.min(min, metresBetween(day.stops[idx], s));
  });
  return min;
}
// The tightest pair in a set of stops: if these two overlap, the day looks like
// fewer stops than it has.
function tightestPair(stops) {
  let min = Infinity;
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) min = Math.min(min, metresBetween(stops[i], stops[j]));
  }
  return min;
}
// Stops near the day's first one — the part of the day you can walk between.
const CORE_RADIUS_M = 2000;
const coreOf = (day) => day.stops.filter((s) => metresBetween(day.stops[0], s) <= CORE_RADIUS_M);

function fitDay(day) {
  if (day.stops.length === 1) {
    map.setView([day.stops[0].lat, day.stops[0].lng], LONE_STOP_ZOOM);
    return;
  }
  const pad = L.point(40, 300);
  const bounds = L.latLngBounds(day.stops.map((s) => [s.lat, s.lng]));
  const fitted = Math.min(map.getBoundsZoom(bounds, false, pad), FIT_OPTS.maxZoom);
  const lat = day.stops[0].lat;
  // Whole day first: if nothing in it overlaps at that zoom, that's the view.
  if (tightestPair(day.stops) / metresPerPixel(lat, fitted) >= CLEAR_PX) {
    map.fitBounds(bounds, FIT_OPTS);
    return;
  }
  // It does overlap — a day that mixes an old town with somewhere out of town
  // can't show both AND keep the old town readable. Show the walkable core of
  // the day as large as it fits, but never tighter than its closest pair needs.
  // The far stop is one swipe of the cards away.
  const core = coreOf(day);
  const cb = L.latLngBounds(core.map((s) => [s.lat, s.lng]));
  const z = Math.max(
    Math.min(map.getBoundsZoom(cb, false, pad), FIT_OPTS.maxZoom),
    zoomForGap(tightestPair(core), lat)
  );
  map.setView(cb.getCenter(), Math.min(z, 18));
}

function showDay(id) {
  activeDay = id;
  applyFilter();
  updateChips();
  closeDetail();
  buildCarousel(id);
  if (id === 'all') map.fitBounds(allBounds, FIT_OPTS);
  else fitDay(byId[id]);
  if (carouselStops.length) select(carouselStops[0].dayId, carouselStops[0].idx, { fly: false, center: true });
}

const IMG_NOISE = /logo|icon|flag|\bmap\b|seal|coat|crest|diagram|aerial|\.svg/;
function collectImages(pages, limit) {
  // geosearch/search both return a per-result `index` (relevance / nearest-first)
  const sorted = Object.values(pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const p of sorted) {
    if (out.length >= limit) break;
    const ii = p.imageinfo && p.imageinfo[0];
    if (!ii || ii.mime !== 'image/jpeg' || !ii.thumburl) continue;
    if (IMG_NOISE.test((p.title || '').toLowerCase())) continue;
    const u = normThumb(ii.thumburl);
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

// Second image source, by NAME — searches Wikimedia Commons file titles/captions
// for the place. Language-agnostic (works for "Playa de la Victoria" etc.) and
// far more relevant than a pure coordinate search. Returns a candidate pool.
async function fetchCommonsByName(name) {
  const url =
    'https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query' +
    '&generator=search&gsrnamespace=6&gsrlimit=12' +
    `&gsrsearch=${encodeURIComponent(name)}&prop=imageinfo&iiprop=url|mime&iiurlwidth=500`;
  try {
    return collectImages(((((await (await fetch(url)).json()) || {}).query) || {}).pages, 8);
  } catch (e) { return []; }
}

// Last-resort image source: photos geotagged near the stop's coordinates.
async function fetchCommonsNearby(lat, lng) {
  const url =
    'https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query' +
    '&generator=geosearch&ggsnamespace=6&ggslimit=20&ggsradius=600' +
    `&ggscoord=${lat}|${lng}&prop=imageinfo&iiprop=url|mime&iiurlwidth=500`;
  try {
    return collectImages(((((await (await fetch(url)).json()) || {}).query) || {}).pages, 8);
  } catch (e) { return []; }
}

// Photos already shown on some stop, so neighbouring stops don't repeat a set.
const usedImgs = new Set();

// ── Lazy photos (shared by cards + detail), keyed per stop ────
function ensureImages(stop) {
  const k = imgKey(stop);
  if (imgCache[k] !== undefined) return; // loading or done
  imgCache[k] = 'loading';
  (async () => {
    let list = [];
    if (stop.wiki) list = await fetchWikiImages(stop.wiki);     // article lead + extras
    if (!list.length) list = await fetchCommonsByName(stop.name); // by name (relevant, any language)
    if (!list.length) list = await fetchCommonsNearby(stop.lat, stop.lng); // by coords (fallback)
    // Prefer images not already used elsewhere, so adjacent stops differ.
    const fresh = list.filter((u) => !usedImgs.has(u));
    const chosen = (fresh.length ? fresh : list).slice(0, 3);
    chosen.forEach((u) => usedImgs.add(u));
    imgCache[k] = chosen;
    if (chosen.length) {
      carouselStops.forEach(({ dayId, idx }) => {
        const s = byId[dayId].stops[idx];
        if (imgKey(s) !== k) return;
        const el = document.getElementById(cardKey(dayId, idx));
        const ph = el && el.querySelector('.pc-thumb');
        if (ph) ph.outerHTML = `<img class="pc-thumb" src="${esc(chosen[0])}" alt="" decoding="async">`;
      });
    }
    // Re-render the open detail either way: a found photo replaces the icon
    // banner; if nothing was found the banner settles on the category icon.
    if (!detail.hidden && selected) {
      const st = byId[selected.dayId].stops[selected.idx];
      if (imgKey(st) === k) renderDetail(selected.dayId, selected.idx);
    }
  })();
}

// ── Selection (pin highlight + map pan + carousel sync) ───────
function setMarkerSel(dayId, idx, on) {
  const m = markers[key(dayId, idx)];
  if (m) m.setIcon(pinIcon(byId[dayId], idx, on));
}

let syncingScroll = false; // ignore scroll events caused by programmatic centering

function select(dayId, idx, opts = {}) {
  if (selected) setMarkerSel(selected.dayId, selected.idx, false);
  selected = { dayId, idx };
  lastViewed = { dayId, idx };
  try { localStorage.setItem(LV_KEY, JSON.stringify(lastViewed)); } catch (e) {}
  setMarkerSel(dayId, idx, true);
  const at = markers[key(dayId, idx)].getLatLng();
  // Asked for a particular stop (a card, a pin, a row): make sure it can be
  // seen as its own pin, not as part of a pile. Only ever moves closer.
  const want = opts.closer ? zoomForGap(nearestNeighbour(byId[dayId], idx), at.lat) : 0;
  if (want > map.getZoom()) map.setView(at, want, { animate: true });
  else if (opts.fly !== false) map.panTo(at, { animate: true });
  if (opts.center) centerCard(dayId, idx);
  if (!detail.hidden) renderDetail(dayId, idx);
}

// ── Carousel (overview) ───────────────────────────────────────
const carousel = document.getElementById('carousel');
let carouselStops = []; // [{dayId, idx}] in display order
const cardKey = (dayId, idx) => `c_${dayId}_${idx}`;

// Small venues whose name rarely maps to a good public photo — a name/geo
// search tends to grab something random (this is what put strangers on the
// restaurant cards). These show a category icon. Everything else — avenues,
// plazas, parks, beaches, malls, viewpoints, landmarks — still tries for a real
// photo, since those places are well documented on Wikimedia Commons.
const ICON_ONLY_CATS = new Set(['food', 'restaurant', 'bar', 'pub', 'cafe', 'coffee']);
function stopCatIcon(stop) {
  return (stop.category && CAT_ICON[stop.category]) ||
    (stop.type === 'walk' ? CAT_ICON.walk : stop.type === 'area' ? CAT_ICON.area : ICON.pin);
}
// The placeholder icon when there's no photo: the category glyph when we have
// one (or a walk/area), else the generic camera (a neutral loading placeholder).
function thumbIcon(stop) {
  return stop.category || stop.type === 'walk' || stop.type === 'area' ? stopCatIcon(stop) : ICON.photo;
}
const hasCat = (stop) => !!(stop.category || stop.type === 'walk' || stop.type === 'area');
// Should this stop try to load a photo, or just show its icon?
function wantsPhoto(stop) {
  if (stop.isBase) return false;
  if (galleryFor(stop).length) return true;   // curated / already resolved
  if (stop.wiki) return true;                  // a real article → reliable photo
  if (stop.category && ICON_ONLY_CATS.has(stop.category)) return false; // small venues → icon
  return true;                                 // avenues, areas, landmarks… attempt a photo
}
// Photo lookup finished and found nothing → we settle on the category icon.
function noPhotoFound(stop) {
  const c = imgCache[imgKey(stop)];
  return Array.isArray(c) && c.length === 0;
}

function cardThumb(stop) {
  const imgs = galleryFor(stop);
  if (imgs.length) return `<img class="pc-thumb" src="${esc(imgs[0])}" alt="" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">`;
  if (stop.isBase) return `<span class="pc-thumb pc-ph pc-base">${ICON.home}</span>`;
  if (wantsPhoto(stop) && !noPhotoFound(stop)) ensureImages(stop);
  return `<span class="pc-thumb pc-ph${hasCat(stop) ? ' pc-cat' : ''}">${thumbIcon(stop)}</span>`;
}

function buildCarousel(id) {
  carouselStops = [];
  DATA.days.forEach((d) => {
    if (id !== 'all' && d.id !== id) return;
    d.stops.forEach((_, i) => carouselStops.push({ dayId: d.id, idx: i }));
  });
  carousel.innerHTML = carouselStops
    .map(({ dayId, idx }) => {
      const d = byId[dayId];
      const stop = d.stops[idx];
      const seq = stop.isBase ? 'Home base' : `${seqNumber(d, idx)} / ${nonBaseCount(d)}`;
      const warn = stop.conflict ? `<span class="pc-warn">${ICON.warn}</span>` : '';
      return `<button class="pcard" type="button" id="${cardKey(dayId, idx)}" data-day="${dayId}" data-idx="${idx}">
        ${cardThumb(stop)}
        <span class="pc-body">
          <span class="pc-eyebrow" style="color:${d.color}">${hasCat(stop) ? `<span class="pc-tag">${stopCatIcon(stop)}</span>` : ''}${esc(d.label)} · ${seq}</span>
          <span class="pc-name">${esc(stop.name)}${warn}</span>
          <span class="pc-meta${stop.time ? ' pc-time' : ''}">${stop.time ? esc(stop.time) : 'tap for details'}</span>
        </span>
      </button>`;
    })
    .join('');
  carousel.querySelectorAll('.pcard').forEach((c) =>
    c.addEventListener('click', () => openDetail(c.dataset.day, +c.dataset.idx))
  );
}

function centerCard(dayId, idx) {
  const el = document.getElementById(cardKey(dayId, idx));
  if (!el) return;
  syncingScroll = true;
  el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  clearTimeout(centerCard._t);
  centerCard._t = setTimeout(() => (syncingScroll = false), 450);
}

let scrollT = null;
carousel.addEventListener(
  'scroll',
  () => {
    if (syncingScroll) return;
    clearTimeout(scrollT);
    scrollT = setTimeout(() => {
      const mid = carousel.scrollLeft + carousel.clientWidth / 2;
      let best = null, bestD = Infinity;
      carousel.querySelectorAll('.pcard').forEach((c) => {
        const cc = c.offsetLeft + c.offsetWidth / 2;
        const dd = Math.abs(cc - mid);
        if (dd < bestD) { bestD = dd; best = c; }
      });
      if (best) select(best.dataset.day, +best.dataset.idx, { closer: true });
    }, 90);
  },
  { passive: true }
);

// ── Detail sheet (iOS-style: large detent, peek behind, close) ─
const detail = document.getElementById('detail');
const scrim = document.getElementById('scrim');
// One dimmed scrim shared by every pull-up sheet; ref-counted so closing one
// sheet doesn't drop the dim under another.
let scrimCount = 0;
function showScrim() {
  scrimCount++;
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add('is-open'));
}
function hideScrim() {
  scrimCount = Math.max(0, scrimCount - 1);
  if (scrimCount === 0) scrim.classList.remove('is-open');
}
// Tapping the scrim dismisses the topmost open sheet.
scrim.addEventListener('click', () => {
  if (!importscreen.hidden && importscreen.classList.contains('is-open')) closeImport();
  else if (!libraryview.hidden && libraryview.classList.contains('is-open')) closeLibrary();
  else if (!listview.hidden && listview.classList.contains('is-open')) closeList();
  else closeDetail();
});
scrim.addEventListener('transitionend', () => {
  if (!scrim.classList.contains('is-open')) scrim.hidden = true;
});

// Drag a sheet down to dismiss it (iOS-style). opts.handle = drag anywhere on
// that element (e.g. a header); opts.scrollSel = drag the sheet itself, but only
// begin once the scrollable content is pulled down from its top.
function makeSheetDismissable(sheet, opts) {
  const handle = opts.handle || null;
  const onClose = opts.onClose;
  const guard = opts.guard || (() => true);
  const target = handle || sheet;
  let startY = 0, startX = 0, dy = 0, dx = 0, dragging = false, active = false, scrollEl = null;
  target.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    // Never hijack a drag that starts on an editable field (text selection).
    if (e.target.closest('input, textarea, [contenteditable]')) { dragging = false; return; }
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    dy = 0; dx = 0;
    dragging = true;
    active = !!handle;
    scrollEl = opts.scrollSel ? sheet.querySelector(opts.scrollSel) : null;
    if (active) sheet.style.transition = 'none';
  }, { passive: true });
  target.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    dy = e.touches[0].clientY - startY;
    dx = e.touches[0].clientX - startX;
    if (!active) {
      // Only claim the gesture for a downward, vertical-dominant drag from the
      // top — leaves horizontal swipes (e.g. lightbox photo paging) untouched.
      const atTop = !scrollEl || scrollEl.scrollTop <= 0;
      if (dy > 4 && dy > Math.abs(dx) && atTop && guard()) { active = true; sheet.style.transition = 'none'; }
      else return;
    }
    if (dy < 0) dy = 0;
    sheet.style.transform = `translateY(${dy}px)`;
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  target.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    if (!active) return;
    active = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy > 110) onClose();
  });
}
// The detail sheet dismisses on a downward drag from anywhere, once its content
// is scrolled to the top (attached once; queries the live .d-body each gesture).
makeSheetDismissable(detail, { scrollSel: '.d-body', onClose: closeDetail });

// Swipe the detail sideways to page between stops (same order as the carousel).
// Horizontal-dominant drags translate the body for live feedback, then commit to
// step(); the vertical dismiss handler ignores these (it needs dy > |dx|).
(function detailPager() {
  let sx = 0, sy = 0, dx = 0, decided = false, paging = false, body = null;
  detail.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || e.target.closest('input, textarea, [contenteditable]')) { body = null; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    dx = 0; decided = false; paging = false;
    body = detail.querySelector('.d-body');
  }, { passive: true });
  detail.addEventListener('touchmove', (e) => {
    if (!body || e.touches.length !== 1) return;
    const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
    if (!decided) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      decided = true;
      paging = Math.abs(mx) > Math.abs(my) * 1.3;
      if (paging) body.style.transition = 'none';
    }
    if (!paging) return;
    dx = mx;
    body.style.transform = `translateX(${dx}px)`;
    body.style.opacity = String(1 - Math.min(Math.abs(dx) / 500, 0.35));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  detail.addEventListener('touchend', () => {
    if (!paging) return;
    paging = false;
    const w = body.clientWidth || 320;
    const commit = Math.abs(dx) > Math.min(80, w * 0.25);
    if (!commit) {
      body.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      body.style.transform = ''; body.style.opacity = '';
      return;
    }
    const dir = dx < 0 ? 1 : -1; // swipe left → next
    body.style.transition = 'transform 0.16s ease, opacity 0.16s ease';
    body.style.transform = `translateX(${dir < 0 ? w : -w}px)`;
    body.style.opacity = '0';
    setTimeout(() => {
      step(dir); // rebuilds detail.innerHTML → a fresh .d-body
      const nb = detail.querySelector('.d-body');
      if (!nb) return;
      nb.style.transition = 'none';
      nb.style.transform = `translateX(${dir < 0 ? -w : w}px)`;
      nb.style.opacity = '0';
      requestAnimationFrame(() => {
        nb.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        nb.style.transform = ''; nb.style.opacity = '';
      });
    }, 150);
  });
})();

function renderDetail(dayId, idx) {
  const day = byId[dayId];
  const stop = day.stops[idx];
  const ds = daySplit(day);
  const seq = stop.isBase ? 'home base' : `${seqNumber(day, idx)} / ${nonBaseCount(day)}`;
  const conflict = stop.conflict ? `<div class="sheet-conflict">${ICON.warn}<span>${esc(stop.conflict)}</span></div>` : '';
  const imgs = galleryFor(stop);
  const loadingPhoto = wantsPhoto(stop) && !noPhotoFound(stop);
  const hero = imgs.length
    ? `<button class="d-hero" type="button">
         <img src="${esc(bigImg(imgs[0]))}" data-fb="${esc(imgs[0])}" alt="${esc(stop.name)}" decoding="async" onerror="if(this.src!==this.dataset.fb)this.src=this.dataset.fb">
         ${imgs.length > 1 ? `<span class="d-hero-badge">${ICON.photo}<span>${imgs.length}</span></span>` : ''}
       </button>`
    : (loadingPhoto ? '' : `<div class="d-hero d-hero-icon" style="--c:${day.color}">${stopCatIcon(stop)}</div>`);
  detail.innerHTML = `
    <div class="d-header">
      <div class="d-grab"></div>
      <button class="d-close" type="button" id="d-close" aria-label="Close">${ICON.close}</button>
    </div>
    <div class="d-body">
      ${hero}
      <div class="d-pad">
        <div class="d-eyebrow" style="color:${day.color}">
          <span class="d-day">${hasCat(stop) ? `<span class="d-tag">${stopCatIcon(stop)}</span>` : ''}${esc(ds.date.toUpperCase())} · ${esc(seq.toUpperCase())}${stop.time ? ' · ' + esc(stop.time) : ''}</span>
          ${ds.title ? `<span class="d-daytitle">${esc(ds.title)}</span>` : ''}
        </div>
        <div class="d-name">${esc(stop.name)}</div>
        ${conflict}
        <div class="d-note">${esc(stop.note)}</div>
      </div>
    </div>
    <div class="d-bar">
      <a class="btn-primary d-maps" target="_blank" rel="noopener" href="${mapsUrl(stop)}">${ICON.pin}Open in Maps</a>
    </div>`;
  detail.querySelector('#d-close').addEventListener('click', closeDetail);
  const heroBtn = detail.querySelector('.d-hero');
  if (heroBtn) heroBtn.addEventListener('click', () => openLightbox(imgs, 0));
  if (!imgs.length && loadingPhoto) ensureImages(stop);
}

function openDetail(dayId, idx) {
  if (detail.hidden) showScrim();
  select(dayId, idx, { center: true, closer: true });
  renderDetail(dayId, idx);
  detail.hidden = false;
  requestAnimationFrame(() => detail.classList.add('is-open'));
  document.body.classList.add('detail-open');
}
function closeDetail() {
  if (!detail.classList.contains('is-open')) return;
  detail.classList.remove('is-open');
  hideScrim();
  document.body.classList.remove('detail-open');
}
detail.addEventListener('transitionend', (e) => {
  if (e.target === detail && !detail.classList.contains('is-open')) detail.hidden = true;
});

function step(delta) {
  if (!selected || !carouselStops.length) return;
  const pos = carouselStops.findIndex((p) => p.dayId === selected.dayId && p.idx === selected.idx);
  if (pos < 0) return;
  const n = carouselStops.length;
  const nx = carouselStops[(pos + delta + n) % n];
  select(nx.dayId, nx.idx, { center: true, closer: true });
}

map.on('click', () => { if (!detail.hidden) closeDetail(); });

// ── Day chips ─────────────────────────────────────────────────
const daybar = document.getElementById('daybar');

function buildChips() {
  const mk = (id, label, color) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.day = id;
    if (color) b.style.setProperty('--c', color);
    b.innerHTML = color ? `<span class="cdot"></span>${esc(label)}` : esc(label);
    b.addEventListener('click', () => showDay(id));
    return b;
  };
  daybar.appendChild(mk('all', 'All days', null));
  DATA.days.forEach((d) => daybar.appendChild(mk(d.id, isToday(d.id) ? `${d.label} · today` : d.label, d.color)));
}

function updateChips() {
  [...daybar.children].forEach((c) => {
    const on = c.dataset.day === activeDay;
    c.classList.toggle('is-active', on);
    c.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  });
}

// Two finished features kept out of the interface for now — see config.js.
// Nothing is removed: flip the flag and they're back, plans and all.
const showPlannerUI = () => window.SHOW_PLANNER_UI !== false;
const showLockShortcut = () => window.SHOW_LOCK_SHORTCUT !== false;

// ── List view ─────────────────────────────────────────────────
const listview = document.getElementById('listview');

// The group plan behind the map on screen: the one this itinerary came from,
// or else whichever plan this device last had open.
function activePlanId() {
  try {
    const lib = loadLibrary();
    const item = lib.items.find((i) => i.id === lib.activeId);
    if (item && item.planId) return item.planId;
    return localStorage.getItem('planner.last') || null;
  } catch (e) { return null; }
}

function buildList() {
  let html =
    `<div class="sheet-grab"></div>` +
    `<div class="lv-nav">` +
    `<button class="lv-navbtn" type="button" id="lv-share" aria-label="Share this map">${ICON.share}</button>` +
    `<button class="lv-navbtn" type="button" id="lv-close" aria-label="Close list">${ICON.close}</button>` +
    `</div>` +
    `<div class="lv-body"><button class="lv-title lv-switch" id="lv-switch" type="button" aria-haspopup="true" aria-label="Switch itinerary"><span>${esc(DATA.title)}</span><span class="lv-chev">${ICON.chevDown}</span></button>`;
  // Opening the list is what everyone does first, so the way back to the group
  // belongs here — not buried in the ⋯ menu next to the settings.
  const planId = showPlannerUI() ? activePlanId() : null;
  if (planId) {
    html += `<button class="lv-plan" type="button" id="lv-plan">${ICON.people}` +
      `<span><b>Plan with friends</b>Add ideas, vote, say when you’re there</span>${ICON.chevRight}</button>`;
  }
  DATA.days.forEach((d) => {
    const ds = daySplit(d);
    html += `<div class="lv-sec-h">${esc(ds.date.toUpperCase())}${ds.title ? ` — ${esc(ds.title)}` : ''}</div>`;
    // The day's narrative reads best here, where the day's stops are. Two lines
    // to begin with: it's written once and read once, and it shouldn't stand
    // between someone and the list they opened.
    if (d.intro) {
      html += `<div class="lv-introwrap"><p class="lv-intro is-clamped">${esc(d.intro)}</p>` +
        `<button class="lv-more" type="button" aria-expanded="false">Read more</button></div>`;
    }
    html += `<div class="lv-group" data-day="${d.id}">`;
    d.stops.forEach((s, i) => {
      const badge = s.isBase ? ICON.home : seqNumber(d, i);
      const warn = s.conflict ? `<span class="lv-warn">${ICON.warn}</span>` : '';
      html += `<div class="lv-row" data-day="${d.id}" data-idx="${i}">` +
        `<button class="lv-open" type="button" data-day="${d.id}" data-idx="${i}">` +
        `<span class="lv-num" style="background:${d.color}">${badge}</span>` +
        `<span class="lv-rname">${esc(s.name)}${warn}${s.time ? `<span class="lv-time">${esc(s.time)}</span>` : ''}</span>` +
        `</button>` +
        `<span class="lv-grip" aria-label="Drag to reorder" role="button">${ICON.grip}</span>` +
        `</div>`;
    });
    html += `</div>`;
  });
  html += `</div>`;
  listview.innerHTML = html;
  listview.querySelector('#lv-close').addEventListener('click', closeList);
  listview.querySelector('#lv-share').addEventListener('click', shareLink);
  listview.querySelector('#lv-switch').addEventListener('click', () => { closeList(); openLibrary(); });
  const planBtn = listview.querySelector('#lv-plan');
  if (planBtn) planBtn.addEventListener('click', () => {
    closeList();
    if (typeof openPlanner === 'function') openPlanner(activePlanId());
  });
  listview.querySelectorAll('.lv-open').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.day;
      const i = +b.dataset.idx;
      closeList();
      showDay(id);
      select(id, i, { center: true, closer: true });
    });
  });
  listview.querySelectorAll('.lv-introwrap').forEach((wrap) => {
    const text = wrap.querySelector('.lv-intro');
    const more = wrap.querySelector('.lv-more');
    more.addEventListener('click', () => {
      const open = text.classList.toggle('is-clamped');
      more.textContent = open ? 'Read more' : 'Less';
      more.setAttribute('aria-expanded', String(!open));
    });
  });
  listview.querySelectorAll('.lv-group').forEach((g) => enableReorder(g, g.dataset.day));
}

// Only offer "Read more" where there is more: two lines may be all there is.
// Has to run with the list ON SCREEN — a hidden element measures zero, and
// every button would quietly disappear.
function tuneIntros() {
  listview.querySelectorAll('.lv-introwrap').forEach((wrap) => {
    const text = wrap.querySelector('.lv-intro');
    const more = wrap.querySelector('.lv-more');
    if (!text || !more) return;
    more.hidden = text.scrollHeight - text.clientHeight < 4;
  });
}

// Recreate one day's pins after its stops are reordered (indices changed).
function rebuildDayMarkers(dayId) {
  const day = byId[dayId];
  const layer = dayLayers[dayId];
  layer.clearLayers();
  day.stops.forEach((_, i) => addStop(day, i, layer));
}

// Commit the list's DOM order back into the data, renumber, persist, re-pin.
function commitReorder(dayId, group) {
  const day = byId[dayId];
  const rows = Array.from(group.querySelectorAll('.lv-row'));
  const next = rows.map((r) => day.stops[+r.dataset.idx]);
  if (next.length !== day.stops.length || next.some((s) => !s)) { buildList(); return; }
  const changed = next.some((s, i) => s !== day.stops[i]);
  day.stops = next;
  rows.forEach((r, i) => {
    r.dataset.idx = i;
    const open = r.querySelector('.lv-open');
    if (open) open.dataset.idx = i;
    const num = r.querySelector('.lv-num');
    if (num) num.innerHTML = day.stops[i].isBase ? ICON.home : seqNumber(day, i);
  });
  if (!changed) return;
  selected = null; // indices shifted; next tap re-selects cleanly
  day.manual = true;               // hand-ordered from here on
  persistActive();
  rebuildDayMarkers(dayId);
  if (activeDay === dayId || activeDay === 'all') buildCarousel(activeDay);
}

// Commit a cross-day move: rebuild EVERY day's stops from the current DOM order
// (each row carries its original data-day/data-idx, so we can resolve the moved
// stop wherever it landed), then reassign, recolour, re-pin and re-render.
function commitMove() {
  const orig = {};
  DATA.days.forEach((d) => { orig[d.id] = d.stops; });
  const groups = Array.from(listview.querySelectorAll('.lv-group'));
  const next = {};
  let total = 0, ok = true;
  groups.forEach((g) => {
    const rows = Array.from(g.querySelectorAll('.lv-row'));
    next[g.dataset.day] = rows.map((r) => orig[r.dataset.day] && orig[r.dataset.day][+r.dataset.idx]);
    total += rows.length;
    if (next[g.dataset.day].some((s) => !s)) ok = false;
  });
  const origTotal = DATA.days.reduce((n, d) => n + d.stops.length, 0);
  if (!ok || total !== origTotal) { buildList(); return; } // safety: re-render from data
  DATA.days.forEach((d) => { if (next[d.id]) { d.stops = next[d.id]; d.manual = true; } });
  selected = null;
  persistActive();
  DATA.days.forEach((d) => rebuildDayMarkers(d.id));
  buildCarousel(activeDay);
  // buildList() replaces the scroll container, which would jump to the top —
  // preserve the reader's scroll position across the rebuild.
  const body = listview.querySelector('.lv-body');
  const top = body ? body.scrollTop : 0;
  buildList();
  const nbody = listview.querySelector('.lv-body');
  if (nbody) nbody.scrollTop = top;
}

// Touch drag-to-reorder; a stop can be dragged into another day's group too.
// Move/end listeners live on `document` for the duration of the drag, so they
// keep firing even after the row (and its grip) cross into another day's group.
function enableReorder(group, dayId) {
  group.querySelectorAll('.lv-grip').forEach((grip) => {
    grip.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      e.stopPropagation(); // keep the sheet's drag-to-dismiss out of it
      const dragRow = grip.closest('.lv-row');
      const originDay = dragRow.parentElement.dataset.day;
      const offsetY = e.touches[0].clientY - dragRow.getBoundingClientRect().top;
      dragRow.classList.add('lv-dragging');
      // let the lifted row escape every group's rounded clip (it can cross days)
      listview.querySelectorAll('.lv-group').forEach((g) => g.classList.add('lv-grabbing'));
      dragRow.style.pointerEvents = 'none'; // so elementFromPoint sees rows beneath
      document.body.style.userSelect = 'none';

      const move = (ev) => {
        ev.preventDefault();
        const y = ev.touches[0].clientY;
        const cx = dragRow.getBoundingClientRect().left + 20;
        const under = document.elementFromPoint(cx, y);
        const urow = under && under.closest && under.closest('.lv-row');
        if (urow && urow !== dragRow && urow.classList.contains('lv-row')) {
          const tg = urow.parentElement; // target day's group (may differ from origin)
          const r = urow.getBoundingClientRect();
          if (y < r.top + r.height / 2) tg.insertBefore(dragRow, urow);
          else tg.insertBefore(dragRow, urow.nextSibling);
        }
        dragRow.style.transform = '';
        const natTop = dragRow.getBoundingClientRect().top;
        dragRow.style.transform = `translateY(${y - offsetY - natTop}px)`;
      };
      const end = () => {
        document.removeEventListener('touchmove', move);
        document.removeEventListener('touchend', end);
        document.removeEventListener('touchcancel', end);
        dragRow.style.transform = '';
        dragRow.style.pointerEvents = '';
        dragRow.classList.remove('lv-dragging');
        listview.querySelectorAll('.lv-group').forEach((g) => g.classList.remove('lv-grabbing'));
        document.body.style.userSelect = '';
        const toGroup = dragRow.parentElement;
        const toDay = toGroup && toGroup.dataset.day;
        if (toDay && toDay !== originDay) commitMove();        // moved to another day
        else commitReorder(originDay, toGroup);                // reordered within the day
      };
      document.addEventListener('touchmove', move, { passive: false });
      document.addEventListener('touchend', end);
      document.addEventListener('touchcancel', end);
    }, { passive: false });
  });
}

function openList() {
  if (listview.hidden) showScrim();
  listview.hidden = false;
  requestAnimationFrame(() => {
    listview.classList.add('is-open');
    tuneIntros();          // measurable only now that it is on screen
  });
}
function closeList() {
  if (!listview.classList.contains('is-open')) return;
  listview.classList.remove('is-open');
  hideScrim();
}
listview.addEventListener('transitionend', () => {
  if (!listview.classList.contains('is-open')) listview.hidden = true;
});
makeSheetDismissable(listview, { scrollSel: '.lv-body', onClose: closeList });

// ── Itinerary library sheet (switch / add / delete saved trips) ──
const libraryview = document.getElementById('libraryview');
function buildLibrary() {
  const lib = loadLibrary();
  const activeId = lib.activeId || DEMO_ID;
  const rows = [{ id: DEMO_ID, name: TRIP.title, sub: TRIP.subtitle, demo: true }]
    .concat(lib.items.map((it) => ({ id: it.id, name: it.name, sub: it.sub })));
  let html =
    `<div class="sheet-grab"></div>` +
    `<div class="lv-nav"><button class="lv-navbtn" type="button" id="lib-close" aria-label="Close">${ICON.close}</button></div>` +
    `<div class="lv-body"><h1 class="lv-title">My itineraries</h1><div class="lv-group">`;
  rows.forEach((r) => {
    const on = r.id === activeId;
    const sub = (r.sub ? esc(r.sub) : '') + (r.demo ? (r.sub ? ' · sample' : 'sample') : '');
    html +=
      `<div class="lib-row${on ? ' is-active' : ''}">` +
      `<button class="lib-pick" type="button" data-id="${esc(r.id)}">` +
      `<span class="lib-check">${on ? ICON.check : ''}</span>` +
      `<span class="lib-meta"><span class="lib-name">${esc(r.name)}</span>${sub ? `<span class="lib-sub">${sub}</span>` : ''}</span>` +
      `</button>` +
      (r.demo ? '' : `<button class="lib-del" type="button" data-id="${esc(r.id)}" aria-label="Delete">${ICON.trash}</button>`) +
      `</div>`;
  });
  html += `</div><button class="imp-go" type="button" id="lib-new"><span class="ig-ic">${ICON.magic}</span>Create an itinerary</button>` +
    `<button class="lib-paste" type="button" id="lib-paste">Received a shared link? Paste it here</button></div>`;
  libraryview.innerHTML = html;
  libraryview.querySelector('#lib-close').addEventListener('click', closeLibrary);
  libraryview.querySelector('#lib-new').addEventListener('click', () => { closeLibrary(); openImport(); });
  libraryview.querySelector('#lib-paste').addEventListener('click', () => { closeLibrary(); openImport(true); });
  libraryview.querySelectorAll('.lib-pick').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (id === activeId) { closeLibrary(); return; }
      switchItinerary(id);
    })
  );
  libraryview.querySelectorAll('.lib-del').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteItinerary(b.dataset.id); // reloads if it was active; otherwise:
      buildLibrary();
    })
  );
}
function openLibrary() {
  buildLibrary();
  if (libraryview.hidden) showScrim();
  libraryview.hidden = false;
  requestAnimationFrame(() => libraryview.classList.add('is-open'));
}
function closeLibrary() {
  if (!libraryview.classList.contains('is-open')) return;
  libraryview.classList.remove('is-open');
  hideScrim();
}
libraryview.addEventListener('transitionend', () => {
  if (!libraryview.classList.contains('is-open')) libraryview.hidden = true;
});
makeSheetDismissable(libraryview, { scrollSel: '.lv-body', onClose: closeLibrary });

// ── Lightbox (swipeable + pinch/double-tap zoom) ──────────────
const lightbox = document.getElementById('lightbox');
const creditCache = {};

// Fetch the photographer + licence for a Commons image (for full-screen credit).
async function fetchCredit(thumbUrl) {
  const file = decodeURIComponent(filePage(thumbUrl).split('File:')[1] || '');
  if (!file) return 'Wikimedia Commons';
  if (creditCache[file]) return creditCache[file];
  try {
    const r = await fetch(
      `https://commons.wikimedia.org/w/api.php?origin=*&format=json&action=query&prop=imageinfo&iiprop=extmetadata&titles=File:${encodeURIComponent(file)}`
    );
    const p = Object.values((((await r.json()) || {}).query || {}).pages || {})[0];
    const m = (p && p.imageinfo && p.imageinfo[0] && p.imageinfo[0].extmetadata) || {};
    const artist = m.Artist ? m.Artist.value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
    const lic = m.LicenseShortName ? m.LicenseShortName.value : '';
    const txt = (artist ? '© ' + artist : 'Wikimedia Commons') + (lic ? ' · ' + lic : '');
    creditCache[file] = txt;
    return txt;
  } catch (e) {
    return 'Wikimedia Commons';
  }
}

function updateLb(imgs, i) {
  i = Math.max(0, Math.min(imgs.length - 1, i));
  lightbox.querySelector('.lb-count').textContent = `${i + 1} / ${imgs.length}`;
  const src = lightbox.querySelector('.lb-source');
  src.href = filePage(imgs[i]);
  src.textContent = 'Wikimedia Commons';
  fetchCredit(imgs[i]).then((t) => {
    if (!lightbox.hidden) src.textContent = t;
  });
}

// Single on-screen image, swapped on swipe. There is deliberately NO horizontal
// scroll container: iOS mis-rasterizes off-screen slides in a scroll backing
// into a top strip (confirmed on-device — correct box, fully decoded, still
// striped). One always-on-screen <img> is never pre-rendered off-screen.
function openLightbox(imgs, index) {
  if (!imgs || !imgs.length) return;
  let cur = Math.max(0, Math.min(imgs.length - 1, index));
  lightbox.innerHTML =
    `<div class="lb-head"><div class="lb-grab"></div>` +
    `<div class="lb-bar">` +
    `<span class="lb-count"></span>` +
    `<a class="lb-source" target="_blank" rel="noopener">Source</a>` +
    `<button class="lb-close" type="button" aria-label="Close">${ICON.close}</button>` +
    `</div></div>` +
    `<div class="lb-stage"><img class="lb-img" alt="" draggable="false"></div>`;
  lightbox.hidden = false;
  void lightbox.offsetHeight;
  document.body.classList.add('lb-open');
  if (!detail.hidden) detail.classList.add('is-stacked');
  requestAnimationFrame(() => lightbox.classList.add('is-open'));

  const stage = lightbox.querySelector('.lb-stage');
  const img = lightbox.querySelector('.lb-img');
  const zoom = makeZoomable(img, stage);
  img.addEventListener('error', () => { if (img.src !== img.dataset.fb) img.src = img.dataset.fb; });

  function show(i, dir) {
    cur = (i + imgs.length) % imgs.length;
    if (zoom) zoom.reset();
    img.dataset.fb = imgs[cur];
    // Keep the image hidden until the NEW bitmap is actually decoded, then
    // update the metadata and reveal together — otherwise the browser keeps
    // painting the previous photo's pixels (until the new src decodes) under
    // the next photo's count/credit for a few ms.
    img.style.opacity = '0';
    const reveal = () => {
      updateLb(imgs, cur);
      if (dir) {
        img.style.transition = 'none';
        img.style.transform = `translateX(${dir > 0 ? 64 : -64}px)`;
        requestAnimationFrame(() => {
          img.style.transition = 'transform .18s ease, opacity .18s ease';
          img.style.transform = '';
          img.style.opacity = '';
        });
      } else {
        img.style.transition = 'opacity .18s ease';
        img.style.opacity = '';
      }
    };
    img.onload = null;
    img.src = bigImg(imgs[cur]);
    if (img.decode) img.decode().then(reveal).catch(reveal);
    else if (img.complete && img.naturalWidth) reveal();
    else img.onload = reveal;
  }

  lightbox.querySelector('.lb-close').addEventListener('click', closeLightbox);
  makeSheetDismissable(lightbox, {
    scrollSel: '.lb-stage',
    guard: () => !zoom.isZoomed(),
    onClose: closeLightbox,
  });

  // Horizontal swipe → page (single image swapped in place).
  let sx = 0, sy = 0, dx = 0, decided = false, paging = false;
  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || zoom.isZoomed()) { paging = false; return; }
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; decided = false; paging = false;
  }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1 || zoom.isZoomed()) return;
    const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
    if (!decided) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      decided = true;
      paging = Math.abs(mx) > Math.abs(my) * 1.3;
      if (paging) img.style.transition = 'none';
    }
    if (!paging) return;
    dx = mx;
    img.style.transform = `translateX(${dx}px)`;
    img.style.opacity = String(1 - Math.min(Math.abs(dx) / 500, 0.4));
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  stage.addEventListener('touchend', () => {
    if (!paging) return;
    paging = false;
    const w = stage.clientWidth || 320;
    if (imgs.length > 1 && Math.abs(dx) > Math.min(80, w * 0.25)) {
      const dir = dx < 0 ? 1 : -1; // swipe left → next
      img.style.transition = 'transform .16s ease, opacity .16s ease';
      img.style.transform = `translateX(${dir > 0 ? -w : w}px)`;
      img.style.opacity = '0';
      setTimeout(() => show(cur + dir, dir), 150);
    } else {
      img.style.transition = 'transform .2s ease, opacity .2s ease';
      img.style.transform = '';
      img.style.opacity = '';
    }
  });

  show(cur);
}

function closeLightbox() {
  lightbox.classList.remove('is-open');
  detail.classList.remove('is-stacked');
}
lightbox.addEventListener('transitionend', (e) => {
  if (e.target === lightbox && !lightbox.classList.contains('is-open')) {
    lightbox.hidden = true;
    lightbox.innerHTML = '';
    document.body.classList.remove('lb-open');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
});

function pinchDist(t) {
  return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
}

// Per-image pinch-to-zoom + pan. While zoomed, the track stops swiping so
// one-finger drags pan the image instead of paging.
function makeZoomable(img, track) {
  let scale = 1, tx = 0, ty = 0;
  let startDist = 0, startScale = 1;
  let panX = 0, panY = 0, startTx = 0, startTy = 0;
  let lastTap = 0;
  const apply = () => { img.style.willChange = 'transform'; img.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`; };
  const reset = () => { scale = 1; tx = 0; ty = 0; img.style.transform = ''; img.style.willChange = ''; track.classList.remove('lb-zoomed'); };

  img.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      startDist = pinchDist(e.touches);
      startScale = scale;
      track.classList.add('lb-zoomed');
      e.preventDefault();
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTap < 300) {
        e.preventDefault();
        if (scale > 1) reset();
        else { scale = 2.5; track.classList.add('lb-zoomed'); apply(); }
      }
      lastTap = now;
      if (scale > 1) {
        panX = e.touches[0].clientX; panY = e.touches[0].clientY;
        startTx = tx; startTy = ty;
      }
    }
  }, { passive: false });

  img.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      scale = Math.min(5, Math.max(1, (startScale * pinchDist(e.touches)) / startDist));
      track.classList.add('lb-zoomed');
      apply();
    } else if (e.touches.length === 1 && scale > 1) {
      e.preventDefault();
      tx = startTx + (e.touches[0].clientX - panX);
      ty = startTy + (e.touches[0].clientY - panY);
      apply();
    }
  }, { passive: false });

  img.addEventListener('touchend', () => {
    if (scale <= 1.02) reset();
  });

  return { reset, isZoomed: () => scale > 1.02 };
}

// ── Import screen ("make your own") ───────────────────────────
const importscreen = document.getElementById('importscreen');
const hasSaved = () => {
  try { return loadLibrary().activeId !== DEMO_ID; } catch (e) { return false; }
};

function selectFallback(ta) {
  if (ta) { ta.focus(); ta.select(); try { document.execCommand('copy'); } catch (e) {} }
}
function copyText(text, ta) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => selectFallback(ta));
  } else selectFallback(ta);
}

function buildImport() {
  importscreen.innerHTML =
    `<div class="sheet-grab"></div>` +
    `<div class="imp-head"><span>Create an itinerary</span>` +
    `<button class="lv-navbtn" type="button" id="imp-close" aria-label="Close">${ICON.close}</button></div>` +
    `<div class="imp-body">` +
    `<p class="imp-lead">Three steps turn a trip you planned with an AI assistant into an interactive itinerary, saved on your phone. Nothing is uploaded.</p>` +
    // Step 1 — plan
    `<div class="imp-step"><div class="imp-step-h"><span><b>1</b> Plan your trip with an AI assistant</span></div>` +
    `<p class="imp-hint">Open ChatGPT, Claude or Gemini and ask it to plan your trip using your preferred language.</p></div>` +
    // Step 2 — copy prompt (prompt itself collapsed by default)
    `<div class="imp-step"><div class="imp-step-h"><span><b>2</b> Copy this prompt into that same chat</span>` +
    `<button class="imp-copy" type="button" id="imp-copy">Copy</button></div>` +
    `<p class="imp-hint">It tells the AI to format your plan so this app can read it.</p>` +
    `<button class="imp-reveal" type="button" id="imp-reveal" aria-expanded="false">Show the prompt</button>` +
    `<textarea class="imp-prompt is-collapsed" id="imp-prompt" readonly></textarea></div>` +
    // Step 3 — paste reply
    `<div class="imp-step"><div class="imp-step-h"><span><b>3</b> Paste the AI’s reply back here</span></div>` +
    `<textarea class="imp-input" id="imp-input" placeholder="Paste the AI’s full reply — or any Promptrip link: a shared trip, or your group plan…"></textarea>` +
    `<div class="imp-error" id="imp-error" role="alert"></div></div>` +
    `<button class="imp-go" type="button" id="imp-go"><span class="ig-ic">${ICON.magic}</span>Create an itinerary</button>` +
    (hasSaved() ? `<button class="imp-link" type="button" id="imp-demo">Reset to the sample itinerary</button>` : '') +
    `</div>`;
  importscreen.querySelector('#imp-prompt').value = PROMPT;
  importscreen.querySelector('#imp-close').addEventListener('click', closeImport);
  importscreen.querySelector('#imp-copy').addEventListener('click', (e) => {
    copyText(PROMPT, importscreen.querySelector('#imp-prompt'));
    e.target.textContent = 'Copied ✓';
    setTimeout(() => (e.target.textContent = 'Copy'), 1600);
  });
  const reveal = importscreen.querySelector('#imp-reveal');
  const promptEl = importscreen.querySelector('#imp-prompt');
  reveal.addEventListener('click', () => {
    const collapsed = promptEl.classList.toggle('is-collapsed');
    reveal.textContent = collapsed ? 'Show the prompt' : 'Hide the prompt';
    reveal.setAttribute('aria-expanded', String(!collapsed));
  });
  importscreen.querySelector('#imp-go').addEventListener('click', doImport);
  const demo = importscreen.querySelector('#imp-demo');
  if (demo) demo.addEventListener('click', () => switchItinerary(DEMO_ID));
}

function doImport() {
  const errEl = importscreen.querySelector('#imp-error');
  errEl.textContent = '';
  const raw = importscreen.querySelector('#imp-input').value;
  // A pasted share LINK works here too. This matters on iOS: links can never
  // open an installed home-screen web app (and its storage is separate from
  // Safari's), so the only way to get a shared trip into the installed app is
  // to bring the link to the app — copy it, open the app, paste it here.
  // A group-plan link brings the whole plan in — the ideas AND the map the
  // group has already built — which is how the installed app joins a trip it
  // was never able to receive by tapping a link.
  // A short trip link: fetch that trip and open it.
  const gt = raw.match(/#t=([a-z0-9]{6,24})\b/i);
  if (gt) {
    errEl.textContent = 'Fetching that trip…';
    closeImport();
    openSharedTrip(gt[1]);
    return;
  }
  const gp = raw.match(/#p=([a-z0-9]{6,24})\b/i);
  if (gp && typeof openPlanner === 'function') {
    closeImport();
    openPlanner(gp[1]);
    return;
  }
  const gi = raw.match(/#g=([\w-]{1,40})\/([a-f0-9]{8,64})/);
  if (gi) {
    errEl.textContent = 'Fetching the shared itinerary…';
    fetch('https://gist.githubusercontent.com/' + gi[1] + '/' + gi[2] + '/raw')
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((data) => finishImport(normalizeItinerary(data)))
      .catch(() => { errEl.textContent = 'Couldn’t fetch that shared link — check your connection and try again.'; });
    return;
  }
  try {
    const li = raw.match(/#i=([A-Za-z0-9+\-$]{16,})/);
    const data = li && typeof LZString !== 'undefined'
      ? normalizeItinerary(JSON.parse(LZString.decompressFromEncodedURIComponent(li[1])))
      : parseItinerary(raw);
    finishImport(data);
  } catch (e) {
    errEl.textContent = e.message || 'Something went wrong reading that.';
  }
}

const sameTitle = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

async function finishImport(data) {
  // Set when the briefing was handed over from a group plan (see planner.js).
  let fromPlan = null;
  try { fromPlan = sessionStorage.getItem('pt_import_plan'); sessionStorage.removeItem('pt_import_plan'); } catch (e) {}
  const raw = JSON.stringify(data);
  // A new reply for a trip already here (same title) is an update to it, not a
  // second copy — so a link already shared keeps pointing at the right trip.
  // Rename the trip in the AI's reply to keep the old one alongside it.
  const twin = loadLibrary().items.find((i) => sameTitle(i.name, data.title));
  const id = addItinerary(data, true, { planId: fromPlan || undefined, rev: revOf(raw), replaceId: twin ? twin.id : undefined });
  // Already shared? Put the new version behind the same link, so everyone who
  // has it sees this one.
  const item = loadLibrary().items.find((i) => i.id === id);
  if (item && item.shareId && window.tripShare && window.tripShare.available()) {
    try {
      await window.tripShare.publish(raw, data.title, item.shareId);
      const lib = loadLibrary();
      const it = lib.items.find((i) => i.id === id);
      if (it) { it.sharedRev = revOf(raw); saveLibrary(lib); }
      try { sessionStorage.setItem('pt_import_note', 'Updated — the link you shared now opens this version'); } catch (e) {}
    } catch (e) {
      try { sessionStorage.setItem('pt_import_note', 'Updated here, but the shared link still has the old version — try Share again'); } catch (e) {}
    }
  } else if (twin) {
    try { sessionStorage.setItem('pt_import_note', 'Updated “' + (data.title || 'your trip') + '”'); } catch (e) {}
  }
  // Nudge first-time installers once the map reloads (see init). Skipped for
  // anyone already running the installed app.
  try { if (!isStandalone()) sessionStorage.setItem('pt_just_imported', '1'); } catch (e) {}
  // Put the finished map back into the plan, so everyone else's link carries it
  // too — no importing, no passing JSON around the group.
  if (fromPlan && typeof window.publishPlanItinerary === 'function') {
    try {
      toast('Sharing the map with the group…');
      await Promise.race([window.publishPlanItinerary(fromPlan, raw), new Promise((r) => setTimeout(r, 6000))]);
    } catch (e) { /* the map is saved here regardless */ }
  }
  location.hash = '';
  location.reload();
}

// The opening class lands on the next frame, so the sheet animates in. A close
// asked for before that frame used to be ignored — and the pending frame then
// opened the sheet right back up. Cancel it instead.
let importRaf = null;
function openImport(focusPaste) {
  if (importscreen.hidden) showScrim();
  importscreen.hidden = false;
  importRaf = requestAnimationFrame(() => {
    importRaf = null;
    importscreen.classList.add('is-open');
    if (focusPaste) {
      // Arriving with a link in hand — skip the AI-prompt steps and land on
      // the paste box.
      const inp = importscreen.querySelector('#imp-input');
      inp.scrollIntoView({ block: 'center' });
      inp.focus();
    }
  });
}
function closeImport() {
  if (importRaf) { cancelAnimationFrame(importRaf); importRaf = null; }
  if (!importscreen.classList.contains('is-open')) { importscreen.hidden = true; hideScrim(); return; }
  importscreen.classList.remove('is-open');
  hideScrim();
}
importscreen.addEventListener('transitionend', () => {
  if (!importscreen.classList.contains('is-open')) importscreen.hidden = true;
});
// Drag-to-dismiss once the body is scrolled to its top; gestures that begin on
// a textarea are ignored so text selection still works.
makeSheetDismissable(importscreen, { scrollSel: '.imp-body', onClose: closeImport });

// ── Share ─────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// A share link must open for the RECIPIENT, so it can never be minted against
// a private origin (localhost, LAN IPs, file:) — those links die outside this
// machine. Fall back to the app's public URL (the og:url meta) in that case.
function shareBase() {
  const here = location.origin + location.pathname;
  const priv = location.protocol === 'file:' ||
    /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$)/.test(location.hostname);
  if (!priv) return here;
  const og = document.querySelector('meta[property="og:url"]');
  return (og && og.content) || here;
}

function longShareUrl() {
  if (typeof LZString === 'undefined') return null;
  return shareBase() + '#i=' + LZString.compressToEncodedURIComponent(JSON.stringify(DATA));
}
function sendLink(url, note) {
  if (navigator.share) {
    navigator.share({ title: DATA.title, url }).then(() => toast(note)).catch(() => {});
  } else {
    copyText(url);
    toast('Link copied — ' + note);
  }
}
// The whole trip used to travel inside the URL, which makes a link thousands of
// characters long — and anything that trims a link (a chat preview, a mail
// client) leaves a stub that can't be read back. A published trip gets a short
// link instead: the map lives under an id, and the same link keeps working when
// the trip is updated. No Firebase configured? The long link still works.
let sharing = false;
async function shareLink() {
  if (sharing) return;
  const item = activeItem();
  if (!item || !window.tripShare || !window.tripShare.available()) {
    const url = longShareUrl();
    if (url) sendLink(url, 'the whole trip travels inside that link');
    return;
  }
  sharing = true;
  toast('Making a link…');
  try {
    const raw = JSON.stringify(DATA);
    const id = await window.tripShare.publish(raw, DATA.title, item.shareId);
    const lib = loadLibrary();
    const it = lib.items.find((i) => i.id === item.id);
    if (it) { it.shareId = id; it.sharedRev = revOf(raw); saveLibrary(lib); }
    sendLink(shareBase() + '#t=' + id,
      item.shareId ? 'the link you already shared now opens this version' : 'anyone can open it, and it follows your updates');
  } catch (e) {
    // Falling back without a word is how a long link turns up unexplained —
    // say which wall we hit, because the two need different fixes.
    const denied = e && (e.code === 'permission-denied' || /permission/i.test(e.message || ''));
    const url = longShareUrl();
    if (!url) { toast('Couldn’t make a link — try again'); return; }
    sendLink(url, denied
      ? 'short links aren’t switched on for this app yet, so this one carries the whole trip — long links can get cut short in chat'
      : 'couldn’t reach the server, so this one carries the whole trip — long links can get cut short in chat');
  } finally { sharing = false; }
}
// The library entry behind the map on screen (the demo has none).
function activeItem() {
  try {
    const lib = loadLibrary();
    return lib.items.find((i) => i.id === lib.activeId) || null;
  } catch (e) { return null; }
}

// ── Lock-screen shortcut ──────────────────────────────────────
// One persistent notification that reopens the app — a fast lock-screen → map
// shortcut. Where it opens follows "Option C": on a dated trip → today's
// last-viewed stop (else today's first); otherwise → wherever you last were
// (else the first stop). No stop-sequencing UI.
const SHORTCUT_KEY = 'lockshortcut.v1';
let shortcutOn = false;

const stopRef = (ref) => (ref && byId[ref.dayId] && byId[ref.dayId].stops[ref.idx]) || null;

function resolveOpenTarget() {
  const today = DATA.days.find((d) => d.date === TODAY);
  const lv = stopRef(lastViewed) ? lastViewed : null;
  if (today) {
    if (lv && lv.dayId === today.id) return lv; // resume today's last-viewed stop
    return { dayId: today.id, idx: 0 }; // else today's first stop
  }
  return lv || { dayId: DATA.days[0].id, idx: 0 }; // no "today" → resume, else first
}

function goToStop(dayId, idx) {
  if (activeDay !== 'all' && activeDay !== dayId) showDay(dayId);
  select(dayId, idx, { center: true });
}

function updateLockUI() {
  if (menu && !menu.hidden) buildMenu();
}

async function showShortcutNotification() {
  if (!shortcutOn || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const t = resolveOpenTarget();
    const day = byId[t.dayId];
    const body = day.label + ' · ' + day.stops[t.idx].name;
    // Already showing this exact reminder? Don't re-fire (avoids repeated alerts).
    const existing = await reg.getNotifications({ tag: 'open-shortcut' });
    if (existing.some((n) => n.body === body)) return;
    await reg.showNotification(DATA.title, {
      body,
      tag: 'open-shortcut',
      renotify: false,
      silent: true,
      requireInteraction: true,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
    });
  } catch (e) {}
}
function clearShortcutNotification() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready
    .then((reg) => reg.getNotifications({ tag: 'open-shortcut' }))
    .then((ns) => ns.forEach((n) => n.close()))
    .catch(() => {});
}

async function toggleShortcut() {
  if (shortcutOn) {
    shortcutOn = false;
    try { localStorage.setItem(SHORTCUT_KEY, '0'); } catch (e) {}
    clearShortcutNotification();
    updateLockUI();
    return;
  }
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  shortcutOn = true;
  try { localStorage.setItem(SHORTCUT_KEY, '1'); } catch (e) {}
  updateLockUI();
  if ('Notification' in window && Notification.permission === 'granted') showShortcutNotification();
  else toast('Add to Home Screen and allow notifications to keep a lock-screen shortcut');
}

// Leaving the app refreshes the notification so it points where you left off.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && shortcutOn && showLockShortcut()) showShortcutNotification();
});

// Tapping the notification → reopen the app on the resolved target.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'open-target') {
      const t = resolveOpenTarget();
      goToStop(t.dayId, t.idx);
    }
  });
}

// ── Install-to-home-screen helpers ────────────────────────────
// Android/desktop Chrome fire `beforeinstallprompt` → we capture it for a
// one-tap install. iOS Safari has no such API, so we show manual instructions.
let deferredInstall = null;
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  if (menu && !menu.hidden) buildMenu();
});
window.addEventListener('appinstalled', () => { deferredInstall = null; });
async function promptInstall() {
  const item = activeItem();
  // An installed app gets its own empty storage, so the icon can only open the
  // trip if the page being added points at it. Put the trip's link back in the
  // address bar first — that, and the manifest above, is what makes the icon
  // open this trip rather than the sample one.
  if (item && item.shareId) {
    tuneManifest();
    if (!location.hash) history.replaceState(null, '', location.pathname + location.search + '#t=' + item.shareId);
  }
  if (deferredInstall) {
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) {}
    deferredInstall = null;
    return;
  }
  if (item && !item.shareId && window.tripShare && window.tripShare.available()) {
    toast('Tap Share (⇪) first to give this trip a link — the installed app opens a link, not this browser’s storage.');
    return;
  }
  toast(isIOS()
    ? 'In Safari, tap the Share button, then “Add to Home Screen”.'
    : 'Open your browser menu, then “Install app” / “Add to Home screen”.');
}

// ── Controls wiring ───────────────────────────────────────────
// ⋯ menu — itinerary, saved itineraries, install, lock-screen, create new
const menuBtn = document.getElementById('menu-btn');
const menu = document.getElementById('menu');
menuBtn.innerHTML = ICON.dots;

// "View stops" — the active itinerary's own control, above the ⋯ menu.
const listBtn = document.getElementById('list-btn');
listBtn.innerHTML = ICON.stops;
listBtn.addEventListener('click', () => { closeMenu(); openList(); });

// ── Start something new: the button on the map, and its little menu ──
const createmenu = document.getElementById('createmenu');
const createwrap = document.getElementById('controls-create');
function buildCreateMenu() {
  // iOS convention: a chevron means "this goes somewhere that already exists".
  // A plan already tied to this map gets one; with no plan, the row says plainly
  // that it starts one.
  const joined = !!activePlanId();
  const rows = [
    { id: 'c-new', label: 'Create an itinerary', trail: ICON.magic },
    ...(!showPlannerUI() ? [] : [joined
      ? { id: 'c-plan', label: 'Plan with friends', sub: 'Add ideas, vote, see who’s there when', trail: ICON.chevRight, go: true }
      : { id: 'c-plan', label: 'Start a group plan', sub: 'One link, everyone adds ideas', trail: ICON.people }]),
  ];
  createmenu.innerHTML = rows.map((r) =>
    `<button class="menu-item" type="button" id="${r.id}" role="menuitem">` +
    `<span class="mi-label${r.sub ? ' mi-two' : ''}">${r.label}${r.sub ? `<span class="mi-sub">${r.sub}</span>` : ''}</span>` +
    `<span class="mi-trail${r.go ? ' mi-go' : ''}">${r.trail}</span></button>`).join('');
  createmenu.querySelector('#c-new').addEventListener('click', () => { closeCreate(); openImport(); });
  const plan = createmenu.querySelector('#c-plan');
  if (plan) plan.addEventListener('click', () => {
    closeCreate();
    if (typeof openPlanner === 'function') openPlanner(activePlanId() || undefined);
  });
}
const createBtn = document.getElementById('create-btn');
createBtn.innerHTML = ICON.plus;
function openCreate() {
  buildCreateMenu();
  createmenu.hidden = false;
  requestAnimationFrame(() => createmenu.classList.add('is-open'));
  createwrap.classList.add('is-open');
  createBtn.setAttribute('aria-expanded', 'true');
}
function closeCreate() {
  createmenu.classList.remove('is-open');
  createwrap.classList.remove('is-open');
  createBtn.setAttribute('aria-expanded', 'false');
}
createmenu.addEventListener('transitionend', () => { if (!createmenu.classList.contains('is-open')) createmenu.hidden = true; });
createBtn.addEventListener('click', (e) => { e.stopPropagation(); createmenu.hidden ? openCreate() : closeCreate(); });
document.addEventListener('click', (e) => {
  if (!createmenu.hidden && !createmenu.contains(e.target) && !createBtn.contains(e.target)) closeCreate();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !createmenu.hidden) closeCreate(); });

function buildMenu() {
  // The active itinerary is represented by its own "View stops" icon now, so the
  // menu is purely manage-itineraries + app utilities, split by a divider.
  // Making something new moved to the + on the map; what's left here is what
  // you do to the map you already have.
  const rows = [
    ...(showLockShortcut() ? [{ id: 'm-lock', label: 'Lock-screen shortcut', toggle: shortcutOn }] : []),
    ...(isStandalone() ? [] : [{ id: 'm-install', label: 'Add to Home Screen', trail: ICON.install }]),
    { id: 'm-feedback', label: 'Send feedback', trail: ICON.feedback },
    { foot: APP_VERSION + (isStandalone()
      ? ' · ' + (LAUNCH_HASH.match(/^#t=([a-z0-9]{6,24})$/i) ? 'opened trip ' + RegExp.$1 : 'opened with no trip link')
      : '') },
  ];
  menu.innerHTML = rows
    .map((r) => {
      if (r.sep) return '<div class="menu-sep" role="separator"></div>';
      if (r.foot) return `<div class="menu-foot">${r.foot}</div>`;
      if (r.head) return `<div class="menu-head${r.sec ? ' sec' : ''}">${r.head}</div>`;
      return (
        `<button class="menu-item" type="button" id="${r.id}" role="menuitem"${r.toggle !== undefined ? ` role="switch" aria-checked="${r.toggle}"` : ''}>` +
        `<span class="mi-label">${r.label}</span>` +
        `<span class="mi-trail">${r.toggle !== undefined ? `<span class="switch${r.toggle ? ' on' : ''}"></span>` : r.trail}</span>` +
        `</button>`
      );
    })
    .join('');
  const inst = menu.querySelector('#m-install');
  if (inst) inst.addEventListener('click', () => { closeMenu(); promptInstall(); });
  // Toggle in place — stop the click reaching the outside-click handler (which
  // would otherwise close the menu, since buildMenu() detaches this node).
  const lock = menu.querySelector('#m-lock');
  if (lock) lock.addEventListener('click', (e) => { e.stopPropagation(); toggleShortcut(); buildMenu(); });
  menu.querySelector('#m-feedback').addEventListener('click', () => { closeMenu(); window.open(FEEDBACK_URL, '_blank', 'noopener'); });
}
function openMenu() {
  buildMenu();
  menu.hidden = false;
  requestAnimationFrame(() => menu.classList.add('is-open'));
  menuBtn.classList.add('is-active');
  menuBtn.setAttribute('aria-expanded', 'true');
}
function closeMenu() {
  menu.classList.remove('is-open');
  menuBtn.classList.remove('is-active');
  menuBtn.setAttribute('aria-expanded', 'false');
}
menu.addEventListener('transitionend', () => { if (!menu.classList.contains('is-open')) menu.hidden = true; });
menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden ? openMenu() : closeMenu(); });
document.addEventListener('click', (e) => {
  if (!menu.hidden && !menu.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
});

const locateBtn = document.getElementById('locate');
locateBtn.innerHTML = ICON.locate;
let userMarker = null;
locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return;
  locateBtn.classList.add('is-active');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      if (!userMarker) {
        userMarker = L.marker(ll, {
          icon: L.divIcon({ className: '', html: '<div class="user-dot"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
          zIndexOffset: 2000,
        }).addTo(map);
      } else {
        userMarker.setLatLng(ll);
      }
      map.panTo(ll, { animate: true });
      locateBtn.classList.remove('is-active');
    },
    () => locateBtn.classList.remove('is-active'),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
});

// ── Init ──────────────────────────────────────────────────────
buildChips();
buildList();
buildImport();
try { shortcutOn = localStorage.getItem(SHORTCUT_KEY) === '1'; } catch (e) {}
// Hidden means off: clear a notification left over from when the feature was
// visible, so nothing lingers on a lock screen with no way to switch it off.
if (!showLockShortcut() && shortcutOn) {
  shortcutOn = false;
  try { localStorage.setItem(SHORTCUT_KEY, '0'); } catch (e) {}
  clearShortcutNotification();
}
try {
  const lv = JSON.parse(localStorage.getItem(LV_KEY) || 'null');
  if (lv && byId[lv.dayId] && byId[lv.dayId].stops[lv.idx]) lastViewed = lv;
} catch (e) {}
// A trip seen for the first time opens on its list: the map answers "where",
// the list answers "what is this trip" — which is the question on arrival.
// Recorded per itinerary, so it happens once and never again.
(() => {
  try {
    const lib = loadLibrary();
    const item = lib.items.find((i) => i.id === lib.activeId);
    if (!item || item.seenAt) return;
    item.seenAt = Date.now();
    saveLibrary(lib);
    setTimeout(() => { if (listview.hidden) openList(); }, 450);
  } catch (e) { /* never block the map over this */ }
})();

// Open on the whole trip. It used to open on today's day (or the last stop you
// looked at), which answers "where am I now?" — but on first sight of a trip
// the question is "what is this?", and a single day answers that badly.
showDay('all');
updateLockUI();
// Note: the shortcut notification is (re)shown only when you LEAVE the app
// (visibilitychange), not on every reopen — see showShortcutNotification.
if (location.hash === '#import') openImport();
// Just created an itinerary? Point out that it now lives on the phone like an
// app. Once, after the reload, and never for the already-installed app.
try {
  // Don't chase an update on the very launch that imported one.
  if (!location.hash) setTimeout(refreshSharedTrip, 1200);
  tuneManifest();
  // An installed app starts with its own empty storage — no link can reach it,
  // so the sample trip is all it has to show. Say how to bring a real one in
  // rather than leaving someone staring at a city they're not going to.
  if (isStandalone() && !hasSaved() && !LAUNCH_HASH) {
    // No trip, and the icon handed us nothing to fetch one with. A toast over
    // the sample trip is easy to miss and leads nowhere, so open the one screen
    // that can fix it, with the paste box ready.
    setTimeout(() => { openImport(true); toast('Paste your trip’s link here to bring it into the app'); }, 900);
  }
  const note = (() => { try { const n = sessionStorage.getItem('pt_import_note'); sessionStorage.removeItem('pt_import_note'); return n; } catch (e) { return null; } })();
  if (note) setTimeout(() => toast(note), 500);
  if (sessionStorage.getItem('pt_just_imported')) {
    sessionStorage.removeItem('pt_just_imported');
    if (!isStandalone()) {
      const isMobile = isIOS() || /android/i.test(navigator.userAgent);
      // On desktop the itinerary lives in this browser only, so the phone needs
      // the share link before it can be added to a Home Screen.
      const msg = isMobile
        ? 'Saved to your phone — add it to your Home Screen to open it like an app'
        : 'Saved on this device — share the link to your phone, then add it to your Home Screen to open it like an app';
      setTimeout(() => toast(msg), 700);
    }
  }
} catch (e) {}

// Snap an imported itinerary's pins to real OSM locations (once, in the
// background). Deferred so it never delays first paint or interaction.
setTimeout(geocodeActiveItinerary, 1500);

// A shared link tapped in an app that's already open changes only the hash, so
// nothing would happen without this — the itinerary routes otherwise run once,
// at startup. (planner.js listens for its own #p= / #plan the same way.)
window.addEventListener('hashchange', () => {
  const t = location.hash.match(/^#t=([a-z0-9]{6,24})$/i);
  if (t) { openSharedTrip(t[1]); return; }
  const i = location.hash.match(/^#i=(.+)$/);
  if (i) location.reload();     // the trip travels inside the URL: read it on a fresh start
});

// "Add to Home Screen" asks the manifest where the icon should open, and a
// static manifest can only say "the app". When the trip on screen has a link of
// its own, hand the browser a manifest that names THAT trip — so the icon opens
// it the first time, with nothing to paste. The static file stays as it is for
// everyone else (and as the fallback if a browser ignores this one).
function tuneManifest() {
  const link = document.querySelector('link[rel="manifest"]');
  const item = activeItem();
  const id = item && item.shareId;
  if (!link || !id || typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  // Relative paths in a blob: manifest have nothing to resolve against, so
  // every URL in here is absolute.
  const base = location.origin + location.pathname.replace(/index\.html$/, '');
  const icon = (src, purpose) => ({ src: base + src, sizes: purpose === 'any' ? '192x192' : '512x512', type: 'image/png', purpose });
  const m = {
    name: 'Promptrip', short_name: 'Promptrip',
    description: 'Turn any AI travel plan into an interactive map you own.',
    start_url: base + '#t=' + id,
    scope: base,
    display: 'standalone', orientation: 'portrait',
    background_color: '#faf9f5', theme_color: '#faf9f5',
    icons: [
      { src: base + 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: base + 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: base + 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(m)], { type: 'application/manifest+json' }));
    // Kept on the function, not in a module-level `let`: this runs during init,
    // which sits ABOVE this declaration — a `let` would still be in its dead
    // zone and throw, and the try around the init call would swallow it.
    if (tuneManifest.url) URL.revokeObjectURL(tuneManifest.url);
    tuneManifest.url = url;
    link.href = url;
  } catch (e) { /* the static manifest still applies */ }
}

// The cover's escape hatches: try the link again, or carry on into the app.
(() => {
  const retry = document.getElementById('op-retry');
  const skip = document.getElementById('op-skip');
  const id = (LAUNCH_HASH.match(/^#t=([a-z0-9]{6,24})$/i) || [])[1];
  if (retry) retry.addEventListener('click', () => {
    uncover('Opening the trip…');      // back to waiting: spinner, no buttons
    if (id) openSharedTrip(id);
  });
  if (skip) skip.addEventListener('click', () => uncover());
})();

// A shared trip follows the person who published it: on every launch, ask
// whether there's a newer version behind its link. This is what keeps an
// installed app — which no link can reach once it's on the Home Screen — from
// drifting out of date.
function refreshSharedTrip() {
  const item = activeItem();
  if (!item || !item.shareId || !window.tripShare || !window.tripShare.available()) return;
  window.tripShare.fetch(item.shareId).then((got) => {
    if (!got || !got.raw) return;
    adoptSharedTrip(item.shareId, got.raw, got.updatedAt);
  }).catch(() => {});   // offline: keep what we have, quietly
}

// ── PWA ───────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  // A new version takes over as soon as it installs (the worker calls
  // skipWaiting), but THIS page keeps running the old files until it reloads.
  // On a phone that can mean days of wondering why a fix hasn't arrived, so
  // reload once when the new worker takes the wheel. Only ever once, and never
  // on the very first install (there was no controller to change).
  const hadController = !!navigator.serviceWorker.controller;
  let swReloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || swReloaded) return;   // first install: nothing to refresh
    swReloaded = true;
    location.reload();
  });
  // Ask on every launch, so a version deployed while the app was closed lands.
  navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
}
