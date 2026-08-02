import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, ContactShadows, RoundedBox } from '@react-three/drei'

// ---- 工具 ----
const PALETTE = {
  skin: '#fce4d6',
  skinShadow: '#f0c8b8',
  hair: '#2d1b4e',
  hairHighlight: '#5b3a8c',
  eyeWhite: '#ffffff',
  eyeIris: '#4a90d9',
  eyePupil: '#1a1a2e',
  eyeHighlight: '#ffffff',
  blush: '#ffb4b4',
  mouth: '#d4787a',
  body: '#6366f1',
  bodyShadow: '#4f46e5',
  shoes: '#1e293b',
  clothes: '#818cf8',
}

// ---- 眼睛组件 ----
function Eye({ position, isBlinking }) {
  const blinkHeight = isBlinking ? 0.01 : 1
  return (
    <group position={position}>
      {/* 眼白 */}
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={PALETTE.eyeWhite} roughness={0.3} />
      </mesh>
      {/* 虹膜 */}
      <mesh position={[0, 0, 0.08]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color={PALETTE.eyeIris} roughness={0.2} metalness={0.3} />
      </mesh>
      {/* 瞳孔 */}
      <mesh position={[0, 0, 0.12]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={PALETTE.eyePupil} roughness={0.1} />
      </mesh>
      {/* 高光 1 */}
      <mesh position={[0.025, 0.025, 0.14]}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color={PALETTE.eyeHighlight} />
      </mesh>
      {/* 高光 2 */}
      <mesh position={[-0.02, -0.02, 0.14]}>
        <sphereGeometry args={[0.008, 8, 8]} />
        <meshBasicMaterial color={PALETTE.eyeHighlight} />
      </mesh>
      {/* 上眼睑（眨眼时压下） */}
      <mesh position={[0, 0.08 * blinkHeight, 0.05]} scale={[1, blinkHeight, 1]}>
        <sphereGeometry args={[0.13, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color={PALETTE.skin} roughness={0.5} />
      </mesh>
      {/* 下眼睑 */}
      <mesh position={[0, -0.1, 0.05]}>
        <sphereGeometry args={[0.11, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5]} />
        <meshStandardMaterial color={PALETTE.skin} roughness={0.5} />
      </mesh>
    </group>
  )
}

// ---- 头发 ----
function Hair() {
  return (
    <group>
      {/* 头顶头发 */}
      <mesh position={[0, 0.52, -0.02]}>
        <sphereGeometry args={[0.48, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.7} />
      </mesh>
      {/* 刘海 */}
      <mesh position={[-0.15, 0.38, 0.3]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.7} />
      </mesh>
      <mesh position={[0.15, 0.38, 0.3]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.42, 0.35]}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.7} />
      </mesh>
      {/* 两侧头发 */}
      <mesh position={[-0.42, 0.15, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.5, 8]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.7} />
      </mesh>
      <mesh position={[0.42, 0.15, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.5, 8]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.7} />
      </mesh>
      {/* 发尾 */}
      <mesh position={[-0.45, -0.15, 0.05]}>
        <coneGeometry args={[0.1, 0.3, 8]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.7} />
      </mesh>
      <mesh position={[0.45, -0.15, 0.05]}>
        <coneGeometry args={[0.1, 0.3, 8]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.7} />
      </mesh>
      {/* 发饰 - 蝴蝶结 */}
      <mesh position={[0.35, 0.45, 0.15]} rotation={[0, 0, 0.3]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#f472b6" roughness={0.3} metalness={0.2} />
      </mesh>
      <mesh position={[0.42, 0.48, 0.12]} rotation={[0, 0, -0.2]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#f472b6" roughness={0.3} metalness={0.2} />
      </mesh>
    </group>
  )
}

// ---- 身体（Q版） ----
function Body() {
  return (
    <group position={[0, 0.55, 0]}>
      {/* 脖子 */}
      <mesh position={[0, 0.38, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.15, 12]} />
        <meshStandardMaterial color={PALETTE.skin} roughness={0.6} />
      </mesh>
      {/* 身体 */}
      <mesh castShadow>
        <sphereGeometry args={[0.32, 16, 16]} />
        <meshStandardMaterial color={PALETTE.body} roughness={0.4} metalness={0.1} />
      </mesh>
      {/* 领口 */}
      <mesh position={[0, 0.25, 0.2]}>
        <torusGeometry args={[0.15, 0.03, 8, 16]} />
        <meshStandardMaterial color={PALETTE.clothes} roughness={0.3} />
      </mesh>
      {/* 左手臂 */}
      <group position={[-0.35, 0.05, 0]}>
        <mesh rotation={[0, 0, 0.3]}>
          <cylinderGeometry args={[0.07, 0.06, 0.45, 8]} />
          <meshStandardMaterial color={PALETTE.body} roughness={0.4} />
        </mesh>
        {/* 左手 */}
        <mesh position={[0, -0.28, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.6} />
        </mesh>
      </group>
      {/* 右手臂 */}
      <group position={[0.35, 0.05, 0]}>
        <mesh rotation={[0, 0, -0.3]}>
          <cylinderGeometry args={[0.07, 0.06, 0.45, 8]} />
          <meshStandardMaterial color={PALETTE.body} roughness={0.4} />
        </mesh>
        {/* 右手 */}
        <mesh position={[0, -0.28, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color={PALETTE.skin} roughness={0.6} />
        </mesh>
      </group>
      {/* 左腿 */}
      <group position={[-0.15, -0.35, 0]}>
        <mesh>
          <cylinderGeometry args={[0.1, 0.08, 0.35, 8]} />
          <meshStandardMaterial color={PALETTE.body} roughness={0.4} />
        </mesh>
        {/* 左脚 */}
        <mesh position={[0, -0.22, 0.04]}>
          <boxGeometry args={[0.14, 0.06, 0.2]} />
          <meshStandardMaterial color={PALETTE.shoes} roughness={0.5} />
        </mesh>
      </group>
      {/* 右腿 */}
      <group position={[0.15, -0.35, 0]}>
        <mesh>
          <cylinderGeometry args={[0.1, 0.08, 0.35, 8]} />
          <meshStandardMaterial color={PALETTE.body} roughness={0.4} />
        </mesh>
        {/* 右脚 */}
        <mesh position={[0, -0.22, 0.04]}>
          <boxGeometry args={[0.14, 0.06, 0.2]} />
          <meshStandardMaterial color={PALETTE.shoes} roughness={0.5} />
        </mesh>
      </group>
      {/* 裙子/下摆 */}
      <mesh position={[0, -0.15, 0]}>
        <coneGeometry args={[0.28, 0.25, 16, 1, true]} />
        <meshStandardMaterial color={PALETTE.clothes} roughness={0.5} side={2} />
      </mesh>
    </group>
  )
}

// ---- 头 ----
function Head({ isSpeaking, onBlink }) {
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)
  const mouthOpenRef = useRef(0)

  useEffect(() => {
    const handler = (e) => {
      setCursorPos({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      })
    }
    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  // 随机眨眼
  useFrame((state) => {
    const t = state.clock.elapsedTime
    // 每 3-5 秒眨一次
    if (Math.sin(t * 0.5) > 0.98 && !isBlinking) {
      setIsBlinking(true)
      onBlink?.()
      setTimeout(() => setIsBlinking(false), 150)
    }
    // 说话时嘴巴张开
    mouthOpenRef.current = isSpeaking ? Math.min(1, mouthOpenRef.current + 0.2) : Math.max(0, mouthOpenRef.current - 0.1)
  })

  const eyeY = cursorPos.y * 0.03
  const eyeX = cursorPos.x * 0.04

  return (
    <group position={[0, 1.55, 0]}>
      {/* 头部 */}
      <mesh castShadow>
        <sphereGeometry args={[0.42, 20, 20]} />
        <meshStandardMaterial color={PALETTE.skin} roughness={0.5} />
      </mesh>

      {/* 腮红 */}
      <mesh position={[-0.28, -0.05, 0.32]}>
        <ellipseGeometry args={[0.08, 0.05, 16]} />
        <meshBasicMaterial color={PALETTE.blush} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0.28, -0.05, 0.32]}>
        <ellipseGeometry args={[0.08, 0.05, 16]} />
        <meshBasicMaterial color={PALETTE.blush} transparent opacity={0.4} />
      </mesh>

      {/* 左眼 */}
      <group position={[-0.16, 0.06, 0.32]}>
        <Eye position={[eyeX, eyeY, 0]} isBlinking={isBlinking} />
      </group>

      {/* 右眼 */}
      <group position={[0.16, 0.06, 0.32]}>
        <Eye position={[eyeX, eyeY, 0]} isBlinking={isBlinking} />
      </group>

      {/* 眉毛 */}
      <mesh position={[-0.16, 0.18, 0.36]} rotation={[0, 0, -0.1]}>
        <boxGeometry args={[0.14, 0.025, 0.03]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.8} />
      </mesh>
      <mesh position={[0.16, 0.18, 0.36]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.14, 0.025, 0.03]} />
        <meshStandardMaterial color={PALETTE.hair} roughness={0.8} />
      </mesh>

      {/* 鼻子 */}
      <mesh position={[0, -0.02, 0.4]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color={PALETTE.skinShadow} roughness={0.6} />
      </mesh>

      {/* 嘴巴 */}
      <group position={[0, -0.12, 0.38]}>
        <mesh>
          <sphereGeometry args={[0.05 + mouthOpenRef.current * 0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color={PALETTE.mouth} roughness={0.4} />
        </mesh>
        {/* 舌头 */}
        {mouthOpenRef.current > 0.3 && (
          <mesh position={[0, -0.02, 0.02]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#e8888a" roughness={0.3} />
          </mesh>
        )}
      </group>

      {/* 头发 */}
      <Hair />
    </group>
  )
}

// ---- 粒子特效 ----
function Sparkles({ count = 30 }) {
  const ref = useRef()
  const particles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        pos: [
          (Math.random() - 0.5) * 6,
          Math.random() * 4 + 0.5,
          (Math.random() - 0.5) * 4,
        ],
        scale: 0.02 + Math.random() * 0.04,
        speed: 0.5 + Math.random() * 1,
        color: ['#fbbf24', '#f472b6', '#818cf8', '#34d399'][Math.floor(Math.random() * 4)],
      })),
    [count]
  )

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.children.forEach((child, i) => {
      if (child.userData && child.userData.baseY !== undefined) {
        child.position.y = child.userData.baseY + Math.sin(t * particles[i].speed + i) * 0.3
        child.material.opacity = 0.3 + Math.sin(t * 2 + i * 0.5) * 0.3
      }
    })
  })

  return (
    <group ref={ref}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.pos} userData={{ baseY: p.pos[1] }}>
          <octahedronGeometry args={[p.scale, 0]} />
          <meshBasicMaterial color={p.color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// ---- 对话框 ----
function SpeechBubble({ text, visible }) {
  if (!visible || !text) return null
  return (
    <group position={[0, 2.4, 0]}>
      <mesh>
        <planeGeometry args={[3.2, 0.7]} />
        <meshBasicMaterial color="rgba(15, 23, 42, 0.85)" side={2} transparent opacity={0.9} />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.16}
        color="#fff"
        anchorX="center"
        anchorY="middle"
        maxWidth={2.8}
        lineHeight={1.3}
        letterSpacing={0.02}
      >
        {text}
      </Text>
      {/* 箭头 */}
      <mesh position={[0, -0.42, 0.01]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.18, 4]} />
        <meshBasicMaterial color="rgba(15, 23, 42, 0.85)" transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

// ---- 主场景 ----
const PHRASES = [
  '你好！我是你的 AI 数字助手 ✨',
  '今天有什么可以帮你的？',
  '我可以回答问题，也可以陪你聊天~',
  '试试看，点击我能说话哦！🎯',
  '欢迎来到我的 3D 世界！',
  '我会盯着你看，你知道吗？👀',
  '这个页面是用 React Three Fiber 做的',
  '数字人也可以很可爱吧？💜',
  '我的眼睛会跟随鼠标移动哦',
  '点击我试试看！',
  '你好呀！很高兴见到你~',
  '今天天气怎么样？',
  '你想聊些什么呢？',
  '我还可以眨眼哦！✨',
  '这个场景有粒子特效~',
]

export default function Stage({ onSpeak }) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechText, setSpeechText] = useState('')
  const charRef = useRef()
  const blinkCount = useRef(0)

  // 点击说话
  const handleClick = () => {
    const next = PHRASES[Math.floor(Math.random() * PHRASES.length)]
    setSpeechText(next)
    setIsSpeaking(true)
    onSpeak?.(next)
  }

  // 说话结束后关闭
  useFrame((state) => {
    if (isSpeaking && speechText) {
      if (state.clock.elapsedTime % 3.5 > 3.2) {
        setIsSpeaking(false)
        setSpeechText('')
      }
    }
  })

  return (
    <>
      {/* 光照 */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 8, 5]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-4, 3, -3]} intensity={0.6} color="#818cf8" />
      <pointLight position={[4, 3, -3]} intensity={0.4} color="#f472b6" />
      <spotLight position={[0, 6, 4]} intensity={0.5} angle={0.4} penumbra={0.5} color="#fef3c7" />

      <Sparkles count={25} />

      <group ref={charRef} onClick={handleClick} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }} onPointerOut={() => { document.body.style.cursor = 'default' }}>
        <SpeechBubble text={speechText} visible={isSpeaking} />
        <Head isSpeaking={isSpeaking} onBlink={() => { blinkCount.current++ }} />
        <Body />
      </group>

      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[12, 64]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>
      {/* 圆形光圈 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[1.5, 1.6, 64]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.3} side={2} />
      </mesh>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.6} blur={2.5} scale={10} far={4} />
    </>
  )
}