# Subway Super Hopper

A Three.js endless runner. Dodge obstacles, collect coins and power-ups, buy characters, and chase leaderboard records.

## Play locally

Serve the directory over HTTP (ES modules require a server):

```sh
python -m http.server 8080
```

Open `http://localhost:8080`. Three.js, fonts, and the optional Supabase client load from CDNs and need an internet connection. Leaderboards use `config.js`; see `config.example.js` and `setup.sql` for setup. Gameplay remains available when leaderboard requests fail.

## Controls

| Input | Action |
| --- | --- |
| Left/right swipe, arrow keys or A/D | Switch lanes |
| Tap, upward swipe, Up/W or Space | Jump |
| P, Escape or pause button | Pause/resume |
| B or SKATE button | Activate a ready skateboard |
| Enter or Space on the home screen | Start |

Mobile also has dedicated direction and jump buttons. Swipes trigger while the finger is still moving, once per gesture. Choose Super Sensitive (10px), Snappy (14px), or Steady (24px) on the home screen; the preference is saved locally. Short taps jump, while cancelled gestures do nothing.

## Gameplay and performance

- Fixed 60Hz simulation keeps physics, score, combo windows and power-up durations consistent across display refresh rates. A single render loop prevents duplicate loops during rapid restarts.
- Faster lane interpolation, a short jump input buffer, a brisk opening pace, spaced obstacle rows, and a capped maximum speed.
- Automatic pause when the tab is hidden or the window loses focus. Resume manually to avoid surprise collisions.
- Reused world geometry, disposal of retired player/floor resources, fewer HUD writes, and a 1.5 pixel-ratio cap with dynamic shadows disabled on touch devices.
- Striped road barricades, traffic cones and banded barrels with individual collision widths and jump-clearance heights. All hazard geometry is cached.
- Expressive low-poly animal runners with hoodie details, cross-body bags, sneakers and animated arms/legs. Six collectible characters have distinct bunny, bear, fox, robot, cat and astronaut models. Runners face down the negative-Z track, away from the chase camera.
- A pastel city skyline, warm sun, cloud puffs, planter trees, raised verges and moving road dashes. Buildings, windows and clouds use instanced geometry to limit draw calls.
- Distant fog starts at 32 units instead of 10; menu backdrop blur is reduced to 2px. Nearby characters and hazards stay clear.
- Bright arcade menus, touch controls, characters, badges, daily streaks and optional online leaderboards.

Scores, purchased characters, coins, achievements, name and settings are stored in the current browser. Scores from before the timing change may have been affected by the device's refresh rate.

## Character shop

Open **Characters** from the home or game-over screen. HOP (bunny) is free; MARINA (bear) costs 50 coins, BOLT (fox) 100, GLITCH (robot) 200, EMBER (cat) 300 and ORBIT (astronaut) 500. Buying equips the character immediately; owned characters can be equipped for free. All have the same gameplay abilities.

Run coins and daily-streak bonuses fund purchases. New characters require coins, with no automatic score unlocks. Legacy coins, selected skins and previously unlocked skins are preserved. A single saved wallet stores balance, ownership and selection together; purchases survive browser reloads on the same device.

## Missions, districts and skating

- **Daily missions:** three rotating challenges track coins, distance, jumps, runs, close calls, district visits, rides or tricks. Open Missions to claim completed coin rewards once. Progress resets at local midnight and shares the same saved wallet as purchases.
- **Near-miss chains:** pass within 0.6 units of an obstacle without touching it to build a chain. Close calls within five active-play seconds raise the score multiplier to a maximum of ×4. The game records the gap while alongside the obstacle, so moving towards it after passing cannot create a bonus.
- **Four districts:** every 400 metres cycles through Colour City, Neon Underpass, Skyline Rooftops and Sunset Boardwalk. Scenery, sky, ground and obstacle patterns change. Tunnel rows can block two lanes but preserve an adjacent safe route. Buildings, tunnel walls and railings use instanced geometry. The underpass has plain dark walls, muted posts and neutral track edges without coloured border lighting.
- **Character personality:** six characters have distinct entrance gestures, airborne poses and end-of-run celebrations while retaining equal gameplay abilities.
- **Skateboarding:** every run starts with one charge. Collect board pickups for more (two stored charges maximum), then press B or SKATE for a 15-second ride. Jump to perform kickflips, shuvits and heelflips; landing awards 15 points. An active board breaks to absorb one crash before shield protection is used. Timers freeze while paused.
- **Board designs:** Street Deck is free, Neon Rush costs 150 coins and Cosmic Cruise costs 300. Designs are permanent cosmetic purchases; all have the same duration and protection.
- **Rescue:** the first unprotected crash offers one optional 30-coin rescue, paid from the existing bank. Accepting freezes gameplay for a three-second countdown, removes nearby hazards and grants three seconds of protection. Declining banks the run's coins; a later fatal crash ends the rescued run. Rescue never banks run coins twice.

## Share a score image

After a run, **Share Image** previews a 1080 × 1350 PNG card with your score, coins, name, run character and the current game URL. Choose **Share Image** again to send the prepared PNG through the device share sheet when file sharing is supported. Choose **Download Image** to save it, or long-press the preview on mobile and attach it manually.

The card is drawn locally from original vector artwork; no screenshot permissions, external image service or remote image loading are required. Text/link sharing remains in an expandable fallback. Cancelling native sharing leaves the preview available. Buying a new character after a run does not change that run's card.

## Checks

No build step or test dependencies:

```sh
node --check script.js
node --check game-art.js
node --check progression.js
node --test tests/*.test.*
```

The tests cover daily rollover and reward claims, board purchases, near-miss chains, rescue payment/countdown, image generation and export failure paths, native file-share capability/cancellation/denial, download and copy fallbacks, stale previews, wallet migration, purchases, persistence, insufficient funds and storage failures, plus existing input/physics/timing regressions. They use a small DOM/rendering harness; physical-device share-sheet behaviour still requires device testing.
