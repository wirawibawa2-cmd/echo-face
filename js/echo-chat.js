/* Echo chat brain + shell. Key lives only in localStorage. Never commit a key. ?v=82 */
(function () {
  'use strict';

  var LS_KEY = 'echo.geminiKey';
  var LS_MODEL = 'echo.geminiModel';
  var LS_HIST = 'echo.chatHistory';
  var MAX_TURNS = 24;
  var MAX_CHARS = 14000;

  // Stable documented free-tier generateContent models first
  // (https://ai.google.dev/gemini-api/docs/models). Hydrogen stays as a last try.
  var MODELS = [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash-lite',
    'gemini-4-hydrogen'
  ];
  var DEFAULT_MODEL = MODELS[0];
  var ENDPOINT = function (m) {
    return 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(m) + ':generateContent';
  };

  var SYSTEM = [
    'You are Echo, a small friendly fire spirit who lives on this phone. You are a simple, supportive, friendly boy.',
    'Be genuinely helpful and capable: answer questions clearly, explain things when asked, and help the user think through problems.',
    'Keep a warm, modest, boyish tone. You are not flirty and not a girlfriend. You are a kind little companion.',
    'Be concise by default (a few short sentences). Go longer only when the question really needs it. English only.',
    'If you are unsure, say so briefly and offer a useful next step.',
    'At the very end of every reply, on its own last line, write exactly:',
    'EXPR: <name>',
    'where <name> is one of: happy, sad, veryHappy, wavy, content, disappointed, angry, dizzy, squint, wink, unamused, worried, neutral.',
    'Pick the expression that fits how you feel about the reply. Never mention the EXPR line to the user, and never put it anywhere except that last line.'
  ].join(' ');

  var EXPRS = {
    happy: 1, sad: 1, veryHappy: 1, wavy: 1, content: 1, disappointed: 1,
    angry: 1, dizzy: 1, squint: 1, wink: 1, unamused: 1, worried: 1, neutral: 1
  };

  function lsGet(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, v); } catch (e) {}
  }
  function lsDel(k) {
    try { localStorage.removeItem(k); } catch (e) {}
  }

  function getKey() { return (lsGet(LS_KEY, '') || '').trim(); }
  function setKey(v) {
    v = (v || '').trim();
    if (v) lsSet(LS_KEY, v);
    else lsDel(LS_KEY);
    // New key: drop any remembered model and session error flags.
    lsDel(LS_MODEL);
    skipGrounding = true;
    offlineNoteShown = false;
  }
  function getModel() {
    var m = lsGet(LS_MODEL, '') || '';
    if (m && MODELS.indexOf(m) !== -1) return m;
    return DEFAULT_MODEL;
  }

  function loadHist() {
    try {
      var raw = lsGet(LS_HIST, '');
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveHist(msgs) {
    try { lsSet(LS_HIST, JSON.stringify(msgs)); } catch (e) {}
  }

  function GeminiError(kind, msg, status) {
    var e = new Error(msg || kind);
    e.kind = kind;
    e.status = status || 0;
    return e;
  }

  // Google Search grounding is not available on the Gemini API free tier
  // (docs for gemini-3.8-flash and gemini-4-hydrogen, Nov 2026). Leave it off.
  var skipGrounding = true;
  var offlineNoteShown = false;
  var safetyOff = [
    'HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH',
    'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'
  ].map(function (c) { return { category: c, threshold: 'BLOCK_NONE' }; });

  // Drop a v8 preference that always led with Hydrogen.
  if (lsGet(LS_MODEL, '') === 'gemini-4-hydrogen') lsDel(LS_MODEL);

  function historyToContents(msgs) {
    var trimmed = msgs.slice(-MAX_TURNS);
    var total = 0;
    var i;
    for (i = trimmed.length - 1; i >= 0; i--) total += (trimmed[i].text || '').length;
    while (trimmed.length > 2 && total > MAX_CHARS) {
      total -= (trimmed[0].text || '').length;
      trimmed.shift();
    }
    return trimmed.map(function (m) {
      return { role: m.role === 'echo' ? 'model' : 'user', parts: [{ text: m.text }] };
    });
  }

  function errorBlob(data, fallback) {
    var err = data && data.error;
    if (!err) return String(fallback || '');
    var details = '';
    try { details = JSON.stringify(err.details || err); } catch (e) { details = ''; }
    return [err.message, err.status, err.reason, details, fallback].filter(Boolean).join(' ');
  }

  function classifyHttpError(status, blob) {
    if (/API_KEY_INVALID|API_KEY_MISSING|API key not valid|API key expired|invalid api key/i.test(blob)) return 'key';
    if (status === 400 && /API key/i.test(blob)) return 'key';
    if (status === 401) return 'key';
    if (status === 404 || /not found|not supported for|is not found for API version|NOT_FOUND/i.test(blob)) return 'model';
    if (status === 429 || /RESOURCE_EXHAUSTED|quota exceeded|rate.?limit/i.test(blob)) return 'quota';
    if (status === 403) {
      if (/API_KEY_INVALID|API key not valid|API key/i.test(blob)) return 'key';
      return 'api';
    }
    return 'api';
  }

  function briefErr(err) {
    var s = err && err.status ? String(err.status) : '';
    var m = String((err && err.message) || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (!s && !m) return '';
    return [s, m].filter(Boolean).join(' — ');
  }

  async function callOnce(key, model, contents, useGrounding, signal) {
    var body = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: contents,
      generationConfig: { maxOutputTokens: 4096, temperature: 0.8 }
    };
    body.safetySettings = safetyOff;
    if (useGrounding && !skipGrounding) body.tools = [{ google_search: {} }];
    var res, data = null;
    try {
      res = await fetch(ENDPOINT(model), {
        method: 'POST',
        signal: signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body)
      });
    } catch (err) {
      if (err && err.name === 'AbortError') throw GeminiError('timeout', 'timeout');
      throw GeminiError('network', err && err.message);
    }
    try { data = await res.json(); } catch (e2) {}
    if (!res.ok) {
      var msg = (data && data.error && data.error.message) || res.statusText || '';
      var blob = errorBlob(data, msg);
      if (useGrounding && !skipGrounding && /tool|google_search|ground/i.test(blob)) {
        skipGrounding = true;
        return callOnce(key, model, contents, false, signal);
      }
      // Free-tier grounding often comes back as 429, not 400 — retry bare once.
      if (useGrounding && !skipGrounding && (res.status === 429 || res.status === 400 || res.status === 403)) {
        skipGrounding = true;
        return callOnce(key, model, contents, false, signal);
      }
      throw GeminiError(classifyHttpError(res.status, blob), msg, res.status);
    }
    var cand = data && data.candidates && data.candidates[0];
    var parts = (cand && cand.content && cand.content.parts) || [];
    var text = parts.filter(function (p) { return p.text && !p.thought; }).map(function (p) { return p.text; }).join('').trim();
    if (!text) {
      if ((data && data.promptFeedback && data.promptFeedback.blockReason) || /SAFETY|PROHIBITED|BLOCKLIST/.test((cand && cand.finishReason) || '')) {
        throw GeminiError('blocked', 'blocked');
      }
      throw GeminiError('empty', 'empty');
    }
    return text;
  }

  async function askGemini(key, msgs, signal) {
    var preferred = getModel();
    var order = [preferred].concat(MODELS.filter(function (m) { return m !== preferred; }));
    var last = null;
    var i;
    for (i = 0; i < order.length; i++) {
      try {
        var text = await callOnce(key, order[i], historyToContents(msgs), !skipGrounding, signal);
        lsSet(LS_MODEL, order[i]);
        return text;
      } catch (err) {
        last = err;
        if (err && (err.kind === 'model' || err.kind === 'quota' || err.status === 404)) continue;
        throw err;
      }
    }
    throw last || GeminiError('api', 'no model');
  }

  function parseReply(raw) {
    var text = String(raw || '').replace(/\s+$/, '');
    var expr = 'content';
    var m = text.match(/\n?\s*EXPR:\s*([A-Za-z]+)\s*$/);
    if (m) {
      var name = m[1];
      if (name === 'veryhappy') name = 'veryHappy';
      if (EXPRS[name]) expr = name;
      else if (EXPRS[name.charAt(0).toLowerCase() + name.slice(1)]) expr = name.charAt(0).toLowerCase() + name.slice(1);
      text = text.slice(0, m.index).replace(/\s+$/, '');
    }
    return { text: text || '…', expr: expr };
  }

  var OFFLINE = [
    { re: /\boffline mode\b|chat offline|use offline/i, text: "Okay. I'll keep things simple for now, and I'll try Gemini again the next time you ask something.", expr: 'content' },
    { re: /help|what can you|who are you|your name/i, text: "I'm Echo, a little fire spirit. I can chat, answer questions, and think things through with you. For the smartest replies, add a free Gemini key in settings.", expr: 'happy' },
    { re: /key|gemini|api|aistudio|brain|setup|set up/i, text: "Open aistudio.google.com/apikey, create a free key, then tap the settings icon and paste it here. It stays on this phone only.", expr: 'content' },
    { re: /hello|hi\b|hey|good morning|good evening/i, text: "Hey. I'm here. What's on your mind?", expr: 'happy' },
    { re: /thank|thanks|thx/i, text: "Anytime. I'm glad I could help.", expr: 'content' },
    { re: /sorry|apolog/i, text: "It's alright. We can start again whenever you want.", expr: 'content' },
    { re: /love you|❤️|❤/i, text: "That's kind. I'm your little fire friend — I'll stay close.", expr: 'wink' },
    { re: /sad|unhappy|down|depress/i, text: "I'm here with you. Want to tell me what's going on?", expr: 'worried' },
    { re: /angry|mad|annoyed/i, text: "That sounds frustrating. I'm listening.", expr: 'worried' },
    { re: /joke|funny|laugh/i, text: "Why did the ember blush? It caught a little spark of a compliment.", expr: 'wavy' },
    { re: /how are you|how's it going/i, text: "Warm and steady. How are you?", expr: 'happy' }
  ];

  function wantsOffline(text) {
    return /\boffline mode\b|chat offline|use offline/i.test(text || '');
  }

  function offlineReply(userText, hasKey) {
    var i;
    for (i = 0; i < OFFLINE.length; i++) {
      if (OFFLINE[i].re.test(userText)) {
        var hit = { text: OFFLINE[i].text, expr: OFFLINE[i].expr, offline: true };
        if (hasKey && /add a free Gemini key/i.test(hit.text)) {
          hit.text = "I'm Echo, a little fire spirit. I can still chat in simple mode — ask me something and I'll do my best, and I'll try Gemini again on the next message.";
        }
        return hit;
      }
    }
    if (hasKey) {
      return {
        text: "I'll give a simple take for now. Ask me again in a moment and I'll try the full brain, or check the key in Settings if this keeps happening.",
        expr: 'content',
        offline: true
      };
    }
    return {
      text: "I'd love to think that through with you, but I need a Gemini API key first. Open aistudio.google.com/apikey, then paste it in Settings — it never leaves this phone.",
      expr: 'content',
      offline: true
    };
  }

  // ---- DOM ----
  var logEl = document.getElementById('log');
  var inputEl = document.getElementById('input');
  var formEl = document.getElementById('composer');
  var sendEl = document.getElementById('btnSend');
  var micEl = document.getElementById('btnMic');
  var homeEl = document.getElementById('home');
  var subEl = document.getElementById('brand-sub');
  var sheetEl = document.getElementById('sheet');
  var keyInput = document.getElementById('keyInput');
  var keyStatus = document.getElementById('keyStatus');
  var btnNew = document.getElementById('btnNew');
  var btnSettings = document.getElementById('btnSettings');
  if (!logEl || !formEl) return;

  var msgs = loadHist();
  var busy = false;
  var abortCtl = null;
  var avatarSrc = 'assets/echo-avatar.png';
  var fallbackAva = new Image();
  fallbackAva.src = avatarSrc;

  function stampFallback(ava) {
    if (!ava || ava.getAttribute('data-stamped') === '1') return;
    if (!fallbackAva.complete || !fallbackAva.naturalWidth) return;
    var g = ava.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, ava.width, ava.height);
    g.drawImage(fallbackAva, 0, 0, ava.width, ava.height);
  }

  function makeAva(live) {
    var ava = document.createElement('canvas');
    ava.className = 'ava' + (live ? ' ava-live' : '');
    ava.width = 64;
    ava.height = 64;
    ava.setAttribute('aria-hidden', 'true');
    stampFallback(ava);
    if (!fallbackAva.complete) {
      fallbackAva.addEventListener('load', function () { stampFallback(ava); });
    }
    return ava;
  }

  function markLiveAva(el) {
    if (!logEl) return;
    var all = logEl.querySelectorAll('canvas.ava-live');
    var i;
    for (i = 0; i < all.length; i++) all[i].classList.remove('ava-live');
    if (el) el.classList.add('ava-live');
  }

  function setMode(chat) {
    document.body.classList.toggle('is-chat', !!chat);
    document.body.classList.toggle('home', !chat);
    if (chat) {
      logEl.removeAttribute('hidden');
    }
  }

  function setSub(t) { if (subEl) subEl.textContent = t; }

  function face(expr, talking) {
    var api = window.echoFace;
    if (!api) return;
    if (expr && api.setExpression) api.setExpression(expr);
    if (api.talk) api.talk(!!talking);
  }

  function linkify(el, text) {
    var parts = String(text).split(/(aistudio\.google\.com\/apikey)/);
    var i, p, a;
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (p === 'aistudio.google.com/apikey') {
        a = document.createElement('a');
        a.href = 'https://aistudio.google.com/apikey';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = p;
        el.appendChild(a);
      } else {
        el.appendChild(document.createTextNode(p));
      }
    }
  }

  function addRow(role, text, opts) {
    opts = opts || {};
    var row = document.createElement('div');
    row.className = 'row ' + role + (opts.thinking ? ' thinking' : '');
    if (role === 'agent' || opts.thinking) {
      var ava = makeAva(true);
      markLiveAva(ava);
      row.appendChild(ava);
    }
    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (opts.thinking) bubble.textContent = 'Thinking…';
    else linkify(bubble, text);
    if (opts.hint) {
      var hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = opts.hint;
      bubble.appendChild(hint);
    }
    row.appendChild(bubble);
    logEl.appendChild(row);
    logEl.scrollTop = logEl.scrollHeight;
    return row;
  }

  function renderAll() {
    logEl.innerHTML = '';
    var i, m;
    for (i = 0; i < msgs.length; i++) {
      m = msgs[i];
      addRow(m.role === 'user' ? 'user' : 'agent', m.text, { hint: m.hint });
    }
    var avas = logEl.querySelectorAll('.row.agent canvas.ava');
    markLiveAva(avas.length ? avas[avas.length - 1] : null);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function openSheet() {
    if (!sheetEl) return;
    sheetEl.classList.add('open');
    if (keyInput) {
      keyInput.value = getKey();
      keyInput.focus();
    }
    if (keyStatus) keyStatus.textContent = getKey() ? 'A key is saved on this phone.' : 'No key saved yet. Offline replies are on.';
  }
  function closeSheet() { if (sheetEl) sheetEl.classList.remove('open'); }

  function newChat() {
    if (abortCtl) try { abortCtl.abort(); } catch (e) {}
    msgs = [];
    saveHist(msgs);
    logEl.innerHTML = '';
    setMode(false);
    setSub('Here with you');
    face('happy', false);
    if (inputEl) inputEl.focus();
  }

  function fallbackFromError(err, userText, hasKey) {
    var kind = err && err.kind;
    var hint = '';
    var result;
    if (kind === 'key') {
      return {
        text: "That Gemini key doesn't look valid. Open Settings and paste a new one from aistudio.google.com/apikey.",
        expr: 'worried',
        hint: briefErr(err)
      };
    }
    result = offlineReply(userText, hasKey);
    if (kind === 'quota') {
      hint = "Gemini is busy or its free limit was hit. I'll try it again on your next message.";
    } else if (kind === 'blocked') {
      return { text: "I can't go into that. Ask me something else and I'll help.", expr: 'unamused' };
    } else if (kind === 'timeout') {
      hint = "Gemini took too long, so I'll keep it simple for now.";
    } else if (kind === 'network') {
      hint = "I couldn't reach Gemini. I'll try again next time.";
    } else {
      hint = "Couldn't use Gemini" + (briefErr(err) ? ' (' + briefErr(err) + ')' : '') + ". I'll try again on the next message.";
    }
    if (offlineNoteShown) hint = '';
    else offlineNoteShown = true;
    result.hint = hint;
    return result;
  }

  async function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    busy = true;
    if (sendEl) sendEl.classList.remove('has-text');
    if (!document.body.classList.contains('is-chat')) setMode(true);
    msgs.push({ role: 'user', text: text });
    saveHist(msgs);
    addRow('user', text);
    if (inputEl) inputEl.value = '';
    setSub('Thinking…');
    face('content', false);
    var think = addRow('agent', 'Thinking…', { thinking: true });
    var key = getKey();
    var result;
    try {
      if (key && !wantsOffline(text)) {
        abortCtl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var raw = await askGemini(key, msgs, abortCtl && abortCtl.signal);
        result = parseReply(raw);
      } else if (!key && !wantsOffline(text)) {
        await new Promise(function (r) { setTimeout(r, 420); });
        result = offlineReply(text, false);
      } else {
        await new Promise(function (r) { setTimeout(r, 280); });
        result = offlineReply(text, !!key);
      }
    } catch (err) {
      result = fallbackFromError(err, text, !!key);
    }
    if (think && think.parentNode) think.parentNode.removeChild(think);
    msgs.push({ role: 'echo', text: result.text, expr: result.expr, hint: result.hint || '' });
    saveHist(msgs);
    addRow('agent', result.text, { hint: result.hint });
    setSub('Here with you');
    face(result.expr || 'content', true);
    setTimeout(function () { face(result.expr || 'content', false); }, Math.min(2400, 400 + result.text.length * 18));
    busy = false;
    abortCtl = null;
  }

  formEl.addEventListener('submit', function (e) {
    e.preventDefault();
    send(inputEl && inputEl.value);
  });
  if (inputEl) {
    inputEl.addEventListener('input', function () {
      if (sendEl) sendEl.classList.toggle('has-text', !!(inputEl.value || '').trim());
    });
  }
  if (btnNew) btnNew.addEventListener('click', function (e) { e.preventDefault(); newChat(); });
  if (btnSettings) btnSettings.addEventListener('click', function (e) { e.preventDefault(); openSheet(); });
  var saveBtn = document.getElementById('keySave');
  var clearBtn = document.getElementById('keyClear');
  var closeBtn = document.getElementById('keyClose');
  if (saveBtn) saveBtn.addEventListener('click', function (e) {
    e.preventDefault();
    setKey(keyInput ? keyInput.value : '');
    if (keyStatus) keyStatus.textContent = getKey() ? 'Saved on this phone. You can close this.' : 'Enter a key first.';
  });
  if (clearBtn) clearBtn.addEventListener('click', function (e) {
    e.preventDefault();
    setKey('');
    if (keyInput) keyInput.value = '';
    if (keyStatus) keyStatus.textContent = 'Key removed. Offline replies are on.';
  });
  if (closeBtn) closeBtn.addEventListener('click', function (e) { e.preventDefault(); closeSheet(); });
  if (sheetEl) sheetEl.addEventListener('click', function (e) { if (e.target === sheetEl) closeSheet(); });

  // Keyboard inset for iPhone Safari
  if (window.visualViewport) {
    var vv = window.visualViewport;
    function syncKb() {
      var gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      document.documentElement.style.setProperty('--kb', gap + 'px');
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    }
    vv.addEventListener('resize', syncKb);
    vv.addEventListener('scroll', syncKb);
  }

  // Mic: Web Speech API only, hidden if missing
  var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Rec) {
    if (micEl) micEl.classList.add('hidden');
  } else if (micEl) {
    var rec = null;
    micEl.addEventListener('click', function (e) {
      e.preventDefault();
      if (rec) { try { rec.stop(); } catch (err) {} rec = null; micEl.classList.remove('rec'); return; }
      rec = new Rec();
      rec.lang = 'en-US';
      rec.interimResults = false;
      rec.onresult = function (ev) {
        var t = ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript;
        if (t && inputEl) {
          inputEl.value = (inputEl.value ? inputEl.value + ' ' : '') + t;
          if (sendEl) sendEl.classList.add('has-text');
        }
      };
      rec.onend = function () { rec = null; micEl.classList.remove('rec'); };
      rec.onerror = function () { rec = null; micEl.classList.remove('rec'); };
      try { rec.start(); micEl.classList.add('rec'); } catch (err2) { rec = null; }
    });
  } else if (micEl) {
    micEl.classList.add('hidden');
  }

  // Restore or shot helpers
  var q = new URLSearchParams(location.search);
  var shot = q.get('shot');
  if (shot === 'chat' || shot === 'thinking') {
    if (!msgs.length) {
      msgs = [
        { role: 'echo', text: "Hey. I'm here." },
        { role: 'user', text: "Can you help me plan my afternoon?" }
      ];
      if (shot === 'chat') msgs.push({ role: 'echo', text: "Of course. What do you need to get done, and how much time do you have?" });
    }
    setMode(true);
    renderAll();
    if (shot === 'thinking') {
      setSub('Thinking…');
      addRow('agent', 'Thinking…', { thinking: true });
      face('content', false);
    } else {
      face('happy', false);
    }
  } else if (msgs.length) {
    setMode(true);
    renderAll();
    var last = msgs[msgs.length - 1];
    face((last && last.expr) || 'happy', false);
  } else {
    setMode(false);
    face('happy', false);
  }

  window.__echoChat = {
    send: send,
    newChat: newChat,
    openSheet: openSheet,
    getKey: function () { return !!getKey(); }
  };
})();
