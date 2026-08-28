# Road to Playable v1

Status report and plan for shipping the first complete, playable version of Dusk and Dawn. Written 2026-08-28 against commit `c79e48a`.

**Definition of v1:** two people (or one person and the AI) can create a game, find it, play it through to a king's death in the browser without reading the source, without the game freezing, and with enough on-screen information to make decisions.

---

## Where things stand

The rules engine is done and trustworthy. The web client is where the work remains.

| Area | State | Evidence |
|------|-------|----------|
| Rules engine (`src/shared`) | Complete: all 12 actions, clock, production, combat, fog, win check | 376 unit tests pass; `scripts/test-play.ts` finishes 10/10 random games (~131 actions each) with zero invariant violations |
| Map generation | Complete, with preview and tuning | `/map`, New Game preview |
| Backend | Complete for the happy path | 4 edge functions, RLS on `games`, server-side AI opponent |
| Auth | Complete | Email/password sign-up, sign-in, reset |
| Game creation | Complete | Name, size, alliance, map config, invite by email, AI toggle |
| Game board | Renders; click to move/attack/loot; fog; polling; turn notifications | `src/core/Board.ts`, `src/pages/game/GamePage.tsx` |
| Non-move actions in the UI | Exist but keyboard-only, undocumented, no feedback | 19 single-key shortcuts in `GamePage.tsx` |
| Unit/army information | Missing | Pieces render as a sprite only: no hearts, defense, equipment, or steed |
| Turn flow | Has two hard freezes | See P0 below |
| Deployment | Manual; no CI | No hosting config in repo; `pnpm typecheck` currently fails |

Tooling that already exists and helps: `/dev` scenario harness, `/sandbox`, `/docs`, CLI play/spectate/auto-play, Playwright screenshots, self-play invariant harness.

---

## What is missing

Ordered by priority. **P0** blocks finishing a game at all. **P1** blocks two strangers finishing a game without help. **P2** is polish and hygiene that v1 should not ship without.

### P0 - the game can freeze

**1. No way to pass time.** Every action advances the clock 60 minutes (at speed 0), so a player must take 12 actions to get through their phase. There is no `pass`/`wait` action (`src/shared/actions/index.ts`), so a player with nothing useful to do has to shuffle a peasant back and forth, and a player with *no* legal action (boxed-in pieces, no resources) can never end their phase. The game is permanently stuck.

Fix: add a `pass` action to the engine that advances the clock one tick (or optionally to the next phase boundary), with the same turn validation as other actions. Expose it as an "End turn" button. Update the AI to fall back to `pass` when `generateAllActions` is empty.

**2. AI turns can stall the game forever.** `game-action` runs the AI for at most 50 actions after a successful human action (`MAX_AI_ACTIONS` in `supabase/functions/game-action/index.ts`). The AI researches Speed (weight 10, cost 1 wood). At speed level 3 a phase takes 72 actions; at level 5 it takes 720. Once the cap is hit mid-phase, `currentPlayer` is still the AI, every human action is rejected with "Not your turn", and the AI only runs after a *successful* human action, so it never resumes.

Fix (pick one): run the AI loop until the phase ends with a much higher cap and a wall-clock guard; or have `game-state` (which the client polls every 2 s) resume AI turns when `currentPlayer` is the AI; or have the AI `pass` to the phase boundary when it has run out of useful moves. Also stop the AI from researching Speed past level 2.

**3. Silent failures.** A rejected action logs `console.warn` and nothing else (`Board.ts` `sendAction`). A player who presses a key on the wrong tile or lacks resources sees nothing happen.

Fix: surface `result.error` and `result.message` in the UI (a toast or a message line in the sidebar).

### P1 - the board is not readable or discoverable

**4. Unit stats are invisible.** The client `Piece` carries only kind, view range, attack range, and walkable landscape (`src/core/Piece.ts`, `GameParser.ts`). Hearts, defense, equipment, and steed are in the server payload but dropped. Combat decisions are blind.

Fix: parse hearts/defense/equipment/steed into the client piece; add a "Selected" panel in the sidebar showing kind, hearts/max, attack, defense, range, equipment, steed, and for buildings type/owner/occupant; draw a small heart pip row on damaged pieces on the canvas.

