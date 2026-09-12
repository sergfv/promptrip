/* Verifies the LIVE Firestore rules on promptrip-16220 with two real anonymous
   identities (separate browser contexts = separate uids). Creates one throwaway
   plan and deletes everything it created at the end. */
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8006/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const tap = (p, s) => p.evaluate((x) => { const el = document.querySelector(x); if (!el) throw new Error('missing ' + x); el.click(); }, s);
const setVal = (p, s, v) => p.evaluate((x, val) => { const el = document.querySelector(x); el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, s, v);
// Tests drive the page directly; the service worker only adds a second actor
// (it reloads the page when a new version takes over, which races the driver).
// The planner's UI is switched off in config.js for now; these checks are
// about the planner, so turn it on for their pages. Non-writable, or config.js
// would switch it straight back off.
const showPlanner = (p) => p.evaluateOnNewDocument(() =>
  Object.defineProperty(window, 'SHOW_PLANNER_UI', { value: true, writable: false }));
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
const uidOf = (p) => p.evaluate(() => firebase.auth().currentUser.uid);
// Run a Firestore call in the page and report success or the rules error code.
const probe = (p, fn, arg) => p.evaluate(async (src, a) => {
  try { const r = await eval('(' + src + ')')(firebase.firestore(), a); return { ok: true, value: r === undefined ? null : r }; }
  catch (e) { return { ok: false, code: e.code || String(e.message || e) }; }
}, fn.toString(), arg);

// Add one thing through the modal, the way a person would.
async function addThing(pg, bucket, title) {
  await tap(pg, `[data-addto="${bucket}"]`);
  await pg.waitForSelector('#am-save', { timeout: 20000 });
  await setVal(pg, '#am-title', title);
  await tap(pg, '#am-save');
  await sleep(900);
}

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  // ── Curator ──
  const cx1 = await b.createBrowserContext();
  const cur = await cx1.newPage();
  await noServiceWorker(cur);
  await showPlanner(cur);
  cur.on('pageerror', (e) => console.log('CURATOR PAGE ERROR:', e.message));
  await cur.goto(BASE + '#plan', { waitUntil: 'networkidle2' });
  await cur.evaluate(() => localStorage.setItem('pt_landing_seen', '1'));
  await cur.waitForSelector('#pl-create', { timeout: 20000 });
  await setVal(cur, '#pl-title', 'RULES CHECK — delete me');
  await setVal(cur, '#pl-place', 'Cadaqués');
  await setVal(cur, '#pl-roster', 'Marta\nSergio');
  await tap(cur, '#pl-create'); await cur.waitForSelector('#pl-next', { timeout: 20000 });
  const planId = await cur.evaluate(() => localStorage.getItem('planner.last'));
  const curUid = await uidOf(cur);
  ok(!!planId, 'curator created a plan in Firestore: ' + planId);
  await tap(cur, '#pl-next'); await cur.waitForSelector('.pl-tile[data-n="Sergio"]');
  await tap(cur, '.pl-tile[data-n="Sergio"]'); await cur.waitForSelector('#pl-go:not([disabled])');
  await tap(cur, '#pl-go'); await cur.waitForSelector('#pl-buckets', { timeout: 20000 });
  await addThing(cur, 'd1', 'Beach morning');
  await setVal(cur, 'select[data-k="arrive"]', 'd1'); await setVal(cur, 'input[data-k="arrive"]', '11:00'); await sleep(900);

  // ── Friend (separate context ⇒ separate anonymous uid) ──
  const cx2 = await b.createBrowserContext();
  const fr = await cx2.newPage();
  await noServiceWorker(fr);
  await showPlanner(fr);
  fr.on('pageerror', (e) => console.log('FRIEND PAGE ERROR:', e.message));
  await fr.goto(BASE + '#p=' + planId, { waitUntil: 'networkidle2' });
  await fr.waitForSelector('.pl-tile[data-n="Marta"]', { timeout: 20000 });
  const frUid = await uidOf(fr);
  ok(frUid !== curUid, 'friend has a different anonymous identity');
  await tap(fr, '.pl-tile[data-n="Marta"]'); await fr.waitForSelector('#pl-go:not([disabled])');
  await tap(fr, '#pl-go'); await fr.waitForSelector('#pl-buckets', { timeout: 20000 });
  ok(await fr.$('#pl-ai') === null, 'friend does not get the AI hand-off');
  const note = await fr.$$eval('.pl-note', (els) => els[els.length - 1].textContent.trim());
  ok(/Sergio hands this to an AI/.test(note), 'friend sees the curator named: ' + note.slice(0, 70));
  await addThing(fr, 'd1', 'Sunset at Cap de Creus');
  await setVal(fr, 'select[data-k="arrive"]', 'd1'); await setVal(fr, 'input[data-k="arrive"]', '09:30'); await sleep(900);

  // ── The rules themselves ──
  const readOther = async (db, a) => { const d = await db.doc('plans/' + a.plan + '/people/' + a.uid).get(); return d.exists ? d.data().name : 'MISSING'; };
  const r1 = await probe(fr, readOther, { plan: planId, uid: curUid });
  ok(r1.ok, 'friend CAN read the curator’s arrival times (shared with the group) → ' + (r1.ok ? r1.value : r1.code));
  const r2 = await probe(cur, readOther, { plan: planId, uid: frUid });
  ok(r2.ok && r2.value === 'Marta', 'curator CAN read a friend’s entry → ' + (r2.ok ? r2.value : r2.code));
  const listPeople = async (db, a) => { const q = await db.collection('plans/' + a.plan + '/people').get(); return q.size; };
  const r3 = await probe(fr, listPeople, { plan: planId });
  ok(r3.ok, 'friend CAN list everyone’s entries (needed by "Who’s there when") → ' + (r3.ok ? r3.value + ' people' : r3.code));
  const r4 = await probe(cur, listPeople, { plan: planId });
  ok(r4.ok && r4.value === 2, 'curator CAN list all entries → ' + (r4.ok ? r4.value + ' people' : r4.code));
  const writeSched = async (db, a) => { await db.doc('plans/' + a.plan + '/schedule/current').set({ days: { d1: [] }, hacked: true }); };
  const r5 = await probe(fr, writeSched, { plan: planId });
  ok(r5.ok, 'friend CAN set times / reorder (shared arranging) → ' + (r5.ok ? 'wrote it' : r5.code));
  const readIdeas = async (db, a) => { const q = await db.collection('plans/' + a.plan + '/ideas').get(); return q.size; };
  const r6 = await probe(fr, readIdeas, { plan: planId });
  ok(r6.ok && r6.value === 2, 'friend CAN read the shared ideas → ' + (r6.ok ? r6.value + ' ideas' : r6.code));
  const impersonate = async (db, a) => { await db.collection('plans/' + a.plan + '/ideas').add({ text: 'spoof', byUid: a.uid, byName: 'Sergio' }); };
  const r7 = await probe(fr, impersonate, { plan: planId, uid: curUid });
  ok(!r7.ok, 'friend CANNOT post an idea as someone else → ' + (r7.ok ? 'SPOOFED' : r7.code));

  // Renaming the plan — the curator's own, like everything else on the plan doc.
  const rename = async (db, a) => { await db.doc('plans/' + a.plan).update({ title: a.title }); };
  const r11 = await probe(fr, rename, { plan: planId, title: 'HIJACKED' });
  ok(!r11.ok, 'friend CANNOT rename the plan → ' + (r11.ok ? 'RENAMED IT' : r11.code));
  const r12 = await probe(cur, rename, { plan: planId, title: 'RULES CHECK — renamed' });
  ok(r12.ok, 'curator CAN rename the plan → ' + (r12.ok ? 'renamed it' : r12.code));

  // ── The curator's OWN second device: a different anonymous id, same person ──
  const cx3 = await b.createBrowserContext();
  const ph = await cx3.newPage();
  await noServiceWorker(ph);
  await showPlanner(ph);
  ph.on('pageerror', (e) => console.log('PHONE PAGE ERROR:', e.message));
  await ph.goto(BASE + '#p=' + planId, { waitUntil: 'networkidle2' });
  await ph.waitForSelector('.pl-tile[data-n="Sergio"]', { timeout: 20000 });
  const phUid = await uidOf(ph);
  ok(phUid !== curUid, 'the organiser’s phone is a different anonymous identity');
  await tap(ph, '.pl-tile[data-n="Sergio"]'); await ph.waitForSelector('#pl-go:not([disabled])');
  await tap(ph, '#pl-go'); await ph.waitForSelector('#pl-buckets', { timeout: 20000 });
  ok(await ph.$('#pl-ai') !== null, 'the organiser’s phone gets the AI hand-off');
  const r13 = await probe(ph, rename, { plan: planId, title: 'RULES CHECK — renamed from the phone' });
  ok(r13.ok, 'organiser’s phone CAN rename the plan (same name) → ' + (r13.ok ? 'renamed it' : r13.code));
  const nuke = async (db, a) => { await db.doc('plans/' + a.plan).delete(); };
  const r14 = await probe(ph, nuke, { plan: planId });
  ok(!r14.ok, 'but CANNOT delete the whole plan — that stays with the device that made it → ' + (r14.ok ? 'DELETED IT' : r14.code));
  // Reloading must not mint a new anonymous person: the stored session takes a
  // moment to come back, and asking too early used to sign in all over again —
  // leaving that phone's name, votes and times behind on the old identity.
  // A page with a live Firestore listener never goes network-idle: wait for the
  // document instead, then for the board to come back.
  await ph.reload({ waitUntil: 'domcontentloaded' });
  await ph.waitForSelector('#pl-buckets', { timeout: 20000 });
  const phUid2 = await uidOf(ph);
  ok(phUid2 === phUid, 'a reload keeps the same anonymous identity → ' + (phUid2 === phUid ? 'same person' : phUid + ' became ' + phUid2));
  ok(await ph.$('.pl-tile') === null, 'and is not asked who they are again');

  const rogue = async (db, a) => { await db.doc('plans/' + a.plan + '/people/' + a.uid).set({ name: 'Sergio' }); };
  await probe(fr, rogue, { plan: planId, uid: frUid });   // Marta renames herself "Sergio"…
  const r15 = await probe(fr, rename, { plan: planId, title: 'HIJACKED BY NAME' });
  ok(r15.ok, 'known trade-off: anyone who picks the organiser’s name gets that too → ' + (r15.ok ? 'renamed it' : r15.code));
  await probe(fr, async (db, a) => { await db.doc('plans/' + a.plan + '/people/' + a.uid).set({ name: 'Marta' }); }, { plan: planId, uid: frUid });

  // What the plan uses (names, travel times, voting) is the organiser's setting.
  const setFeat = async (db, a) => { await db.doc('plans/' + a.plan).set({ features: { votes: false } }, { merge: true }); };
  const r19 = await probe(fr, setFeat, { plan: planId });
  ok(!r19.ok, 'friend CANNOT switch the plan’s features → ' + (r19.ok ? 'SWITCHED THEM' : r19.code));
  const r20 = await probe(cur, setFeat, { plan: planId });
  ok(r20.ok, 'curator CAN switch them → ' + (r20.ok ? 'switched' : r20.code));

  // The finished map lives on the plan so every phone gets it from the link.
  // waitForPendingWrites: the same guarantee publishPlanItinerary makes before
  // the importer reloads the page out from under the write.
  const putItin = async (db, a) => { await db.doc('plans/' + a.plan).set({ itinerary: a.raw }, { merge: true }); await db.waitForPendingWrites(); };
  const itin = JSON.stringify({ title: 'RULES CHECK map', days: [{ label: 'Fri', stops: [] }] });
  const r16 = await probe(fr, putItin, { plan: planId, raw: '{"title":"HIJACKED"}' });
  ok(!r16.ok, 'friend CANNOT overwrite the group’s map → ' + (r16.ok ? 'OVERWROTE IT' : r16.code));
  const r17 = await probe(cur, putItin, { plan: planId, raw: itin });
  ok(r17.ok, 'curator CAN publish the map into the plan → ' + (r17.ok ? 'published' : r17.code));
  // Straight from the server: a cached copy could predate the write above.
  const readItin = async (db, a) => { const d = await db.doc('plans/' + a.plan).get({ source: 'server' }); return (d.data() || {}).itinerary || 'MISSING'; };
  // Another client can take a moment to see a fresh write: read until it does.
  let r18 = { ok: false, value: 'MISSING' };
  for (let i = 0; i < 6 && r18.value !== itin; i++) {
    if (i) await sleep(600);
    r18 = await probe(fr, readItin, { plan: planId });
  }
  ok(r18.ok && r18.value === itin, 'and everyone with the link can read it → ' + (r18.ok ? String(r18.value).slice(0, 40) : r18.code));

  // Flyers (the images collection added for the trip inbox)
  const addImg = async (db, a) => { const d = await db.collection('plans/' + a.plan + '/images').add({ data: 'ZmFrZS1qcGVn', byUid: a.uid }); return d.id; };
  const r8 = await probe(fr, addImg, { plan: planId, uid: frUid });
  ok(r8.ok, 'friend CAN add a flyer → ' + (r8.ok ? 'stored' : r8.code));
  const readImg = async (db, a) => { const d = await db.doc('plans/' + a.plan + '/images/' + a.img).get(); return d.exists ? d.data().data : 'MISSING'; };
  const r9 = await probe(cur, readImg, { plan: planId, img: r8.value });
  ok(r9.ok && r9.value === 'ZmFrZS1qcGVn', 'curator CAN read the friend’s flyer → ' + (r9.ok ? 'read it' : r9.code));
  const r10 = await probe(fr, addImg, { plan: planId, uid: curUid });
  ok(!r10.ok, 'friend CANNOT add a flyer as someone else → ' + (r10.ok ? 'SPOOFED' : r10.code));

  // ── A shared trip: a short link anyone can open, only the owner can replace ──
  const pubTrip = async (db, a) => {
    await db.collection('trips').doc(a.id).set({ data: a.raw, title: 'RULES CHECK trip', ownerUid: a.uid, updatedAt: Date.now() }, { merge: true });
    await db.waitForPendingWrites();
  };
  const readTrip = async (db, a) => { const d = await db.collection('trips').doc(a.id).get({ source: 'server' }); return d.exists ? d.data().data : 'MISSING'; };
  const tripId = 'rulescheck' + Math.random().toString(36).slice(2, 8);
  const t1 = await probe(cur, pubTrip, { id: tripId, raw: '{"title":"Trip one"}', uid: curUid });
  ok(t1.ok, 'anyone can publish a trip of their own → ' + (t1.ok ? 'published' : t1.code));
  let t2 = { value: 'MISSING' };
  for (let i = 0; i < 6 && t2.value !== '{"title":"Trip one"}'; i++) {
    if (i) await sleep(600);
    t2 = await probe(fr, readTrip, { id: tripId });
  }
  ok(t2.ok && t2.value === '{"title":"Trip one"}', 'and anyone with the link can open it → ' + String(t2.value).slice(0, 30));
  const t3 = await probe(fr, pubTrip, { id: tripId, raw: '{"title":"HIJACKED"}', uid: frUid });
  ok(!t3.ok, 'but someone else CANNOT replace it → ' + (t3.ok ? 'REPLACED IT' : t3.code));
  const t4 = await probe(cur, pubTrip, { id: tripId, raw: '{"title":"Trip two"}', uid: curUid });
  ok(t4.ok, 'the owner CAN replace it, so the same link follows their updates → ' + (t4.ok ? 'updated' : t4.code));
  await probe(cur, async (db, a) => { await db.collection('trips').doc(a.id).delete(); }, { id: tripId });

  // ── Clean up everything this check created ──
  const mine = async (db, a) => {
    const del = [];
    const ideas = await db.collection('plans/' + a.plan + '/ideas').get();
    ideas.forEach((d) => { if (d.data().byUid === a.uid) del.push(d.ref.delete()); });
    const votes = await db.collection('plans/' + a.plan + '/votes').get();
    votes.forEach((d) => { if (d.data().uid === a.uid) del.push(d.ref.delete()); });
    const imgs = await db.collection('plans/' + a.plan + '/images').get();
    imgs.forEach((d) => { if (d.data().byUid === a.uid) del.push(d.ref.delete()); });
    del.push(db.doc('plans/' + a.plan + '/people/' + a.uid).delete());
    await Promise.all(del); return del.length;
  };
  await probe(fr, mine, { plan: planId, uid: frUid });
  await probe(ph, mine, { plan: planId, uid: phUid });
  await probe(cur, mine, { plan: planId, uid: curUid });
  // Count and clear the subcollections BEFORE removing the plan document —
  // curatorOf() reads that document, so once it's gone every rule denies and
  // the leftovers would be stranded in the project.
  const finish = async (db, a) => {
    await db.doc('plans/' + a.plan + '/schedule/current').delete().catch(() => {});
    const left = (await db.collection('plans/' + a.plan + '/people').get()).size;
    for (const c of ['ideas', 'votes', 'images']) {
      const snap = await db.collection('plans/' + a.plan + '/' + c).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete().catch(() => {})));
    }
    await db.doc('plans/' + a.plan).delete();
    return left;
  };
  const cleanup = await probe(cur, finish, { plan: planId });
  ok(cleanup.ok && cleanup.value === 0, 'throwaway plan deleted, nothing left behind → ' + JSON.stringify(cleanup));
  await b.close();
  console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
