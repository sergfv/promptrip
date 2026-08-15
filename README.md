<p align="center">
  <img src="icons/icon-192.png" width="96" height="96" alt="Promptrip app icon" />
</p>

<h1 align="center">Promptrip</h1>

<p align="center">
  Turn any AI-generated travel plan into an interactive itinerary app on your phone.
</p>

A tiny travel-map app you build by talking to **any** AI assistant — then add
to your phone's Home Screen, where it opens full-screen like a real app. Ask
ChatGPT, Claude, or Gemini to plan a trip, paste its reply, and get a mobile,
offline-capable map of your days — with photos and directions.

**▶ Live demo:** https://sergfv.github.io/promptrip/
(opens a sample Vienna itinerary — tap **⋯ → Create an itinerary** to build your own)

No accounts, no servers, no app store. It's a single static page that runs
entirely in the browser and installs to your home screen as a PWA.

**💬 Feedback:** [Tell me what you think](https://form.typeform.com/to/Z2gBNuH7) — it shapes what I build next.

<p align="center">
  <img src="docs/screenshots.png" width="100%" alt="Promptrip screens: the welcome landing, the day map with the Karlskirche stop selected, the stop detail with photos, and the create-an-itinerary flow" />
</p>

---

## What it does

- **Day-by-day map** — colour-coded pins per day; tap a day to focus it, or see them all.
- **Stop cards** — a bottom sheet with notes, step through each day in order, and a one-tap **Open in Maps**.
- **Photos** — real places show images pulled live from Wikipedia (restaurants and small spots show a clean category icon instead of a random image); tap to open a swipe + pinch-zoom lightbox.
- **Reads like a plan, not a list** — each day carries a short narrative intro, and stops are typed (a sight, a **stroll** down an avenue, a viewpoint, a beach…) each with its own icon.
- **Opens on today** — if your trip is in progress, it lands on the current day.
- **Create an itinerary** — paste an AI's reply to generate yours (see below).
- **Any language** — plan with your AI in whatever language you prefer; your itinerary comes back in the same language (place names stay in their local form).
- **Share** — pack a whole itinerary into a single link and send it; the recipient just taps it. The link is long *by design*: your entire trip is encoded inside it, so there's no server, no account and no database behind your data — the link **is** the trip.
- **Installs like an app** — add it to your Home Screen and it opens full-screen, with its own icon — no app store, no download.
- **Offline** — the app shell is cached, so it opens and works without signal (map tiles and photos need a connection).

## Create an itinerary in three steps

1. Plan your trip with your preferred AI assistant (ChatGPT, Claude, Gemini).
2. Open Promptrip, tap **⋯ → Create an itinerary → Copy**, and paste that prompt into the same chat.
3. Paste the AI's reply back into the app → **Create my itinerary**. It's saved on your device, and you can add it to your home screen like an app.

Nothing is uploaded — your itinerary lives in your browser (and in share links you choose to create).

<details>
<summary>The prompt (also built into the app)</summary>

The app asks the AI for a small JSON itinerary. Each day has an optional
`intro` (its narrative), and each stop is a `place` or a `walk` (a street to
stroll) — both a single point, with a `category` that sets the icon:

```json
{
  "title": "Trip name",
  "subtitle": "dates or a short tagline",
  "days": [
    {
      "label": "Mon 1",
      "name": "Mon 1 — morning theme",
      "date": "2026-07-01",
      "intro": "The day's story: how it flows and what to look out for.",
      "stops": [
        { "type": "place", "category": "museum", "name": "Place", "note": "Why go, timing, a tip.", "lat": 0.0, "lng": 0.0, "wiki": "Wikipedia article title" },
        { "type": "walk", "category": "walk", "name": "An avenue to stroll", "note": "What you'll pass.", "lat": 0.0, "lng": 0.0 }
      ]
    }
  ]
}
```

Colours and ids are assigned by the app, so the AI only supplies content. A
stop's `category` picks its icon; the optional `wiki` title (for real
landmarks) is what lets a stop show a photo.
</details>

## Design & engineering notes

This started as a one-off itinerary for a single trip and was generalised into a
reusable tool. A few decisions worth calling out:

- **Paste, not integrations.** The lowest common denominator every AI assistant
  can do is "follow a format and return text." So the handoff is a copy-paste of
  the AI's reply — it works the same in ChatGPT, Claude, Gemini, or anything
  else, with zero per-tool setup. A one-tap share link covers re-opening and
  sending to others.
- **Built for a non-technical traveller.** No GitHub, no files, no JSON
  knowledge required — the prompt is embedded in the app, the import is lenient
  (it pulls the JSON out of a full chat reply), and bad input gets a friendly
  message instead of a blank screen.
- **Untrusted data is treated as untrusted.** Once anyone's itinerary can be
  loaded, all text is HTML-escaped at render, coordinates are validated, and
  image URLs are restricted to Wikimedia.
- **Names are the source of truth, not coordinates.** AI-supplied `lat`/`lng`
  can be plausibly wrong, so on first view an imported itinerary is geocoded
  once against OpenStreetMap — each stop's name is looked up (biased to its
  rough coordinate so a match can't jump cities) and the pin snaps to the real
  place. It's best-effort: offline, unmatched names, or the private home base
  keep their original coordinate. ("Open in Maps" already resolves by name, so
  this just brings the on-map pin up to the same accuracy.)
- **Photos without curation.** Rather than hardcoding image URLs, a stop names a
  Wikipedia article and the app fetches the editor-chosen lead image (plus a few
  relevant extras) on demand — so it works for any place in the world.
- **Calm visual system.** Warm paper surfaces, flat fills, a single accent
  colour for anything interactive, and categorical colours for days.

## How it works

Plain vanilla JavaScript — **no build step, no framework.**

- **[Leaflet](https://leafletjs.com/)** with the **CARTO Voyager** basemap (OpenStreetMap data) — free, no API key.
- **Wikipedia / Wikimedia Commons** APIs for photos (fetched client-side).
- **[lz-string](https://github.com/pieroxy/lz-string)** to compress an itinerary into a share link.
- A **service worker** precaches the app shell for offline use.
- Hosted free on **GitHub Pages**.

| File | Role |
|------|------|
| `index.html` | Markup shell |
| `style.css` | The visual system |
| `app.js` | The engine: data loading, rendering, import, share, photos |
| `data.js` | The built-in demo itinerary (`TRIP`) + its curated photos |
| `sw.js` | Service worker (offline cache) |

## Run locally

No dependencies — just serve the folder over HTTP:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Credits

- Maps © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, tiles by [CARTO](https://carto.com/attributions).
- Photos from [Wikimedia Commons](https://commons.wikimedia.org/) (each links to its source/licence).
- Built with [Leaflet](https://leafletjs.com/) and [lz-string](https://github.com/pieroxy/lz-string).

## License

[MIT](LICENSE)
