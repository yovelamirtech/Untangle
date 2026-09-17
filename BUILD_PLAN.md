# Untangle — Build Plan for Claude Code

This doc is split into phases. Copy one phase at a time into Claude Code, verify it works (Expo Go or preview), then move to the next. Don't hand over all phases at once — that's what causes a mess.

## Status

| Phase | Status |
|---|---|
| 1 - Project scaffold | ✅ Done |
| 2 - Solvable puzzle generation | ✅ Done |
| 3 - Dragging + solve detection | ✅ Done |
| 4 - Visual & feel polish | ✅ Done |
| 5 - Journey map & progress | ✅ Done |
| 6 - Ads | ✅ Done (interstitial confirmed firing only at zone boundaries, via appetize.io device test) |
| 7 - Studio splash & app branding | ✅ Done |
| 8 - Main menu (mode select) | ✅ Done (Badge Challenge shown as disabled "coming soon"; settings gear is a no-op stub until Phase 9) |
| 9 - Settings screen | ✅ Done (bug reports need a Web3Forms access key added before they'll actually send — see PR notes) |
| 10 - Badge Challenge mode | 🟡 In progress — Bird/Shark/Toaster/Butterfly/RTX 5090 confirmed working (each a single continuous line, outer silhouette pinned, interior tangled); Face on hold — `assets/example_photos_for_badges/face.jpg` is only 228×350px and mixes thin low-poly facet lines with bold accent strokes (eyebrow/eye/nose/lips/jaw) that `scripts/vectorize-badge.mjs`'s single darkness threshold can't tell apart, plus a floating hair-curl near the temple that never touches the main mesh. Auto-tracing as-is drops real detail (two multi-way junctions near the eye and mouth get flagged ambiguous and dropped) even after loosening spur-pruning and junction-clustering. User decided (2026-09-16) to leave Face for later rather than hand-simplify or fall back to contour-only — revisit with a better source image next session. |
| 11 - Journey map rework (bottom-to-top, tap-to-advance, replay) | ⏳ Not started |

**Before you start work on any phase, read this table to know where the project stands. After finishing a phase, update its row here before you stop.**

---

## Assets already prepared (do not regenerate)

- `assets/stutio_logo/` — the studio's own logo (Yovlez Studio), in three variants: `icon-primary.svg` (with cartridge notch, use for the splash fade), `icon-appstore.svg` (plain square), `wordmark.svg` (icon + "Yovlez STUDIO" text). Note the folder name has a typo (`stutio` not `studio`) — kept as-is unless told to rename it, since renaming means updating every import.
- `assets/game_logo/` — a first draft of the Untangle game's own mark (separate from the studio logo): `icon-main.svg` (circular icon: a closed, non-crossing loop of pale-blue nodes on a sky-blue background, in the game's existing "sky cotton" palette from `src/palette.ts`) and `wordmark.svg` (same mark + "Untangle" text). Treat this as a starting point for phase 8, not a final asset — feel free to iterate on it with the user before locking it in as the real app icon.
  - **Planned follow-up (not yet requested as a task):** the user wants to eventually swap this generic mark for the icon/silhouette of one of the Badge Challenge badges (phase 10) once those exist — ask before doing this, don't do it proactively.

---

## Before anything — persistent context

Put this at the start of every new Claude Code session (or in `~/.claude/CLAUDE.md` if you have a place for it there):

```
I'm building a mobile puzzle game called "Untangle", in Expo/React Native.
The game: a set of points on screen connected by lines that cross each
other. The player drags points around until no line crosses another.
Once that happens — the level is solved, there's an animation + haptic
buzz, and it moves to the next level. No game over, no timer, no pressure.

At each phase of the project I'll give you a specific instruction. Only
work on what I asked for, then stop and tell me what to check before
you move on.
```

---

## Phase 1 — Project scaffold

```
Set up a new Expo project (TypeScript, Expo Router if that's convenient).
I just need a single empty screen to confirm everything runs. Add:
- react-native-svg (for drawing the lines and points)
- react-native-reanimated + react-native-gesture-handler (for smooth dragging)
- expo-haptics (for vibration feedback)

Make sure it builds and runs in Expo Go, and tell me what to check to
confirm the install is solid. Still no game logic at all.
```

---

## Phase 2 — Generating an always-solvable puzzle

This is the algorithmic core of the game. Worth understanding the idea before handing it to Claude:

**The principle:** first build an "ordered" graph — points placed so the lines between them don't cross — this is the *solution*. Then randomly reposition the points on screen (without changing which points connect to which). This guarantees a solution always exists — it's just currently "scattered".

