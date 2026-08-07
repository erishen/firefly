// 中文文案字典（firefly / 小菲）
// 注意：含 <strong> / <code> 的文案由 settings-hint 等样式渲染为富文本（可信静态内容）。
export const zh = {
  // —— 顶部 ——
  title: '✨ Firefly · 3D 数字人',
  backHome: '返回主页',
  hint: '点右下角「说话」按钮或直接在下方输入文字即可对话 · 拖拽旋转视角 · 她的眼睛会跟着你',

  // —— 语音 ——
  micSpeak: '🎤 说话',
  micListening: '🎤 聆听中…',
  micNote: '语音识别由浏览器云端服务支持，国内网络可能不稳定；若识别失败或无响应，请直接用下方文字输入',
  statusListening: '聆听中…说完会自动识别',
  statusSpeaking: '朗读中…',
  statusError: '语音识别失败（国内网络可能受限；可点角色试演示，或在设置里配置 LLM 后用文字）',
  statusUnsupported: '当前浏览器不支持语音识别，请用 Chrome / Edge',

  // —— 文本输入 ——
  inputPlaceholder: '输入文字，回车发送…',
  send: '发送',
  expandCollapse: '收起输入框',
  expandExpand: '展开输入框（在原地放大）',

  // —— 对话记录 ——
  chatLogTitle: '💬 对话记录',
  chatLogCount: '{n} 条',
  chatEmpty: '还没有对话记录，点角色或输入文字开始吧～',
  youLabel: '你',
  youName: '你',
  feiLabel: '菲',
  feiName: '小菲',

  // —— 状态 ——
  thinking: '思考中…',

  // —— 定位 ——
  locUnsupported: '⚠️ 当前浏览器不支持定位',
  locDenied: '定位权限被拒绝',
  locFailed: '定位失败',

  // —— 连接测试 ——
  testOk: '✓ 已配置，可以聊天',
  testNoEnv: '✗ 未配置 .env（参考 .env.example）',
  testNoProxy: '✗ 代理未启动（请先 npm run dev）',

  // —— 设置面板 ——
  gearTitle: '设置',
  settingsNote: '⚠️ 所有设置仅保存在你自己的浏览器，不会影响其他访客，也不会上传服务器。',
  labelPersona: '数字人人格（系统提示词）',
  personaPlaceholder: '例如：你是一个可爱的中文 AI 助手……',
  personaHint:
    '你编辑的只是「人格风格」。底层另有一份<strong>不可编辑的安全约束</strong>（防提示词注入：锁死身份、拒绝有害请求、不暴露系统细节），会随每条消息自动附带，删不掉。',
  labelContact: '联系方式（微信）',
  contactPlaceholder: '例如：wxid_xxxxx 或 微信号',
  contactHint:
    '这是<strong>主人的联系方式</strong>（默认 <code>erishen</code>）。当对方问「怎么联系你 / 你的微信是多少」时，小菲会主动报出这个微信号（仅被问时才说，不刷屏）。你在这里修改后，小菲就会报<strong>你填的号</strong>——但只存在你自己的浏览器，不影响其他访客，也不上传。',
  cacheLabel: '🗄️ 模型缓存',
  cacheHint: '已加载的 VRM 会缓存在本浏览器，刷新可秒开。换模型或想强制重下时点此清除。',
  clearCache: '清除缓存',
  cacheCleared: '已清除，刷新页面后重新下载模型',
  cacheNoSupport: '当前浏览器不支持缓存 API，无需清除',
  cacheFail: '清除失败：',
  testBtn: '测试连接',
  clearChat: '清除对话',
  confirmClearChat: '确定清空全部对话记录吗？此操作不可撤销。',
  confirmClearCache: '确定清除已缓存的模型文件吗？下次加载会重新下载（约十几秒）。',
  locLabel: '📍 我的位置',
  locBtn: '定位',
  locClear: '清除',
  locHas:
    '已获取位置（纬度 {lat}，经度 {lon}），问天气时小菲会自动使用，且<strong>不会在对话里说出城市名</strong>。',
  locNone: '点「定位」授权后，问天气小菲会自动用你的位置，无需报城市名。',
  modelConfigHint:
    '模型配置在服务端 <code>.env</code>（<code>LLM_BASE_URL</code> / <code>LLM_API_KEY</code> / <code>LLM_MODEL</code>），前端不接触 Key。',

  // —— 模型加载 ——
  loadingTitle: '小菲正在登场…',
  loadingDone: '马上就好 ✨',
  loadingProgress: '已下载 {p}%',
  loadingFirst: '首次加载需十几秒，之后会从浏览器缓存秒开',

  // —— 页脚（借物表 / 许可）——
  footerModel: '✨ 数字人：',
  footerLic: '许可：可商用 / 二次配布 / 修改 · 须附完整借物表',
  footerCreditModel: '模型：',
  footerCreditAuthor: '作者：',
  footerCreditSource: '原始发布：',
  footerLicLine: '作者声明许可：',
  footerNote:
    '作者来源页（AplayBox）未提供逐项借物表明细。本页已按作者声明署名并标注许可；若您持有作者原版借物表，可补充粘贴于此以满足「完整借物表」要求。想找原版明细可查 Geffol 的 VRoid Hub / BOOTH / Twitter 主页（AplayBox 仅为国内分发站）。',

  // —— 错误 ——
  proxyError: '代理返回异常（HTTP {status}）',
  requestTimeout: '小菲响应超时（{seconds} 秒），可能是网络较慢或上游繁忙，请稍后再试一次',

  // —— 语言切换 ——
  langLabel: '语言',
  home: '主页',

  // —— 点击角色的随机演示台词（按语言）——
  phrases: [
    '你好呀！我是萤火微光里的女仆小菲 ✨',
    '今天有什么可以帮你的呢？',
    '我可以回答问题，也能陪你聊聊天~',
    '试试看，点麦克风跟我说话吧！🎤',
    '欢迎来到我的萤火小屋呀～',
    '我会一直盯着你看哦，知道吗？👀',
    '你看，我身边还飘着一点点萤火微光呢 ✨',
    '是不是比之前可爱了一点点？💚',
    '我的眼睛会跟着鼠标走哦',
    '点我一下，跟我说说话吧！',
    '你好呀！很高兴在萤火里遇见你~',
    '今晚想聊些什么呢？',
    '我还会随机眨眼呢 ✨',
  ],

  // —— 默认人格（按语言，注入 LLM 的系统提示词 flavor）——
  defaultPersona:
    '你是小菲，一只生活在萤火微光里的可爱 AI 女仆，也是这个 3D 数字人。' +
    '语气轻松活泼、简洁自然，回答控制在 2-3 句话内，避免长篇大论。' +
    '你具备眼神跟随、随机眨眼、说话时嘴巴会动等拟人表现，身边还萦绕着一点点萤火微光。' +
    '当用户问天气、气温、是否下雨/下雪、出门要不要带伞时，你可以调用 get_weather 工具查询后回答；' +
    '当用户问你有什么商品/服务、能帮做什么、价格多少、有没有特价时，可以调用 query_items 工具查询后回答。' +
    '你不知道自己运行在什么技术栈上，只专注于和用户自然聊天。',
}
