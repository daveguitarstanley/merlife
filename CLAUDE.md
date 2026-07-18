# Mer Life — Game Plan & Rules (DO NOT LOSE THIS)

An interactive 3D game for a dad and his daughter. Kid-friendly, gentle, colourful.
Must work on touch screens, tablets and smartphones — but always keep keyboard
controls working for desktop testing.

## 1. Core Game Concept & Rules

- **Setting:** A tropical underwater reef world (the mer-character's home and spawn
  point is a grotto behind a waterfall) that borders a coastal island village with a jetty.
- **Player:** Can be a Mermaid or Merman. Fully customizable skin colour (including
  Golden), body shape (fit/abs, soft, round/fat, pregnant) and tail scale colours via an
  interactive colour palette.
- **Transformation loop:**
  - In water: swims with fluid mechanics.
  - On land: crossing the jetty/beach transition zone transforms the character into a
    human with legs, using land walking/jumping controls. Walking back into deep
    water transforms back into mer-form.
- **The Shield Puzzle:**
  - Four elemental shields: Earth, Wind, Fire, Water — selectable with colour dots on
    the side of the screen.
  - Big Nasty Fish guard quest items. Each nasty fish species has a secret weakness to
    one specific shield.
  - Players cycle shields quickly. The correct shield bounces the fish and protects the
    player for 10 seconds. Wrong shield fails and the fish can bite.
  - 4 bites = death → re-clone back at the waterfall home.
- **The Pearl Gun:** Shooting pearls lets players craft/spawn coral caves, pearl houses
  and indoor furniture. Pearls can NEVER hurt or kill any fish (friendly or nasty).
- **Camouflage (Rest):** Textures change to match the reef; nasty fish instantly lose
  aggro and leave the player alone. The player CANNOT move while camouflaged, but
  health/strength safely regenerates. It is for resting before trying again.
- **Island economy:**
  - Villagers give retrieval tasks for 100 Shell Coins.
  - Shops (Shoes, Clothes, Accessories, Food, Furniture) give tasks in exchange for items.
  - Tasks are always: go back into the water and retrieve an item of value, each guarded
    by a big nasty fish. Bring it back to the SAME person to be rewarded.
  - Goal: earn Shell Coins to buy empty houses in the village (500+ coins depending on
    size). Houses can be lived in or gifted to homeless village characters.
  - The village has many houses: some occupied, some empty with For Sale signs.
- **Co-op multiplayer:** A friend joins via a shared web link. Players can help each
  other, pool Shell Coins in a shared community pot to buy bigger houses for the
  homeless, and drop/swap items with each other.
- The game never really ends — it just grows.

## 2. The 10 Deep-Sea Quest Items

Random retrieval quests pulled from this list:

1. **Sunken Anchor** (The Ship Captain) → to secure his boat.
2. **Luminescent Sea-Glass** (The Lamp-maker) → night-lights for the streets.
3. **Royal Coral Crown** (Accessories Shop) → unlocks a rare crown in the character creator.
4. **Lost Wedding Ring** (Sad Villager on Jetty) → dropped off the pier while fishing.
5. **Prismatic Seaweed** (Clothes Shop) → magic dye that unlocks new scale colours.
6. **Ancient Bottle Recipe** (Food Shop Baker) → recipe scroll in a sealed cork bottle.
7. **Starfish Cushion** (Furniture Shop) → plush giant starfish for village living rooms.
8. **Deep-Sea Sponge** (Shoe Shop Cobbler) → comfy fast-running insoles.
9. **Rainbow Nautilus Shell** (Lonely Musician) → rare spiral shell that plays music.
10. **The Golden Trident** (The Village Elder) → legendary, guarded by the toughest
    fish, huge payout.

## 3. Technical Stack & Architecture

- **Engine:** Three.js (npm package) + Vite. Plain ES modules, no framework.
  Everything procedural (no downloaded 3D assets) so it stays fast and free.
- **Targets:** Mobile/tablet first (touch joystick + buttons), keyboard always supported
  for desktop testing (WASD/arrows, Space = swim up/jump, Shift = swim down).
- **Hosting (recommended):** Cloudflare Pages or Vercel free tier — static site, `npm run
  build` → deploy `dist/`. Nothing to arrange until we want a public link.
