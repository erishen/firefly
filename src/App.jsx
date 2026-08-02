import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import Stage from './components/Stage'
import './styles.css'

export default function App() {
  return (
    <>
      <div className="overlay">
        <h1>✨ 3D 数字人 Demo</h1>
        <span className="hint">点击数字人说话 · 拖拽旋转 · 滚轮缩放 · 观察眼神跟随</span>
      </div>
      <Canvas shadows camera={{ position: [0, 1.2, 4.5], fov: 40 }}>
        <Stage />
        <OrbitControls makeDefault enableDamping dampingFactor={0.05} autoRotate autoRotateSpeed={0.8} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 2.2} />
      </Canvas>
    </>
  )
}