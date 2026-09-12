/* Promptrip — Group planner ("Plan with friends").
   One link pinned in the group chat. Anyone who opens it taps their name from
   the roster the curator set up (no account), adds ideas, votes, and says when
   they arrive and leave. The curator — whoever created the plan, on the device
   they created it — arranges the ideas into days with a time or time range,
   then sends the plan to the map (the normal itinerary viewer) or hands the
   gathered ideas to the AI. Shared state lives in Firebase (docs/planner-setup.md);
   with no config the planner still runs, but on this device only.
   Loaded after app.js and relies on its globals (ICON, CAT_ICON, esc, toast,
   showScrim, hideScrim,
   makeSheetDismissable, openImport, shareBase, PROMPT). */
(function () {
  'use strict';

  const view = document.getElementById('plannerview');
  if (!view) return;

  // ── Config / ids ──────────────────────────────────────────────
  const CFG = window.PLANNER_FIREBASE || null;
  const SHARED = !!(CFG && CFG.projectId && CFG.apiKey);
  const LAST_KEY = 'planner.last';
  const nameKey = (id) => 'planner.name.' + id;
  const pid = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  // Categories a friend can tag an idea with (drives its icon + photo rule).
  const CATS = ['food', 'bar', 'cafe', 'beach', 'walk', 'viewpoint', 'museum', 'park', 'shop', 'market', 'church', 'landmark'];
  const CAT_LABEL = { food: 'Food', bar: 'Drinks', cafe: 'Café', beach: 'Beach', walk: 'Walk', viewpoint: 'View', museum: 'Museum', park: 'Park', shop: 'Shop', market: 'Market', church: 'Church', landmark: 'Landmark' };
  const IDEA_ICON = SVG('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>');
  const HEART = SVG('<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.4-7 10-7 10z"/>');
  const CLOCK = SVG('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>');
  const ARROW = SVG('<path d="M5 12h14M13 6l6 6-6 6"/>');
  const LINK = SVG('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>');
  const copyStr = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    return Promise.resolve(fallbackCopy(text));
  };
  // A photo or screenshot, shrunk in the browser to something a Firestore
  // document can hold (1 MiB hard cap) while staying readable to an AI.
  function fileToBase64(file, maxPx = 1100) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let q = 0.74, out = c.toDataURL('image/jpeg', q);
        while (out.length > 700000 && q > 0.32) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
        if (out.length > 700000) return reject(new Error('That image is too big even shrunk — try a screenshot of it'));
        resolve(out.split(',')[1]);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Couldn’t read that image')); };
      img.src = url;
    });
  }

  // Animated GIFs must keep their original bytes — re-encoding one through a
  // canvas leaves a single frozen frame. Anything else gets shrunk to JPEG.
  function readAsBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(new Error('Couldn’t read that file'));
      r.readAsDataURL(file);
    });
  }
  async function imageToStore(file) {
    if (file.type === 'image/gif') {
      const raw = await readAsBase64(file);
      if (raw.length < 700000) return { data: raw, mime: 'image/gif' };
      throw new Error('That GIF is too big — try a smaller one');
    }
    return { data: await fileToBase64(file), mime: 'image/jpeg' };
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  // ── Store: this device only (no Firebase config) ─────────────
  // Same interface as the Firebase store, backed by localStorage, so the whole
  // planner can be tried — and verified — before the one-time backend setup.
  const LOCAL_KEY = 'planner.local.v1';
  function localStore() {
    let db = null;
    let devUid = null; // test hook: pretend to be another person — in memory only, never persisted
    const subs = {};
    const load = () => {
      try { db = JSON.parse(lsGet(LOCAL_KEY)) || null; } catch (e) { db = null; }
      if (!db) db = { uid: 'local_' + pid(), plans: {} };
      devUid = lsGet('planner.devUid') || null;
    };
    const save = () => lsSet(LOCAL_KEY, JSON.stringify(db));
    const snapshot = (planId) => {
      const p = db.plans[planId];
      if (!p) return { exists: false };
      return {
        exists: true, plan: p.plan, people: p.people,
        ideas: Object.keys(p.ideas).map((id) => ({ id, ...p.ideas[id] })).sort((a, b) => a.createdAt - b.createdAt),
        votes: p.votes, schedule: p.schedule,
      };
    };
    const emit = (planId) => (subs[planId] || []).forEach((cb) => cb(snapshot(planId)));
    const plan = (id) => { load(); return db.plans[id]; };
    return {
      shared: false,
      // Persist straight away so the device identity is stable: without this
      // every later load() before the first write would mint a new uid, and
      // the curator would stop being the curator after a reload.
      async init() { load(); save(); return { uid: devUid || db.uid }; },
      async createPlan(data) {
        load();
        const id = pid();
        db.plans[id] = { plan: { ...data, createdAt: Date.now() }, people: {}, ideas: {}, votes: {}, images: {}, schedule: { days: {} } };
        save(); return id;
      },
      async publishTrip(tripId, raw, title, uid) {
        load();
        const id = tripId || pid();
        db.trips = db.trips || {};
        db.trips[id] = { data: raw, title: title || '', ownerUid: uid, updatedAt: Date.now() };
        save(); return id;
      },
      async readTrip(tripId) {
        load();
        const t = (db.trips || {})[tripId];
        return t ? { raw: t.data, updatedAt: t.updatedAt } : null;
      },
      watch(planId, cb) {
        load();
        (subs[planId] = subs[planId] || []).push(cb);
        cb(snapshot(planId));
        const onS = (e) => { if (e.key === LOCAL_KEY) { load(); cb(snapshot(planId)); } };
        window.addEventListener('storage', onS);
        return () => { subs[planId] = (subs[planId] || []).filter((f) => f !== cb); window.removeEventListener('storage', onS); };
      },
      async setPerson(planId, uid, data) { const p = plan(planId); if (!p) return; p.people[uid] = { ...(p.people[uid] || {}), ...data, updatedAt: Date.now() }; save(); emit(planId); },
      async addIdea(planId, data) { const p = plan(planId); if (!p) return null; const id = pid(); p.ideas[id] = { ...data, createdAt: Date.now() }; save(); emit(planId); return id; },
      async updateIdea(planId, ideaId, data) { const p = plan(planId); if (!p || !p.ideas[ideaId]) return; Object.assign(p.ideas[ideaId], data); save(); emit(planId); },
      async deleteIdea(planId, ideaId) { const p = plan(planId); if (!p) return; delete p.ideas[ideaId]; Object.keys(p.votes).forEach((k) => { if (p.votes[k].ideaId === ideaId) delete p.votes[k]; }); save(); emit(planId); },
      async toggleVote(planId, uid, ideaId, on) { const p = plan(planId); if (!p) return; const k = uid + '_' + ideaId; if (on) p.votes[k] = { uid, ideaId }; else delete p.votes[k]; save(); emit(planId); },
      async saveSchedule(planId, days) { const p = plan(planId); if (!p) return; p.schedule = { days, updatedAt: Date.now() }; save(); emit(planId); },
      async updatePlan(planId, data) { const p = plan(planId); if (!p) return; Object.assign(p.plan, data); save(); emit(planId); },
      // Image bytes live apart from the item list so the live list stays cheap;
      // they're fetched only when a thumbnail is actually rendered.
      async addImage(planId, data, mime) { const p = plan(planId); if (!p) return null; p.images = p.images || {}; const id = pid(); p.images[id] = { data, mime: mime || 'image/jpeg' }; save(); return id; },
      async getImage(planId, imageId) {
        const p = plan(planId);
        const v = p && p.images && p.images[imageId];
        if (!v) return null;
        return typeof v === 'string' ? { data: v, mime: 'image/jpeg' } : v;   // legacy entries were bare base64
      },
      async deleteImage(planId, imageId) { const p = plan(planId); if (!p || !p.images) return; delete p.images[imageId]; save(); },
    };
  }

  // ── Store: Firebase (shared with everyone who opens the link) ─
  // The SDK is loaded only when the planner opens, so the offline shell stays
  // lean for everyone who never uses it. Friends sign in anonymously — a
  // stable hidden identity per device, no sign-up, nothing to type.
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function firebaseStore() {
    let fs = null, uid = null;
    const base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    const ts = () => firebase.firestore.FieldValue.serverTimestamp();
    const ref = (planId) => fs.collection('plans').doc(planId);
    return {
      shared: true,
      async init() {
        if (!window.firebase) {
          await loadScript(base + 'firebase-app-compat.js');
          await loadScript(base + 'firebase-auth-compat.js');
          await loadScript(base + 'firebase-firestore-compat.js');
        }
        if (!firebase.apps.length) firebase.initializeApp(CFG);
        const auth = firebase.auth();
        fs = firebase.firestore();
        // currentUser is null until the SDK has read the stored session back,
        // so wait for the first auth state before deciding to sign in. Without
        // this, every reload creates a brand-new anonymous person: their name,
        // their votes and their times all left behind on the old identity.
        const restored = await new Promise((resolve) => {
          const un = auth.onAuthStateChanged((u) => { un(); resolve(u); }, () => resolve(null));
        });
        const user = restored || (await auth.signInAnonymously()).user;
        uid = user.uid;
        return { uid };
      },
      async createPlan(data) {
        const id = pid();
        await ref(id).set({ ...data, createdAt: ts() });
        await ref(id).collection('schedule').doc('current').set({ days: {}, updatedAt: ts() });
        return id;
      },
      watch(planId, cb) {
        const r = ref(planId);
        const st = { exists: null, error: false, plan: null, people: {}, ideas: [], votes: {}, schedule: { days: {} } };
        const push = () => { if (st.exists !== null || st.error) cb({ ...st }); };
        const subs = [
          r.onSnapshot((d) => { st.error = false; st.exists = d.exists; st.plan = d.exists ? d.data() : null; push(); },
            // Offline, or a permission hiccup: the plan is not gone, we just
            // can't see it right now. Saying "not found" would be a lie.
            () => { st.error = true; push(); }),
          r.collection('people').onSnapshot((q) => { const o = {}; q.forEach((x) => { o[x.id] = x.data(); }); st.people = o; push(); }),
          r.collection('ideas').orderBy('createdAt').onSnapshot((q) => { const a = []; q.forEach((d) => a.push({ id: d.id, ...d.data() })); st.ideas = a; push(); }),
          r.collection('votes').onSnapshot((q) => { const o = {}; q.forEach((d) => { o[d.id] = d.data(); }); st.votes = o; push(); }),
          r.collection('schedule').doc('current').onSnapshot((d) => { st.schedule = d.exists ? d.data() : { days: {} }; push(); }),
        ];
        return () => subs.forEach((u) => u());
      },
      setPerson: (planId, u, data) => ref(planId).collection('people').doc(u).set({ ...data, updatedAt: ts() }, { merge: true }),
      async addIdea(planId, data) { const d = await ref(planId).collection('ideas').add({ ...data, createdAt: ts() }); return d.id; },
      updateIdea: (planId, ideaId, data) => ref(planId).collection('ideas').doc(ideaId).set(data, { merge: true }),
      deleteIdea: (planId, ideaId) => ref(planId).collection('ideas').doc(ideaId).delete(),
      toggleVote(planId, u, ideaId, on) { const v = ref(planId).collection('votes').doc(u + '_' + ideaId); return on ? v.set({ uid: u, ideaId }) : v.delete(); },
      saveSchedule: (planId, days) => ref(planId).collection('schedule').doc('current').set({ days, updatedAt: ts() }),
      updatePlan: (planId, data) => ref(planId).set(data, { merge: true }),
      // Resolves once everything written so far is acknowledged by the server.
      // A write that has only reached the local queue dies with the page.
      flush: () => fs.waitForPendingWrites(),
      // A shared trip: the map itself, under a short id, owned by whoever
      // published it. Anyone with the link reads it; only the owner replaces it.
      async publishTrip(tripId, raw, title, uid) {
        const id = tripId || pid();
        await fs.collection('trips').doc(id).set({ data: raw, title: title || '', ownerUid: uid, updatedAt: Date.now() }, { merge: true });
        await fs.waitForPendingWrites();
        return id;
      },
      async readTrip(tripId) {
        const d = await fs.collection('trips').doc(tripId).get();
        if (!d.exists) return null;
        const v = d.data();
        return { raw: v.data || '', updatedAt: v.updatedAt || 0 };
      },
      // Image bytes live in their own collection, never subscribed to as a
      // whole: an image is ~100 KB and the live item list must stay cheap.
      async addImage(planId, data, mime) {
        const d = await ref(planId).collection('images').add({ data, mime: mime || 'image/jpeg', byUid: uid, createdAt: ts() });
        return d.id;
      },
      async getImage(planId, imageId) {
        const d = await ref(planId).collection('images').doc(imageId).get();
        if (!d.exists) return null;
        const v = d.data();
        return { data: v.data, mime: v.mime || 'image/jpeg' };
      },
      deleteImage: (planId, imageId) => ref(planId).collection('images').doc(imageId).delete(),
    };
  }

  // ── State ─────────────────────────────────────────────────────
  const P = { store: null, uid: null, planId: null, st: null, me: '', mode: 'home', unsub: null, cat: null, draft: '', strip: null, edit: null, addName: false, renaming: false, brief: '', seg: 'suggest', busy: false };
  const sameName = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  // Identity here is per device — the same person on a phone and a laptop is two
  // anonymous ids. The organiser opening their own link on their phone is still
  // the organiser, so the name the plan records counts as well as the id that
  // made it. With no logins and a link anyone can edit, the name IS the identity.
  const isCurator = () => !!(P.st && P.st.plan &&
    (P.st.plan.curatorUid === P.uid || sameName(P.st.plan.curatorName, P.me)));
  // The curator's name lives on the plan itself: each person's entry under
  // people/ is private to them (and the curator), so friends can't read it
  // from there — see firestore.rules.
  const curatorName = () => {
    const p = P.st && P.st.plan;
    if (!p) return 'the organiser';
    const who = P.st.people[p.curatorUid];
    return p.curatorName || (who && who.name) || 'the organiser';
  };
  // Not every group wants the whole apparatus. A plan can switch off the parts
  // it doesn't need; the code stays, so another trip can have them. Absent
  // means on — every plan made before this keeps working unchanged.
  const FEATURES = [
    { key: 'people', label: 'Names', note: 'Everyone picks their name, and ideas show who added them' },
    { key: 'when', label: 'Arrival and leaving times', note: '"When I\'m there", and who overlaps with whom' },
    { key: 'votes', label: 'Voting', note: 'A heart on every idea' },
  ];
  const feat = (k) => {
    const f = P.st && P.st.plan && P.st.plan.features;
    return !(f && f[k] === false);
  };
  const voteCount = (ideaId) => Object.values(P.st.votes || {}).filter((v) => v.ideaId === ideaId).length;
  const myVote = (ideaId) => !!(P.st.votes || {})[P.uid + '_' + ideaId];
  const ideaById = (id) => (P.st.ideas || []).find((i) => i.id === id);
  const timeStr = (it) => (it.start ? it.start + (it.end ? '–' + it.end : '') : '');
  const dayLabelFor = (date, n) => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const d = new Date(date + 'T12:00:00');
      if (!isNaN(d)) return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    }
    return 'Day ' + n;
  };
  const dateRange = (days) => days.map((d) => d.label).join(' – ');
  const catIcon = (c) => (c && CAT_ICON[c]) || IDEA_ICON;
  const ini = (n) => esc((n || '?').trim().charAt(0).toUpperCase());
  const link = () => shareBase() + '#p=' + P.planId;

  // ── Sheet shell ───────────────────────────────────────────────
  function shell(inner, opts = {}) {
    view.innerHTML =
      `<div class="sheet-grab"></div>` +
      `<div class="lv-nav">` +
      (opts.back ? `<button class="lv-navbtn" type="button" id="pl-back" aria-label="Back">${ICON.chevLeft}</button>` : '') +
      `<span style="flex:1"></span>` +
      `<button class="lv-navbtn" type="button" id="pl-close" aria-label="Close">${ICON.close}</button></div>` +
      `<div class="lv-body">${inner}</div>`;
    view.querySelector('#pl-close').addEventListener('click', closePlanner);
    const b = view.querySelector('#pl-back');
    if (b && opts.back) b.addEventListener('click', opts.back);
  }
  const eyebrow = (t) => `<div class="pl-eyebrow">${t}</div>`;
  const notShared = () => (SHARED ? '' :
    `<div class="pl-warn"><b>This device only.</b> Sharing with the group needs a one-time Firebase setup — see <code>docs/planner-setup.md</code>. Everything here works meanwhile, just not across phones.</div>`);

  // ── Home: start a plan ────────────────────────────────────────
  function renderHome() {
    const last = lsGet(LAST_KEY);
    shell(
      eyebrow('Plan with friends') +
      `<h1 class="lv-title">Start a group plan</h1>` +
      `<p class="pl-lead">One link for the group. Everyone adds ideas and says when they'll be there — no account. You arrange the days and send the plan to the map.</p>` +
      notShared() +
      `<details class="pl-more pl-joinwrap"><summary>Already have a group link?</summary>` +
        `<div class="pl-addrow"><input class="pl-input" id="pl-join" placeholder="Paste the link the group shared" autocapitalize="off" autocorrect="off" spellcheck="false">` +
        `<button class="pl-addbtn" type="button" id="pl-joingo" aria-label="Open that plan">${ICON.chevRight}</button></div>` +
        `<div class="pl-note" style="text-align:left;margin-top:6px">Tapping a link can never open an app you've added to your Home Screen, so paste it here instead.</div>` +
      `</details>` +
      `<div class="pl-field"><label class="pl-label" for="pl-title">Trip name</label><input class="pl-input" id="pl-title" placeholder="Weekend in Cadaqués" maxlength="60"></div>` +
      `<div class="pl-field"><label class="pl-label" for="pl-place">Where</label><input class="pl-input" id="pl-place" placeholder="Town or area — used to place stops on the map" maxlength="80"></div>` +
      `<div class="pl-field"><label class="pl-label" for="pl-ndays">Days</label><select class="pl-input" id="pl-ndays"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option><option value="4">4</option></select></div>` +
      `<div id="pl-dates" class="pl-field" style="margin-top:8px"></div>` +
      `<div class="pl-field"><label class="pl-label" for="pl-roster">Who's coming — one name per line</label><textarea class="pl-input" id="pl-roster" placeholder="Marta&#10;Jordi&#10;Laia&#10;…"></textarea>` +
      `<div class="pl-note" style="text-align:left;margin-top:4px">Friends tap their name the first time they open the link. Anyone missing can add themselves.</div></div>` +
      `<div class="pl-actions"><button class="imp-go" type="button" id="pl-create"><span class="ig-ic">${ICON.people}</span>Create the plan</button>` +
      (last ? `<button class="pl-link" type="button" id="pl-resume">Open my current plan</button>` : '') +
      `</div>`
    );
    const dates = view.querySelector('#pl-dates');
    const nd = view.querySelector('#pl-ndays');
    const drawDates = () => {
      const n = +nd.value;
      dates.innerHTML = Array.from({ length: n }, (_, i) =>
        `<div style="display:flex;align-items:center;gap:10px"><span class="pl-label" style="width:52px">Day ${i + 1}</span><input class="pl-input" type="date" data-i="${i}" style="height:44px;flex:1"></div>`
      ).join('');
    };
    nd.addEventListener('change', drawDates);
    drawDates();
    view.querySelector('#pl-create').addEventListener('click', createPlan);
    const rs = view.querySelector('#pl-resume');
    if (rs) rs.addEventListener('click', () => openPlanner(last));
    const joinIn = view.querySelector('#pl-join');
    const join = () => {
      const m = (joinIn.value || '').match(/#p=([a-z0-9]{6,24})\b/i);
      if (!m) { toast('That doesn’t look like a group link'); return; }
      openPlanner(m[1]);
    };
    view.querySelector('#pl-joingo').addEventListener('click', join);
    joinIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); join(); } });
  }

  async function createPlan() {
    const title = view.querySelector('#pl-title').value.trim();
    const place = view.querySelector('#pl-place').value.trim();
    if (!title) { toast('Give the trip a name'); return; }
    if (!place) { toast('Where is it? That’s how stops get placed on the map'); return; }
    const dateEls = Array.from(view.querySelectorAll('#pl-dates input[type=date]'));
    const days = dateEls.map((el, i) => ({ id: 'd' + (i + 1), date: el.value || null, label: dayLabelFor(el.value, i + 1) }));
    const roster = Array.from(new Set(view.querySelector('#pl-roster').value.split(/\n/).map((s) => s.trim()).filter(Boolean))).slice(0, 40);
    if (P.busy) return; P.busy = true;
    try {
      const id = await P.store.createPlan({ title, place, days, roster, curatorUid: P.uid });
      lsSet(LAST_KEY, id);
      history.replaceState(null, '', location.pathname + location.search + '#p=' + id);
      P.mode = 'link';
      watchPlan(id);
    } catch (e) {
      toast('Couldn’t create the plan — check your connection');
    } finally { P.busy = false; }
  }

  // ── Link: pin it in the group ─────────────────────────────────
  function renderLink() {
    const url = link();
    shell(
      eyebrow('Plan created') +
      `<h1 class="lv-title">${esc(P.st.plan.title)}</h1>` +
      `<p class="pl-lead">Pin this link in the group chat. Everyone who opens it can add ideas straight away.</p>` +
      notShared() +
      `<div class="lv-group" style="margin-top:14px"><div class="pl-row"><span class="pl-ic">${LINK}</span><span class="pl-txt" style="font-size:14px;word-break:break-all;color:var(--ink-soft)">${esc(url)}</span></div></div>` +
      `<div class="pl-actions"><button class="imp-go" type="button" id="pl-share"><span class="ig-ic">${ICON.share}</span>Share the link</button>` +
      `<button class="pl-link" type="button" id="pl-next">Continue — pick your own name</button></div>`
    );
    view.querySelector('#pl-share').addEventListener('click', shareLinkNow);
    view.querySelector('#pl-next').addEventListener('click', () => { P.mode = 'name'; render(); });
  }
  function shareLinkNow() {
    const url = link();
    if (navigator.share) navigator.share({ title: P.st.plan.title, url }).catch(() => {});
    else copyStr(url).then(() => toast('Link copied — pin it in the group'));
  }

  // ── Name: who are you? ────────────────────────────────────────
  // Everyone on the "Who are you?" list: the names the plan was set up with,
  // plus anyone who added their own. One entry per person — the same person on
  // a phone and a laptop is two identities, but still one friend on the trip.
  function groupNames(extra) {
    const out = [], seen = new Set();
    [...((P.st.plan && P.st.plan.roster) || []),
     ...Object.values(P.st.people || {}).map((p) => p.name),
     ...(extra ? [extra] : [])].forEach((n) => {
      const t = (n || '').trim(); if (!t) return;
      const k = t.toLowerCase(); if (seen.has(k)) return;
      seen.add(k); out.push(t);
    });
    return out;
  }
  function renderName() {
    const plan = P.st.plan;
    // A name typed in below joins the tiles straight away, already chosen.
    const names = groupNames(P.me);
    shell(
      eyebrow('Group plan') +
      `<h1 class="lv-title">${esc(plan.title)}</h1>` +
      `<p class="pl-lead">${esc(curatorName())} set this up for ${names.length || 'the group'}. Tap your name so your ideas and times are yours — no account needed.</p>` +
      `<div class="pl-sec" style="margin-top:22px">Who are you?</div>` +
      `<div class="pl-tiles" id="pl-tiles">` +
      names.map((n) => `<button class="pl-tile${n === P.me ? ' on' : ''}" type="button" data-n="${esc(n)}"><span class="pl-ini">${ini(n)}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(n)}</span>${n === P.me ? ICON.check : ''}</button>`).join('') +
      `</div>` +
      `<div class="pl-actions"><button class="imp-go" type="button" id="pl-go"${P.me ? '' : ' disabled style="opacity:.45"'}>${P.me ? 'Continue as ' + esc(P.me) : 'Continue'}</button></div>` +
      // Adding a name is the rarer path, so it stays a quiet link until asked for.
      `<details class="pl-more pl-newwrap"${P.addName ? ' open' : ''}><summary>Not on the list?</summary>` +
        `<div class="pl-addrow"><input class="pl-input" id="pl-newname" placeholder="Add your name" maxlength="40"><button class="pl-addbtn" type="button" id="pl-addname" aria-label="Add">${ICON.plus}</button></div>` +
      `</details>` +
      `<div class="pl-note">Remembered on this phone — you won’t be asked again.</div>`,
      { back: P.mode === 'name' && lsGet(nameKey(P.planId)) ? () => { P.mode = 'board'; render(); } : null }
    );
    view.querySelectorAll('.pl-tile').forEach((b) => b.addEventListener('click', () => { P.me = b.dataset.n; renderName(); }));
    const addName = () => {
      const n = view.querySelector('#pl-newname').value.trim();
      if (!n) return;
      P.me = n; P.addName = false; renderName();
    };
    view.querySelector('#pl-addname').addEventListener('click', addName);
    view.querySelector('#pl-newname').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addName(); } });
    // Remember that it was opened, and put the cursor straight in the field.
    const wrap = view.querySelector('.pl-newwrap');
    wrap.addEventListener('toggle', () => {
      P.addName = wrap.open;
      if (wrap.open) view.querySelector('#pl-newname').focus();
    });
    view.querySelector('#pl-go').addEventListener('click', async () => {
      if (!P.me) return;
      lsSet(nameKey(P.planId), P.me);
      await P.store.setPerson(P.planId, P.uid, withAdoptedTimes(P.me));
      // Publish the curator's name on the plan so everyone can see who arranges
      // the days (their own people/ entry is private to them).
      if (isCurator() && P.st.plan.curatorName !== P.me) P.store.updatePlan(P.planId, { curatorName: P.me });
      P.mode = 'board'; render();
    });
  }

  // ── Board: suggest, vote, say when you're there ───────────────
  function renderBoard() {
    const plan = P.st.plan;
    const cur = isCurator();
    shell(
      eyebrow('Group plan') +
      (P.renaming
        ? `<div class="pl-rename"><input class="pl-input" id="pl-title-new" value="${esc(plan.title)}" maxlength="80" aria-label="Plan name">` +
          `<button class="pl-mini pl-done" type="button" id="pl-title-save">Save</button></div>`
        : `<h1 class="lv-title pl-h1" style="margin-top:4px"><span>${esc(plan.title)}</span>` +
          (cur ? `<button class="pl-pencil" type="button" id="pl-title-edit" aria-label="Rename this plan">${ICON.pencil}</button>` : '') +
          `</h1>`) +
      `<div class="pl-sub">${esc(dateRange(plan.days))} · ${esc(plan.place)}</div>` +
      `<div id="pl-maprow"></div>` +
      (feat('when')
        ? `<div class="pl-sec">When I’m there` +
          (feat('people') ? `<button class="pl-me" type="button" id="pl-who" style="margin-left:auto"><span class="pl-ini">${ini(P.me)}</span>${esc(P.me)}${ICON.chevDown}</button>` : '') +
          `</div><div class="lv-group" id="pl-when"></div>` +
          `<button class="pl-rosterlink" type="button" id="pl-roster-link"></button>`
        : (feat('people')
          ? `<div class="pl-sec">You<button class="pl-me" type="button" id="pl-who" style="margin-left:auto"><span class="pl-ini">${ini(P.me)}</span>${esc(P.me)}${ICON.chevDown}</button></div>`
          : '')) +
      `<div class="pl-sec">Plan</div>` +
      `<div id="pl-buckets"></div>` +
      `<div class="pl-actions" style="margin-top:18px">` +
      (cur ? `<button class="imp-go" type="button" id="pl-ai"><span class="ig-ic">${ICON.magic}</span>Hand it to your AI</button>` : '') +
      `<button class="pl-link" type="button" id="pl-copy">Copy the group link</button></div>` +
      (cur
        ? `<details class="pl-more pl-setwrap"><summary>What this plan uses</summary>` +
          FEATURES.map((f) => `<button class="pl-set" type="button" data-feat="${f.key}" role="switch" aria-checked="${feat(f.key)}">` +
            `<span><b>${f.label}</b>${esc(f.note)}</span><span class="switch${feat(f.key) ? ' on' : ''}"></span></button>`).join('') +
          `<div class="pl-note" style="text-align:left;margin-top:8px">Switching one off hides it for everyone on this plan. Nothing is deleted — turn it back on and it returns.</div>` +
          `</details>`
        : '') +
      `<div class="pl-note">${cur
        ? 'Your AI turns all of this into the map — it reads the images, and names a real place for anything vague.'
        : esc(curatorName()) + ' hands this to an AI to build the map. Anyone can add, vote and set times.'}${SHARED ? '' : ' · this device only until Firebase is set up'}</div>`
    );
    const who = view.querySelector('#pl-who');
    if (who) who.addEventListener('click', () => { P.mode = 'name'; render(); });
    const rename = view.querySelector('#pl-title-edit');
    if (rename) rename.addEventListener('click', () => { P.renaming = true; renderBoard(); });
    const tin = view.querySelector('#pl-title-new');
    if (tin) {
      const save = () => {
        const t = tin.value.trim();
        if (t && t !== P.st.plan.title) {
          const was = P.st.plan.title;
          P.st.plan.title = t;                       // show it at once; the store catches up
          Promise.resolve(P.store.updatePlan(P.planId, { title: t }))
            .catch(() => { P.st.plan.title = was; toast('Couldn’t save the new name'); refreshBoard(true); });
        }
        P.renaming = false; renderBoard();
      };
      view.querySelector('#pl-title-save').addEventListener('click', save);
      tin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { P.renaming = false; renderBoard(); }
      });
      tin.focus(); tin.select();
    }
    view.querySelector('#pl-copy').addEventListener('click', shareLinkNow);
    const rl = view.querySelector('#pl-roster-link');
    if (rl) rl.addEventListener('click', openRoster);
    const f = document.createElement('input');
    f.type = 'file'; f.accept = 'image/*'; f.id = 'pl-imgfile'; f.hidden = true;
    view.appendChild(f);
    f.addEventListener('change', async () => {
      if (!f.files || !f.files[0]) return;
      const file = f.files[0]; f.value = '';
      await attachImage(file);
    });
    view.querySelectorAll('[data-feat]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.feat;
      const features = { ...(P.st.plan.features || {}) };
      features[k] = !feat(k);
      P.st.plan.features = features;                 // show it at once
      Promise.resolve(P.store.updatePlan(P.planId, { features }))
        .catch(() => toast('Couldn’t save that'));
      renderBoard();
      const again = view.querySelector('.pl-setwrap');
      if (again) again.open = true;
    }));
    const ai = view.querySelector('#pl-ai');
    if (ai) ai.addEventListener('click', askAI);
    refreshBoard(true);
  }

  // The plan and the map are two halves of the same trip, so the board says
  // plainly where the map is: waiting in your itineraries, or not yet shared.
  function refreshMapRow() {
    const wrap = view.querySelector('#pl-maprow');
    if (!wrap) return;
    const pubRaw = (P.st.plan && P.st.plan.itinerary) || '';
    const info = (typeof window.planMapInfo === 'function' && window.planMapInfo(P.planId, pubRaw)) || { has: false };
    const published = !!pubRaw;
    const mine = info.name || info.spare;
    let html = '';
    if (isCurator() && mine && !info.inSync) {
      // Naming it matters: an untagged map is only a guess at which one they
      // mean, and a wrong guess goes to everyone.
      html = `<button class="pl-maprow" type="button" id="pl-sharemap" data-guess="${info.name ? '' : '1'}">${ICON.share}` +
        `<span><b>${published ? 'Update the group’s map' : 'Share this map with the group'}</b>` +
        `“${esc(mine)}”${published ? ' — replaces what the group sees now' : ' — so everyone’s link opens it too'}</span>${ICON.chevRight}</button>`;
    } else if (info.has && !info.onScreen) {
      html = `<button class="pl-maprow" type="button" id="pl-openmap">${ICON.pin}` +
        `<span><b>Open the group’s map</b>${esc(info.name)}</span>${ICON.chevRight}</button>`;
    } else if (!published && isCurator()) {
      html = `<div class="pl-maprow is-note">${ICON.magic}<span><b>No map yet</b>Hand the plan to your AI, paste its reply back, and the map lands here for everyone.</span></div>`;
    }
    wrap.innerHTML = html;
    const open = wrap.querySelector('#pl-openmap');
    if (open) open.addEventListener('click', () => window.openPlanMap(P.planId));
    const share = wrap.querySelector('#pl-sharemap');
    if (share) share.addEventListener('click', async () => {
      const pay = window.planMapPayload(P.planId);
      if (!pay) { toast('No map on this device yet'); return; }
      // A map that isn't tagged to this plan is a guess — make them look at the
      // name once before it reaches everyone.
      if (share.dataset.guess === '1' && !share.dataset.sure) {
        share.dataset.sure = '1';
        const b = share.querySelector('b');
        if (b) b.textContent = 'Tap again to send that map';
        setTimeout(() => { if (wrap.contains(share)) refreshMapRow(); }, 6000);
        return;
      }
      share.disabled = true;
      try {
        await window.publishPlanItinerary(P.planId, pay.raw);
        window.stampPlanMap(P.planId, pay.id, pay.rev);
        toast('Shared — everyone’s link opens the map now');
      } catch (e) {
        toast('Couldn’t share the map — try again');
        share.disabled = false;
      }
    });
  }

  // One stop. Inside a day it's numbered and can carry a time; under "Any day"
  // it's just the idea, waiting to be given one. Same row, same controls, for
  // everyone — the hand-off to the AI is the only curator-only thing.
  function itemRow(it, opts = {}) {
    const inDay = !!opts.dayId;
    const slot = opts.slot || {};
    const t = timeStr(slot);
    const key = inDay ? opts.dayId + ':' + opts.index : '';
    const n = voteCount(it.id), on = myVote(it.id);
    const sent = sentIds(), showNew = everSent();
    const open = P.strip === key && inDay;
    const badge = showNew && !sent.has(it.id) ? `<span class="pl-new">not on the map yet</span>` : '';
    const sub = it.place ? `<div class="pl-meta pl-place">${ICON.pin}${esc(it.place)}</div>`
      : (it.url ? `<div class="pl-meta pl-url">${esc(it.url)}</div>` : '');
    const lead = inDay
      ? `<button class="lv-num" type="button" data-act="strip" data-key="${key}" style="background:${opts.color};border:none;cursor:pointer;font-family:inherit">${opts.index + 1}</button>`
      : `<span class="pl-ic">${it.imageId ? '' : (it.url ? LINK : catIcon(it.category))}</span>`;
    const shot = it.imageId ? `<span class="pl-shot pl-shot-sm" data-img="${esc(it.imageId)}" role="button" tabindex="0" aria-label="View image"></span>` : '';
    const opener = inDay
      ? `<button class="pl-txt pl-open" type="button" data-act="strip" data-key="${key}">`
      : `<button class="pl-txt pl-open" type="button" data-act="loose" data-id="${esc(it.id)}">`;
    // On a phone the title needs the whole width, so the controls drop to their
    // own line underneath rather than competing with it for horizontal space.
    return `<div class="pl-row pl-stop">${lead}${shot}` +
      opener +
        `<div class="pl-name">${esc(it.text || (it.imageId ? 'Photo' : it.url || ''))}${badge}</div>${sub}` +
        (t ? `<div class="pl-meta pl-timeline">${CLOCK}${esc(t)}</div>` : '') +
        (it.note ? `<div class="pl-meta">${esc(it.note.slice(0, 60))}</div>` : '') +
      `</button>` +
      (feat('votes') ? `<button class="pl-vote${on ? ' on' : ''}" type="button" data-id="${esc(it.id)}" aria-pressed="${on}" aria-label="Vote">${HEART}${n || ''}</button>` : '') +
      `</div>` +
      ((open || (!inDay && P.edit === it.id))
        ? editStrip(it, { dayId: opts.dayId, index: opts.index, total: opts.total, t, key, slot })
        : '');
  }
  // Saving an edit makes the store emit, which would rebuild the list and throw
  // away the very input being typed into (losing focus and caret every few
  // keystrokes). While a field is focused, defer the rebuild until it's done.
  function typing() {
    const a = document.activeElement;
    return !!(a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('.pl-strip, .pl-modal, .pl-rename'));
  }
  function deferRefresh() { P.pendingRefresh = true; return true; }
  function refreshAfterEdit() {
    if (!P.pendingRefresh) return;
    P.pendingRefresh = false;
    refreshBoard(true);
  }

  // `force` = the person just tapped something, so redraw now. Only redraws
  // arriving from the store are deferred while a field has the caret — without
  // that distinction, tapping a control with the keyboard still up does nothing.
  function refreshBoard(force) {
    if (P.mode !== 'board') return;
    if (!view.querySelector('#pl-buckets')) return;   // the board isn't on screen
    if (!force && typing()) return void deferRefresh();
    const me = P.st.people[P.uid] || {};
    const plan = P.st.plan;
    // The plan can be renamed at any time, on any device — keep the heading in step.
    const heading = view.querySelector('.pl-h1 > span');
    if (heading && heading.textContent !== plan.title) heading.textContent = plan.title;
    const dayOpts = (sel) => `<option value="before"${sel === 'before' ? ' selected' : ''}>the day before</option>` +
      plan.days.map((d) => `<option value="${d.id}"${sel === d.id ? ' selected' : ''}>${esc(d.label)}</option>`).join('') +
      `<option value="after"${sel === 'after' ? ' selected' : ''}>the day after</option>`;
    const when = feat('when') ? view.querySelector('#pl-when') : null;
    if (when && !when.dataset.built) {
      when.dataset.built = '1';
      when.innerHTML = ['arrive', 'leave'].map((k) => {
        const v = me[k] || {};
        return `<div class="pl-row"><span class="pl-ic">${k === 'arrive' ? CLOCK : ARROW}</span><span class="pl-name" style="flex:0 0 64px">I ${k}</span>` +
          `<select class="pl-input" data-k="${k}" data-f="day" style="height:36px;flex:1;padding:0 8px;font-size:14px">${dayOpts(v.day || (k === 'arrive' ? plan.days[0].id : plan.days[plan.days.length - 1].id))}</select>` +
          `<input class="pl-input" type="time" data-k="${k}" data-f="time" value="${esc(v.time || '')}" style="height:36px;width:104px;flex:0 0 auto;padding:0 8px;font-size:14px"></div>`;
      }).join('');
      when.querySelectorAll('select,input').forEach((el) => el.addEventListener('change', saveWhen));
    }
    // Who's there when — everyone's arrivals, so the group can coordinate.
    const lab = (d) => d === 'before' ? 'day before' : d === 'after' ? 'day after'
      : ((plan.days.find((x) => x.id === d) || {}).label || '—');
    refreshMapRow();
    const ppl = roster();
    const rlink = view.querySelector('#pl-roster-link');
    if (rlink) rlink.textContent = ppl.length
      ? `Who’s there when · ${ppl.length} ${ppl.length === 1 ? 'person' : 'people'}`
      : 'Who’s there when';

    // One bucket per day — numbered stops in time order — plus a home for
    // anything nobody has pinned to a day yet.
    const ideas = (P.st.ideas || []).filter((it) => !it.mood);   // !mood: pictures from the old vibe strip
    const days = cloneDays();
    const buckets = view.querySelector('#pl-buckets');
    const groups = plan.days.map((d, di) => ({
      id: d.id, label: d.label, color: dayColor(di),
      rows: (days[d.id] || []).map((sl) => ({ slot: sl, idea: ideaById(sl.ideaId) })).filter((r) => r.idea),
    }));
    const loose = ideas.filter((it) => !it.day);
    buckets.innerHTML = groups.map((g, gi) =>
      `<div class="pl-sec"><span class="cdot" style="background:${g.color}"></span>${esc(g.label)}` +
      `<span class="cnt">${g.rows.length ? g.rows.length + ' stop' + (g.rows.length > 1 ? 's' : '') : ''}</span></div>` +
      `<div class="lv-group">` +
      (g.rows.length ? g.rows.map((r, i) => itemRow(r.idea, { dayId: g.id, index: i, color: g.color, slot: r.slot, total: g.rows.length })).join('')
        : `<div class="pl-row"><div class="pl-txt"><div class="pl-meta">Nothing here yet.</div></div></div>`) +
      `<button class="pl-addrow-btn" type="button" data-addto="${esc(g.id)}">${ICON.plus}<span>Add to ${esc(g.label)}</span></button>` +
      `</div>`
    ).join('') +
      `<div class="pl-sec">Any day<span class="cnt">${loose.length || ''}</span></div><div class="lv-group">` +
      (loose.length ? loose.map((it) => itemRow(it, { dayId: '' })).join('')
        : `<div class="pl-row"><div class="pl-txt"><div class="pl-meta">Everything has a day.</div></div></div>`) +
      `<button class="pl-addrow-btn" type="button" data-addto="">${ICON.plus}<span>Add to any day</span></button></div>`;

    buckets.querySelectorAll('.pl-vote').forEach((b) => b.addEventListener('click', () => P.store.toggleVote(P.planId, P.uid, b.dataset.id, !myVote(b.dataset.id))));
    buckets.querySelectorAll('.pl-shot').forEach((el) => { paintShot(el, el.dataset.img); el.addEventListener('click', () => openShot(el.dataset.img)); });
    buckets.querySelectorAll('[data-addto]').forEach((b) => b.addEventListener('click', () => openAdd(b.dataset.addto)));
    buckets.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', onArrangeAction));
    buckets.querySelectorAll('.pl-strip input[type=time]').forEach((el) => el.addEventListener('change', onTimeInput));
    wireEdit(buckets);
  }
  // One place that turns a chosen file into a stored image: the picture on a
  // stop being edited.
  async function attachImage(file) {
    const target = P.photoFor; P.photoFor = null;
    if (!target) return;
    if (!/^image\//.test(file.type)) { toast('That’s not an image'); return; }
    if (P.busy) return; P.busy = true;
    toast('Adding…');
    try {
      const { data, mime } = await imageToStore(file);
      const imageId = await P.store.addImage(P.planId, data, mime);
      shotCache[imageId] = { data, mime };
      await P.store.updateIdea(P.planId, target.id, { imageId });
      refreshBoard(true);
    } catch (e) {
      toast(e.message || 'Couldn’t add that image');
    } finally { P.busy = false; }
  }

  // Who's there when — a link under "When I'm there", opened on demand.
  // Identity is per device, so the same person opening the link on a phone and
  // a laptop writes two entries. Nobody wants to see themselves twice, so the
  // roster merges entries sharing a name and keeps the most useful one: your
  // own, then whichever actually has times, then the most recently touched.
  const millis = (v) => (v && v.toMillis ? v.toMillis() : (typeof v === 'number' ? v : 0));
  function roster() {
    const all = Object.keys(P.st.people || {})
      .map((k) => ({ uid: k, ...P.st.people[k] }))
      .filter((x) => x.name && x.name.trim());
    // What the group needs from this row is the times, so an entry that has them
    // beats one that doesn't — including your own, empty, on a second device.
    const rank = (p) => (((p.arrive && p.arrive.time) || (p.leave && p.leave.time)) ? 4 : 0) +
      (p.uid === P.uid ? 2 : 0);
    const byName = new Map();
    all.forEach((x) => {
      const key = x.name.trim().toLowerCase();
      const prev = byName.get(key);
      if (!prev) { byName.set(key, { ...x, mine: x.uid === P.uid, dupes: 0 }); return; }
      const better = (rank(x) > rank(prev)) ||
        (rank(x) === rank(prev) && millis(x.updatedAt) > millis(prev.updatedAt));
      const winner = better ? x : prev;
      byName.set(key, { ...winner, mine: prev.mine || x.uid === P.uid, dupes: prev.dupes + 1 });
    });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  function openRoster() {
    const plan = P.st.plan;
    const lab = (d) => d === 'before' ? 'day before' : d === 'after' ? 'day after'
      : ((plan.days.find((x) => x.id === d) || {}).label || '—');
    const ppl = roster();
    const old = view.querySelector('#pl-modal'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'pl-modal'; el.id = 'pl-modal';
    el.innerHTML = `<div class="pl-modal-card" role="dialog" aria-label="Who’s there when">` +
      `<div class="pl-modal-h"><span>Who’s there when</span>` +
      `<button class="lv-navbtn" type="button" id="ro-x" aria-label="Close">${ICON.close}</button></div>` +
      `<div class="pl-modal-b" style="gap:0">` +
      (ppl.length ? `<div class="lv-group">` + ppl.map((x) => {
        const inTxt = x.arrive && x.arrive.day ? lab(x.arrive.day) + (x.arrive.time ? ' ' + x.arrive.time : '') : '—';
        const outTxt = x.leave && x.leave.day ? lab(x.leave.day) + (x.leave.time ? ' ' + x.leave.time : '') : '—';
        return `<div class="pl-row"><span class="pl-ini">${ini(x.name)}</span>` +
          `<div class="pl-txt"><div class="pl-name">${esc(x.name)}${x.mine ? ' <span class="pl-you">you</span>' : ''}</div>` +
          (x.dupes ? `<div class="pl-meta">on ${x.dupes + 1} devices</div>` : '') + `</div>` +
          `<div class="pl-rcol"><span class="pl-when-t">${CLOCK}${esc(inTxt)}</span><span class="pl-when-t">${ARROW}${esc(outTxt)}</span></div></div>`;
      }).join('') + `</div>`
        : `<div class="pl-lead" style="margin:0 4px">Nobody has said when they’re there yet.</div>`) +
      `</div></div>`;
    view.appendChild(el);
    el.querySelector('#ro-x').addEventListener('click', () => el.remove());
    el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
  }

  // Images are fetched only when their row is on screen, then kept for the session.
  const shotCache = {};
  const shotSrc = (v) => (v && v.data) ? `data:${v.mime || 'image/jpeg'};base64,${v.data}` : '';
  async function paintShot(el, imageId) {
    if (!imageId) return;
    let v = shotCache[imageId];
    if (v === undefined) {
      shotCache[imageId] = 'loading';
      try { v = shotCache[imageId] = await P.store.getImage(P.planId, imageId); }
      catch (e) { v = shotCache[imageId] = null; }
    }
    const src = v && v !== 'loading' ? shotSrc(v) : '';
    if (src) el.style.backgroundImage = `url("${src}")`;
  }
  function openShot(imageId) {
    const v = shotCache[imageId];
    if (!v || v === 'loading') return;
    const src = shotSrc(v);
    if (!src) return;
    const o = document.createElement('div');
    o.className = 'pl-lightbox';
    o.innerHTML = `<img src="${src}" alt="">`;
    o.addEventListener('click', () => o.remove());
    document.body.appendChild(o);
  }
  // One editor for an item, used from the inbox and from Arrange. "Place" is
  // what the map actually looks up — a real name ("Playa de la Malagueta") or
  // an area ("Málaga centro") — kept apart from the free-text title.
  // Everything about one stop, in one strip: what it is, where it is, which day
  // it sits in, and finally the two decisions — delete it, or done. "Place" is
  // what the map looks up: a real name ("Playa de la Malagueta") or an area
  // ("Málaga centro"), kept apart from the free-text title.
  function editStrip(it, opts = {}) {
    const inDay = !!opts.dayId;
    const t = opts.t || '';
    const key = opts.key || '';
    const days = P.st.plan.days;
    const moves = inDay ? days.filter((d) => d.id !== opts.dayId) : days;
    const votes = voteCount(it.id);
    return `<div class="pl-strip pl-edit">` +
      ((feat('people') && it.byName) || (feat('votes') && votes)
        ? `<div class="pl-eby">${feat('people') && it.byName ? 'Added by ' + esc(it.byName) : ''}` +
          `${feat('votes') && votes ? (feat('people') && it.byName ? ' · ' : '') + votes + ' vote' + (votes > 1 ? 's' : '') : ''}</div>`
        : '') +
      `<label class="pl-elab">Title<input class="pl-input pl-ein" data-e="text" data-id="${esc(it.id)}" value="${esc(it.text || '')}" maxlength="300" placeholder="What is it?"></label>` +
      `<label class="pl-elab">Place on the map` +
        `<input class="pl-input pl-ein" data-e="place" data-id="${esc(it.id)}" value="${esc(it.place || '')}" maxlength="120" placeholder="e.g. Playa de la Malagueta, or Málaga centro">` +
        `<span class="pl-ehint">Leave the place empty and the AI will choose one.</span></label>` +
      // Tucked away unless there's something in it — most edits are a title or
      // a place, and the extras shouldn't crowd them out on a phone.
      `<details class="pl-more"${(it.note || it.url || it.imageId) ? ' open' : ''}>` +
        `<summary>Add a link, a photo, a note…</summary>` +
        `<textarea class="pl-input pl-ein" data-e="extra" data-id="${esc(it.id)}" rows="2" placeholder="Paste a link, or write anything useful">${esc([it.note, it.url].filter(Boolean).join(' '))}</textarea>` +
        `<div class="pl-addrow" style="margin-top:10px">` +
          `<button class="pl-mini" type="button" data-act="ephoto" data-id="${esc(it.id)}">${ICON.photo}${it.imageId ? 'Change photo' : 'Add a photo'}</button>` +
          (it.imageId ? `<span class="pl-shot pl-shot-sm" data-img="${esc(it.imageId)}"></span><button class="pl-mini" type="button" data-act="ephotox" data-id="${esc(it.id)}">Remove</button>` : '') +
        `</div>` +
      `</details>` +
      (inDay ? `<label class="pl-elab">Time` +
        `<div class="pl-timerow">` +
          `<input class="pl-input" type="time" data-f="start" data-key="${key}" value="${esc((opts.slot || {}).start || '')}" aria-label="Start">` +
          `<span class="pl-dash">–</span>` +
          `<input class="pl-input" type="time" data-f="end" data-key="${key}" value="${esc((opts.slot || {}).end || '')}" aria-label="End (optional)">` +
          (t ? `<button class="pl-mini" type="button" data-act="tclear" data-key="${key}">Clear</button>` : '') +
        `</div>` +
        (t ? `<span class="pl-ehint">With a time set, the day puts itself in order — clear it to move this stop by hand.</span>` : '') +
        `</label>` : '') +
      `<div class="pl-elab">${inDay ? 'Day' : 'Add it to a day'}<div class="pl-daybtns">` +
        (inDay && !t && opts.index > 0 ? `<button class="pl-mini" type="button" data-act="up" data-key="${key}">${ICON.chevUp}Up</button>` : '') +
        (inDay && !t && opts.index < opts.total - 1 ? `<button class="pl-mini" type="button" data-act="down" data-key="${key}">${ICON.chevDown}Down</button>` : '') +
        moves.map((d) => inDay
          ? `<button class="pl-mini" type="button" data-act="move" data-key="${key}" data-to="${d.id}"><span class="cdot" style="background:${dayColor(days.indexOf(d))}"></span>${esc(d.label)}</button>`
          : `<button class="pl-mini" type="button" data-act="add" data-id="${esc(it.id)}" data-to="${d.id}"><span class="cdot" style="background:${dayColor(days.indexOf(d))}"></span>${esc(d.label)}</button>`).join('') +
        (inDay ? `<button class="pl-mini" type="button" data-act="remove" data-key="${key}">Any day</button>` : '') +
      `</div></div>` +
      `<div class="pl-efoot">` +
        `<button class="pl-mini pl-del" type="button" data-act="del" data-id="${esc(it.id)}">${ICON.close}Delete</button>` +
        `<button class="pl-mini pl-done" type="button" data-act="edone" data-id="${esc(it.id)}">Done</button>` +
      `</div></div>`;
  }
  // Edits accumulate per item and are written together: a single shared timer
  // per FIELD would let a quick title-then-place cancel the title's write.
  let editT = null, editPending = {};
  function flushEdits() {
    clearTimeout(editT); editT = null;
    const patches = editPending; editPending = {};
    Object.keys(patches).forEach((id) => {
      const patch = { ...patches[id] };
      if ('extra' in patch) {
        // Same split as the add sheet: a pasted link becomes the link, the rest a note.
        const raw = (patch.extra || '').trim();
        const m = raw.match(/https?:\/\/\S+/);
        patch.url = m ? m[0] : '';
        patch.note = (m ? raw.replace(m[0], '').trim().replace(/^[–—-]\s*/, '') : raw);
        delete patch.extra;
      }
      P.store.updateIdea(P.planId, id, patch);
    });
  }
  function onEditInput(e) {
    const el = e.currentTarget;
    const id = el.dataset.id;
    editPending[id] = { ...(editPending[id] || {}), [el.dataset.e]: el.value.trim() };
    clearTimeout(editT);
    editT = setTimeout(flushEdits, 350);
  }
  function wireEdit(root) {
    root.querySelectorAll('.pl-ein').forEach((el) => {
      el.addEventListener('input', onEditInput);
      el.addEventListener('blur', () => { flushEdits(); setTimeout(refreshAfterEdit, 0); });
    });
    root.querySelectorAll('[data-act="edone"]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = document.activeElement; if (a && a.blur) a.blur();  // let go of the caret
        flushEdits(); P.edit = null; P.strip = null; P.pendingRefresh = false;
        refreshBoard(true);
      }));
  }
  // Items already carried over to the map, so the rest can be marked as new.
  const sentIds = () => new Set(((P.st.plan && P.st.plan.sentIds) || []));
  const everSent = () => !!(P.st.plan && P.st.plan.sentIds && P.st.plan.sentIds.length);

  async function removeItem(id) {
    const it = (P.st.ideas || []).find((x) => x.id === id);
    if (!it) return;
    await P.store.deleteIdea(P.planId, id);
    if (it.imageId) P.store.deleteImage(P.planId, it.imageId).catch(() => {});
  }
  // Picking a name that has already been used on another device adopts what that
  // person said about themselves, so times set on a laptop show up on a phone.
  function withAdoptedTimes(name) {
    const patch = { name };
    const mineNow = (P.st.people || {})[P.uid] || {};
    if ((mineNow.arrive && mineNow.arrive.time) || (mineNow.leave && mineNow.leave.time)) return patch;
    const other = Object.keys(P.st.people || {})
      .map((k) => ({ uid: k, ...P.st.people[k] }))
      .filter((x) => x.uid !== P.uid && sameName(x.name, name) &&
        ((x.arrive && x.arrive.time) || (x.leave && x.leave.time)))
      .sort((a, b) => millis(b.updatedAt) - millis(a.updatedAt))[0];
    if (other) {
      if (other.arrive) patch.arrive = other.arrive;
      if (other.leave) patch.leave = other.leave;
    }
    return patch;
  }
  function saveWhen() {
    const me = { ...(P.st.people[P.uid] || {}) };
    ['arrive', 'leave'].forEach((k) => {
      const day = view.querySelector(`select[data-k="${k}"]`).value;
      const time = view.querySelector(`input[data-k="${k}"]`).value;
      me[k] = { day, time };
    });
    P.store.setPerson(P.planId, P.uid, { name: P.me, arrive: me.arrive, leave: me.leave });
  }
  // Adding something: one sheet with everything about it, opened from the day
  // it belongs to. The last field takes whatever form the idea arrived in — a
  // link someone pasted, an image they screenshotted, or just a sentence.
  function openAdd(dayId) {
    P.add = { day: dayId || '', text: '', place: '', extra: '', img: null };
    renderAdd();
  }
  function closeAdd() { P.add = null; const m = view.querySelector('#pl-modal'); if (m) m.remove(); }
  function renderAdd() {
    const a = P.add; if (!a) return;
    const plan = P.st.plan;
    const old = view.querySelector('#pl-modal'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'pl-modal'; el.id = 'pl-modal';
    el.innerHTML =
      `<div class="pl-modal-card" role="dialog" aria-label="Add to the plan">` +
      `<div class="pl-modal-h"><span>Add something</span>` +
      `<button class="lv-navbtn" type="button" id="am-x" aria-label="Close">${ICON.close}</button></div>` +
      `<div class="pl-modal-b">` +
      `<label class="pl-elab">Title<input class="pl-input" id="am-title" maxlength="300" placeholder="Flamenco night" value="${esc(a.text)}"></label>` +
      `<label class="pl-elab">Place on the map<input class="pl-input" id="am-place" maxlength="120" placeholder="e.g. Museo Flamenco Peña Juan Breva" value="${esc(a.place)}"></label>` +
      `<label class="pl-elab">Add a link, a photo, a note…` +
      `<textarea class="pl-input" id="am-extra" rows="3" placeholder="Paste a link, or write anything useful — opening times, who suggested it, what to order">${esc(a.extra)}</textarea></label>` +
      `<div class="pl-addrow" style="margin-top:0">` +
      `<button class="pl-mini" type="button" id="am-photo">${ICON.photo}${a.img ? 'Change photo' : 'Add a photo'}</button>` +
      (a.img ? `<span class="pl-shot pl-shot-sm" id="am-thumb" style="background-image:url('${shotSrc(a.img)}')"></span><button class="pl-mini" type="button" id="am-unphoto">Remove</button>` : '') +
      `<input type="file" id="am-file" accept="image/*" hidden></div>` +
      `<label class="pl-elab">Which day` +
      `<select class="pl-input" id="am-day">` +
      plan.days.map((d) => `<option value="${d.id}"${a.day === d.id ? ' selected' : ''}>${esc(d.label)}</option>`).join('') +
      `<option value=""${a.day ? '' : ' selected'}>Any day</option></select></label>` +
      `</div>` +
      `<div class="pl-modal-f"><button class="imp-go" type="button" id="am-save">Add it</button></div>` +
      `</div>`;
    view.appendChild(el);
    const keep = () => {
      a.text = el.querySelector('#am-title').value;
      a.place = el.querySelector('#am-place').value;
      a.extra = el.querySelector('#am-extra').value;
      a.day = el.querySelector('#am-day').value;
    };
    el.querySelectorAll('input,textarea,select').forEach((i) => i.addEventListener('change', keep));
    el.querySelector('#am-x').addEventListener('click', closeAdd);
    el.addEventListener('click', (e) => { if (e.target === el) closeAdd(); });
    const file = el.querySelector('#am-file');
    el.querySelector('#am-photo').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files || !file.files[0]) return;
      keep();
      try { a.img = await imageToStore(file.files[0]); } catch (err) { toast(err.message || 'Couldn’t read that image'); }
      file.value = ''; renderAdd();
    });
    const un = el.querySelector('#am-unphoto');
    if (un) un.addEventListener('click', () => { keep(); a.img = null; renderAdd(); });
    // Paste a screenshot straight into the sheet.
    el.addEventListener('paste', async (e) => {
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (const i of items) {
        if (i.kind === 'file' && /^image\//.test(i.type)) {
          const f = i.getAsFile();
          if (f) { e.preventDefault(); keep(); try { a.img = await imageToStore(f); } catch (err) {} renderAdd(); return; }
        }
      }
    });
    el.querySelector('#am-save').addEventListener('click', () => { keep(); saveAdd(); });
    setTimeout(() => { const t = el.querySelector('#am-title'); if (t && !a.text) t.focus(); }, 60);
  }
  async function saveAdd() {
    const a = P.add; if (!a || P.busy) return;
    const extra = (a.extra || '').trim();
    const m = extra.match(/https?:\/\/\S+/);
    const note = m ? extra.replace(m[0], '').trim().replace(/^[–—-]\s*/, '') : extra;
    const title = (a.text || '').trim() || (m ? m[0] : '') || (a.img ? 'Photo' : '');
    if (!title && !note && !a.img) { toast('Give it a title, or add something to it'); return; }
    P.busy = true;
    try {
      const item = { text: title, byUid: P.uid, byName: feat('people') ? P.me : '', day: a.day || '' };
      if ((a.place || '').trim()) item.place = a.place.trim();
      if (m) item.url = m[0];
      if (note) item.note = note;
      if (a.img) {
        const imageId = await P.store.addImage(P.planId, a.img.data, a.img.mime);
        shotCache[imageId] = a.img;   // cache the SAME shape paintShot expects
        item.imageId = imageId;
      }
      await P.store.addIdea(P.planId, item);
      closeAdd();
    } catch (e) {
      toast('Couldn’t add that — try again');
    } finally { P.busy = false; }
  }

  // Everyone shares one view of the days now; only the hand-off is the
  // curator's. Kept as a helper because the AI briefing still summarises it.
  function arrivalsSummary() {
    const plan = P.st.plan;
    const ppl = Object.values(P.st.people || {}).filter((p) => p.name);
    if (!ppl.length) return 'Nobody has said when they arrive yet.';
    const lab = (d) => d === 'before' ? 'the day before' : d === 'after' ? 'the day after' : ((plan.days.find((x) => x.id === d) || {}).label || d);
    const by = {};
    ppl.forEach((p) => { const d = (p.arrive && p.arrive.day) || '?'; by[d] = (by[d] || 0) + 1; });
    const arr = Object.keys(by).filter((d) => d !== '?').map((d) => `${by[d]} arrive ${lab(d)}`).join(', ');
    const leaves = ppl.map((p) => p.leave && p.leave.day && lab(p.leave.day) + (p.leave.time ? ' ' + p.leave.time : '')).filter(Boolean);
    let lv = '';
    if (leaves.length) { const c = {}; leaves.forEach((l) => { c[l] = (c[l] || 0) + 1; }); const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0]; lv = ` · most leave ${top}`; }
    return `${ppl.length} in the group${arr ? ' · ' + arr : ''}${lv}`;
  }
  // The curator's saved order + times, reconciled with whatever day people
  // picked when they added things. Anything assigned to a day but not yet in
  // the saved order is appended, so a friend's new suggestion just shows up.
  function cloneDays() {
    const src = (P.st.schedule && P.st.schedule.days) || {};
    const out = {};
    const seen = new Set();
    P.st.plan.days.forEach((d) => {
      out[d.id] = (src[d.id] || []).filter((it) => ideaById(it.ideaId)).map((it) => ({ ...it }));
      out[d.id].forEach((it) => seen.add(it.ideaId));
    });
    (P.st.ideas || []).forEach((it) => {
      if (it.mood) return;
      if (it.day && out[it.day] && !seen.has(it.id)) { out[it.day].push({ ideaId: it.id }); seen.add(it.id); }
    });
    Object.keys(out).forEach((k) => { out[k] = sortByTime(out[k]); });
    return out;
  }
  // A day with times is a timeline: whatever has a start time sits in clock
  // order, and anything not yet timed waits at the end, in the order it was put
  // there. (Array sort is stable, so untimed items keep their arrangement.)
  function sortByTime(list) {
    return list.slice().sort((a, b) => {
      const at = a.start || '', bt = b.start || '';
      if (at && bt) return at < bt ? -1 : at > bt ? 1 : 0;
      if (at) return -1;
      if (bt) return 1;
      return 0;
    });
  }
  function onArrangeAction(e) {
    const b = e.currentTarget;
    const act = b.dataset.act;
    if (act === 'edone') return;   // the edit strip's own Done — wireEdit handles it
    if (act === 'ephoto') { P.photoFor = { kind: 'item', id: b.dataset.id }; view.querySelector('#pl-imgfile').click(); return; }
    if (act === 'ephotox') { P.store.updateIdea(P.planId, b.dataset.id, { imageId: '' }); return; }
    if (act === 'loose') { P.edit = P.edit === b.dataset.id ? null : b.dataset.id; P.strip = null; refreshBoard(true); return; }
    if (act === 'del') { removeItem(b.dataset.id); P.edit = null; P.strip = null; return; }
    // Opening a stop shows its editor and its move/order controls together —
    // itemRow renders the edit fields whenever the strip is open.
    if (act === 'strip') {
      P.strip = P.strip === b.dataset.key ? null : b.dataset.key;
      P.edit = null;
      refreshBoard(true); return;
    }
    const days = cloneDays();
    if (act === 'add') {
      days[b.dataset.to].push({ ideaId: b.dataset.id });
      P.store.updateIdea(P.planId, b.dataset.id, { day: b.dataset.to });
      P.store.saveSchedule(P.planId, days); return;
    }
    const [dayId, iStr] = b.dataset.key.split(':'); const i = +iStr;
    const arr = days[dayId]; if (!arr || !arr[i]) return;
    if (act === 'tclear') { delete arr[i].start; delete arr[i].end; }
    else if (act === 'up') { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; P.strip = dayId + ':' + (i - 1); }
    else if (act === 'down') { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; P.strip = dayId + ':' + (i + 1); }
    else if (act === 'move') {
      const [it] = arr.splice(i, 1); days[b.dataset.to].push(it); P.strip = null;
      P.store.updateIdea(P.planId, it.ideaId, { day: b.dataset.to });
    } else if (act === 'remove') {
      const [it] = arr.splice(i, 1); P.strip = null;
      if (it) P.store.updateIdea(P.planId, it.ideaId, { day: '' });
    }
    P.store.saveSchedule(P.planId, days);
  }
  let timeT = null;
  function onTimeInput(e) {
    const el = e.currentTarget;
    const [dayId, iStr] = el.dataset.key.split(':'); const i = +iStr;
    clearTimeout(timeT);
    timeT = setTimeout(() => {
      const days = cloneDays();
      const it = days[dayId] && days[dayId][i]; if (!it) return;
      const start = view.querySelector(`input[data-f="start"][data-key="${el.dataset.key}"]`);
      const end = view.querySelector(`input[data-f="end"][data-key="${el.dataset.key}"]`);
      if (start && start.value) it.start = start.value; else delete it.start;
      if (end && end.value) it.end = end.value; else delete it.end;
      // The new time may move this stop up or down the day — re-sort, and keep
      // the open time editor pointed at the same stop rather than whatever
      // slid into its old position.
      days[dayId] = sortByTime(days[dayId]);
      const moved = days[dayId].findIndex((x) => x.ideaId === it.ideaId);
      if (moved >= 0 && P.strip === el.dataset.key) P.strip = dayId + ':' + moved;
      P.store.saveSchedule(P.planId, days);
    }, 250);
  }

  // All the images stacked into ONE sheet, numbered to match the briefing.
  // An assistant sees a real picture (a base64 string inside an HTML or
  // Markdown file would just read as gibberish), so this is the one format
  // that reliably carries them.
  async function buildSheet(ids) {
    const loaded = [];
    for (const id of ids) {
      let v = shotCache[id];
      if (v === undefined || v === 'loading') {
        try { v = shotCache[id] = await P.store.getImage(P.planId, id); } catch (e) { v = null; }
      }
      if (!v || v === 'loading') continue;
      try {
        loaded.push(await new Promise((res, rej) => {
          const im = new Image();
          im.onload = () => res(im); im.onerror = rej;
          im.src = shotSrc(v);
        }));
      } catch (e) { /* skip an image that won't decode */ }
    }
    if (!loaded.length) return null;
    const W = 1000, pad = 22, labelH = 42;
    let cells = loaded.map((im) => { const w = W - pad * 2; return { im, w, h: Math.round(im.height * (w / im.width)) }; });
    let total = pad + cells.reduce((n, c) => n + labelH + c.h + pad, 0);
    // Keep the sheet within something an assistant will accept whole.
    const MAXH = 7000;
    if (total > MAXH) {
      const k = MAXH / total;
      cells = cells.map((c) => ({ ...c, w: Math.round(c.w * k), h: Math.round(c.h * k) }));
      total = pad + cells.reduce((n, c) => n + labelH + c.h + pad, 0);
    }
    const c = document.createElement('canvas');
    c.width = W; c.height = total;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, total);
    let y = pad;
    cells.forEach((cell, i) => {
      g.fillStyle = '#141413';
      g.font = 'bold 26px -apple-system, "Segoe UI", Roboto, sans-serif';
      g.fillText('IMAGE ' + (i + 1), pad, y + 28);
      y += labelH;
      g.drawImage(cell.im, pad, y, cell.w, cell.h);
      y += cell.h + pad;
    });
    return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  }

  // Hand the gathered ideas to the AI: copy a prompt that carries everything
  // the group said, then land on the paste box so the reply comes straight back.
  function askAI() {
    const plan = P.st.plan;
    const group = groupNames();     // the friends, however many devices they opened it on
    const ppl = roster();           // the ones who said when they're around
    const lab = (d) => d === 'before' ? 'the day before' : d === 'after' ? 'the day after' : ((plan.days.find((x) => x.id === d) || {}).label || d);
    const lines = [];
    lines.push(`We're a group of ${group.length || 'friends'} planning "${plan.title}" in ${plan.place} — ${plan.days.length} day${plan.days.length > 1 ? 's' : ''}: ${plan.days.map((d) => d.label + (d.date ? ' (' + d.date + ')' : '')).join(', ')}.`);
    lines.push('');
    lines.push(feat('votes')
      ? 'Everything the group has gathered (votes in brackets, most-voted first):'
      : 'Everything the group has gathered:');
    const ideas = [...(P.st.ideas || [])].filter((it) => !it.mood).sort((a, b) => voteCount(b.id) - voteCount(a.id));
    const shotIds = [];
    const vote = (id) => (feat('votes') ? `[${voteCount(id)}] ` : '');
    ideas.forEach((it) => {
      const who = feat('people') && it.byName ? ' — added by ' + it.byName : '';
      const where = it.place ? ` — the place is: ${it.place}` : '';
      if (it.imageId) {
        shotIds.push(it.imageId);
        lines.push(`- ${vote(it.id)}IMAGE ${shotIds.length}${it.text ? ' — "' + it.text + '"' : ''}${where}${who}`);
      } else if (it.url) {
        lines.push(`- ${vote(it.id)}${it.text && it.text !== it.url ? it.text + ' — ' : ''}${it.url}${where}${who}`);
      } else {
        lines.push(`- ${vote(it.id)}${it.text}${where}${who}`);
      }
    });
    const shots = shotIds.length;
    if (shots) {
      lines.push('');
      lines.push(shots > 1
        ? `One image is attached, holding all ${shots} photos and screenshots the group shared, stacked and labelled IMAGE 1 … IMAGE ${shots} to match the list above. Read each for the details it carries — venue name, address, date, time, price — and use those as stops.`
        : `An image is attached (labelled IMAGE 1) — an image the group shared. Read it for the details it carries — venue name, address, date, time, price — and use it as a stop.`);
    }
    const days = (P.st.schedule && P.st.schedule.days) || {};
    const fixed = plan.days.map((d) => {
      const items = (days[d.id] || []).filter((it) => ideaById(it.ideaId));
      return items.length ? `${d.label}: ${items.map((it) => ideaById(it.ideaId).text + (timeStr(it) ? ' at ' + timeStr(it) : '')).join('; ')}` : null;
    }).filter(Boolean);
    if (fixed.length) { lines.push(''); lines.push('Already decided (keep these as they are):'); fixed.forEach((f) => lines.push('- ' + f)); }
    // Only the people who have actually said — a list of "?" tells the AI
    // nothing, and one lone answer must not become the spine of the trip.
    const said = feat('when') ? ppl.filter((p) => (p.arrive && p.arrive.day) || (p.leave && p.leave.day)) : [];
    const when = said.map((p) => `${p.name}: arrives ${p.arrive && p.arrive.day ? lab(p.arrive.day) + (p.arrive.time ? ' ' + p.arrive.time : '') : 'not said'}, leaves ${p.leave && p.leave.day ? lab(p.leave.day) + (p.leave.time ? ' ' + p.leave.time : '') : 'not said'}`);
    if (when.length) {
      lines.push('');
      lines.push(said.length < group.length
        ? `Travel times, from the ${said.length} of ${group.length} who have said so far (the rest are simply there):`
        : 'Who is there when:');
      when.forEach((w) => lines.push('- ' + w));
    }
    lines.push('');
    // The group has already decided. The AI's job is to sharpen what they chose
    // and put it on the map — not to plan the weekend over again around it.
    lines.push(`This is the group's own ${plan.days.length}-day plan for ${plan.place}, already decided together. Sharpen it — don't replan it:`);
    lines.push('- Use EVERY item above as a stop. Keep it on the day the group put it on, and never swap someone\'s choice for a better-known alternative.');
    lines.push('- Add nothing of your own, with the one exception below. A day the group left light stays light — free time is a choice, not a gap to fill.');
    lines.push(`- Turn anything vague into ONE specific, real, named place in or near ${plan.place} ("beach" → a named beach, "somewhere for drinks" → a named bar). Say in that stop's note that you chose it, so the group knows which ones to confirm.`);
    lines.push('- Keep every fixed date or time exactly as it stands, including anything printed on one of the images.');
    lines.push('- Enrich rather than extend: each note is one or two practical sentences — why it\'s worth it, best timing, what to book, what\'s next door — and keeps whatever the person who suggested it said about it.');
    lines.push('- Put each day\'s stops in a sensible walking order, and suggest a time for the ones that have none.' +
      (feat('when') ? ' Fit them around when people arrive and leave.' : ''));
    if (feat('votes')) lines.push('- Votes in brackets show enthusiasm: where two stops want the same slot, the more-voted one takes the better time.');
    lines.push('- Write for the group. Everyone reads the same intros and notes, so never build a day around one person\'s plans and don\'t single anyone out by name' +
      (feat('when') ? ' — use the travel times only to judge what fits when ("the group is together from Friday evening").' : '.'));
    lines.push('- Each day\'s "intro" describes the day the group has actually planned — how their stops connect, what to know — not a pitch for a different day.');
    lines.push('- The ONLY thing you may add: if a day has fewer than two stops, or a gap of more than about five hours in the middle of it, you may add AT MOST ONE suggestion to that day, and its note must start with "Suggestion — not chosen by the group:".');
    lines.push('');
    lines.push('Then, with that as the itinerary:');
    lines.push('');
    lines.push(PROMPT);
    handOff(lines.join('\n'), shotIds);
  }

  // Landing on "Create an itinerary" with a full clipboard and no explanation is
  // baffling, and a toast is gone before it's read. Say what just happened, and
  // what to do, right where they land — until they paste.
  function handoffNotice(shots, mode) {
    setTimeout(() => {
      const body = document.querySelector('#importscreen .imp-body');
      if (!body) return;
      const old = body.querySelector('.pl-handoff');
      if (old) old.remove();
      const el = document.createElement('div');
      el.className = 'pl-handoff';
      const what = shots
        ? (mode === 'shared'
          ? `Your group briefing was <b>copied</b> and the sheet with ${shots} image${shots > 1 ? 's' : ''} was <b>shared</b>.`
          : `Your group briefing was <b>copied</b> and a sheet with ${shots} image${shots > 1 ? 's' : ''} was <b>saved to your device</b>.`)
        : 'Your group briefing was <b>copied</b>.';
      el.innerHTML =
        `<div class="pl-ho-h">${ICON.magic}<span>Handed to your AI</span></div>` +
        `<p>${what}</p>` +
        `<ol><li>Open ChatGPT, Claude or Gemini.</li>` +
        `<li><b>Paste</b> the briefing${shots ? ` and <b>attach the image sheet</b> (${mode === 'shared' ? 'pick it from the share sheet, or your Photos' : 'find it in your downloads'})` : ''}.</li>` +
        `<li>Copy its reply and <b>paste it in the box below</b>.</li></ol>` +
        // Sharing the sheet can take the clipboard with it, so the briefing —
        // every stop, who's there when, and what the AI is being asked for —
        // stays here to copy again or read.
        // Only the share sheet can take the clipboard off the briefing.
        (shots && mode === 'shared' ? `<p class="pl-ho-tip">The clipboard holds one thing at a time — if the image took it, copy the briefing here when you’re ready to paste.</p>` : '') +
        `<div class="pl-ho-f"><button class="pl-mini" type="button" id="pl-ho-copy">${ICON.copy}Copy the briefing again</button></div>` +
        `<details class="pl-more pl-ho-more"><summary>Show the briefing</summary><pre class="pl-brief">${esc(P.brief || '')}</pre></details>`;
      body.insertBefore(el, body.firstChild);
      const cp = el.querySelector('#pl-ho-copy');
      cp.addEventListener('click', () => {
        copyStr(P.brief || '').then(() => { cp.innerHTML = ICON.check + 'Copied'; setTimeout(() => { cp.innerHTML = ICON.copy + 'Copy the briefing again'; }, 2200); });
      });
      el.scrollIntoView({ block: 'start' });
    }, 500);
  }

  // One tap: the briefing plus every image as a single sheet, straight into the
  // AI app via the share sheet. The text is always copied too, since some share
  // targets take the file and drop the text.
  async function handOff(briefing, shotIds) {
    if (P.busy) return; P.busy = true;
    // What comes back from the AI is this plan's itinerary — tag it so a later
    // hand-off updates the same one instead of leaving two on the shelf.
    try { sessionStorage.setItem('pt_import_plan', P.planId); } catch (e) {}
    const btn = view.querySelector('#pl-ai'); if (btn) btn.disabled = true;
    P.brief = briefing;
    try {
      await copyStr(briefing);
      if (isCurator()) {
        const ids = (P.st.ideas || []).map((i) => i.id);
        P.store.updatePlan(P.planId, { sentIds: ids, sentAt: Date.now() }).catch(() => {});
      }
      let file = null;
      if (shotIds.length) {
        toast('Putting the images together…');
        const blob = await buildSheet(shotIds);
        if (blob) file = new File([blob], 'trip-images.jpg', { type: 'image/jpeg' });
      }
      // A share sheet is how a phone attaches a file; on a desktop it can't put
      // one into a web chat, so there the sheet is saved for attaching by hand.
      const handheld = (navigator.maxTouchPoints || 0) > 0;
      if (file && handheld && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: briefing });
          closePlanner();
          setTimeout(() => openImport(true), 400);
          handoffNotice(shotIds.length, 'shared');
          return;
        } catch (e) {
          if (e && e.name === 'AbortError') { toast('Cancelled — the briefing is still on your clipboard'); return; }
        }
      }
      if (file) {
        // No file sharing here (desktop, mostly): save the sheet and attach it.
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = 'trip-images.jpg';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        closePlanner();
        setTimeout(() => openImport(true), 400);
        handoffNotice(shotIds.length, 'saved');
        return;
      }
      closePlanner();
      setTimeout(() => openImport(true), 400);
      handoffNotice(0, 'copied');
    } catch (e) {
      toast('Couldn’t put that together — try again');
    } finally {
      P.busy = false;
      if (btn) btn.disabled = false;
    }
  }

  // ── Render / lifecycle ────────────────────────────────────────
  function render() {
    if (!P.st || P.mode === 'home') return renderHome();
    if (P.st.error && !P.st.exists) {
      shell(eyebrow('Group plan') + `<h1 class="lv-title">Can’t reach the plan</h1>` +
        `<p class="pl-lead">It’s still there — this device just can’t see it right now. Check you’re online and try again.</p>` +
        `<div class="pl-actions"><button class="imp-go" type="button" id="pl-retry">Try again</button></div>`);
      const rt = view.querySelector('#pl-retry');
      if (rt) rt.addEventListener('click', () => { const id = P.planId; P.st = null; shell(eyebrow('Group plan') + `<h1 class="lv-title">Connecting…</h1>`); watchPlan(id); });
      return;
    }
    if (!P.st.exists) {
      shell(eyebrow('Group plan') + `<h1 class="lv-title">Plan not found</h1><p class="pl-lead">This link doesn’t point to a plan any more — ask for a fresh one.</p>` +
        `<div class="pl-actions"><button class="imp-go" type="button" id="pl-new">Start a new plan</button></div>`);
      view.querySelector('#pl-new').addEventListener('click', () => { P.mode = 'home'; stopWatch(); P.st = null; render(); });
      return;
    }
    if (P.mode === 'link') return renderLink();
    if (P.mode === 'name') return renderName();
    P.mode = 'board';
    return renderBoard();
  }
  function onState(st) {
    const first = !P.st;
    P.st = st;
    if (!st.exists) { render(); return; }
    // The map the group has already built. adoptPlanItinerary decides whether
    // it's new to this device, and reloads only if it takes the map over.
    if (st.plan && st.plan.itinerary && typeof window.adoptPlanItinerary === 'function') {
      try { if (window.adoptPlanItinerary(P.planId, st.plan.itinerary, false, st.plan.itineraryAt || 0)) return; } catch (e) {}
    }
    if (first) {
      const meStored = (st.people[P.uid] && st.people[P.uid].name) || lsGet(nameKey(P.planId)) || '';
      P.me = meStored;
      // A plan that doesn't use names never asks for one. A name already stored
      // on this device is kept — it's what recognises the organiser across
      // their own phones — it just isn't asked for, shown, or attached to ideas.
      if (P.mode !== 'link') P.mode = (meStored || !feat('people')) ? 'board' : 'name';
      const mine = st.people[P.uid] || {};
      const known = !!(mine.arrive && mine.arrive.time) || !!(mine.leave && mine.leave.time);
      if (meStored && (!mine.name || !known)) P.store.setPerson(P.planId, P.uid, withAdoptedTimes(meStored));
      if (meStored && isCurator() && st.plan.curatorName !== meStored) P.store.updatePlan(P.planId, { curatorName: meStored });
      render();
      return;
    }
    if (P.mode === 'board') refreshBoard();
  }
  function stopWatch() { if (P.unsub) { P.unsub(); P.unsub = null; } }
  function watchPlan(planId) {
    stopWatch();
    P.planId = planId; P.st = null; P.strip = null; P.renaming = false;
    lsSet(LAST_KEY, planId);
    P.unsub = P.store.watch(planId, onState);
  }

  async function ensureStore() {
    if (P.store && P.uid) return true;
    P.store = SHARED ? firebaseStore() : localStore();
    try {
      const { uid } = await P.store.init();
      P.uid = uid;
      return true;
    } catch (e) {
      P.store = null;
      return false;
    }
  }

  async function openPlanner(planId) {
    if (view.hidden) showScrim();
    view.hidden = false;
    requestAnimationFrame(() => view.classList.add('is-open'));
    shell(eyebrow('Plan with friends') + `<h1 class="lv-title">Connecting…</h1>`);
    const ok = await ensureStore();
    if (!ok) {
      shell(eyebrow('Plan with friends') + `<h1 class="lv-title">Couldn’t connect</h1><p class="pl-lead">The shared planner needs a connection. Check you’re online and try again.</p>`);
      return;
    }
    const id = planId || lsGet(LAST_KEY);
    if (id) {
      // Opening a plan is what makes it this device's current one — watchPlan
      // records it too, but it isn't always the path we take from here.
      lsSet(LAST_KEY, id);
      if (!planId && !location.hash.startsWith('#p=')) history.replaceState(null, '', location.pathname + location.search + '#p=' + id);
      if (P.planId !== id || !P.st) { P.mode = 'board'; watchPlan(id); }
      else {
        // Already connected to this one. If the last thing shown was the
        // start-a-plan form, asking for a plan by id means: show me that plan.
        if (P.mode === 'home') P.mode = 'board';
        render();
      }
    } else {
      P.mode = 'home';
      render();
    }
  }
  function closePlanner() {
    if (!view.classList.contains('is-open')) return;
    view.classList.remove('is-open');
    hideScrim();
  }
  view.addEventListener('transitionend', () => { if (!view.classList.contains('is-open')) view.hidden = true; });
  makeSheetDismissable(view, { scrollSel: '.lv-body', onClose: closePlanner });

  window.openPlanner = openPlanner;
  window.closePlanner = closePlanner;
  // app.js calls this after an import that came from a plan: the finished map
  // goes back into the plan document, so every other phone gets it from the
  // link instead of needing its own copy of the JSON.
  // The app's door to a shared trip. Kept here because this file owns the
  // Firebase bootstrap; app.js just asks for a link and gets one.
  window.tripShare = {
    // A short link is only worth making when there's somewhere to put it.
    available: () => SHARED || window.TRIP_SHARE_LOCAL === true,
    async publish(raw, title, existingId) {
      if (!(await ensureStore())) throw new Error('offline');
      return P.store.publishTrip(existingId || null, raw, title, P.uid);
    },
    async fetch(id) {
      if (!(await ensureStore())) throw new Error('offline');
      return P.store.readTrip(id);
    },
  };

  window.publishPlanItinerary = async (planId, raw) => {
    if (!(await ensureStore())) return;
    await P.store.updatePlan(planId, { itinerary: raw, itineraryAt: Date.now() });
    // The importer reloads the page the moment this returns, so make sure the
    // map is actually with the server and not still sitting in the queue.
    if (P.store.flush) await P.store.flush();
  };

  // A pinned link opens straight into the plan. While the planner is being
  // tested it has no menu entry: #plan is the curator's private way in (it
  // opens their current plan, or the form to start one).
  const m = location.hash.match(/^#p=([a-z0-9]{6,24})$/i);
  // The welcome overlay sits above everything, so it has to be dismissed
  // whichever way we arrive — a fresh load OR a hash change in an open tab.
  const plannerUI = () => window.SHOW_PLANNER_UI !== false;
  function enterPlanner(id) {
    try { localStorage.setItem('pt_landing_seen', '1'); } catch (e) {}
    document.documentElement.classList.remove('show-landing');
    openPlanner(id);
  }
  // With the planner out of the interface, a #p= link is simply the trip's
  // link: fetch the map the plan carries, put it on screen, and say nothing
  // about plans. The organiser's own door (#plan) still opens the planner.
  async function quietAdopt(planId) {
    history.replaceState(null, '', location.pathname + location.search);
    if (!(await ensureStore())) return;
    lsSet(LAST_KEY, planId);
    let done = false;
    const unsub = P.store.watch(planId, (st) => {
      if (done || st.error) return;
      done = true;
      setTimeout(() => unsub(), 0);
      if (!st.exists) { toast('That trip isn’t there any more'); return; }
      const raw = st.plan && st.plan.itinerary;
      if (!raw) { toast('The map for this trip isn’t ready yet'); return; }
      // They tapped the trip's own link, so this is the trip they want open.
      if (typeof window.adoptPlanItinerary === 'function') window.adoptPlanItinerary(planId, raw, true, st.plan.itineraryAt || 0);
    });
  }
  if (m && !plannerUI()) quietAdopt(m[1]);
  else if (m || location.hash === '#plan') enterPlanner(m ? m[1] : undefined);
  // …and also when the hash changes while the app is already open (a #p= link
  // landing in an open tab, or the curator's own #plan bookmark). Note that
  // openPlanner's own replaceState never fires this, so there's no loop.
  window.addEventListener('hashchange', () => {
    const h = location.hash.match(/^#p=([a-z0-9]{6,24})$/i);
    if (h && !plannerUI()) quietAdopt(h[1]);
    else if (h || location.hash === '#plan') enterPlanner(h ? h[1] : undefined);
  });
})();