```
Now let's build the puzzle-generation logic, no special UI yet — just a
simple screen showing points and lines.

1. A function that creates a solvable graph: N points positioned so they
   don't create crossings (e.g. on a circle, or a random layout with
   crossing checks), connected by M random edges (without breaking the
   no-crossing property).
2. A function that shuffles the point positions (without touching the
   edges) so the result is scrambled and does contain crossings.
3. A function that checks whether two line segments intersect (not
   counting when they share an endpoint) — this runs after every drag.
4. Show me on a simple screen: points (circles) and lines between them,
   no interaction yet — just so I can see it generates scrambled but
   solvable graphs.

Start with 6 hardcoded points and 7 hardcoded edges so it's easy to test.
```

---

## Phase 3 — Dragging + solve detection

```
Now add interaction to the screen from the previous phase:
1. Each point is draggable, using reanimated + gesture-handler.
2. After every drag — check all pairs of lines using the function we
   already built, and count how many crossings currently exist.
3. When the crossing count reaches 0 — that's a solve! Show some clear
   signal on screen (e.g. all lines turn green) — still no special
   animation yet, just so I know you detected it correctly.

Important: make sure dragging feels smooth (60fps) and doesn't stutter.
```

---

## Phase 4 — Visual & feel polish

```
Now let's add the layer that makes this feel good:
1. When a puzzle is solved: a short animation (lines "straighten
   out"/light up), plus a short haptic buzz via expo-haptics.
2. Minimalist design: solid dark background, points as small circles,
   thin lines. Pick one pleasant color palette for now (we can change
   it later if needed).
3. After a solve — a button/automatic transition after a second to the
   next level, with a new puzzle generated via the phase 2 functions.
4. Start at 5 points, and increase difficulty (more points/edges) every
   few levels — propose a simple difficulty-scaling rule and I'll
   confirm it.

After this phase it should already be possible to play a continuous
sequence of levels without stopping.
```

---

## Phase 5 — Journey map & progress

```
Now let's add the "journey" layer:
1. An additional screen/area showing a winding path (a simple SVG is
   enough, nothing fancy needed), with one point on the path for each
   level solved. Levels already solved are highlighted; levels ahead
   are dimmed/gray.
2. Every 5 levels — a small "waypoint" with slightly different styling
   on the path.
3. Every 20-25 levels — a new "zone": a different background palette
   (propose 3-4 palettes that rotate).
4. Save progress locally on the device (AsyncStorage), so it persists
   across app launches.
5. Ability to scroll back and see the whole path already traveled.

Keep this as a separate screen accessible via a simple button from the
game screen, not something that pops up and interrupts the actual game
flow.
```

---

## Phase 6 — Ads (last, not before)

```
The game already works and feels good — now let's add light monetization:
1. Integrate expo-ads-admob or react-native-google-mobile-ads (tell me
   which one fits Expo better right now) with test ad unit IDs for now —
   I haven't signed up for a real AdMob account yet.
2. An interstitial (transition ad) that only appears at transitions
   between "zones" on the journey map (i.e. every 20-25 levels) — not
   between every level.
3. Make sure the ad never appears mid-drag of a point, only between
   actions.

Once this works with test IDs, I'll sign up for a real AdMob account
and we'll swap the IDs in.
```

---

## Phase 7 — Studio splash & app branding

```
Add a studio splash screen that plays once at app launch, before the main
menu (phase 8):
1. Show the studio logo (assets/stutio_logo/icon-primary.svg) centered on
   screen, fading in, holding briefly, then fading out — then move on to
   the main menu automatically. No buttons, nothing tappable, skip on tap
   is a nice-to-have but not required.
2. Use assets/game_logo/icon-main.svg as the app's actual icon/splash-icon
   (replacing assets/icon.png and assets/splash-icon.png) and update
   app.json accordingly. Convert the SVG to PNG at the sizes Expo expects
   — tell me if you need a tool for that.
3. Keep this fast — under ~1.5s total — this runs on every cold start and
   should never feel like it's blocking the player from playing.
```

---

## Phase 8 — Main menu (mode select)

```
Add a new "main menu" screen shown right after the studio splash
(phase 7). This becomes the app's real home screen — replacing whatever
currently loads first.

1. Show the game's own logo (assets/game_logo/wordmark.svg or
   icon-main.svg + a title) near the top.
2. Two big, clearly-labeled options to choose a game mode:
   - "Journey" (מסע) — goes to the existing level progression
     (today's PuzzleScreen/JourneyScreen flow, unchanged).
   - "Badge Challenge" — placeholder button for now, wired up for real in
     phase 10. If phase 10 isn't built yet, either hide this button or
     show a "coming soon" state — your call, tell me which you did.
3. A settings (gear) icon fixed to the top corner of this screen — same
   spot/style as letter-wheel's SplashScreen (top-left in RTL, using
   Ionicons "settings-outline"), opening the settings screen from phase 9.

Keep this screen simple — it's a hub, not a place to cram content.
```

---

## Phase 9 — Settings screen

