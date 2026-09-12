/* End-to-end check for "Plan with friends" (the group planner), on the local
   store — no Firebase needed. Drives the whole flow in headless Chrome:
   create a plan → pick a name → add things through the modal into day buckets
   (title, place, link, note, image) → vote → edit without losing focus →
   curator arranges (reorder, retime, move day) → a second "friend" opens the
   pinned link and adds something (and must NOT see Arrange) → hand off to the
   AI with one image sheet → what came after is flagged "not on the map yet".

   Run:  python3 -m http.server 8006   (from the repo root, in another shell)
         npm i puppeteer-core          (once, anywhere; script expects it resolvable)
         node tests/planner-e2e.js
   Needs Google Chrome installed (path below). No network required: the planner
   is pinned to its device-only store, so Firebase is never touched. */
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8006/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const waitFor = (p, sel, t = 8000) => p.waitForSelector(sel, { timeout: t });
const tap = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error('missing ' + s); el.click(); }, sel);
const setVal = (p, sel, v) => p.evaluate((s, val) => {
  const el = document.querySelector(s); el.value = val;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, sel, v);
const store = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('planner.local.v1') || 'null'));
const plan = async (p, id) => (await store(p)).plans[id];
// Tests drive the page directly; the service worker only adds a second actor
// (it reloads the page when a new version takes over, which races the driver).
const noServiceWorker = (p) => p.evaluateOnNewDocument(() => {
  try {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      get: () => ({
        register: () => Promise.reject(new Error('disabled in tests')),
        ready: new Promise(() => {}),
        addEventListener() {}, removeEventListener() {},
        controller: null,
        getRegistrations: () => Promise.resolve([]),
      }),
    });
  } catch (e) {}
});
const catchErrors = (p) => p.evaluateOnNewDocument(() => {
  window.addEventListener('error', (e) => { window.__lastErr = (e.message || '') + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno; });
});
// A believable event image, handed to the page as a real File.
const makeFlyer = (title, bg) => `(() => {
  const c = document.createElement('canvas'); c.width = 900; c.height = 1200;
  const g = c.getContext('2d'); g.fillStyle = '${bg}'; g.fillRect(0, 0, 900, 1200);
  g.fillStyle = '#fff'; g.font = 'bold 80px sans-serif'; g.fillText('${title}', 60, 300);
  const bin = atob(c.toDataURL('image/jpeg', 0.9).split(',')[1]);
  const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const dt = new DataTransfer(); dt.items.add(new File([arr], 'image.jpg', { type: 'image/jpeg' }));
  const el = document.querySelector('#am-file'); el.files = dt.files;
  el.dispatchEvent(new Event('change', { bubbles: true }));
})()`;

