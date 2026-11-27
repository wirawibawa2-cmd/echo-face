# Echo Face

A minimal wandering face for Echo: two white eyes and a short rounded mouth on a black screen, with organic motion and twenty expressions. One self-contained page, built for iPhone Safari and Add to Home Screen. No build step, no libraries, no API keys.

**Preview:** https://wirawibawa2-cmd.github.io/echo-face/?v=1

This is a standalone project. It is not Kira, and it is not the live Echo app.

## Open it

- Browser: use the preview URL, or serve this folder with any static server and open `index.html`.
- iPhone: open in Safari, then Share → Add to Home Screen.

Query flags: `?auto=1` starts Auto mode, `?debug=1` shows FPS, `?still=1&expr=happy` pins a pose, `?demo=1` hides the control bar.

## Controls

The translucent row at the bottom triggers expressions. **Auto** cycles them at random while Echo wanders, pauses, looks around, blinks, and reacts to taps (look, follow, or a surprised poke).

## App API

```js
window.echoFace.setExpression('happy')
window.echoFace.talk(true)
window.echoFace.setAuto(true)
window.echoFace.getExpression()
window.echoFace.expressions
```

Expressions: `neutral`, `happy`, `veryHappy`, `laugh`, `sad`, `crying`, `angry`, `surprised`, `shocked`, `sleepy`, `sleeping`, `curious`, `confused`, `sly`, `love`, `wink`, `embarrassed`, `thinking`, `talking`, `listening`.
