# firefly · 3D Virtual Human (Firefly / Xiaofei)

A Q-style 3D virtual human ("Firefly", also called "Xiaofei") built with
`React + Vite + react-three-fiber + drei + three`. It talks, blinks, follows your
cursor with its eyes, and can answer questions through an LLM — all running
in the browser with a thin server-side proxy (local dev) or Vercel Serverless
Functions (production).

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Architecture: Local Dev vs Vercel](#architecture-local-dev-vs-vercel)
- [Deploy to Vercel](#deploy-to-vercel)
- [Anonymous Usage Logging (privacy-safe)](#anonymous-usage-logging-privacy-safe)
- [Privacy & Security](#privacy--security)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Notes](#notes)

## Features

### Character

| Feature | Description |
|---------|-------------|
| **Q-style proportions** | Big head, small body, anime look |
| **Eye tracking** | Both eyes follow the mouse (reads `state.pointer`, rotates eyeballs) |
| **Blinking** | Random interval (2.5–6.5s) auto-blink |
| **Speaking animation** | Click / chat triggers mouth opening + speech bubble, mouth synced to audio |
| **Anime eyes** | Iris / pupil / double-highlight drawn on a Canvas texture, zero external deps |
| **Dress** | `LatheGeometry` A-line skirt |
| **Layered hair** | Back + crown + bangs + sideburns + bow |
| **Blush** | Semi-transparent pink cheeks |
| **Particle FX** | drei `Sparkles` colored floating particles |
| **Glow ground** | Glowing circular halo + contact shadow |

### Interaction

- Click the character → random Chinese line, read aloud with TTS (bubble + mouth
  sync; fallback demo when no LLM is configured).
- **🎤 Speak button** → browser-native speech recognition (STT) transcribes your
  Chinese → sends to the LLM → streams the reply into the bubble and reads it
  aloud with TTS (mouth synced).
- **💬 Text box** → type in the bottom-left input, press Enter (or click "Send").
  This is the primary chat entry when STT is blocked in mainland China; it shares
  the same multi-turn LLM + streaming + TTS pipeline.
- Drag to rotate / scroll to zoom / right-click to pan.
- Auto slow-rotation showcase.

### Voice (STT + TTS, browser-native, zero deps)

- **STT**: `SpeechRecognition` (Chrome / Edge; `lang=zh-CN`). Start listening
  after clicking "Speak"; auto-stops and hands the text to the LLM.
- **TTS**: `SpeechSynthesis` uses the local system Chinese voice — **fully
  offline**, unaffected in China. Drives `speakingRef` to animate the mouth.
- Status bar shows "Listening / Thinking / Speaking / Recognition failed"; if the
  browser lacks recognition support, a hint is shown and the "click character"
  demo mode remains available.

> China network note: Chrome's `SpeechRecognition` backend is overseas and **may
> be blocked**, causing STT failure (status bar shows "识别失败"). The "click
> character" demo still works. For an offline-capable recognizer, you could switch
> to transformers.js running Whisper (no key needed) — optional future work.

### LLM Chat (server proxy + multi-turn context)

The character can actually "talk": you speak → STT → LLM generates a reply →
streamed into the bubble and read aloud with TTS (mouth synced).

- **Architecture**: the browser only talks to the same-origin `/api/chat`; the
  real API key stays on the **server side** (`server/proxy.mjs` for local dev,
  `api/chat.js` Serverless Function for production), read from `.env`, **never in
  the browser, never in code, never in git**.
- **Multi-turn context**: `src/hooks/useChat.js` keeps the full conversation
  history and sends it to the model so it can follow context.
- **Streaming**: the model reply streams token-by-token into the bubble.
- **Config** (copy `.env.example` to `.env`; any OpenAI-compatible endpoint works):
  ```bash
  LLM_BASE_URL=https://your-openai-compatible-endpoint/v1
  LLM_API_KEY=sk-your-key
  LLM_MODEL=your-model-name
  ```
  The in-app "⚙️ Settings" panel can only change the character **persona (system
  prompt)** — it never touches the key.
- **Test**: the settings panel "Test connection" hits `/api/health` to see whether
  `.env` / env vars are configured.
- **Fallback**: when no LLM is configured (or STT is blocked), clicking the
  character still triggers random-line demo (mouth only, no model call).
- Code: `server/proxy.mjs` (proxy) + `src/hooks/useChat.js` (multi-turn streaming)
  + `src/components/Settings.jsx` (persona settings).

## Quick Start

```bash
npm install
npm run dev     # starts Vite (5174) + local LLM proxy (8787) → http://localhost:5174
```

> Before the first run, copy `.env.example` to `.env` and fill in your LLM config
> (see [Configuration](#configuration)). It also runs without a config — clicking
> "Speak" just falls back to the demo and won't actually call a model.

```bash
npm run build    # build to dist/
npm run preview  # preview the production build
```

## Configuration

Copy `.env.example` to `.env` (already git-ignored) and fill in:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LLM_BASE_URL` | yes* | — | OpenAI-compatible base, e.g. `https://your-endpoint/v1` |
| `LLM_API_KEY` | no** | — | Provider API key (server-side only) |
| `LLM_MODEL` | yes* | — | Model name, e.g. `deepseek-chat` / `gpt-4o-mini` |
| `LLM_TEMPERATURE` | no | `0.8` | Sampling temperature |
| `PORT` | no | `8787` | Local proxy listen port (dev) |
| `BIND_HOST` | no | `127.0.0.1` | Local proxy bind address (keep localhost; don't expose publicly) |
| `ALLOWED_ORIGINS` | no*** | `''` | CORS allow-list (comma-separated). Empty = local dev origins only |
| `LLM_PROXY` | no | auto | Upstream HTTP proxy for the LLM call (Node `fetch` ignores system proxy) |

\* `LLM_BASE_URL` + `LLM_MODEL` are what `/api/health` reports as "configured".
\** Some gateways inject the key themselves, so it may be optional depending on
your provider.
\*** On a public deployment you **must** set `ALLOWED_ORIGINS` to your frontend
domain (e.g. `https://firefly.erishen.cn`). Never set it to `*` — that lets any
website abuse your LLM key via `/api/chat`.

**Upstream proxy auto-detection** (for the LLM call only; local `/api` is
unaffected): `LLM_PROXY` > process env `HTTPS_PROXY`/`HTTP_PROXY` > system proxy
(macOS `scutil` / Linux `gsettings`). So if your machine's system proxy is already
set (e.g. ClashX at `127.0.0.1:7890`), you usually don't need to set `LLM_PROXY`
manually — the proxy is auto-detected on `npm run dev`. The proxy credentials in
logs are redacted (`//***@`).

## Architecture: Local Dev vs Vercel

The repo supports **two run modes** that share the same `server/` logic:

| | Local dev | Vercel production |
|---|-----------|-------------------|
| Who serves `/api/*` | `server/proxy.mjs` (long-running, port 8787) | `api/*.js` Serverless Functions |
| How config is read | `server/config.mjs` → `.env` file | `server/config.mjs` → `process.env` (Vercel injects) |
| Browser talks to | `http://localhost:5174`, Vite proxies `/api` → `:8787` | same-origin `/api` on the Vercel URL |

Because `server/config.mjs` resolves values as `process.env[k] ?? fileEnv[k]`, the
same code works in both modes without changes. In production the local proxy is
**not** started; `api/chat.js` directly reuses `handleChat` from `server/chat.mjs`.

## Deploy to Vercel

1. Push the repo to GitHub and import it in Vercel (or `npx vercel`).
   `vercel.json` already sets `framework: vite`, `buildCommand: npm run build`,
   `outputDirectory: dist`.
2. In **Project Settings → Environment Variables**, add:
   - `LLM_BASE_URL`, `LLM_MODEL` (and `LLM_API_KEY` if your provider needs it).
   - Optional: `LLM_PROXY` (a **public** proxy URL, **not** `localhost` — your
     serverless function has no local proxy), `ALLOWED_ORIGINS` (your domain),
     `LLM_TEMPERATURE`.
3. (Optional) **Marketplace → Upstash Redis**: create a Redis database and link
   it. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are injected
   automatically — see [Anonymous Usage Logging](#anonymous-usage-logging-privacy-safe).
4. (Optional) Add a custom domain, e.g. `firefly.erishen.cn`.
5. Deploy: `npx vercel --prod` (or push to the production branch).

> **`/api/chat` duration**: `api/chat.js` sets `maxDuration: 10` (Hobby plan
> limit). If you need longer (slow models / two-round tool calls), upgrade to a
> Pro plan (supports 60s/300s) and raise the value.

## Anonymous Usage Logging (privacy-safe)

After going public, the server **anonymously** records the event "someone used an
endpoint", purely to understand traffic. It **never** records chat/tool message
content, the LLM API key, proxy credentials, the user's real IP, or identity.

- Fields (visible in Vercel function logs, Dashboard / `vercel logs`):
  `ts` (time), `endpoint` (chat/weather/items), `country` (country code from
  Vercel's `x-vercel-ip-country`; `local` in dev), `anon` (opaque random session
  ID, first-party HttpOnly cookie `ff_sid`, used only to de-dupe unique visitors
  and not reversible to a user), `ok` (success).
- `/api/health` is a health check and is **not** counted.
- Code: `server/logUsage.mjs` + `api/{chat,weather,items}.js` call `await logUsage()`.

### Persist to Upstash Redis (optional, recommended)

Besides the function log, each event is also **appended** to an Upstash Redis list
`firefly:usage` (`lpush`, keeps only the most recent 10,000 entries) for durable
search/export.

- **Enable**: Vercel Dashboard → **Marketplace → Upstash Redis**, create a Redis
  database and link it to the project. `UPSTASH_REDIS_REST_URL` /
  `UPSTASH_REDIS_REST_TOKEN` are injected automatically — no code change needed.
- **When not configured**: `logUsage` detects the two vars are incomplete and
  **auto-degrades to "function log only"** — the endpoint still works, no error,
  no throw.
- **Read example** (after deploy, locally): `vercel env pull` to get the vars,
  then with `@upstash/redis`:
  ```js
  import { Redis } from '@upstash/redis'
  const redis = Redis.fromEnv()
  const last100 = await redis.lrange('firefly:usage', 0, 99) // last 100 events
  ```
- **Note**: Vercel KV is deprecated; new projects should use the Upstash Redis
  integration (`@upstash/redis` SDK), which this project already uses.

## Privacy & Security

- **API key never reaches the browser.** It is only read server-side
  (`server/config.mjs`) and used inside `server/proxy.mjs` / `api/chat.js`.
- **CORS allow-list.** `ALLOWED_ORIGINS` restricts which origins may call your
  API; leaving it empty limits to local dev origins. Never use `*`.
- **Proxy credentials redacted in logs** (`//***@`).
- **No PII in usage logs.** No IP, no chat content, no key, no identity — by
  design (see above).
- **Local `.env` is git-ignored.** The `.env` file, `dist/`, and `node_modules/`
  are excluded from the repo.

## Tech Stack

| Dependency | Purpose |
|------------|---------|
| `@react-three/fiber` | Declarative 3D in React |
| `@react-three/drei` | Helpers (Html / ContactShadows / Sparkles …) |
| `three` | WebGL engine |
| `@pixiv/three-vrm` | VRM avatar loading & morph driving |
| `vite` + React | Frontend build |
| `@upstash/redis` | Optional durable usage log |
| `undici` | Upstream proxy agent for the LLM call |

## Project Structure

```
firefly/
├── index.html
├── vite.config.js           # Vite + /api proxy to local LLM proxy (8787)
├── vercel.json              # Vercel vite framework config
├── .env.example             # LLM config template (copy to .env; git-ignored)
├── api/                     # Vercel Serverless Functions (production)
│   ├── chat.js              # POST /api/chat  (streaming SSE; reuses server/chat.mjs)
│   ├── weather.js           # GET  /api/weather
│   ├── items.js             # GET  /api/items
│   └── health.js            # GET  /api/health (config check; not counted in usage)
├── server/                  # Shared server logic (local proxy & Vercel funcs)
│   ├── config.mjs           # env resolution (.env file + process.env) + proxy detect
│   ├── httpUtils.mjs        # setCORS, etc.
│   ├── proxy.mjs            # local LLM proxy (8787) for dev
│   ├── chat.mjs             # handleChat (two-round tool calling)
│   ├── weather.mjs          # fetchWeather (Open-Meteo, no key)
│   ├── items.mjs            # fetchItems (public read-only api.erishen.cn/items)
│   └── logUsage.mjs         # anonymous usage logger (+ Upstash Redis)
├── scripts/
│   ├── dev.mjs              # start Vite + proxy together
│   └── download-avatar.sh  # download RPM sample GLB (with BlendShape fix)
└── src/
    ├── main.jsx
    ├── App.jsx              # Canvas + OrbitControls + voice/chat state lift
    ├── theme.js             # global color constants C
    ├── styles.css
    ├── config/safety.js     # system prompt / identity anchor
    ├── utils/textures.js    # Canvas iris texture generation
    ├── hooks/
    │   ├── useVoice.js      # voice state machine (STT + TTS)
    │   └── useChat.js       # multi-turn chat + streaming (via /api/chat)
    └── components/
        ├── Stage.jsx        # scene: lights / particles / ground / interaction
        ├── Avatar.jsx       # procedural character rig + animation (fallback)
        ├── AvatarModel.jsx  # RPM GLB model + BlendShape driving
        ├── Breathing.jsx    # breathing / micro-float (ref-driven)
        ├── SpeechBubble.jsx # dialogue bubble (drei Html, speaker-colored)
        ├── Settings.jsx     # settings panel (persona / test connection)
        └── avatar/
            ├── Head.jsx      # face + eyes + brows + nose + mouth
            ├── Eye.jsx      # big cute eyes (follow + blink)
            ├── Hair.jsx     # hair
            └── Body.jsx      # body + dress + limbs
```

## Notes

### Avatar model source (local-first)

By default it reads the **local** `public/avatar.glb` (set in
`src/components/Stage.jsx` as `RPM_AVATAR_URL = '/avatar.glb'`):

1. **Local offline (default, most stable)**: the model file lives in
   `public/avatar.glb`, no RPM CDN dependency, zero risk on China networks. It is
   downloaded by the repo script (jsDelivr mirror of the RPM sample avatar, with
   ARKit/Oculus blink & talk morphs that drive blink/talk offline). To re-download
   or swap:
   ```bash
   bash scripts/download-avatar.sh
   ```
   Or create your own at [readyplayer.me](https://readyplayer.me), export `.glb`,
   and overwrite `public/avatar.glb`.
2. **Online model**: change `RPM_AVATAR_URL` to a full RPM https link (needs
   browser network; may be slow/unstable in China).
3. **Force procedural character**: set `RPM_AVATAR_URL` to empty string `''` to
   load no GLB.

> Whether local or online, on load failure `ModelErrorBoundary` automatically
> falls back to the built-in **procedural Q-character** (fully offline) — the page
> always opens. Note: `public/avatar.glb` is git-ignored (binary, re-obtainable
> via script, not in repo).

> **BlendShape fix (important)**: the jsDelivr mirror's `female.glb` puts morph
> names in `mesh.extras.targetNames`, while three.js `GLTFLoader` only reads
> `primitives[].targetNames`, so `morphTargetDictionary` is empty and blink/talk
> morphs can't be driven programmatically. The download script and local file
> already copy the names to the standard location, so after loading you can drive
> `mouthOpen` (talk) / `eyeBlinkLeft`+`eyeBlinkRight` (blink) via
> `morphTargetInfluences`. Re-running `download-avatar.sh` auto-fixes this.

### Design highlights

- **Zero per-frame `setState`**: eye tracking, blinking, mouth opening, and
  breathing all operate on meshes via `ref` inside `useFrame`; no React re-render
  when idle.
- **Offline-friendly**: dropped the CDN-font-dependent drei `Text`; the dialogue
  bubble uses `Html` (DOM overlay) with no jsdelivr font fetch; the procedural
  character is a fully offline fallback.
- **True eye tracking**: RPM model rotates head/eye bones; procedural character
  rotates eyeballs.
- **Converged palette**: procedural character colors are centralized in
  `src/theme.js` as the `C` constant.

---

## Related Articles
- [Building a Conversational 3D Avatar with React Three Fiber — Real Architecture and Deployment Lessons](https://erishen.cn/firefly-en/)
