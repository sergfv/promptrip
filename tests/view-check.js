/* How a trip presents itself: what opens first, where the day's narrative
   lives, which day is showing, and whether a tight day's pins are legible. */
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8006/';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A day in one old town (stops ~200-400 m apart) and a day spread across a bay.
const TRIP = {
  title: 'Presentation check', subtitle: 'Málaga',
  days: [
    { label: 'Fri 25', intro: 'A long opening paragraph that runs well past two lines so the clamp has something to hide. '.repeat(4),
      stops: [
        { name: 'Bodega El Pimpi', time: '21:00', lat: 36.7215, lng: -4.4178 },
        { name: 'Teatro Romano', time: '22:30', lat: 36.7213, lng: -4.4165 },
        { name: 'Plaza de la Merced', time: '23:30', lat: 36.7245, lng: -4.4174 },
      ] },
    { label: 'Sat 26', intro: 'Short one.',
      stops: [
        { name: 'Mercado Atarazanas', time: '11:00', lat: 36.7196, lng: -4.4248 },
        { name: 'Catedral de Málaga', time: '12:30', lat: 36.7203, lng: -4.4197 },
        { name: 'Museo Flamenco', time: '20:30', lat: 36.7222, lng: -4.4192 },
        { name: 'La Cala del Moral', time: '17:00', lat: 36.7189, lng: -4.3399 },
      ] },
  ],
};

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  await p.evaluateOnNewDocument(() => {
    try {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        get: () => ({ register: () => Promise.reject(new Error('off')), ready: new Promise(() => {}), addEventListener() {}, controller: null }),
      });
    } catch (e) {}
  });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await p.evaluate((t) => { localStorage.setItem('pt_landing_seen', '1'); addItinerary(normalizeItinerary(t), true); }, TRIP);

  // First sight of a trip: the list opens itself.
  await p.reload({ waitUntil: 'networkidle2' });
  await sleep(1600);
  const first = await p.evaluate(() => ({
    list: !document.getElementById('listview').hidden,
    day: activeDay,
    chip: (document.querySelector('#daybar .chip.is-active') || {}).textContent,
  }));
  ok(first.list, 'a trip opens on its list the first time');
  ok(first.day === 'all' && /All days/.test(first.chip || ''), 'and the map behind it shows the whole trip → ' + first.chip);

  // The narrative sits in the list, clamped, with a way to read the rest.
  const intro = await p.evaluate(() => {
    const el = document.querySelector('.lv-intro');
    const more = document.querySelector('.lv-more');
    const clamped = el.clientHeight;
    more.click();
    return { clamped, opened: el.clientHeight, label: more.textContent, hidesSome: el.scrollHeight > clamped + 4 };
  });
  ok(intro.hidesSome && intro.opened > intro.clamped, 'the day summary starts clamped and opens → ' + intro.clamped + 'px → ' + intro.opened + 'px');
  ok(intro.label === 'Less', 'and the control says what it now does → ' + intro.label);
  const shortOne = await p.evaluate(() => {
    const wraps = [...document.querySelectorAll('.lv-introwrap')];
    // What is on screen, not what the markup says — a display rule can beat
    // the hidden attribute, which is exactly how this went wrong once before.
    const shown = (w) => { const b = w.querySelector('.lv-more'); return b && getComputedStyle(b).display !== 'none'; };
    return { n: wraps.length, buttons: wraps.filter(shown).length };
  });
  ok(shortOne.n === 2 && shortOne.buttons === 1, 'a summary that already fits gets no button (' + shortOne.buttons + ' of ' + shortOne.n + ')');
  ok(await p.$('#dayintro') === null, 'and nothing of it floats over the map any more');

  // Second visit: the list stays out of the way.
  await p.evaluate(() => closeList());
  await p.reload({ waitUntil: 'networkidle2' });
  await sleep(1500);
  ok(await p.evaluate(() => document.getElementById('listview').hidden), 'a trip already seen opens on the map');

  // A day spent in one neighbourhood zooms in far enough to tell its pins apart.
  // Pixel distance between the stops that are actually ON SCREEN — a stop that
  // sits off the edge isn't overlapping anything.
  const onScreenGap = () => p.evaluate(() => {
    const size = map.getSize();
    const pts = [];
    DATA.days.forEach((d) => {
      if (activeDay !== 'all' && d.id !== activeDay) return;
      d.stops.forEach((s) => {
        const pt = map.latLngToContainerPoint([s.lat, s.lng]);
        if (pt.x > -20 && pt.y > -20 && pt.x < size.x + 20 && pt.y < size.y + 20) pts.push(pt);
      });
    });
    let min = Infinity;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) min = Math.min(min, pts[i].distanceTo(pts[j]));
    }
    return { zoom: map.getZoom(), shown: pts.length, min: pts.length > 1 ? Math.round(min) : Infinity };
  });

  await p.evaluate(() => showDay(DATA.days[0].id));
  await sleep(700);
  const tight = await onScreenGap();
  ok(tight.min > 44, 'a day in one old town opens with its pins apart → ' + tight.min + 'px at z' + tight.zoom);

  // The reported case: an old town plus somewhere out of town on the same day.
  await p.evaluate(() => showDay(DATA.days[1].id));
  await sleep(700);
  const mixed = await onScreenGap();
  ok(mixed.min > 44, 'a day that also goes out of town still opens legibly → ' + mixed.min + 'px at z' + mixed.zoom + ', ' + mixed.shown + ' pins in view');

  // …and walking the cards leaves the stop you are on clear of its neighbours.
  const walked = [];
  for (let i = 0; i < 4; i++) {
    await p.evaluate((n) => { const s = carouselStops[n]; select(s.dayId, s.idx, { center: true, closer: true }); }, i);
    await sleep(500);
    walked.push(await p.evaluate(() => {
      const here = map.latLngToContainerPoint(markers[key(selected.dayId, selected.idx)].getLatLng());
      const d = byId[selected.dayId];
      let min = Infinity;
      d.stops.forEach((s, i) => {
        if (i === selected.idx) return;
        min = Math.min(min, here.distanceTo(map.latLngToContainerPoint([s.lat, s.lng])));
      });
      return Math.round(min);
    }));
  }
  ok(walked.every((m) => m > 44), 'and every card lands on a stop clear of its neighbours → ' + walked.join(', ') + 'px');

  await b.close();
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
