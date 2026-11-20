# Gameplay polish validation — 20 November 2026

## Completed

- 88 Node tests pass with `node --test tests/*.test.*`.
- Syntax checks pass for all application and test JavaScript; `git diff --check` passes.
- 12,000 seeded obstacle rows preserve an empty route no more than one lane from the preceding route.
- Three seeded 2,600-metre runs pass through every district at maximum speed using only lane changes. Ground pickups are excluded from this test so a board, shield or jetpack cannot hide a forced collision.
- Real Three.js scene checks cover nine character models, forward orientation, equal model scale, cosmetic bounds, police intro cleanup, capture timing, restart guards, six district crossfades, earned boxes and single final-run recording.
- Save files roundtrip wallet data; malformed files, unsupported versions, unknown character IDs and oversized files are rejected. Failed storage retains the previous wallet.
- Offline installation tests load every relative module, engine, font and icon from cache after mocked network loss.
- Browser preview at desktop, 390 × 844 and 320 × 568 CSS viewports: home/profile/settings/shop menus open; settings persist across reloads; character illustrations and rarity labels appear; shop opens at Characters; backup download, import preview and restore complete successfully.

## Limits and remaining device checks

The preview browser has WebGL disabled. It verifies DOM menus, SVG illustrations, persistence and file flows, but cannot validate the rendered 3D chase, scenery transitions, character animation or frame rate. Local Chromium launch is also blocked by the execution environment. No physical Android/iOS device was available.

Before a release, play on a WebGL-capable phone and desktop. Check fast alternating swipes, jump clearance, readable hazards in all districts, board/jetpack landings, capture framing, small-screen menus and native score-image sharing. Compare frame rate and input response on Auto and Low graphics. Test a connected visit followed by a genuine offline refresh. Playtest reward pacing and character prices; automated route checks do not establish enjoyment or economy balance.
