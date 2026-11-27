# Echo flame preview

A moving preview of Echo as a lively flame spirit. Pure black background, approved white-face proportions, no libraries.

**Live:** https://wirawibawa2-cmd.github.io/echo-face/preview/?v=2

This lives at `/preview/` so the root `index.html` (commit 6ff4e06) stays untouched.

## Open it

- Browser: use the live URL, or serve the repo root and open `/preview/`.
- iPhone: open in Safari.

Query flags: `?auto=1` starts Auto mode, `?debug=1` shows FPS, `?still=1&expr=happy` pins a pose, `?demo=1` hides the control bar.

## Controls

Echo stays in the center of the screen. The flame burns in place: tongues lick and split, the tip whips and curls, drips stretch and fall, embers rise, and the glow pulses. A gentle bob, blinks, look-around, and tap reactions keep him alive. The row at the bottom sets an expression. **Auto** cycles the 12 faces at random.

## App API

```js
window.echoFace.setExpression('happy')
window.echoFace.talk(true)
window.echoFace.setAuto(true)
window.echoFace.getExpression()
window.echoFace.expressions
```

Pills: `happy`, `sad`, `veryHappy`, `wavy`, `content`, `disappointed`, `angry`, `dizzy`, `squint`, `wink`, `unamused`, `worried`.

API-only (no pill): `neutral`, `talking`.