- **Multiplayer (recommended, Phase 4):** Playroom Kit (joinable-by-link casual web
  game rooms, free tier) — simplest for parent/kid co-op. Alternative with more
  control: Colyseus (self-host on Fly.io/Render).
- **Persistence:** localStorage now; Supabase free tier later if we want cross-device
  saves and the shared community pot.
- **PWA** manifest later so it can be "installed" to a tablet home screen.

## 4. Phase Road Map (do NOT move on until the current phase works perfectly)

- **Phase 1: Character Creator & The Jetty** — ✅ play-tested & approved by the user.
  World (reef, grotto + waterfall home, island village, jetty), character creator
  (mermaid/merman, skin incl. golden, body shape, scale/hair colours), swimming,
  land walking, transformation at jetty/beach, friendly fish schools, touch + keyboard
  controls, HUD (hearts, shell coins), ambient audio, localStorage save.
  Feedback round done: fluke turned sideways (proper fan), knee-length skirt on land,
  much prettier characters (flower crown & waist garland, layered flowing hair,
  lashes/blush/iris eyes, scale texture on tail, pearly iridescent fins, pearl
  necklace/armbands, pecs+abs merman), For Sale sign board in front of its post.
- **Phase 2: The Pearl Builder & Camouflage** — ✅ built, awaiting play-testing.
  Pearl gun (F / 🫧): lobs pearls that always land just ahead; repeated shots feed one
  build site (ghost preview + N/M progress bubble). Blueprints cycle with B / 🏠 button:
  Coral Cave (6 pearls), Pearl House (10), Furniture (3, random bed/table/chair/lamp/
  sofa). Pearls can never hurt fish. Too-shallow shots refund the pearl. 8 glowing
  oysters on the reef give +3 pearls (close & reopen after 25 s), cap 24. Camouflage
  (X / 🦎): reef-mottled tint, frozen in place, hearts regenerate every 2.5 s, any move
  input exits. Structures AND half-built sites persist in localStorage (save key
  `merlife.save.v1`: coins, pearls, hearts, builds, sites).
  Feedback round 2: mermaid wears a floor-length flowing gown on land (sways, swishes
  and flares with each stride + step-bounce); her legs are not built at all in human
  form (never visible under the gown — remove what can't be seen); front hair locks
  removed. Merman keeps visible legs + shorts.
- **Phase 3: The Bad Fish & Shield Battle** — ✅ first version built, awaiting
  play-testing. One roaming Nasty Fish (menacing box fish: angry eyes, teeth, red
  fins) spawns when the player swims over deep water (`terrainHeight < -15`),
  approaches at 3.4 u/s (slower than the 9 u/s swim — you can flee). Random elemental
  weakness per spawn. 4 shield buttons (colour dots, left side; keys 1-4): 10 s bubble
  around the player, switching allowed, countdown badge on the button. Contact with
  correct shield → fish bounces/flees 10 s; wrong/no shield → bite (-1 heart, red
  flash, 2.4 s cooldown, fish recoils). 4 bites → re-clone at the waterfall home with
  full hearts (12 s calm before next encounter). Camouflage makes it lose interest
  and drift off; camo rest still regenerates hearts. Fish gives up if you reach land
  or shallows. Shields drop on landing. `src/enemy.js` (`NastyFish`, `ELEMENTS`).
  Still to do in Phase 4: fish species guarding specific quest items.
- **Phase 4a: Village Economy** — ✅ built, awaiting play-testing.
  All 10 quest givers live on the island (5 shop stalls with striped awnings + sign
  sprites, villagers, Pip on the jetty, Elder locked until 3 quests done). Talk with
  E / 💬 button (proximity prompt), dialog panel with choices. One quest at a time;
  item spawns at its `spot` with a glowing beacon pillar + bobbing emoji sprite, and a
  colour-tinted guardian Nasty Fish species with FIXED weakness per species (see
  `src/quests.js`; Trident guardian is bigger & faster). Quest tracker chip at top
  with a rotating direction arrow. Rewards: shell coins (anchor/seaglass/ring/
  nautilus 100, recipe 50+full hearts, trident 500), pearls (cushion +8), unlocks —
  crown (👑 in creator "Treasures"), rainbow scales (creator swatch), sponge (land
  speed 5.5→7.4). Houses: 4 for-sale (500/550/700/1200 by size), buy → live in or
  gift; 3 homeless villagers move in when gifted ("😊 Home at last!"), signs redraw
  (MER HOME / HOME 💗). The deep-water roamer is suppressed within 45 u of an active
  guardian (one danger at a time). Everything persists (quests/houses/unlocks in
  `merlife.save.v1`).
- **Phase 5: The Grand Island** — ✅ built & sim-tested 2026-07-18, awaiting play-testing.
  A) **Island 6×+ bigger & flat**: island centre moves east to (170, 0) so the whole
     reef/quest sea stays untouched (everything underwater is at x ≤ 70). Flat
     plateau at height ~5.3 (radius 95), gentle beach ring down to the waterline
     (~radius 113, west coast at x ≈ 57), fully underwater by radius 150. Old island
     was a bump of coast-radius ~40 → new area ≈ 8× old. Terrain/water planes grow
     to 700×700. Jetty moves to x ∈ [32, 58]. Sea-floor ripples are blended out under
     the island so streets are perfectly level.
  B) **Roads & streets (uniform town)**: Harbour Road (z=0, from jetty to x=290),
     Main Street (x=150, z ∈ [-90, 90]), Coral Lane (z=-50) and Shell Street (z=50)
     (x ∈ [100, 250]), East Avenue (x=220, z ∈ [-50, 50]), all meeting a paved Market
     Square plaza at (150, 0). Roads are flat planes just above the grass, with
     lampposts (Lumi's night-lights — emissive, no real lights for perf) and evenly
     spaced palms.
  C) **Proportions pass**: player is ~2.9 u tall on land, but old houses had 2.6 u
     walls and 1.4 u doors (half player height!). New houses: ~6.5×5×6 u × size,
     doors 1.5×3.4 u, windows. Shop stalls, NPC height (~2.2 u), sign/label heights
     and interact radii (npc 3.6, house 7) all scale to match. The 4 for-sale houses
     KEEP their push order & sizes (1 / 0.9 / 1.4 / 0.85 → 700/550/1200/500 🐚) so
     existing saves' house indices stay valid.
  D) **Real villagers**: `makeVillager(look)` in village.js — legs/dress, torso,
     arms, head with eyes/brows/nose, hair styles (short/bun/long/afro/bald), hats
     (captain/baker/beret/straw/flower), beard, apron, staff. Every quest giver gets
     a distinct `look` in quests.js (skin tone, hair, outfit colours, accessories) —
     e.g. Captain Finn: white beard + navy coat + captain's hat; Elder Maris: white
     robe + staff; Barnaby: stout + baker's hat + apron. Homeless villagers get
     patched dull clothes. Plus ~6 ambient villagers strolling the streets on
     waypoint loops so the town feels alive.
  E) Quest data moves: all `giverPos` relocate onto the new streets/market square
     (Pip stays on the jetty); sponge item spot moves to [40, 90] (old spot is now
     inside the bigger island). All spots re-verified underwater.
  Polish round (all ✅ built & sim-tested): villagers scaled to player stature
  (1.18× in `makeVillager`); palms never spawn inside/hugging a house footprint;
  SOLID TOWN — `COLLIDERS` export in world.js ({houses (rect+door gap), circles
  (fountain/stalls/lamps/palms)}), `landBlocked()` in main.js blocks walking with
  wall-sliding; houses are HOLLOW with a real doorway + open hinged door, wood
  floor and furnished room (bed+teddy, table+stools+candle/fruit, bookshelf,
  lamp, rug, plant — seeded per house); dollhouse view (walls+roof fade to 0.32
  opacity while the player stands inside); villagers have hip/shoulder-pivoted
  limbs that swing as strollers walk; strollers steer around obstacles
  (repulsion from COLLIDERS); mermaid gown got a fixed hip yoke with the swaying
  skirt pivoting from the yoke hem (no waist gap); dialog buttons ignore
  double-taps (no double coin deduction).
