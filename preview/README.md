# Echo flame preview

A moving preview of Echo as a lively flame spirit. Pure black background, approved face proportions, no libraries.

**Live:** https://wirawibawa2-cmd.github.io/echo-face/preview/?v=6

This lives at `/preview/` so the root `index.html` (commit 6ff4e06) stays untouched.

## Open it

- Browser: use the live URL, or serve the repo root and open `/preview/`.
- iPhone: open in Safari.

Query flags: `?auto=1` starts Auto mode, `?debug=1` shows FPS, `?still=1&expr=happy` pins a pose, `?demo=1` hides the control bar.

## Controls

Echo stays in the center of the screen. The flame is a WebGL flipbook of the reference fire's silhouettes, played at the GIF's own frame timing so the motion stays organic. Edges are smoothed (soft SDF, 2x DPR). Color follows the cel-style reference: pale yellow/cream hot patches that shift with the boil, golden mid tones, an orange edge, a soft orange glow, and a maroon-brown haze. The face is very dark brown/black so it stays readable on the bright cream body (Wira signed off on this). Use ?face=white to try a white face with a dark band behind it. A procedural flame is the fallback if the atlas or WebGL is missing. A gentle bob, blinks, look-around, and tap flares keep him alive. The row at the bottom sets an expression. **Auto** cycles the 12 faces at random.

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
