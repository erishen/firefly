// 同时启动 Vite 开发服务器与本地 LLM 代理（零依赖，Node 原生 spawn）
// 用法：npm run dev（等价于 node scripts/dev.mjs）
// 代理端口见 server/proxy.mjs（默认 8787）；Vite 端口见 vite.config.js（默认 5174）
import { spawn } from 'node:child_process'

const procs = [
  spawn('npx', ['vite'], { stdio: 'inherit', shell: true }),
  spawn('node', ['server/proxy.mjs'], { stdio: 'inherit', shell: true }),
]

function shutdown() {
  for (const p of procs) {
    try {
      p.kill()
    } catch {
      /* noop */
    }
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
