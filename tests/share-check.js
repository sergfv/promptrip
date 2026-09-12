/* Sharing a trip: a short link that anyone can open and that keeps up with the
   owner's updates. Runs on the LOCAL store (no network) — the live Firestore
   half is covered by tests/rules-check.js. */
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8006/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Waiting on a fixed sleep makes a flaky test out of a sound app: an import
// publishes, then reloads, and how long that takes is not ours to predict.
const until = async (p, fn, ms = 12000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await p.evaluate(fn)) return true; } catch (e) { /* mid-reload */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};
const setVal = (p, s, v) => p.evaluate((x, val) => { const e = document.querySelector(x); e.value = val; e.dispatchEvent(new Event('input', { bubbles: true })); }, s, v);

const trip = (title, stop) => ({
  title, subtitle: 'Málaga',
  days: [{ label: 'Fri 25', stops: [{ name: stop, time: '21:00', lat: 36.7215, lng: -4.4178 }] }],
});

async function newPage(b) {
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  await p.evaluateOnNewDocument(() => {
    Object.defineProperty(window, 'PLANNER_FIREBASE', { value: null, writable: false });
    window.TRIP_SHARE_LOCAL = true;          // the local store stands in for Firestore
    try {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        get: () => ({ register: () => Promise.reject(new Error('off')), ready: new Promise(() => {}), addEventListener() {}, controller: null }),
      });
    } catch (e) {}
  });
  return p;
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await newPage(b);
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await p.evaluate((t) => { localStorage.setItem('pt_landing_seen', '1'); addItinerary(normalizeItinerary(t), true); }, trip('Málaga 50s', 'Bodega El Pimpi'));
  await p.reload({ waitUntil: 'networkidle2' });
  await sleep(1000);

  // Share → a short link, not the whole trip packed into a URL.
  const shared = await p.evaluate(async () => {
    let sent = null;
    navigator.share = async (d) => { sent = d.url; };
    await shareLink();
    return { url: sent, item: JSON.parse(localStorage.getItem('library.v1')).items[0] };
  });
  ok(/#t=[a-z0-9]{6,24}$/i.test(shared.url || ''), 'sharing makes a short link → ' + (shared.url || 'NONE'));
  ok((shared.url || '').length < 80, 'short enough to survive any chat (' + (shared.url || '').length + ' chars)');
  ok(!!shared.item.shareId, 'and the trip remembers the link it was given');
  const shareId = shared.item.shareId;

  // What someone else sees: only what the link carries. Two pages in one
  // browser share storage, so "their device" is this one with its library
  // cleared — the published trip stays where it is, like a server would.
  // (Two genuinely separate identities are covered in tests/rules-check.js.)
  const asNewcomer = async (id) => {
    await p.evaluate(() => localStorage.removeItem('library.v1'));
    // A unique query forces a real page load: going to the same URL with only
    // the fragment changed is a no-op, not a visit.
    await p.goto(BASE + '?n=' + Date.now() + '#t=' + id, { waitUntil: 'networkidle2' });
    await sleep(2000);
    return p.evaluate(() => ({
      title: DATA.title, stop: DATA.days[0].stops[0].name, hash: location.hash,
      items: JSON.parse(localStorage.getItem('library.v1') || '{"items":[]}').items.length,
    }));
  };
  const opened = await asNewcomer(shareId);
  ok(opened.title === 'Málaga 50s' && opened.stop === 'Bodega El Pimpi',
     'the link opens that trip on a device that never had it → ' + opened.title + ' / ' + opened.stop);
  // The hash is deliberately kept: it is the whole address of the trip, and an
  // installed app has nothing else to go on.
  ok(opened.hash === '#t=' + shareId, 'and keeps the link in the URL → ' + opened.hash);
  ok(opened.items === 1, 'leaving one itinerary behind, not two');

  // The owner pastes a new reply for the same trip: same link, new version.
  await p.evaluate(() => openImport());
  await p.waitForSelector('#imp-input');
  await setVal(p, '#imp-input', JSON.stringify(trip('Málaga 50s', 'Mercado Atarazanas')));
  await p.evaluate(() => document.querySelector('#imp-go').click());
  await until(p, () => window.DATA && DATA.days[0].stops[0].name === 'Mercado Atarazanas');
  const after = await p.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('library.v1'));
    return { n: lib.items.length, shareId: lib.items[0].shareId, stop: DATA.days[0].stops[0].name };
  });
  ok(after.n === 1, 'a new reply for the same trip updates it, not duplicates it (' + after.n + ' itinerary)');
  ok(after.shareId === shareId, 'and keeps the link it already handed out');
  ok(after.stop === 'Mercado Atarazanas', 'the map on screen is the new version → ' + after.stop);

  // …and the same link, opened fresh, now carries the new version.
  const again = await asNewcomer(shareId);
  ok(again.stop === 'Mercado Atarazanas', 'the same link now opens the update → ' + again.stop);
  ok(again.items === 1, 'without collecting copies (' + again.items + ' itinerary)');

  // When the store refuses (rules not published, offline), the long link still
  // goes out — and says why, instead of turning up unexplained.
  const fallback = await p.evaluate(async () => {
    let sent = null, note = null;
    navigator.share = async (d) => { sent = d.url; };
    const real = window.tripShare.publish;
    window.tripShare.publish = async () => { const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; throw e; };
    const seen = [];
    const t = window.toast; window.toast = (m) => { seen.push(m); };
    await shareLink();
    window.toast = t; window.tripShare.publish = real;
    note = seen.join(' | ');
    return { sent, note };
  });
  ok(/#i=/.test(fallback.sent || ''), 'a refused publish still sends a working link → ' + (fallback.sent || '').slice(0, 44));
  ok(/aren’t switched on/.test(fallback.note || ''), 'and says why it is the long one → ' + (fallback.note || 'SILENT').slice(-60));

  // The link is what an installed app has to be given, so it must survive in
  // the URL — that's what "Add to Home Screen" captures — and be pasteable.
  await p.evaluate(() => localStorage.removeItem('library.v1'));
  await p.goto(BASE + '?n=' + Date.now() + '#t=' + shareId, { waitUntil: 'networkidle2' });
  await sleep(2200);
  ok(await p.evaluate(() => location.hash) === '#t=' + shareId,
     'the short link stays in the address bar, ready to be added to a Home Screen');
  ok(await p.evaluate(() => DATA.title) === 'Málaga 50s', 'and still opens the trip');

  // What "Add to Home Screen" is offered: a manifest that names this trip, so
  // the icon opens it the first time rather than the sample one.
  const man = await p.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    const href = link ? link.href : '';
    let body = null;
    try { body = await fetch(href).then((r) => r.json()); } catch (e) { body = { error: String(e) }; }
    return { blob: /^blob:/.test(href), start: body.start_url, scope: body.scope, icon: (body.icons || [])[0] && body.icons[0].src };
  });
  ok(man.blob, 'the page offers a manifest of its own once a trip has a link');
  ok((man.start || '').endsWith('#t=' + shareId), 'which opens this trip → ' + man.start);
  ok(/^http/.test(man.scope || '') && /^http/.test(man.icon || ''), 'with absolute paths, since a blob has nothing to resolve against');

  // Tapping "Add to Home Screen" puts the trip's link back in the address bar,
  // because that is what a browser without manifest support will capture.
  await p.evaluate(() => history.replaceState(null, '', location.pathname));
  // Fire and forget: awaiting it from here can outlive the page if the launch
  // refresh reloads underneath us.
  await p.evaluate(() => { promptInstall(); });
  await sleep(500);
  ok(await p.evaluate(() => location.hash) === '#t=' + shareId,
     'and the address bar points at the trip when you go to add it → ' + await p.evaluate(() => location.hash));

  // Pasting that link into the app is the other way in (an installed app can
  // never be reached by tapping a link).
  await p.evaluate(() => { localStorage.removeItem('library.v1'); });
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(600);
  await p.evaluate(() => openImport());
  await p.waitForSelector('#imp-input');
  await setVal(p, '#imp-input', 'https://sergfv.github.io/promptrip/#t=' + shareId);
  await p.evaluate(() => document.querySelector('#imp-go').click());
  await sleep(2500);
  ok(await p.evaluate(() => DATA.title) === 'Málaga 50s',
     'a pasted trip link brings the trip in → ' + await p.evaluate(() => DATA.title));

  // …and from then on it keeps itself up to date, with no link at all.
  await p.evaluate(async () => {
    const lib = JSON.parse(localStorage.getItem('library.v1'));
    const it = lib.items.find((i) => i.shareId);
    it.data.days[0].stops[0].name = 'Stale copy'; it.rev = 'stale:1'; it.savedAt = 1;
    localStorage.setItem('library.v1', JSON.stringify(lib));
  });
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await sleep(3000);
  ok(await p.evaluate(() => DATA.days[0].stops[0].name) === 'Mercado Atarazanas',
     'an out-of-date copy catches up on the next launch → ' + await p.evaluate(() => DATA.days[0].stops[0].name));

  // The manifest must not name a start_url of its own: with none, the page that
  // was added is where the icon opens, which is how #t=… survives being added.
  const staticManifest = await p.evaluate(() => fetch('manifest.webmanifest?probe=' + Date.now()).then((r) => r.json()));
  ok(!('start_url' in staticManifest),
     'the static manifest names no start_url, so the added page wins → ' + Object.keys(staticManifest).join(','));

  // An installed app that was handed nothing says so, where the version lives.
  const foot = await p.evaluate(() => {
    const real = window.matchMedia;
    window.matchMedia = (q) => (q === '(display-mode: standalone)' ? { matches: true } : real.call(window, q));
    buildMenu();
    const txt = document.querySelector('#menu .menu-foot').textContent.trim();
    window.matchMedia = real;
    buildMenu();
    return txt;
  });
  ok(/opened (trip [a-z0-9]+|with no trip link)/.test(foot), 'an installed app reports what its icon opened → ' + foot);

  // A trip renamed in the AI's reply stays a separate trip.
  await p.evaluate(() => openImport());
  await p.waitForSelector('#imp-input');
  await setVal(p, '#imp-input', JSON.stringify(trip('Málaga 50s — take two', 'Kelipe')));
  await p.evaluate(() => document.querySelector('#imp-go').click());
  await sleep(2000);
  const split = await p.evaluate(() => JSON.parse(localStorage.getItem('library.v1')).items.map((i) => i.name));
  ok(split.length === 2, 'a different title keeps both trips → ' + split.join(' / '));

  // Opening a link on a device that hasn't got the trip: a cover, not a flash
  // of the sample trip that then changes under you.
  await p.evaluate(() => localStorage.removeItem('library.v1'));
  await p.goto(BASE + '?n=' + Date.now() + '#t=' + shareId, { waitUntil: 'domcontentloaded' });
  const covered = await p.evaluate(() => ({
    up: document.documentElement.classList.contains('opening-trip'),
    shown: getComputedStyle(document.getElementById('opening')).display,
    says: (document.getElementById('op-msg') || {}).textContent,
    acts: getComputedStyle(document.getElementById('op-acts')).display,
    wait: getComputedStyle(document.getElementById('op-wait')).display,
  }));
  ok(covered.up && covered.shown === 'flex', 'the app is covered while the trip is fetched → ' + JSON.stringify(covered.shown));
  ok(covered.acts === 'none' && covered.wait !== 'none',
     'showing that it is working, and no buttons to press → acts:' + covered.acts + ' wait:' + covered.wait);
  ok(/Opening the trip/.test(covered.says || ''), 'and says what it is doing → ' + covered.says);
  await sleep(2500);
  const settled = await p.evaluate(() => ({
    up: document.documentElement.classList.contains('opening-trip'),
    title: DATA.title,
  }));
  ok(!settled.up && settled.title === 'Málaga 50s', 'the cover lifts onto the trip → ' + JSON.stringify(settled));

  // Opened again with the trip already here, the cover is gone before paint.
  await p.goto(BASE + '?n=' + Date.now() + '#t=' + shareId, { waitUntil: 'domcontentloaded' });
  ok(!(await p.evaluate(() => document.documentElement.classList.contains('opening-trip'))),
     'and never appears when the trip is already on this device');

  // If the link can't be reached, the cover says so instead of dumping someone
  // on a city they are not going to.
  await p.evaluate(() => localStorage.removeItem('library.v1'));
  await p.evaluateOnNewDocument(() => {
    window.__breakFetch = true;
  });
  await p.goto(BASE + '?n=' + Date.now() + '#t=' + shareId, { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => {
    const t = setInterval(() => {
      if (window.tripShare && window.__breakFetch) { window.tripShare.fetch = () => Promise.reject(new Error('offline')); clearInterval(t); }
    }, 10);
  });
  await sleep(3000);
  const failed = await p.evaluate(() => ({
    up: document.documentElement.classList.contains('opening-trip'),
    says: (document.getElementById('op-msg') || {}).textContent,
    acts: getComputedStyle(document.getElementById('op-acts')).display !== 'none',
    wait: getComputedStyle(document.getElementById('op-wait')).display !== 'none',
  }));
  ok(failed.up && /Couldn’t reach|doesn’t point/.test(failed.says || ''),
     'a link that cannot be reached says so → ' + failed.says);
  ok(failed.acts && !failed.wait, 'and only then offers a way on from there');

  await b.close();
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