```
Add a settings screen, reachable from the gear icon added in phase 8 (and
from inside a game screen too, same as letter-wheel does it — gear icon
top corner, opens settings, "back" returns to wherever you were).

Use github.com/yovelamirtech/letter-wheel as a structural reference (its
src/screens/SettingsScreen.tsx, src/components/SettingsSection.tsx,
src/components/SettingsRow.tsx, src/utils/settings.ts) but adapt it to
Untangle — reuse the pattern (sectioned rows in cards, a toggle row, a
danger button at the bottom), not letter-wheel's exact copy or its
word-game-specific content.

Sections to include, adapted to what Untangle actually has:
1. Sound / haptics — toggles for sound effects and haptic feedback on
   solve, persisted via AsyncStorage (same pattern as letter-wheel's
   settings.ts: a synchronous in-memory cache + async persistence).
2. Help — a "report a bug" entry (can be a simple mailto: link if you
   don't want to build a full in-app form — ask me which I prefer).
3. Info — link to a privacy policy (ask me for the URL/text, or draft a
   minimal one similar to letter-wheel's PRIVACY.md if this app doesn't
   have one yet — required before shipping since we show ads).
4. A "reset progress" danger button at the bottom, with a confirmation
   dialog, that clears journey progress AND badge-collection progress
   (phase 10) — with a clear warning that both are wiped.

Match Untangle's own visual style (colors, fonts) — don't copy
letter-wheel's color/font values directly.
```

---

## Phase 10 — Badge Challenge mode

This is the "many dots, giant space" idea from earlier planning, now scoped as its own real mode rather than a future idea — the pan/zoom camera, Skia rendering, and puzzle-generation code from phases 2-4 already support a much higher node count, so this phase is mostly new screens + a shape-matching layer on top of what exists.

```
Build the "Badge Challenge" mode selected from the main menu (phase 8):

1. A "collection" screen: a grid/list of windows/cards, one per badge
   (e.g. bird, toaster — pick 4-6 to start with, more can be added later
   the same way). Each card shows a hint about the badge without fully
   revealing it — a partial/blurred outline, or a short text clue, your
   choice, but keep it consistent across cards.
2. Each card shows a clear visual state:
   - locked/not started
   - in progress (the player opened this badge's puzzle before but hasn't
     solved it) — needs its own visible indicator on the card
   - solved (badge earned) — hint fully replaced by the real reveal
3. Tapping a card opens that badge's puzzle: a single large pannable/
   zoomable canvas (reuse the existing camera + Skia rendering) with far
   more points/edges than a normal level, laid out so that the *solved*
   state traces the badge's shape as a closed, non-crossing outline —
   similar in spirit to assets/game_logo/icon-main.svg's approach (a
   closed loop through ordered points), just with many more points and a
   recognizable silhouette (reference: a low-poly line-art style, like a
   geometric bird outline — contour only, not every internal facet).
   Scramble point positions the same way phase 2's shuffle function does,
   without changing which points connect to which.
4. Progress within an in-progress badge puzzle must be saved (current
   point positions, or at least "started" state) so the player can leave
   mid-solve and come back later to the exact same puzzle state — persist
   this in AsyncStorage alongside the rest of progress.
5. On solving a badge: same solve feedback as normal levels (animation +
   haptic), then return to the collection screen with that badge now
   shown as earned.
6. Solved badges accumulate in the collection screen — this doubles as
   the "badge collection" the player can browse.

Propose how many points/edges a badge puzzle should have and how you'll
define each badge's target shape (hardcoded coordinate list per badge is
fine to start) — confirm with me before generating more than 1-2 badges.
```

---

## Phase 11 — Journey map rework

```
Three changes to the existing journey screen (src/JourneyScreen.tsx):

1. Flip the path's direction: level 1 starts at the bottom of the screen,
   and the path winds upward as levels increase (currently it's the
   opposite/unspecified — check current behavior first and confirm with
   me what's changing).
2. After solving a level, instead of auto-advancing to the next level
   after a second (current phase-4 behavior), return to the journey map
   and play a small "new stage unlocked" animation revealing the newly
   opened point on the path. The player must then tap that new stage
   themselves to actually start playing it — no more automatic
   transition. Confirm with me this is meant to fully replace the
   auto-advance, not sit alongside it.
3. Any already-unlocked stage (solved or not-yet-attempted-but-reachable)
   can be tapped from the journey map to (re)play it. Replaying an
   already-solved level generates a fresh puzzle for fun and does NOT
   affect unlock progression either way — it's purely for the player's
   enjoyment, solving it again doesn't unlock anything further and
   failing to solve it again doesn't lock anything back up.
```

---

### General note for every phase

At the end of each phase, ask Claude Code: **"Explain in a few sentences exactly what to check to confirm this works before we continue"** — that way you always know whether it's safe to move on or something needs fixing first.
