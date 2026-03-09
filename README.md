# MyShelf

A web app to track and show off your collections. Add stuff you own—figures, cards, games, whatever—organize it in boxes, build bundles, and optionally share it. You can also follow other collectors, add friends, and see what they’re adding in a feed.

---

## What it does (as of Mar 9, 2025)

**Your collection.** Add items with names, categories, tags, photos, condition, year, and whether they’re public or private. Put items in “boxes” (e.g. “Honkai Star Rail”), or define “bundles” that tie several items together (e.g. a console + game bundle). Search, filter, sort, bulk-edit, and see basic stats.

**Profiles & discovery.** Your profile can be public or private. If it’s public, others can find you via Explore (search by name) and see your public items and boxes. They can follow you or send a friend request.

**Social.** Follow people, manage friends, accept or decline requests. The Feed shows activity from people you follow or are friends with.

**Account & settings.** Sign in with email or Google. In settings you can switch theme (dark/light), tweak how the collection is displayed, link or unlink accounts, reset password, export your data, or delete your account.

So in short: it’s a full collection tracker with a social layer—everything above is implemented and working.

---

## How to run it

**Deploy it** (that’s the intended way): install the [Firebase CLI](https://firebase.google.com/docs/cli), then from the project folder run:

```bash
firebase deploy
```

Your app will be live on the hosting URL Firebase gives you.

**GitHub Pages:** You can also deploy via GitHub Pages (Settings → Pages → deploy from branch). The app auto-detects the base path when it’s served from a project subpath (e.g. `username.github.io/MyShelf/`).

**Run it locally** (optional): only if you need to test on your machine. Same CLI, then:

```bash
firebase serve
```

You’ll get a local URL. It still talks to the same backend, so it’s real data. Handy as a fallback; deploy is the main path.