**5. Actions are keyboard-only and undocumented.** Build, spawn, craft, steed, train, heal, research, enter tower, summon are bound to `h t c w r p s d b x e n m g o f 4 5 6 7` with no on-screen hint. Several require a prior selection (heal, enter tower, buy steed) that the user cannot know about.

Fix: a context action panel for the selected tile. Own piece: Build (house/tower/wall/church with cost), Craft (sword/shield/bow), Enter tower (if king next to tower), Heal (if priest). Own house: Spawn peasant, Buy horse/boat. Own church: Train priest, Summon. Own castle: Research list with costs and current levels. Buttons disabled with a reason when unaffordable or invalid. Keep the shortcuts and list them in a help overlay (`?`). Drop the `c` (castle) shortcut; castles cannot be built directly.

**6. Sidebar is incomplete or dead.** Shows wood/stone/food/gold but not iron or faith (`render-resources.ts`). The "Buildings" panel (`#houses`, `#towers`, `#castles`) is never populated. No research state is shown. The clock prints fractional hours once Speed is researched (`Clock.toString` with `time = 6.5` renders `6.5:00`).

Fix: render all six resources, research levels, and the building counts, or delete the building panel. Format the clock as `HH:MM`.

**7. Player role comes from the URL.** `/game/:id?player=day` is chosen by the user on a "Choose your side" screen; the server already returns `viewingAs`. Anyone can pick the wrong side and get a confusing board where every action fails.

Fix: derive role from `viewingAs` in the `game-state` response, remove the chooser, and use `?player=spectator` only for non-participants.

**8. Board navigation.** Canvas is sized to its wrapper, no zoom, pan only via arrow keys after focusing the canvas, no touch. The New Game default is 40x40 with 30 px hex radius (roughly 2000 px wide); the king starts off-screen.

Fix: center the camera on the player's king at load; add drag-to-pan and wheel zoom; set the default board size to 20 for v1.

**9. No action history.** Between polls the board just changes. The opponent's moves, production at dawn/dusk, and combat results are not narrated.

Fix (minimal): server appends a short event log to the game row (last N entries: "Night peasant attacked your tower at 12,4"); client shows it in the sidebar. Alternatively, diff consecutive states client-side for a v1 approximation.

**10. Invite flow is one-directional.** `game-create` writes the invitee's email straight into the opponent slot, so the invitee sees the game in `/games/list` if they already have an account and think to look. There is no email, no shareable link, and `game-join` has no UI. Open games (no invite) cannot be joined by anyone.

Fix: after creating a game, show a copyable game link. On `GamePage`, if the viewer is not a participant and a slot is empty, show "Join as night" calling `game-join`. Optional but valuable: send an invite email and a "your turn" email from the edge functions (Supabase + Resend).

**11. Game list.** Cards show emails and timestamps but not the game name, whether it is *my* turn, or whether the game is finished.

Fix: show name, a "Your turn" / "Waiting" badge relative to the signed-in user, and "Finished - Day won". Sort my-turn games first.

### P2 - hygiene before shipping

**12. Build health.** `pnpm typecheck` fails with 8 errors (`BattleSandbox.tsx`, `SandboxPage.tsx`, `SignupPage.tsx`). `pnpm lint` reports 3,648 errors, almost all style rules (`no-magic-numbers`, `sort-keys`, `sort-imports`, `no-ternary`); the lint script is not usable as a gate. `knip` flags the CLI as unused because it is not an entry point.

Fix: fix the type errors; trim `.oxlintrc.json` to the rules the project actually follows; add `src/cli/main.ts` as a knip entry.

**13. No CI, no hosting config.** Tests and typecheck run only by hand. The frontend has no deploy target in the repo; edge functions deploy through `pnpm deploy:functions`.

Fix: GitHub Actions running `typecheck`, `test`, and `build` on PRs; static hosting for `dist/` (any static host works: the app is a SPA with Supabase behind it) with an SPA rewrite to `index.html`; document `VITE_SUPABASE_*` for the host.