- **Phase 4b: Co-op Multiplayer** — ✅ BUILT & 2-tab tested 2026-07-18 (Playroom Kit).
  `src/net.js` (`Net`): 🤝 HUD button opens the co-op panel → `insertCoin({ gameId,
  skipLobby: true })` → share link shown + copy button. Friend opens the link
  (`#r=CODE` hash), makes their own character, auto-joins on Dive In ("Splash!
  You're in your friend's sea!"). 10 Hz state broadcast (pos/yaw/form/mode/speed/
  camo) + look config w/ version counter (mirror edits rebuild the remote avatar);
  remotes lerp (k=dt*8) and run the full Character animator, name tag sprite
  (💙 profile name). Toasts on friend join/leave; 🤝 glows while live.
  GOTCHA: Playroom's URL hash is `#r=` + prefix char + code; `getRoomCode()`
  strips the prefix — always share `location.hash` verbatim, never rebuild it.
  Each player keeps their own save/coins/quests (shared community pot = Supabase,
  later). Game ID from `VITE_PLAYROOM_GAME_ID` (.env.local + Vercel env).
  DEPLOY: GitHub daveguitarstanley/merlife → Vercel (Vite preset, auto-deploy on
  push to main). Env vars in Vercel dashboard. Secrets live in .env.local
  (gitignored); .env.example is the committed template. Supabase project exists
  but is NOT wired yet (anon key only in .env.local, unused).
  TODO list — ✅ ALL BUILT & sim-tested 2026-07-18 except multiplayer itself:
  - ✅ House floor z-fighting fixed (floor box shrunk inside the walls, raised to 0.08).
  - ✅ Infinite coin economy: every completed quest giver offers a REPEATABLE re-fetch
    of their item (same spot + guardian) for half coins (min 40, `repeatReward()`);
    repeat completions don't re-push `done` and grant coins only. Save gains
    `quests.repeat` flag. The 1200 🐚 house is always reachable now.
  - ✅ Stuck stroller (was walking head-on into the fountain and deadlocking on pure
    radial repulsion): steering now adds a tangential walk-around component, plus a
    5 s no-progress failsafe that skips to the next waypoint.
  - ✅ CONTROL REDESIGN: character-relative driving. ⬅️➡️ turn her (`charYaw`,
    2.7 rad/s), ⬆️ walks/swims the way she faces, ⬇️ gentle back-step (-0.45×).
    Chase camera gracefully swings round behind `charYaw` (lerp 2.4). Same scheme
    on land & water; touch joystick x=steer, y=forward. `__mer.setYaw(y)`/`yaw`
    for tests (setMove x is now TURN, not strafe!). Hints updated.
  - ✅ Sunken shipwreck at (0, 55) (`WRECK` const in world.js): listing hull with
    port-side breach to swim into the cargo hold (crates, barrels, treasure chest
    with glowing gold + coins), deck hatch, captain's cabin (desk/chest/lantern),
    broken masts + torn sail, railings, coral growth + sand drift. Hull fades to
    0.35 opacity while exploring inside (same dollhouse trick, `WRECK.mats`).
    Deep-water roamer naturally patrols the area — treasure hunting is risky!
  - STILL TODO: "make EVERYTHING more detailed and realistic" — ongoing art pass.
