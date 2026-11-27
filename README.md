# Echo

Echo is a lively flame spirit you can talk to, on a black glass screen, built for iPhone Safari and Add to Home Screen. No build step, no libraries, and no API keys in this repo.

**Live:** https://wirawibawa2-cmd.github.io/echo-face/?v=82

This is a standalone project. It is not Kira, and it is not the other Echo app repo.

The previous minimal white-face page is archived at [`archive/minimal-face/`](archive/minimal-face/). A working copy of this build also stays at [`/preview/`](preview/).

## Open it

- Browser: use the live URL, or serve this folder with any static server and open `index.html`.
- iPhone: open in Safari, then Share → Add to Home Screen. If you already saved a shortcut, remove it and add it again to get the new icon.

Query flags: `?auto=1` starts Auto mode, `?debug=1` shows FPS, `?still=1&expr=happy` pins a pose, `?demo=1` hides the chat chrome, `?pills=1` shows the expression row.

## Chat

Echo replies on this device. Paste a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey) in Settings. The key stays in your browser only and is never committed or uploaded to this project.

Without a key, Echo uses short offline replies and will tell you how to add one. With a key, he uses Gemini (free-tier models, with automatic fallback), keeps recent conversation history on the phone, and picks an expression for each reply. There is no server-side voice yet.

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