**14. Spectator leak.** `game-state` returns the full, unfiltered board to any authenticated user who knows a game id. Acceptable among friends; restrict to participants or filter to the union of both players' vision before opening sign-up more widely.

**15. Docs drift.** README says magic-link auth (it is password). The spec lists 11 actions (there are 12, `loot` is missing). Spec and README should mention the `pass` action once it exists.

**16. Transition dialogs.** Dawn/Dusk and "Your turn" dialogs are separate DOM-manipulated modals that can stack and both fire on the same poll. Fold them into one non-blocking banner.

**17. Balance is untested by humans.** Random self-play ends in ~11 in-game days, which says nothing about how the game feels. Two or three full human playtests will surface pacing problems (12 actions per phase at speed 0 is a lot of clicking) that no test harness will.

---

## The plan

Five milestones, each leaving the game more playable than the last. Estimates are in focused working days for one developer familiar with the codebase.

### M1 - Cannot freeze (1-2 days)

- Add `pass` action to engine, AI, CLI, and self-play harness; test that a player with no legal actions can still end their phase.
- Fix AI stall: AI runs to phase end or passes; cap Speed research for AI at level 2; add a wall-clock guard in the edge function.
- Show action errors and messages in the UI.
- Fix typecheck; add CI for typecheck + test + build.
- Self-play: extend the harness with a "player has no legal action" scenario and assert no stalemates.

Exit: 100 random games and 3 scripted deadlock scenarios all reach game over.

### M2 - Readable board (2-3 days)

- Parse hearts/defense/equipment/steed into the client piece; heart pips on the canvas.
- Selected-tile inspector panel.
- Full resource row (6), research state, clock as `HH:MM`; remove or populate the buildings panel.
- Camera centers on king at load; drag-pan and wheel zoom; default size 20.

Exit: a new player can tell, without the console, what a unit is, how hurt it is, what it can reach, and what they own.

### M3 - Discoverable actions (2-3 days)

- Context action panel per selected tile with costs and disabled reasons.
- Help overlay listing shortcuts and the rules summary (link to `/docs/game-specification`).
- "End turn" button (uses `pass`, optionally repeating to the phase boundary with confirmation).
- Replace stacked dialogs with a single turn/phase banner.

Exit: a full game can be played with the mouse only.

### M4 - Two people, one game (2 days)

- Role from `viewingAs`; remove the side chooser.
- Copyable game link after creation; "Join" button on `GamePage` for an empty slot.
- Game list shows name, your-turn badge, finished state; my-turn games first.
- Event log (server-side, last 20 events) shown in the sidebar.
- Optional: invite and your-turn emails.

Exit: send a link to someone who has never seen the game; they sign up, join, and you finish a game together.

### M5 - Ship (1-2 days)

- Static hosting for the frontend with SPA rewrite; `pnpm deploy:functions` documented and run.
- Restrict `game-state` to participants (or accept and note it).
- Docs: README auth, spec actions (12 + pass), a "How to play" page reachable from the game.
- Lint config trimmed so `pnpm lint` is green and can gate PRs.
- Three human playtests; adjust starting resources / default speed if the opening drags.

Exit: a URL you can hand out.

**Total: roughly 8-12 working days.** M1 alone takes the game from "may freeze" to "always completes" and is worth doing first regardless of the rest.

---

## Explicitly out of scope for v1

- Mobile and touch support
- Realtime transport (polling every 2 s is fine for an asynchronous game)
- Smarter AI (weighted-random is adequate as a training partner once it cannot stall)
- Theme editor and admin tooling improvements
- Rematch, ELO, chat, replays
- Balance tuning beyond what playtests force

---

## Suggested first commits

1. `feat(engine): add pass action` - `src/shared/actions/index.ts`, `engine.ts`, `ai/index.ts`, tests.
2. `fix(edge): AI plays to phase end, never leaves the game on its own turn` - `supabase/functions/game-action/index.ts`.
3. `feat(client): surface action results` - `src/core/Board.ts`, `GamePage.tsx`.
4. `fix: typecheck` - the three sandbox/signup files.
5. `ci: typecheck, test, build on PR`.
