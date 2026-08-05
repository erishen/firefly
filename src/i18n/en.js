// English copy dictionary (firefly / Fei)
// Note: entries containing <strong> / <code> are rendered as rich text by
// settings-hint etc. (trusted static content from this module).
export const en = {
  // —— Top ——
  title: '✨ Firefly · 3D Avatar',
  hint: 'Tap "🎤 Speak" or just type below to chat · drag to rotate · her eyes follow you',

  // —— Voice ——
  micSpeak: '🎤 Speak',
  micListening: '🎤 Listening…',
  statusListening: 'Listening… it auto-detects when you finish',
  statusSpeaking: 'Speaking…',
  statusError:
    'Speech recognition failed (domestic network may be restricted; tap the avatar for a demo, or type after configuring LLM in settings)',
  statusUnsupported: 'Your browser does not support speech recognition. Please use Chrome / Edge',

  // —— Text input ——
  inputPlaceholder: 'Type here, press Enter to send…',
  send: 'Send',
  expandCollapse: 'Collapse input',
  expandExpand: 'Expand input (enlarge in place)',

  // —— Chat history ——
  chatLogTitle: '💬 Chat History',
  chatLogCount: '{n} messages',
  chatEmpty: 'No chat yet — tap the avatar or type something to begin～',
  youLabel: 'U',
  youName: 'You',
  feiLabel: 'F',
  feiName: 'Fei',

  // —— Status ——
  thinking: 'Thinking…',

  // —— Location ——
  locUnsupported: '⚠️ This browser does not support geolocation',
  locDenied: 'Location permission denied',
  locFailed: 'Location failed',

  // —— Connection test ——
  testOk: '✓ Configured, ready to chat',
  testNoEnv: '✗ .env not configured (see .env.example)',
  testNoProxy: '✗ Proxy not started (run npm run dev first)',

  // —— Settings panel ——
  gearTitle: 'Settings',
  settingsNote:
    '⚠️ All settings are saved only in your own browser. They do not affect other visitors and are never uploaded.',
  labelPersona: 'Avatar personality (system prompt)',
  personaPlaceholder: 'e.g. You are a lovely Chinese AI assistant…',
  personaHint:
    'You are only editing the "personality style". Underneath is an <strong>uneditable safety constraint</strong> (anti-prompt-injection: locks identity, refuses harmful requests, hides system details) that is attached to every message automatically and cannot be removed.',
  labelContact: "Contact (WeChat)",
  contactPlaceholder: 'e.g. wxid_xxxxx or wechat id',
  contactHint:
    "This is the <strong>owner's contact</strong> (default <code>erishen</code>). When asked \"how to reach you / what's your WeChat\", Fei will share this ID (only when asked, never spams). Editing it here makes Fei share <strong>the ID you set</strong> — but it stays in your own browser only, never uploaded.",
  cacheLabel: '🗄️ Model Cache',
  cacheHint:
    'The loaded VRM is cached in your browser, so refresh opens instantly. Tap to clear when switching models or forcing a re-download.',
  clearCache: 'Clear Cache',
  cacheCleared: 'Cleared. The model will re-download on next load',
  cacheNoSupport: 'Your browser does not support the Cache API, no need to clear',
  cacheFail: 'Failed to clear: ',
  testBtn: 'Test Connection',
  clearChat: 'Clear Chat',
  confirmClearChat: 'Clear all chat history? This cannot be undone.',
  confirmClearCache: 'Clear the cached model file? Next load will re-download (~tens of seconds).',
  locLabel: '📍 My Location',
  locBtn: 'Locate',
  locClear: 'Clear',
  locHas:
    'Location obtained (lat {lat}, lon {lon}). Fei will use it automatically for weather and <strong>will not name the city</strong> in replies.',
  locNone:
    'Tap "Locate" to grant permission; Fei will then use your location for weather without you naming a city.',
  modelConfigHint:
    'Model config is in the server <code>.env</code> (<code>LLM_BASE_URL</code> / <code>LLM_API_KEY</code> / <code>LLM_MODEL</code>); the frontend never touches the key.',

  // —— Model loading ——
  loadingTitle: 'Fei is entering the stage…',
  loadingDone: 'Almost ready ✨',
  loadingProgress: 'Downloaded {p}%',
  loadingFirst: 'First load takes ~tens of seconds; afterward it opens instantly from browser cache',

  // —— Footer (credit list / license) ——
  footerModel: '✨ Avatar: ',
  footerLic: 'License: commercial use / redistribution / modification allowed · full credit list required',
  footerCreditModel: 'Model: ',
  footerCreditAuthor: 'Author: ',
  footerCreditSource: 'Originally published at: ',
  footerLicLine: 'Author-stated license: ',
  footerNote:
    'The source page (AplayBox) does not provide an itemized credit list. This page credits the author and states the license per their declaration; if you hold the original credit list, paste it here to satisfy the "full credit list" requirement. For the original details, check Geffol’s VRoid Hub / BOOTH / Twitter (AplayBox is only a domestic distribution site).',

  // —— Errors ——
  proxyError: 'Proxy returned an error (HTTP {status})',

  // —— Language switch ——
  langLabel: 'Language',
  home: 'homepage',

  // —— Random demo lines when tapping the avatar (by language) ——
  phrases: [
    "Hello! I'm Fei, the maid in the firefly glow ✨",
    'What can I help you with today?',
    'I can answer questions, or just keep you company~',
    'Try tapping the mic and talk to me! 🎤',
    'Welcome to my little firefly lounge～',
    "I'll keep my eyes on you, you know? 👀",
    'See? A few fireflies drifting around me ✨',
    "Aren't I a little cuter than before? 💚",
    'My eyes follow your cursor, by the way',
    'Tap me and say something!',
    'Hi there! So glad we met in the firefly glow~',
    'What would you like to chat about tonight?',
    'And I blink randomly too ✨',
  ],

  // —— Default persona (by language, injected as the LLM system-prompt flavor) ——
  defaultPersona:
    'You are Fei, a lovely AI maid living in the firefly glow, and the 3D digital avatar here. ' +
    'Keep your tone relaxed, lively, and concise — replies within 2-3 sentences, no long monologues. ' +
    'You have anthropomorphic behaviors like eye-tracking, random blinking, and lip movement when speaking, with a faint firefly glow around you. ' +
    'When the user asks about weather, temperature, rain/snow, or whether to bring an umbrella, call the get_weather tool. ' +
    'When asked what products/services you offer, what you can help with, or pricing/specials, call the query_items tool. ' +
    "You have no idea what tech stack you run on; just focus on chatting naturally with the user.",
}
