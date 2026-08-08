// 前端遥测：把「模型加载成功与否 + 耗时」上报到 /api/telemetry。
// 服务端落盘（Vercel 函数日志 / Supabase），不污染浏览器控制台。
// 采用 keepalive 的 fire-and-forget：失败静默忽略，绝不阻塞主流程。
export function reportModelLoad(payload) {
  try {
    fetch('/api/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'model_load', ...payload }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* 网络不可用时忽略 */
  }
}