- **Phase 6: Boost, Bank & the Grand Tour** — ✅ BUILT & sim-tested 2026-07-18.
  A) **Shields REMOVED → 🚀 BOOST** (user decision: shields too glitchy/frustrating
     for kids). One big BOOST button (left, `#btnBoost`; keys Q or 1): 0.9 s dash
     ~2.4× swim speed along facing, 2 charges (● ● pips), each takes 10 s to
     recharge (toast when full). Nasty fish now ALWAYS bite on contact (no
     weakness mechanic; `_tryBite` in enemy.js — `weakness` fields in quests.js
     are vestigial). Escape tools: boost, flee, camo, land. Bites/re-clone as
     before. `__mer.doBoost()` / `.boost` for tests.
  B) **Shell Bank + Community Pot**: bank building + Goldie the Banker NPC
     (village.js, market square north at (150,-26)/(150,-19.5)). Talk → deposit
     50/200, withdraw 50. `save.pot`; in co-op the pot is Playroom room state
     (`net.setPot/getPot/syncPot` — merge = max on join, polled in tick). For-sale
     houses can be bought "from the Community Pot" when it covers the price.
  C) **⏸️ Pause & sleep**: pause button (topRight) → panel (Resume / Exit);
     pausing stops the render loop (battery). 5 min with zero input in play →
     auto-pause "💤 drifted off". Exit = location.href reset (save kept).
  D) **QR code** on the co-op panel (`qrcode` npm pkg → canvas #coopQR) — scan to
     join, same link as before.
  E) **Pearl homes are now GRAND**: hollow 5.2-radius pearl dome (wedge doorway,
     arch frame, portholes, floor+rug, glowing lamp, finial) you swim inside;
     shell fades to 0.35 while inside (`dollhouses` in PearlSystem.update).
     Coral cave scaled 2.4× (big swim-through arch). Old cost/prices unchanged.
  F) **Town grew again**: Palm Row (z=-75) & Sunset Lane (z=75) roads; 10 new
     houses incl. 2 NEW for-sale (saleHouses indices 4-5 — original 0-3 order
     untouched, prices auto from size); civic quarter on Palm Row: 🏛️ Town Hall,
     📮 Post Office, ☕ Reef Café (`civic()` in world.js); park with pond/benches/
     flowers on Sunset Lane; 2 GOLF BUGGIES parked by Market Square (world.js
     `buggy()`, `world.buggies`) — 💬 "Hop in!", drive 12.5 u/s with the same
     steering, "Hop out" via same button, auto-eject at the waterline; in co-op
     the driver's buggy position mirrors on the friend's screen (`v` field in net
     state).
     REDONE to real golf-cart proportions (user feedback: head poked through the
     roof — ALWAYS scale props against the 2.9-u player): roof at 3.76 (seated
     head ≈3.2, `SEAT_H` 1.75), two-seat bench (driver LEFT at `SEAT_X` 0.52,
     passenger right), windshield, steering wheel, chrome hubs; THREE buggies
     (green/orange/blue). PASSENGER SEAT: a friend walking up to a
     remotely-driven buggy gets "🪑 Ride along!" → pinned to the right seat
     (`passengerOf` in main.js; `b._remoteAt` marks remote-driven, 4 s staleness
     auto-ejects when the driver leaves/quits). BUMPER CARS: driving into any
     other buggy separates + reflects velocity with a shove, sparkle + "💥
     BUMP!" (0.7 s cooldown). Buggies are solid to pedestrians (r 1.9 circle in
     landBlocked, skipping the one you're sitting in). Underwater: swaying kelp forest (~(-44,76)), rainbow sea arch
     (~(-140,-55)).
  `__mer` additions: doBoost, boost, addPearls(n). Save v1 gains `pot`.
  NOTE: findInteract picks the NEAREST offer (npc/bank/buggy) — shop reach is
  8.5 so anything new near a stall must live outside that or rely on nearest-wins.

