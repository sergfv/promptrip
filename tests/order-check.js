/* The app's own ordering rules: stops with a time are shown in clock order,
   everything else stays where the itinerary put it. Runs headless, no network. */
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8006/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  // The group-link check below uses a seeded local plan, not the live project.
  await p.evaluateOnNewDocument(() => Object.defineProperty(window, 'PLANNER_FIREBASE', { value: null, writable: false }));
  await p.evaluateOnNewDocument(() => {
    try {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        get: () => ({ register: () => Promise.reject(new Error('off')), ready: new Promise(() => {}), addEventListener() {}, controller: null }),
      });
    } catch (e) {}
  });
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await p.evaluate(() => localStorage.setItem('pt_landing_seen', '1'));

  // A day the AI handed back out of order, with two untimed stops among them.
  const raw = {
    title: 'Order check', subtitle: 'Málaga',
    days: [{
      label: 'Sat', stops: [
        { name: 'Dinner', time: '21:00', lat: 36.721, lng: -4.418 },
        { name: 'Walk the paseo', lat: 36.72, lng: -4.42 },
        { name: 'Lunch', time: '14:00', lat: 36.722, lng: -4.417 },
        { name: 'Beach', time: '11:30', lat: 36.7195, lng: -4.411 },
        { name: 'Nightcap', time: '00:30', lat: 36.723, lng: -4.416 },
      ],
    }],
  };
  const names = await p.evaluate((r) => normalizeItinerary(r).days[0].stops.map((s) => s.name + (s.time ? ' ' + s.time : '')), raw);
  ok(names.join(' / ') === 'Beach 11:30 / Walk the paseo / Lunch 14:00 / Dinner 21:00 / Nightcap 00:30',
     'timed stops come out in clock order → ' + names.join(' / '));
  ok(names[1] === 'Walk the paseo', 'an untimed stop keeps its place in the day');
  ok(names[names.length - 1] === 'Nightcap 00:30', 'after midnight counts as late, not early');

  // A day already in order is left exactly as it is (same objects, same order).
  const stable = await p.evaluate(() => {
    const d = { title: 't', days: [{ label: 'Sun', stops: [
      { name: 'A', time: '09:00', lat: 1, lng: 1 }, { name: 'B', lat: 1, lng: 1 }, { name: 'C', time: '18:00', lat: 1, lng: 1 },
    ] }] };
    return normalizeItinerary(d).days[0].stops.map((s) => s.name).join('');
  });
  ok(stable === 'ABC', 'a day already in order is untouched → ' + stable);

  // A hand-dragged day is never rearranged by the clock again.
  const dragged = await p.evaluate(() => {
    const d = { title: 't', days: [{ label: 'Mon', manual: true, stops: [
      { name: 'Late', time: '20:00', lat: 1, lng: 1 }, { name: 'Early', time: '08:00', lat: 1, lng: 1 },
    ] }] };
    const out = normalizeItinerary(d).days[0];
    return { order: out.stops.map((s) => s.name).join(','), manual: out.manual };
  });
  ok(dragged.order === 'Late,Early' && dragged.manual === true,
     'a day someone ordered by hand stays that way → ' + dragged.order);

  // …and the list and map agree, because both read the same normalized data.
  await p.evaluate((r) => { addItinerary(normalizeItinerary(r), true); }, raw);
  await p.reload({ waitUntil: 'networkidle2' });
  await sleep(1200);
  const shown = await p.evaluate(() => {
    openList();
    return [...document.querySelectorAll('#listview .lv-row .lv-rname')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  });
  ok(/^Beach/.test(shown[0]) && /Nightcap/.test(shown[shown.length - 1]),
     'the list shows them in that order → ' + shown.join(' / '));
  const pins = await p.evaluate(() => {
    const d = DATA.days[0];
    return d.stops.map((s, i) => i + 1 + ':' + s.name).join(' ');
  });
  ok(/1:Beach/.test(pins) && /5:Nightcap/.test(pins), 'and the pins are numbered to match → ' + pins);

  // The example inside the prompt is not a trip — it once reached a whole group.
  const refused = await p.evaluate(() => {
    try {
      parseItinerary(JSON.stringify({ title: 'Trip name', subtitle: 'dates or a short tagline',
        days: [{ label: 'Mon 1', stops: [{ name: 'Place name', lat: 1, lng: 1 }] }] }));
      return 'IMPORTED IT';
    } catch (e) { return e.message; }
  });
  ok(/example from the prompt/.test(refused), 'the prompt’s own example is refused → ' + refused);

  // A pinned group link, with the planner switched off, is simply the trip's
  // link: it brings the map down and never shows a plan.
  ok(await p.evaluate(() => window.SHOW_PLANNER_UI) === false, 'the planner UI is off in config');
  const mapRaw = JSON.stringify({
    title: 'What the group sees', subtitle: 'Málaga',
    days: [{ label: 'Fri', stops: [{ name: 'Bodega El Pimpi', lat: 36.7215, lng: -4.4178 }] }],
  });
  await p.evaluate((raw) => {
    localStorage.setItem('planner.local.v1', JSON.stringify({
      uid: 'local_seed',
      plans: { grouplink1: { plan: { title: 'The trip', place: 'Málaga', days: [{ id: 'd1', label: 'Fri' }], curatorUid: 'someone', itinerary: raw }, people: {}, ideas: {}, votes: {}, images: {}, schedule: { days: {} } } },
    }));
  }, mapRaw);
  await p.goto(BASE + '#p=grouplink1', { waitUntil: 'networkidle2' });
  await sleep(2200);
  const landed = await p.evaluate(() => ({
    planner: !document.getElementById('plannerview').hidden,
    title: DATA.title,
    hash: location.hash,
  }));
  ok(!landed.planner, 'no planner screen for the group');
  ok(landed.title === 'What the group sees', 'the map the plan carries is what opens → ' + landed.title);
  ok(landed.hash === '', 'and the link tidies up after itself');

  await b.close();
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