// Add one thing through the modal, the way a person would.
async function addThing(p, bucket, { title, place, extra, image }) {
  await tap(p, `[data-addto="${bucket}"]`);
  await waitFor(p, '#am-save');
  if (title) await setVal(p, '#am-title', title);
  if (place) await setVal(p, '#am-place', place);
  if (extra) await setVal(p, '#am-extra', extra);
  if (image) { await p.evaluate(image); await sleep(900); }
  await tap(p, '#am-save');
  await sleep(500);
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  // Keep this hermetic: never reach for the real Firebase project.
  await p.evaluateOnNewDocument(() => Object.defineProperty(window, 'PLANNER_FIREBASE', { value: null, writable: false }));
  // The planner's UI is switched off in config.js for now; the suite still
  // exercises it, so turn it on for these pages only.
  // Non-writable, or config.js's own assignment would switch it back off.
  await p.evaluateOnNewDocument(() => Object.defineProperty(window, 'SHOW_PLANNER_UI', { value: true, writable: false }));
  await catchErrors(p);
  await noServiceWorker(p);
  p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  await p.goto(BASE, { waitUntil: 'networkidle2' });
  await p.evaluate(async () => {
    localStorage.clear(); localStorage.setItem('pt_landing_seen', '1');
    if (navigator.serviceWorker) { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map((r) => r.unregister())); }
    if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); }
  });

  // 1. Create a plan through the private entry point
  await p.goto(BASE + '#plan', { waitUntil: 'networkidle2' });
  await waitFor(p, '#pl-create');
  ok(true, 'planner opens via the private #plan link');
  await setVal(p, '#pl-title', 'Weekend in Málaga');
  await setVal(p, '#pl-place', 'Málaga');
  await p.evaluate(() => { const d = document.querySelectorAll('#pl-dates input[type=date]'); d[0].value = '2026-10-03'; d[1].value = '2026-10-04'; });
  await setVal(p, '#pl-roster', 'Marta\nJordi\nLaia\nSergio');
  await tap(p, '#pl-create'); await waitFor(p, '#pl-next');
  const planId = await p.evaluate(() => localStorage.getItem('planner.last'));
  ok(!!planId, 'plan created, id ' + planId);

  // 2. Pick my name
  await tap(p, '#pl-next'); await waitFor(p, '.pl-tile[data-n="Sergio"]');
  await tap(p, '.pl-tile[data-n="Sergio"]'); await waitFor(p, '#pl-go:not([disabled])');
  await tap(p, '#pl-go'); await waitFor(p, '#pl-buckets');

  // 2b. Say when I'm there
  await setVal(p, 'select[data-k="arrive"]', 'd1');
  await setVal(p, 'input[data-k="arrive"]', '11:00');
  await setVal(p, 'select[data-k="leave"]', 'd2');
  await setVal(p, 'input[data-k="leave"]', '17:00');
  await sleep(400);
  {
    const me = (await store(p)).plans[planId].people;
    const mine = Object.values(me)[0];
    ok(mine && mine.arrive.time === '11:00' && mine.leave.time === '17:00',
      'my arrival/leaving saved → ' + JSON.stringify(mine && mine.arrive));
  }

  // 3. Suggest shows a bucket per day, plus "Any day"
  const heads = await p.$$eval('#pl-buckets .pl-sec', (els) => els.map((e) => {
    const c = e.cloneNode(true); const n = c.querySelector('.cnt'); if (n) n.remove();
    return c.textContent.trim();
  }));
  ok(heads.join(' | ') === 'Sat 3 | Sun 4 | Any day', 'a bucket per day plus Any day → ' + heads.join(' | '));
  const adders = await p.$$eval('[data-addto]', (els) => els.map((e) => e.dataset.addto));
  ok(adders.length === 3, 'each bucket has its own add button');

  // 4. Add through the modal: title + place + a pasted link, straight into Sat
  await addThing(p, 'd1', {
    title: 'Beach afternoon', place: 'Playa de la Malagueta, Málaga',
    extra: 'Best after 17:00 https://example.com/malagueta',
  });
  let pl = await plan(p, planId);
  let items = Object.values(pl.ideas);
  ok(items.length === 1, 'one item added');
  const beach = items[0];
  ok(beach.day === 'd1', 'it landed in the day I added it to');
  ok(beach.place === 'Playa de la Malagueta, Málaga', 'place name saved → ' + beach.place);
  ok(beach.url === 'https://example.com/malagueta', 'link pulled out of the free field');
  ok(beach.note === 'Best after 17:00', 'the rest of that field kept as a note → ' + beach.note);

  // 5. An image into Sunday, with its own title and place
  await addThing(p, 'd2', {
    title: 'Flamenco night', place: 'Museo Flamenco Peña Juan Breva, Málaga',
    image: makeFlyer('FLAMENCO', '#2b1b2e'),
  });
  pl = await plan(p, planId);
  const imgItem = Object.values(pl.ideas).find((i) => i.imageId);
  ok(!!imgItem && imgItem.day === 'd2', 'image added to Sunday');
  const stored = imgItem && pl.images[imgItem.imageId];
  const bytes = stored && stored.data;
  ok(!!bytes && bytes.length > 500 && bytes.length < 700000 && stored.mime === 'image/jpeg',
    'image shrunk and stored as base64 (' + (bytes ? Math.round(bytes.length / 1024) + ' KB' : 'MISSING') + ', under the 1 MiB doc cap)');
  ok(await p.$eval('.pl-shot', (e) => !!e.style.backgroundImage), 'image shows as a thumbnail');

  // 6. Something nobody has pinned to a day
  await addThing(p, '', { title: 'Tapas somewhere', place: 'Málaga centro' });
  pl = await plan(p, planId);
  ok(Object.values(pl.ideas).filter((i) => !i.day).length === 1, 'an item can sit in Any day');

  // 7. Voting still works
  await tap(p, '.pl-vote');
  await sleep(300);
  pl = await plan(p, planId);
  ok(Object.keys(pl.votes).length === 1, 'vote recorded');
  ok(await p.$eval('.pl-vote', (e) => e.classList.contains('on')), 'vote pill shows the voted state');

  // 8. Editing must not yank the caret out of the field (the reported bug)
  const beachId = beach.id || Object.keys(pl.ideas).find((k) => pl.ideas[k].text === 'Beach afternoon');
  await tap(p, '[data-act="strip"][data-key="d1:0"]');
  await waitFor(p, `.pl-edit input[data-e="place"][data-id="${beachId}"]`);
  await p.focus(`.pl-edit input[data-e="place"][data-id="${beachId}"]`);
  await p.evaluate((id) => { const el = document.querySelector(`.pl-edit input[data-e="place"][data-id="${id}"]`); el.value = ''; }, beachId);
  await p.keyboard.type('La Malagueta', { delay: 90 });   // slower than the 350ms save debounce
  await sleep(700);
  const stillFocused = await p.evaluate((id) => {
    const a = document.activeElement;
    return !!(a && a.dataset && a.dataset.e === 'place' && a.dataset.id === id);
  }, beachId);
  ok(stillFocused, 'caret stays in the place field while typing');
  const caretVal = await p.evaluate((id) => document.querySelector(`.pl-edit input[data-e="place"][data-id="${id}"]`).value, beachId);
  ok(caretVal === 'La Malagueta', 'every character survived → "' + caretVal + '"');
  // the same "link, photo, note" field is available while editing
  await setVal(p, `.pl-edit textarea[data-e="extra"][data-id="${beachId}"]`, 'Go at sunset https://example.com/sunset');
  await sleep(700);
  await tap(p, `[data-act="edone"][data-id="${beachId}"]`);
  await sleep(400);
  pl = await plan(p, planId);
  ok(pl.ideas[beachId].place === 'La Malagueta', 'edited place saved');
  ok(pl.ideas[beachId].url === 'https://example.com/sunset' && pl.ideas[beachId].note === 'Go at sunset',
     'a link and note can be added while editing → ' + JSON.stringify({ u: pl.ideas[beachId].url, n: pl.ideas[beachId].note }));

  // 9. Arrange: the curator sees the same buckets and can move a day
  ok(await p.$('.pl-seg') === null, 'no Suggest/Arrange split — one view for everyone');
  ok(await p.$('#pl-ai') !== null, 'curator sees Hand it to your AI');
  ok(await p.$('#pl-send') === null, 'no "Send to map" — the AI builds the map now');
  const satCount = await p.$$eval('#pl-buckets .lv-group', (gs) => gs[0].querySelectorAll('.pl-row').length);
  ok(satCount === 1, 'Saturday shows the item added to it');
  await tap(p, '.lv-num[data-key="d1:0"]');
  await waitFor(p, '.pl-mini[data-act="move"][data-key="d1:0"]');
  await tap(p, '.pl-mini[data-act="move"][data-key="d1:0"]');
  await sleep(500);
  pl = await plan(p, planId);
  ok(pl.ideas[beachId].day === 'd2', 'moving a day in Arrange updates the item itself, so Suggest agrees');

  // 10. A time range — set inside the stop's own editor
  await tap(p, '.lv-num[data-key="d2:0"]');
  await waitFor(p, 'input[data-f="start"][data-key="d2:0"]');
  await setVal(p, 'input[data-f="start"][data-key="d2:0"]', '11:00'); await sleep(350);
  await setVal(p, 'input[data-f="end"][data-key="d2:0"]', '13:00'); await sleep(500);
  pl = await plan(p, planId);
  ok(pl.schedule.days.d2[0].start === '11:00' && pl.schedule.days.d2[0].end === '13:00', 'time range saved 11:00–13:00');

  // 10b. A day sorts itself once times are set — even when entered out of order.
  const sunRows = await p.$$eval('#pl-buckets .lv-group', (gs) => gs[1].querySelectorAll('.pl-row').length);
  ok(sunRows === 2, 'Sunday holds both stops before timing them');
  await tap(p, '.lv-num[data-key="d2:1"]');
  await waitFor(p, 'input[data-f="start"][data-key="d2:1"]');
  await setVal(p, 'input[data-f="start"][data-key="d2:1"]', '09:00');   // earlier than the 11:00 above
  await sleep(700);
  pl = await plan(p, planId);
  const order = pl.schedule.days.d2.map((x) => x.start || '—');
  ok(order.join(' → ') === '09:00 → 11:00', 'the day re-sorted itself by time → ' + order.join(' → '));
  const sunNames = () => p.evaluate(() => {
    const g = document.querySelectorAll('#pl-buckets .lv-group')[1];
    return Array.from(g.querySelectorAll('.pl-row .pl-name')).map((e) => e.textContent.trim());
  });
  const firstName = (await sunNames())[0];
  ok(!!firstName, 'the earlier stop now shows first: ' + firstName);
  const meta = await p.$$eval('#pl-buckets .lv-group', (gs) => {
    const r = gs[1].querySelector('.pl-row');
    return { time: (r.querySelector('.pl-timeline') || {}).textContent, votes: !!r.querySelector(':scope > .pl-vote') };
  });
  ok(/09:00/.test(meta.time || ''), 'the time reads as metadata under the place → ' + meta.time);
  ok(meta.votes, 'the vote button sits back on the right of the row');
  // An untimed stop waits at the end of the day.
  await addThing(p, 'd2', { title: 'Late-night churros' });
  pl = await plan(p, planId);
  const withUntimed = await sunNames();
  ok(withUntimed[withUntimed.length - 1] === 'Late-night churros',
     'an untimed stop waits at the end → ' + withUntimed.join(' / '));

  // 11. A friend on another phone
  await p.evaluate((id) => { localStorage.setItem('planner.devUid', 'local_friend1'); localStorage.removeItem('planner.name.' + id); }, planId);
  await p.reload({ waitUntil: 'networkidle2' });
  await waitFor(p, '.pl-tile[data-n="Marta"]');
  // Adding a name stays folded away below Continue until it's asked for.
  {
    // A closed <details> keeps its layout box in current Chrome, so ask the
    // browser whether the field is actually rendered rather than measuring it.
    const shown = (s) => p.evaluate((x) => { const e = document.querySelector(x); return !!(e && e.checkVisibility()); }, s);
    ok(!(await shown('#pl-newname')), 'the add-a-name field is hidden behind the link');
    const order = await p.evaluate(() => {
      const go = document.querySelector('#pl-go'), link = document.querySelector('.pl-newwrap');
      return go && link ? (go.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 : false;
    });
    ok(order, '"Not on the list?" sits below the Continue button');
    await tap(p, '.pl-newwrap > summary');
    await waitFor(p, '#pl-newname');
    ok(await shown('#pl-newname'), 'tapping the link reveals the field and its + button');
    await setVal(p, '#pl-newname', 'Bea'); await tap(p, '#pl-addname'); await sleep(300);
    await waitFor(p, '.pl-tile[data-n="Bea"].on');
    ok(/Continue as Bea/.test(await p.$eval('#pl-go', (e) => e.textContent)), 'a new name joins the tiles, already chosen');
  }
  await tap(p, '.pl-tile[data-n="Marta"]'); await waitFor(p, '#pl-go:not([disabled])');
  await tap(p, '#pl-go'); await waitFor(p, '#pl-buckets');
  ok(await p.$('#pl-ai') === null, 'friend does NOT get the AI hand-off');
  ok(await p.$('#pl-title-edit') === null, 'friend cannot rename the plan — only the curator can');
  await tap(p, '.lv-num[data-key="d2:0"]');
  await waitFor(p, 'input[data-f="start"][data-key="d2:0"]');
  ok(await p.$('.pl-mini[data-act="move"][data-key="d2:0"]') !== null, 'friend DOES get times and stop controls');
  await tap(p, '.lv-num[data-key="d2:0"]');   // close it again
  const footer = await p.$$eval('.pl-note', (els) => els[els.length - 1].textContent.trim());
  ok(/Sergio hands this to an AI/.test(footer), 'footer names the curator: ' + footer.slice(0, 60));
  {
    await tap(p, '#pl-roster-link'); await waitFor(p, '#pl-modal .pl-row');
    const seen = await p.$$eval('#pl-modal .pl-row', (rs) => rs.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
    ok(seen.some((r) => /Sergio/.test(r) && /11:00/.test(r)),
      'a friend can see the curator’s arrival time → ' + (seen.find((r) => /Sergio/.test(r)) || 'NOT VISIBLE'));
    await tap(p, '#ro-x'); await sleep(200);
  }
  await setVal(p, 'select[data-k="arrive"]', 'd2');
  await setVal(p, 'input[data-k="arrive"]', '08:30');
  await sleep(400);
  await addThing(p, 'd1', { title: 'Museo Picasso', place: 'Museo Picasso Málaga' });
  pl = await plan(p, planId);
  ok(Object.keys(pl.ideas).length === 5, 'friend’s item stored alongside the rest');
  ok(Object.values(pl.people).map((x) => x.name).sort().join(',') === 'Marta,Sergio', 'people = Marta, Sergio');

  // 12. Back as the curator: hand it all to the AI from Arrange
  await p.evaluate((id) => { localStorage.removeItem('planner.devUid'); localStorage.setItem('planner.name.' + id, 'Sergio'); }, planId);
  await p.reload({ waitUntil: 'networkidle2' });
  await waitFor(p, '#pl-buckets');
  await waitFor(p, '#pl-ai');
  // A phone: the sheet goes through the share sheet, the way it attaches a file.
  const cdp = await p.createCDPSession();
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await p.evaluate(() => {
    window.__shared = null;
    window.__copied = [];
    navigator.share = async (d) => { window.__shared = { files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })), text: d.text || '' }; };
    navigator.canShare = (d) => !!(d && d.files && d.files.length);
    navigator.clipboard.writeText = async (t) => { window.__copied.push(t); };
  });
  await tap(p, '#pl-ai');
  await sleep(4500);
  const shared = await p.evaluate(() => window.__shared);
  ok(shared && shared.files.length === 1 && shared.files[0].type === 'image/jpeg',
    'images went as ONE sheet → ' + JSON.stringify(shared && shared.files[0]));
  ok(shared && shared.files[0].size > 4000, 'the sheet has real content (' + Math.round((shared ? shared.files[0].size : 0) / 1024) + ' KB)');
  ok(shared && /Playa de la Malagueta|La Malagueta/.test(shared.text), 'briefing carries the place names');
  ok(shared && /IMAGE 1/.test(shared.text), 'briefing numbers the image to match the sheet');
  ok(shared && /specific, real, named place/.test(shared.text), 'briefing tells the AI to name real places');
  // The group decided this together — the AI sharpens it, it doesn't replan it.
  ok(shared && /Use EVERY item above as a stop/.test(shared.text) && /Add nothing of your own/.test(shared.text),
     'briefing tells the AI to keep the group’s stops and invent none');
  ok(shared && /AT MOST ONE suggestion/.test(shared.text) && /Suggestion — not chosen by the group/.test(shared.text),
     'and to flag the one gap-filler it is allowed');
  ok(shared && /never build a day around one person/.test(shared.text) && /single anyone out by name/.test(shared.text),
     'briefing asks for the group’s voice, not one person’s schedule');
  ok(shared && /who have said so far/.test(shared.text),
     'and says how many of the group have given travel times');
  ok(shared && shared.files[0].name === 'trip-images.jpg', 'the sheet is named for what it holds → ' + (shared && shared.files[0].name));
  const notice = await p.$eval('.pl-handoff', (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
  ok(notice && /Handed to your AI/.test(notice) && /paste it in the box below/i.test(notice),
    'importer explains what happened: ' + (notice || 'NO NOTICE').slice(0, 80));
  ok(notice && !/flyer/i.test(notice), 'the notice calls them images, not flyers');
  // The briefing is copied once, before the sheet is shared — what the share
  // sheet then does with the clipboard is the person's own choice to make.
  const copied = await p.evaluate(() => window.__copied);
  ok(copied.length === 1 && /specific, real, named place/.test(copied[0]),
    'the briefing is copied once, and the share sheet is left alone after it (' + copied.length + ' copies)');
  // Four friends on the "Who are you?" list; only two have opened the link so
  // far — the briefing counts the friends, not the devices that answered.
  const devices = Object.keys((await plan(p, planId)).people).length;
  ok(devices === 2 && /group of 4 planning/.test(copied[0]),
     'the briefing counts the 4 people on the list, not the ' + devices + ' devices → ' + (copied[0].split('\n')[0] || '').slice(0, 52));
  const shownBrief = await p.$eval('.pl-brief', (e) => e.textContent).catch(() => null);
  ok(shownBrief && /La Malagueta/.test(shownBrief), 'the briefing itself is on the page, stops and all');
  ok(shownBrief && /ONE json code block/.test(shownBrief), 'and it carries the format instructions for the AI');
  ok(await p.$('#pl-ho-copy') !== null, 'with a button to copy it again');

  // On a machine with no touchscreen there is no useful share sheet: the sheet
  // is saved instead, so it can be attached from disk.
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await p.goto(BASE + '#plan', { waitUntil: 'networkidle2' });
  await waitFor(p, '#pl-ai');
  await p.evaluate(() => {
    window.__shared = null; window.__saved = null;
    navigator.share = async (d) => { window.__shared = d; };
    navigator.canShare = () => true;
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__saved = this.download; return; } return click.apply(this, arguments); };
  });
  await tap(p, '#pl-ai');
  await sleep(4500);
  const desk = await p.evaluate(() => ({ shared: window.__shared, saved: window.__saved }));
  ok(!desk.shared, 'no share sheet on a desktop — it cannot attach into a web chat');
  ok(desk.saved === 'trip-images.jpg', 'the image sheet is saved to attach by hand → ' + desk.saved);
  const deskNotice = await p.$eval('.pl-handoff', (e) => e.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
  ok(deskNotice && /saved to your device/.test(deskNotice) && /downloads/.test(deskNotice),
     'and the notice says where to find it');

  // 13. Anything added after the hand-off is flagged
  await p.goto(BASE + '#plan', { waitUntil: 'networkidle2' });
  await waitFor(p, '#pl-buckets');
  ok(await p.$('.pl-new') === null, 'nothing flagged right after handing off');
  await addThing(p, 'd1', { title: 'Late addition' });
  await sleep(400);
  const flagged = await p.$$eval('.pl-new', (els) => els.length);
  ok(flagged === 1, 'the new item is marked "not on the map yet" (' + flagged + ' flagged)');

  // 13b. The organiser's own phone: another device, another hidden identity,
  // but the same person — so the hand-off is theirs and their times follow.
  await p.evaluate((id) => { localStorage.setItem('planner.devUid', 'local_myphone'); localStorage.removeItem('planner.name.' + id); }, planId);
  await p.reload({ waitUntil: 'networkidle2' });
  await waitFor(p, '.pl-tile[data-n="Sergio"]');
  await tap(p, '.pl-tile[data-n="Sergio"]'); await waitFor(p, '#pl-go:not([disabled])');
  await tap(p, '#pl-go'); await waitFor(p, '#pl-buckets'); await sleep(600);
  ok(await p.$('#pl-ai') !== null, 'the organiser on their own phone still gets the AI hand-off');
  ok(await p.$('#pl-title-edit') !== null, 'and can still rename the plan');
  const phoneWhen = await p.$$eval('#pl-when input[data-k]', (els) => els.map((e) => e.value));
  ok(phoneWhen.join(',') === '11:00,17:00', 'their arrival times came with them → ' + phoneWhen.join(' / '));
  await tap(p, '#pl-roster-link'); await waitFor(p, '#pl-modal .pl-row');
  const onPhone = await p.$$eval('#pl-modal .pl-row', (rs) => rs.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  ok(onPhone.length === 2, 'still one row per person, not per device (' + onPhone.length + ')');
  await tap(p, '#ro-x'); await sleep(200);
  await p.evaluate((id) => { localStorage.removeItem('planner.devUid'); localStorage.setItem('planner.name.' + id, 'Sergio'); }, planId);
  await p.reload({ waitUntil: 'networkidle2' }); await waitFor(p, '#pl-buckets');

  await tap(p, '#pl-roster-link'); await waitFor(p, '#pl-modal .pl-row');
  const roster = await p.$$eval('#pl-modal .pl-row', (rs) => rs.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  ok(roster.length === 2, 'everyone appears in "Who’s there when" (' + roster.length + ')');
  ok(roster.some((r) => /Marta/.test(r)) && roster.some((r) => /Sergio/.test(r)), 'both names listed → ' + roster.join(' | '));
  ok(roster.some((r) => /11:00/.test(r)) && roster.some((r) => /08:30/.test(r)),
     'everyone’s arrival times are visible → ' + roster.join(' | '));
  ok(await p.$eval('#pl-roster-link', (e) => /2 people/.test(e.textContent)), 'the link summarises the group');
  // Same person, second device: one row, not two.
  await p.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('planner.local.v1'));
    const pl = Object.values(db.plans)[0];
    pl.people['local_secondphone'] = { name: 'Sergio', updatedAt: 1 };
    localStorage.setItem('planner.local.v1', JSON.stringify(db));
  });
  await tap(p, '#ro-x'); await sleep(200);
  await p.reload({ waitUntil: 'networkidle2' });
  await waitFor(p, '#pl-roster-link');
  await tap(p, '#pl-roster-link'); await waitFor(p, '#pl-modal .pl-row');
  const merged = await p.$$eval('#pl-modal .pl-row', (rs) => rs.map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
  ok(merged.length === 2, 'a second device does not create a second person (' + merged.length + ' rows)');
  const mine = merged.find((r) => /Sergio/.test(r));
  ok(/11:00/.test(mine), 'the merged row keeps the entry that has the times → ' + mine);
  ok(/on 3 devices/.test(mine), 'and says how many devices are the same person → ' + mine);
  await tap(p, '#ro-x'); await sleep(200);

  // The vibe strip is gone — the group's WhatsApp does that job.
  ok(await p.$('#pl-mood') === null, 'no "The vibe" section any more');

  // A gif still keeps its own bytes when it becomes a stop's picture.
  const firstKey = await p.$eval('.lv-num[data-key]', (e) => e.dataset.key);
  await tap(p, `.lv-num[data-key="${firstKey}"]`);
  await waitFor(p, '[data-act="ephoto"]');
  const gifIdea = await p.$eval('[data-act="ephoto"]', (e) => e.dataset.id);
  await p.evaluate(() => {
    const gif = 'R0lGODlhCgAKAIAAAP8AAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQJCgAAACwAAAAACgAKAAACC4SPqcvtD6OctNIAIfkECQoAAAAsAAAAAAoACgAAAgqEj6nL7Q+jnLTSACH5BAkKAAAALAAAAAAKAAoAAAIKhI+py+0Po5y00gA7';
    const bin = atob(gif); const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const dt = new DataTransfer(); dt.items.add(new File([arr], 'v.gif', { type: 'image/gif' }));
    document.querySelector('[data-act="ephoto"]').click();
    const el = document.querySelector('#pl-imgfile'); el.files = dt.files;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(1400);
  pl = await plan(p, planId);
  const withGif = pl.ideas[gifIdea];
  ok(!!(withGif && withGif.imageId), 'a picture can be added to a stop while editing it');
  ok(withGif && pl.images[withGif.imageId] && pl.images[withGif.imageId].mime === 'image/gif',
     'a gif keeps its own format so it still animates → ' + (withGif && pl.images[withGif.imageId] && pl.images[withGif.imageId].mime));

  // Renaming the plan, after it was created.
  await tap(p, '#pl-title-edit');
  await waitFor(p, '#pl-title-new');
  await setVal(p, '#pl-title-new', 'Málaga, take two');
  await tap(p, '#pl-title-save'); await sleep(600);
  pl = await plan(p, planId);
  ok(pl.plan.title === 'Málaga, take two', 'the curator can rename the plan → ' + pl.plan.title);
  ok(await p.$eval('.pl-h1 > span', (e) => e.textContent.trim()) === 'Málaga, take two', 'and the heading shows the new name');
  await p.reload({ waitUntil: 'networkidle2' }); await waitFor(p, '#pl-buckets');
  ok(await p.$eval('.pl-h1 > span', (e) => e.textContent.trim()) === 'Málaga, take two', 'the new name survives a reload');

  // 15. The itinerary the AI sends back belongs to this plan: handing off again
  // refreshes that same itinerary instead of shelving a second near-copy.
  {
    const add = (title) => p.evaluate((t, id) => {
      addItinerary({ title: t, subtitle: 'x', days: [{ label: 'Fri', stops: [{ name: 'El Pimpi', lat: 36.72, lng: -4.42 }] }] }, false, { planId: id });
      const lib = JSON.parse(localStorage.getItem('library.v1'));
      return { n: lib.items.length, names: lib.items.map((i) => i.name) };
    }, title, planId);
    const before = await p.evaluate(() => { const l = localStorage.getItem('library.v1'); return l ? JSON.parse(l).items.length : 0; });
    const one = await add('Weekend v1');
    const two = await add('Weekend v2');
    ok(one.n === before + 1, 'the group plan’s itinerary is saved the first time (' + before + ' → ' + one.n + ')');
    ok(two.n === one.n && two.names.includes('Weekend v2') && !two.names.includes('Weekend v1'),
       'and handing off again refreshes that same one → ' + two.names.join(' / '));
  }

  // 16. The map travels with the plan, so a phone with its own empty storage
  // (an iPhone's Home Screen app has exactly that) still opens the group's trip.
  {
    const raw = JSON.stringify({ title: 'The group’s map', subtitle: 'Málaga', days: [{ label: 'Fri', stops: [{ name: 'Bodega El Pimpi', lat: 36.721, lng: -4.418 }] }] });
    const got = await p.evaluate((id, r) => {
      localStorage.removeItem('library.v1');            // a phone that has imported nothing
      const first = adoptPlanItinerary(id, r);          // true only when it reloads
      const lib = JSON.parse(localStorage.getItem('library.v1'));
      const item = lib.items[0];
      const again = adoptPlanItinerary(id, r);          // the same version, a second time
      const after = JSON.parse(localStorage.getItem('library.v1'));
      return { first, name: item.name, active: lib.activeId === item.id, planId: item.planId, again, n: after.items.length };
    }, planId, raw);
    ok(got.name === 'The group’s map' && got.planId === planId,
       'the plan carries the map onto a device that never imported it → ' + got.name);
    ok(got.active && got.first === true, 'and it becomes the map on screen');
    ok(got.again === false && got.n === 1, 'opening the plan again changes nothing (' + got.n + ' itinerary)');
  }

  // 17. Pasting a group link into the importer joins that plan — the only way
  // into an installed home-screen app, whose storage links can never reach.
  {
    // The step above ends in a reload (the group's map took the screen), so
    // land somewhere settled before touching the page again.
    await sleep(900);
    await p.goto(BASE, { waitUntil: 'networkidle2' });
    await p.evaluate(() => { localStorage.removeItem('planner.last'); });
    await p.evaluate(() => { openImport(); });
    await waitFor(p, '#imp-input');
    await setVal(p, '#imp-input', 'Here you go: https://example.test/promptrip/#p=' + planId);
    await tap(p, '#imp-go');
    await waitFor(p, '#pl-buckets', 25000);
    const joined = await p.evaluate(() => localStorage.getItem('planner.last'));
    ok(joined === planId, 'a pasted group link opens that plan → ' + joined);
    await sleep(600);
    const impState = await p.$eval('#importscreen', (e) => ({ hidden: e.hidden, open: e.classList.contains('is-open') }));
    ok(impState.hidden || !impState.open, 'and the importer gets out of the way → ' + JSON.stringify(impState));
  }

  // 17b. The board says where the map is — and lets the organiser hand over the
  // one already on this device, without another trip through the AI.
  {
    await p.evaluate(() => { closePlanner(); });
    await p.goto(BASE + '#p=' + planId, { waitUntil: 'networkidle2' });
    await waitFor(p, '#pl-buckets', 20000);
    await sleep(700);
    // Nothing published yet, and this device holds a map → offer to share it.
    const before = await p.$eval('#pl-maprow', (e) => e.textContent.replace(/\s+/g, ' ').trim());
    ok(/Share this map with the group/.test(before), 'the board offers to hand the map over → ' + before.slice(0, 46));
    await tap(p, '#pl-sharemap');
    await sleep(900);
    const pl2 = await plan(p, planId);
    ok(!!pl2.plan.itinerary, 'sharing puts the map into the plan');
    await p.reload({ waitUntil: 'networkidle2' });
    await waitFor(p, '#pl-buckets', 20000);
    await sleep(700);
    const after = await p.$eval('#pl-maprow', (e) => e.textContent.replace(/\s+/g, ' ').trim());
    ok(!/Share this map/.test(after) && !/Update the group/.test(after),
       'and stops offering once the group has that same version → ' + (after || '(nothing)'));
    // A newer map on this device is offered as an update, not a fresh share.
    await p.evaluate(() => {
      const lib = JSON.parse(localStorage.getItem('library.v1'));
      const it = lib.items.find((i) => i.planId);
      it.data.title = 'The group’s map, take two'; it.name = it.data.title; it.rev = 'fresh:1';
      it.savedAt = Date.now() + 60000;          // imported after the group's copy
      localStorage.setItem('library.v1', JSON.stringify(lib));
    });
    await p.reload({ waitUntil: 'networkidle2' });
    await waitFor(p, '#pl-buckets', 20000);
    await sleep(700);
    const stale = await p.$eval('#pl-maprow', (e) => e.textContent.replace(/\s+/g, ' ').trim());
    ok(/Update the group’s map/.test(stale), 'a newer map is offered as an update → ' + stale.slice(0, 46));
    await tap(p, '#pl-sharemap');
    await sleep(900);
    const pl3 = await plan(p, planId);
    ok(/take two/.test(pl3.plan.itinerary || ''), 'and updating replaces what the group sees');
    // Back in step, looking at another trip: the board points at the group's map.
    await p.evaluate(() => {
      addItinerary({ title: 'Vienna with Carlos', days: [{ label: 'Mon', stops: [{ name: 'Prater', lat: 48.2, lng: 16.4 }] }] }, true);
    });
    await p.reload({ waitUntil: 'networkidle2' });
    await waitFor(p, '#pl-buckets', 20000);
    await sleep(700);
    const elsewhere = await p.$eval('#pl-maprow', (e) => e.textContent.replace(/\s+/g, ' ').trim());
    ok(/Open the group’s map/.test(elsewhere), 'and points at it when another trip is on screen → ' + elsewhere.slice(0, 44));
  }

  // 17c. A plan can switch off the parts it doesn't need. The code stays; the
  // plan just stops using it, for everyone.
  {
    await p.reload({ waitUntil: 'networkidle2' });
    await waitFor(p, '#pl-buckets', 20000);
    await sleep(500);
    ok(await p.$('.pl-vote') !== null && await p.$('#pl-when') !== null && await p.$('#pl-who') !== null,
       'by default a plan uses names, travel times and voting');
    await p.evaluate(() => { document.querySelector('.pl-setwrap').open = true; });
    for (const k of ['people', 'when', 'votes']) {
      await tap(p, `[data-feat="${k}"]`);
      await sleep(500);
      await p.evaluate(() => { const d = document.querySelector('.pl-setwrap'); if (d) d.open = true; });
    }
    await sleep(600);
    const off = await p.evaluate(() => ({
      vote: !!document.querySelector('.pl-vote'),
      when: !!document.querySelector('#pl-when'),
      who: !!document.querySelector('#pl-who'),
      roster: !!document.querySelector('#pl-roster-link'),
      stops: document.querySelectorAll('#pl-buckets .pl-row').length,
    }));
    ok(!off.vote && !off.when && !off.who && !off.roster,
       'switched off, none of the three are on the board → ' + JSON.stringify(off));
    ok(off.stops > 0, 'and the stops themselves are untouched (' + off.stops + ' rows)');
    const saved = await plan(p, planId);
    ok(saved.plan.features && saved.plan.features.people === false && saved.plan.features.when === false
       && saved.plan.features.votes === false, 'the choice is on the plan, so it holds for everyone');
    // A friend arriving now is not asked who they are.
    await p.evaluate((id) => { localStorage.setItem('planner.devUid', 'local_quiet'); localStorage.removeItem('planner.name.' + id); }, planId);
    await p.reload({ waitUntil: 'networkidle2' });
    await waitFor(p, '#pl-buckets', 20000);
    ok(await p.$('.pl-tile') === null, 'and a newcomer is never asked for a name');
    // Put them back for the rest of the suite.
    await p.evaluate((id) => { localStorage.removeItem('planner.devUid'); localStorage.setItem('planner.name.' + id, 'Sergio'); }, planId);
    await p.reload({ waitUntil: 'networkidle2' });
    await waitFor(p, '#pl-buckets', 20000);
    await sleep(400);
    await p.evaluate(() => { document.querySelector('.pl-setwrap').open = true; });
    for (const k of ['people', 'when', 'votes']) {
      await tap(p, `[data-feat="${k}"]`);
      await sleep(500);
      await p.evaluate(() => { const d = document.querySelector('.pl-setwrap'); if (d) d.open = true; });
    }
    await sleep(600);
    ok(await p.$('.pl-vote') !== null && await p.$('#pl-when') !== null,
       'and turning them back on restores the lot');
  }

  // 18. Making something new lives on the map; the ⋯ menu keeps the rest.
  const made = await p.evaluate(() => {
    document.querySelector('#create-btn').click();
    const ids = [...document.querySelectorAll('#createmenu .menu-item')].map((b) => b.id);
    document.querySelector('#menu-btn').click();
    const inDots = [...document.querySelectorAll('#menu .menu-item')].map((b) => b.id);
    return { ids, inDots };
  });
  ok(made.ids.join(',') === 'c-new,c-plan', 'the + on the map offers both ways to start → ' + made.ids.join(' / '));
  ok(!made.inDots.includes('m-new') && !made.inDots.includes('m-plan'),
     'and the ⋯ menu is left with what you do to a map you have → ' + made.inDots.join(' / '));
  ok(made.inDots.includes('m-install'), 'Add to Home Screen is there in a browser');
  ok(!made.inDots.includes('m-lock'), 'and the lock-screen shortcut is hidden for now');
  // Which version is this phone actually running? The menu says so — and it has
  // to be the same version the service worker caches under, or it's a fib.
  const ver = await p.evaluate(async () => {
    const f = document.querySelector('#menu .menu-foot');
    const sw = await fetch('sw.js?probe=' + Date.now()).then((r) => r.text());
    return { shown: f ? f.textContent.trim() : '', cache: (sw.match(/promptrip-(v\d+)/) || [])[1] };
  });
  ok(ver.shown && ver.shown === ver.cache,
     'the menu names the version the worker caches → ' + ver.shown + ' / ' + ver.cache);
  // The row says where it goes: a plan that exists gets the iOS chevron.
  const labels = await p.evaluate(() => {
    const row = document.querySelector('#c-plan');
    return { text: row.querySelector('.mi-label').textContent, go: !!row.querySelector('.mi-go') };
  });
  ok(/^Plan with friends/.test(labels.text) && labels.go,
     'with a plan linked, the row points at it → ' + labels.text.slice(0, 40));
  const fresh = await p.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('library.v1'));
    lib.items.forEach((i) => delete i.planId);
    localStorage.setItem('library.v1', JSON.stringify(lib));
    const keep = localStorage.getItem('planner.last');
    localStorage.removeItem('planner.last');
    openCreate();                       // rebuild the menu with no plan in sight
    const row = document.querySelector('#c-plan');
    const out = { text: row.querySelector('.mi-label').textContent, go: !!row.querySelector('.mi-go') };
    localStorage.setItem('planner.last', keep);
    return out;
  });
  ok(/^Start a group plan/.test(fresh.text) && !fresh.go,
     'and with none, it says it starts one → ' + fresh.text.slice(0, 40));

  // 19. A pasted group link is also a way in from the planner's own first screen
  // — the only route into an app added to the Home Screen.
  {
    await p.goto(BASE + '#plan', { waitUntil: 'networkidle2' });
    await p.evaluate(() => { localStorage.removeItem('planner.last'); });
    await p.goto(BASE + '#plan', { waitUntil: 'networkidle2' });
    await waitFor(p, '#pl-join', 20000);
    await setVal(p, '#pl-join', 'https://sergfv.github.io/promptrip/#p=' + planId);
    await tap(p, '#pl-joingo');
    await waitFor(p, '#pl-buckets', 20000);
    const after = await p.evaluate(() => localStorage.getItem('planner.last'));
    ok(after === planId, 'pasting the group link on the start screen opens that plan → ' + after + ' vs ' + planId);
  }

  const goesBack = await p.evaluate(() => {
    document.querySelector('#create-btn').click();
    document.querySelector('#c-plan').click();
    return !document.getElementById('plannerview').hidden;
  });
  ok(goesBack, 'and "Plan with friends" there opens the plan');

  await b.close();
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