## Code map

- `index.html` — UI overlays (creator, HUD, touch controls) + CSS.
- `src/main.js` — game states (creator/play), physics, transformation, camera, loop.
- `src/world.js` — terrain function `terrainHeight(x,z)`, reef, grotto/waterfall, island,
  village, jetty (`JETTY` rect const), water surface, bubbles. Spawn = `SPAWN`.
- `src/character.js` — procedural mer/human character builder + animations.
- `src/creator.js` — character creator UI wiring + palettes.
- `src/controls.js` — keyboard + touch joystick/buttons.
- `src/fish.js` — friendly fish schools.
- `src/builder.js` — pearl gun projectiles, build sites/ghosts, structures (cave/house/
  furniture), oysters, persistence (`PearlSystem`).
- `src/enemy.js` — Nasty Fish enemy (box fish; roamer states approach/flee/leave;
  guardian states guardPatrol/approach/flee/guardReturn via `spawnGuard`)
  + `ELEMENTS` (earth/wind/fire/water).
- `src/quests.js` — the 10 quest definitions (giver, spot, weakness, species colour,
  dialog lines, rewards). All spots verified underwater.
- `src/village.js` — quest-giver NPCs + labels/markers, shop stalls, homeless
  villagers, `makeTextSprite`.
- `src/audio.js` — WebAudio ambient + chimes + pearl pop (no audio files).

Conventions: water surface at y=0; character origin at the waist; land mode stands
1.47 above ground; world is deterministic via seeded RNG so it never shifts between
sessions. Island: flat plateau h≈5.3 centred (170,0), west coast x≈57, jetty
x∈[32,58]; the sea/reef (all x ≤ 70) never moves.

Testing: `window.__mer` exposes { pos, mode, state, setMove(x,z), setVertical(up,down),
step(nFrames, dt) } for automated play-testing in the browser console. Note:
requestAnimationFrame does not fire while the preview pane is hidden — always drive
simulation with `__mer.step(...)` when testing headlessly, never wall-clock waits.
Run dev server: `npx vite` (or the .claude/launch.json "mer-life" config).
