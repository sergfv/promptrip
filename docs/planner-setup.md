# Plan with friends — one-time setup

The group planner needs one shared place for the plan to live, so everyone who
opens the pinned link sees the same ideas, votes and times. Promptrip uses
**Firebase** for that (free tier, no server of your own). Until it's configured
the planner still works, but only on the device you're using.

Friends never sign up: they're signed in *anonymously* — a hidden, stable
identity per phone — and tap their name from the roster you set up.

## Steps (about 10 minutes)

1. **Create a project** — go to https://console.firebase.google.com, *Add project*,
   name it (e.g. `promptrip`), and turn *Google Analytics* off. Create.
2. **Turn on anonymous sign-in** — left menu *Build → Authentication → Get started*,
   tab *Sign-in method*, choose **Anonymous**, enable, save.
3. **Create the database** — *Build → Firestore Database → Create database*,
   pick a region near you (e.g. `eur3` / europe-west), start in **production mode**,
   create.
4. **Paste the security rules** — in Firestore open the *Rules* tab, replace
   everything with the contents of [`firestore.rules`](../firestore.rules), and
   *Publish*. These rules are what make "anyone can suggest, only the curator
   arranges" true on the server, not just in the app.
5. **Register the web app** — *Project settings* (gear icon) → *Your apps* →
   the `</>` (web) icon → nickname `Promptrip` → *Register*. Firebase shows a
   `firebaseConfig` object; copy its `apiKey`, `authDomain`, `projectId` and
   `appId`.
6. **Put the config in the app** — open [`config.js`](../config.js) and replace
   the `null` after `window.PLANNER_FIREBASE =` with that object (the example
   in the file shows the shape).
7. **Allow your domain** — *Authentication → Settings → Authorized domains* →
   *Add domain* → `sergfv.github.io`. (`localhost` is already allowed for
   testing.)
8. **Deploy** as usual (bump the service-worker cache so installed apps refresh).

## Good to know

- The config values are **public by design** — every Firebase web app ships
  them. What people can read and write is decided by the rules, not by hiding
  the config.
- **The curator is the device that created the plan.** Arranging happens from
  that phone (or browser). If you need to arrange from elsewhere, create the
  plan from that device.
- **Who can see what.** The link is the only key — anyone holding it is a
  participant, and can read the trip name, dates, place, everyone's first names,
  the ideas and the votes. **Arrival and leaving times are private**: each
  person's entry is readable only by them and the curator. Still, the link
  reveals that these people are away at a given place on given dates — share it
  with the group, not publicly.
- One consequence of that privacy: a name someone adds via *"Add your name"*
  won't appear in other people's name pickers (the roster you typed always does).
- The free Spark plan comfortably covers a friend group; Firestore's free
  quota is thousands of reads a day.
