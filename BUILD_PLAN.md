# Untangle — Build Plan for Claude Code

This doc is split into 6 phases. Copy one phase at a time into Claude Code, verify it works (Expo Go or preview), then move to the next. Don't hand over all phases at once — that's what causes a mess.

## Status

| Phase | Status |
|---|---|
| 1 - Project scaffold | ⬜ Not started |
| 2 - Solvable puzzle generation | ⬜ Not started |
| 3 - Dragging + solve detection | ⬜ Not started |
| 4 - Visual & feel polish | ⬜ Not started |
| 5 - Journey map & progress | ⬜ Not started |
| 6 - Ads | ⬜ Not started |

**Before you start work on any phase, read this table to know where the project stands. After finishing a phase, update its row here before you stop.**

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

### General note for every phase

At the end of each phase, ask Claude Code: **"Explain in a few sentences exactly what to check to confirm this works before we continue"** — that way you always know whether it's safe to move on or something needs fixing first.
