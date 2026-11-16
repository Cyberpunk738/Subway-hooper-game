# Subway Super Hopper

A Three.js endless runner. Dodge obstacles, collect coins and power-ups, unlock skins, and chase leaderboard records.

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
| Enter or Space on the home screen | Start |

Mobile also has dedicated direction and jump buttons. Swipes trigger while the finger is still moving, once per gesture. Choose Super Sensitive (10px), Snappy (14px), or Steady (24px) on the home screen; the preference is saved locally. Short taps jump, while cancelled gestures do nothing.

## Gameplay and performance

- Fixed 60Hz simulation keeps physics, score, combo windows and power-up durations consistent across display refresh rates. A single render loop prevents duplicate loops during rapid restarts.
- Faster lane interpolation, a short jump input buffer, a brisk opening pace, spaced obstacle rows, and a capped maximum speed.
- Automatic pause when the tab is hidden or the window loses focus. Resume manually to avoid surprise collisions.
- Reused world geometry, disposal of retired player/floor resources, fewer HUD writes, and a 1.5 pixel-ratio cap with dynamic shadows disabled on touch devices.
- Expressive low-poly animal runners with hoodie details, cross-body bags, sneakers and animated arms/legs. Skin choices retain a consistent bunny, bear or cat silhouette.
- A pastel city skyline, warm sun, cloud puffs, planter trees, raised verges and moving road dashes. Buildings, windows and clouds use instanced geometry to limit draw calls.
- Distant fog starts at 32 units instead of 10; menu backdrop blur is reduced to 2px. Nearby characters and hazards stay clear.
- Bright arcade menus, touch controls, skins, badges, daily streaks and optional online leaderboards.

Scores, purchased skins, coins, achievements, name and settings are stored in the current browser. Scores from before the timing change may have been affected by the device's refresh rate.

## Checks

No build step or test dependencies:

```sh
node --check script.js
node --test tests/gameplay.test.cjs
```

The tests exercise controls, gesture cancellation, sensitivity persistence, pause, refresh-rate timing, bounded catch-up, loop ownership and simulation movement. They use a small DOM/rendering harness; visual rendering and physical-device feel require browser testing.
