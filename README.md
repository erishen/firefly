# react-three-fiber Demo

复杂 3D 场景 Demo：`React + Vite + react-three-fiber + drei + postprocessing`。

## 数字人 Demo

### 角色特性

| 特性 | 说明 |
|------|------|
| **Q 版比例** | 大头小身，二次元风格 |
| **眼神跟随** | 瞳孔实时追踪鼠标位置 |
| **眨眼动画** | 随机间隔自动眨眼 |
| **说话动画** | 点击触发 → 嘴巴开合 + 气泡文字 |
| **头发分层** | 头顶 + 刘海 + 两侧 + 发尾 + 蝴蝶结 |
| **腮红** | 半透明粉色腮红 |
| **粒子特效** | 25 颗彩色浮动粒子环绕 |
| **光圈地面** | 发光的圆形光圈 |

### 交互

- 点击数字人 → 随机中文台词
- 拖拽旋转 / 滚轮缩放 / 右键平移
- 自动慢速旋转展示

## 快速开始

```bash
npm install
npm run dev     # http://localhost:5174
```

```bash
npm run build    # 构建到 dist/
npm run preview  # 预览
```

## 技术栈

| 依赖 | 说明 |
|------|------|
| `@react-three/fiber` | React 声明式 3D |
| `@react-three/drei` | 辅助组件（Text / ContactShadows 等） |
| `@react-three/postprocessing` | 后处理（Bloom） |
| `three` | WebGL 引擎 |
| `vite` + React | 前端构建 |

## 目录结构

```
react-three-fiber/
├── index.html
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx         # Canvas + OrbitControls
    ├── styles.css
    └── components/
        └── Stage.jsx   # 数字人 + 粒子 + 对话框
```