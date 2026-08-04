# firefly · 萤火数字人（萤火 / 小菲）

Q 版 3D 数字人（萤火 / 小菲）：`React + Vite + react-three-fiber + drei + three`。
它会说话、眨眼、用眼睛跟随鼠标，还能通过大模型回答问题——全部在浏览器里运行，
配合一个轻量服务端代理（本地开发）或 Vercel Serverless Functions（生产部署）。

## 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [配置](#配置)
- [架构：本地开发 vs Vercel](#架构本地开发-vs-vercel)
- [部署到 Vercel](#部署到-vercel)
- [使用统计（匿名、隐私安全）](#使用统计匿名隐私安全)
- [隐私与安全](#隐私与安全)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [补充说明](#补充说明)

## 特性

### 角色特性

| 特性 | 说明 |
|------|------|
| **Q 版比例** | 大头小身，二次元风格 |
| **眼神跟随** | 双眼实时追踪鼠标（读 `state.pointer`，旋转眼球） |
| **眨眼动画** | 随机间隔（2.5~6.5s）自动眨眼 |
| **说话动画** | 点击/对话触发 → 嘴巴开合 + 气泡文字，嘴型同步 |
| **动漫眼睛** | 虹膜/瞳孔/双高光全部画在 Canvas 贴图上，零外部依赖 |
| **连衣裙** | `LatheGeometry` 旋转面生成 A 字裙身 |
| **头发分层** | 后发 + 头顶盖 + 刘海 + 鬓发 + 蝴蝶结 |
| **腮红** | 半透明粉色腮红 |
| **粒子特效** | drei `Sparkles` 彩色浮动粒子环绕 |
| **光圈地面** | 发光的圆形光圈 + 接触阴影 |

### 交互

- 点击数字人 → 随机中文台词，并用 TTS **朗读出声**（气泡 + 嘴型同步，无 LLM 时的兜底演示）
- **🎤 说话按钮** → 浏览器原生语音识别（STT）把你说的中文转文字 → 发给大模型生成回复 → 流式显示在气泡并用 TTS 朗读（嘴型同步）
- **💬 文本输入框** → 直接在左下角输入框打字、回车（或点「发送」）即发送；国内 STT 被墙时的主要对话入口，与语音共用同一套多轮 LLM + 流式 + TTS 链路
- 拖拽旋转 / 滚轮缩放 / 右键平移
- 自动慢速旋转展示

### 语音（STT + TTS，浏览器原生、零依赖）

- **STT**：`SpeechRecognition`（Chrome / Edge 支持；`lang=zh-CN`）。点「说话」后开始聆听，说完自动停止并交给 LLM。
- **TTS**：`SpeechSynthesis` 用本机系统中文嗓音，**完全离线**，国内无碍；朗读时驱动 `speakingRef` 让嘴型动。
- 状态栏会显示「聆听中 / 思考中 / 朗读中 / 识别失败」；浏览器不支持识别时给出提示，并保留「点击角色」的演示模式。

> 国内网络注意：Chrome 的 `SpeechRecognition` 识别后端在境外，**可能被墙导致 STT 失败**（状态栏会提示「识别失败」）。
> 此时「点击角色」仍可演示嘴型与气泡。若要国内可用的离线识别，可改为 transformers.js 跑 Whisper（无需 key），后续可加。

### LLM 对话（服务端代理 + 多轮上下文）

数字人可以真正「对话」：**你说 → STT 转文字 → 发给大模型生成回复 → 流式显示在气泡并用 TTS 朗读（嘴型同步）**。

- **架构**：浏览器只和同源的 `/api/chat` 通信；真正的 API Key 留在**服务端**（`server/proxy.mjs` 用于本地开发、`api/chat.js` Serverless Function 用于生产），从 `.env` 读取，**不进浏览器、不进代码、不进 git**。
- **多轮上下文**：`src/hooks/useChat.js` 维护完整对话历史再发给模型，能接上下文。
- **流式**：模型回复按 token 流式显示，气泡里逐字出来。
- **配置**（复制 `.env.example` 为 `.env` 填写，支持任意 OpenAI 兼容服务）：
  ```bash
  LLM_BASE_URL=https://your-openai-compatible-endpoint/v1
  LLM_API_KEY=sk-your-key
  LLM_MODEL=your-model-name
  ```
  前端在「⚙️ 设置」里只能改数字人**人格（系统提示词）**，永远接触不到 Key。
- **测试**：设置面板「测试连接」打 `/api/health` 看 `.env` / 环境变量是否配置就绪。
- **兜底**：未配置 LLM（或 STT 在国内被墙）时，点角色仍触发随机台词演示（仅动嘴，不调模型）。
- 代码：`server/proxy.mjs`（代理）+ `src/hooks/useChat.js`（多轮流式）+ `src/components/Settings.jsx`（人格设置）。

## 快速开始

```bash
npm install
npm run dev     # 同时启动 Vite(5174) + 本地 LLM 代理(8787) → http://localhost:5174
```

> 首次运行前，复制 `.env.example` 为 `.env` 并填入你的 LLM 配置（见[配置](#配置)）。不填也能跑，只是点「说话」会走兜底演示、不会真正调模型。

```bash
npm run build    # 构建到 dist/
npm run preview  # 预览生产构建
```

## 配置

复制 `.env.example` 为 `.env`（已被 git 忽略）并填写：

| 变量 | 必填 | 默认 | 说明 |
|------|------|------|------|
| `LLM_BASE_URL` | 是* | — | OpenAI 兼容接口 base，如 `https://your-endpoint/v1` |
| `LLM_API_KEY` | 否** | — | 服务商 API Key（仅服务端使用） |
| `LLM_MODEL` | 是* | — | 模型名，如 `deepseek-chat` / `gpt-4o-mini` |
| `LLM_TEMPERATURE` | 否 | `0.8` | 采样温度 |
| `PORT` | 否 | `8787` | 本地代理监听端口（仅开发） |
| `BIND_HOST` | 否 | `127.0.0.1` | 本地代理绑定网卡（保持本机，勿暴露公网） |
| `ALLOWED_ORIGINS` | 否*** | `''` | CORS 白名单（逗号分隔）。留空=仅本地开发源 |
| `LLM_PROXY` | 否 | 自动 | 调 LLM 时走的上游 HTTP 代理（Node `fetch` 不读系统代理） |

\* `LLM_BASE_URL` + `LLM_MODEL` 是 `/api/health` 判定「已配置」的依据。
\** 部分网关自身注入 key，故视你的服务商可能可选。
\*** 公网部署时**必须**把 `ALLOWED_ORIGINS` 设为前端域名（如 `https://firefly.erishen.cn`）。切勿设为 `*`——那会让任意网站盗用你的 LLM Key 发起 `/api/chat` 请求。

**上游代理自动探测**（仅对 LLM 调用；本地 `/api` 不受影响）：`LLM_PROXY` > 进程环境变量 `HTTPS_PROXY`/`HTTP_PROXY` > 系统代理（macOS `scutil` / Linux `gsettings`）。所以本机系统代理已配（如 ClashX 在 `127.0.0.1:7890`）时，通常**不用**手动填 `LLM_PROXY`——`npm run dev` 启动时会自动探测并走代理。代理地址里的凭证在日志中脱敏为 `//***@`。

## 架构：本地开发 vs Vercel

本仓库支持**两种运行模式**，共用同一套 `server/` 逻辑：

| | 本地开发 | Vercel 生产 |
|---|-----------|-------------------|
| 谁来服务 `/api/*` | `server/proxy.mjs`（常驻，端口 8787） | `api/*.js` Serverless Functions |
| 配置从哪里读 | `server/config.mjs` → 根目录 `.env` 文件 | `server/config.mjs` → `process.env`（Vercel 注入） |
| 浏览器访问 | `http://localhost:5174`，Vite 把 `/api` 代理到 `:8787` | Vercel 域名下同源 `/api` |

因为 `server/config.mjs` 的取值逻辑是 `process.env[k] ?? fileEnv[k]`，同一份代码在两种模式下都无需改动即可工作。生产环境下**不会**启动本地代理；`api/chat.js` 直接复用 `server/chat.mjs` 的 `handleChat`。

## 部署到 Vercel

1. 把仓库推到 GitHub，在 Vercel 导入（或 `npx vercel`）。`vercel.json` 已设
   `framework: vite`、`buildCommand: npm run build`、`outputDirectory: dist`。
2. 在 **Project Settings → Environment Variables** 添加：
   - `LLM_BASE_URL`、`LLM_MODEL`（以及你的服务商需要的 `LLM_API_KEY`）。
   - 可选：`LLM_PROXY`（**公网**代理地址，**不是** `localhost`——你的 serverless 函数没有本地代理）、`ALLOWED_ORIGINS`（你的域名）、`LLM_TEMPERATURE`。
3. （可选）**Marketplace → Upstash Redis**：创建 Redis 数据库并关联到本项目。
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` 会自动注入——见[使用统计](#使用统计匿名隐私安全)。
4. （可选）绑定自定义域名，如 `firefly.erishen.cn`。
5. 部署：`npx vercel --prod`（或推到生产分支）。

> **`/api/chat` 时长**：`api/chat.js` 设了 `maxDuration: 10`（Hobby 免费计划上限）。若需更长（慢模型 / 工具两轮调用），请升级 Pro 计划（支持 60s/300s）并把该值调大。

## 使用统计（匿名、隐私安全）

对外发布后，会在服务端**匿名**记录「有人使用了哪个接口」这一事件，用于了解访问情况。**绝不记录**聊天/工具的消息内容、LLM API Key、代理凭证、用户真实 IP 或身份。

- 记录字段（Vercel 函数日志，可在 Dashboard / `vercel logs` 查看）：`ts`（时间）、`endpoint`（chat/weather/items）、`country`（国家代码，来自 Vercel 提供的 `x-vercel-ip-country`；本地开发为 `local`）、`anon`（不透明随机会话 ID，首方 HttpOnly cookie `ff_sid`，仅用于去重独立访客，不可反推用户）、`ok`（是否成功）。
- `/api/health` 是健康检查，不计入统计。
- 代码：`server/logUsage.mjs` + `api/{chat,weather,items}.js` 在 handler 入口 `await logUsage()`。

### 持久化到 Upstash Redis（可选，推荐）

每条事件除了写函数日志，还会**追加**到 Upstash Redis 列表 `firefly:usage`（用 `lpush`，仅保留最近 1 万条），便于长期检索/导出。

- **启用**：在 Vercel Dashboard → **Marketplace → Upstash Redis** 创建一个 Redis 数据库并关联到本项目，环境变量 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` 会自动注入，无需改代码。
- **未配置时**：`logUsage` 检测到两个变量不全会**自动降级为「只写函数日志」**，接口照常工作、不报错、不抛异常。
- **读取示例**（部署后本地执行）：`vercel env pull` 拿到变量后，用 `@upstash/redis`：
  ```js
  import { Redis } from '@upstash/redis'
  const redis = Redis.fromEnv()
  const last100 = await redis.lrange('firefly:usage', 0, 99) // 取最近 100 条
  ```
- ⚠️ **Vercel KV 已弃用**：新项目请直接用 Upstash Redis 集成（`@upstash/redis` SDK），本项目已采用此方案。

## 隐私与安全

- **API Key 不进浏览器**：只在服务端（`server/config.mjs`）读取，用于 `server/proxy.mjs` / `api/chat.js`。
- **CORS 白名单**：`ALLOWED_ORIGINS` 限制可调用你 API 的来源；留空仅限本地开发源。切勿用 `*`。
- **代理凭证日志脱敏**（`//***@`）。
- **使用日志无 PII**：不记 IP、不记聊天内容、不记 Key、不记身份——设计如此（见上）。
- **本地 `.env` 已 git 忽略**：`.env`、`dist/`、`node_modules/` 均不入库。

## 技术栈

| 依赖 | 说明 |
|------|------|
| `@react-three/fiber` | React 声明式 3D |
| `@react-three/drei` | 辅助组件（Html / ContactShadows / Sparkles 等） |
| `three` | WebGL 引擎 |
| `@pixiv/three-vrm` | VRM 模型加载与 morph 驱动 |
| `vite` + React | 前端构建 |
| `@upstash/redis` | 可选的使用日志持久化 |
| `undici` | 调 LLM 时的上游代理 Agent |

## 3D 模型分发

萤火女仆角色（`fireflyMaid.vrm`）的 VRM 许可为 `OnlyAuthor + redistribution=disallow`（第三方 VRoid 创作，仅作者可商用/再分发），因此**不随仓库公开分发**，而是通过 `api.erishen.cn/api/models/fireflyMaid.vrm` **带令牌获取**：

- 生产环境：默认从该受保护接口加载，需在设置面板填写「模型访问令牌」（须与服务端 `MODEL_ACCESS_TOKEN` 一致）；令牌错误会回退到内置程序化角色。
- 开发环境（`npm run dev`）：直接用本地 `public/fireflyMaid.vrm`，无需令牌。
- 令牌可经 `Authorization: Bearer` / `X-API-Key` / `?token=` 三种方式传递；接口详情见 `personal/web-services/fastapi-web` 的 `app/routers/protected_files.py`。

## 目录结构

```
firefly/
├── index.html
├── vite.config.js           # Vite + /api 代理到本地 LLM 代理(8787)
├── vercel.json              # Vercel vite 框架配置
├── .env.example             # LLM 配置模板（复制为 .env，含真实 key 不入库）
├── api/                     # Vercel Serverless Functions（生产）
│   ├── chat.js              # POST /api/chat  （流式 SSE；复用 server/chat.mjs）
│   ├── weather.js           # GET  /api/weather
│   ├── items.js             # GET  /api/items
│   └── health.js            # GET  /api/health （配置检查；不计入使用统计）
├── server/                  # 共用服务端逻辑（本地代理 & Vercel 函数）
│   ├── config.mjs           # 配置解析(.env 文件 + process.env) + 代理探测
│   ├── httpUtils.mjs        # setCORS 等
│   ├── proxy.mjs            # 本地 LLM 代理(8787)，仅开发用
│   ├── chat.mjs             # handleChat（两轮 tool calling）
│   ├── weather.mjs          # fetchWeather（Open-Meteo，免 key）
│   ├── items.mjs            # fetchItems（公开只读 api.erishen.cn/items）
│   └── logUsage.mjs         # 匿名使用日志（+ Upstash Redis）
├── scripts/
│   ├── dev.mjs              # 同时启动 Vite + 代理
│   └── download-avatar.sh  # 下载 RPM 示例 GLB（含 BlendShape 修复）
└── src/
    ├── main.jsx
    ├── App.jsx             # Canvas + OrbitControls + 语音/对话状态提升
    ├── theme.js            # 全局配色常量 C
    ├── styles.css
    ├── config/safety.js     # 系统提示词 / 身份锚点
    ├── utils/textures.js    # Canvas 虹膜贴图生成
    ├── hooks/
    │   ├── useVoice.js      # 语音状态机（STT + TTS）
    │   └── useChat.js       # 多轮对话 + 流式（走 /api/chat）
    └── components/
        ├── Stage.jsx        # 场景：灯光 / 粒子 / 地面 / 交互状态
        ├── Avatar.jsx       # 程序化角色装配 + 动画调度（兜底）
        ├── AvatarModel.jsx  # RPM GLB 模型 + BlendShape 驱动
        ├── Breathing.jsx    # 呼吸/微浮动（ref 驱动）
        ├── SpeechBubble.jsx # 对话框（drei Html，按说话人配色）
        ├── Settings.jsx     # 设置面板（人格 / 测试连接）
        └── avatar/
            ├── Head.jsx      # 脸 + 眼 + 眉 + 鼻 + 嘴
            ├── Eye.jsx      # 大眼萌眼睛（跟随 + 眨眼）
            ├── Hair.jsx     # 头发
            └── Body.jsx      # 身体 + 连衣裙 + 四肢
```

## 补充说明

### 角色模型来源（本地优先）

默认读取 **本地** `public/avatar.glb`（在 `src/components/Stage.jsx` 顶部的 `RPM_AVATAR_URL = '/avatar.glb'`）：

1. **本地离线（默认，最稳）**：模型文件在 `public/avatar.glb`，完全不依赖 RPM CDN，国内网络零风险。
   - 该文件已随仓库脚本下载到位（RPM 官方示例头像的 jsDelivr 镜像，含 ARKit/Oculus 眨眼与说话 morph，可离线驱动眨眼/说话动画）。
   - 如需重新下载 / 换形象：
     ```bash
     bash scripts/download-avatar.sh
     ```
   - 或去 [readyplayer.me](https://readyplayer.me) 捏一个你喜欢的形象，导出 `.glb` 直接覆盖 `public/avatar.glb`。
2. **在线模型**：把 `RPM_AVATAR_URL` 改成完整的 RPM https 链接（需浏览器联网，国内可能慢/不稳）。
3. **强制程序化角色**：把 `RPM_AVATAR_URL` 设为空字符串 `''`，不加载任何 GLB。

> 无论本地还是在线 GLB，加载失败时 `ModelErrorBoundary` 会自动回退到内置**程序化 Q 版角色**（完全离线），页面永远打得开。
> 注意：`public/avatar.glb` 已被 `.gitignore` 忽略（二进制、可经脚本重新获取，不入库）。

> **BlendShape 修复（重要）**：jsDelivr 镜像里的 `female.glb` 把 morph 名放在 `mesh.extras.targetNames`，而 three.js `GLTFLoader` 只读 `primitives[].targetNames`，导致 `morphTargetDictionary` 为空、眨眼/说话 morph 无法被程序驱动。下载脚本与本地文件都已把名字复制到标准位置，加载后即可用 `morphTargetInfluences` 驱动 `mouthOpen`（说话）、`eyeBlinkLeft/Right`（眨眼）。重新跑 `download-avatar.sh` 会自动修复。

### 设计要点

- **动画零每帧 `setState`**：眼神跟随、眨眼、嘴巴开合、呼吸全部用 `ref` 在 `useFrame` 里直接操作 mesh，静止时不触发 React 重渲染。
- **离线友好**：去掉了依赖 CDN 字体的 drei `Text`，对话框改用 `Html`（DOM 覆盖层），无 jsdelivr 字体拉取；程序化角色作为兜底完全离线。
- **真·眼神跟随**：RPM 模型旋转头部/眼骨骼；程序化角色旋转眼球。
- **配色收敛**：程序化角色颜色集中到 `src/theme.js` 的 `C` 常量。
