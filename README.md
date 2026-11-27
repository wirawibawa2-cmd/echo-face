# Echo

Echo as a lively flame spirit: a painted fire body with a hollow-cutout face, on a black screen, built for iPhone Safari and Add to Home Screen. One self-contained page. No build step, no libraries, no API keys.

**Live:** https://wirawibawa2-cmd.github.io/echo-face/?v=7

This is a standalone project. It is not Kira, and it is not the other Echo app repo.

The previous minimal white-face page is archived at [`archive/minimal-face/`](archive/minimal-face/). A working copy of this flame build also stays at [`/preview/`](preview/).

## Open it

- Browser: use the live URL, or serve this folder with any static server and open `index.html`.
- iPhone: open in Safari, then Share → Add to Home Screen.

Query flags: `?auto=1` starts Auto mode, `?debug=1` shows FPS, `?still=1&expr=happy` pins a pose, `?demo=1` hides the control bar.

## Controls

Echo stays in the center of the screen. The flame is a flipbook of the reference fire, and the face is drawn in a hollow-cutout style. The row at the bottom sets an expression. **Auto** cycles the 12 faces at random. Blinks, look-around, and tap flares keep him alive.

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
