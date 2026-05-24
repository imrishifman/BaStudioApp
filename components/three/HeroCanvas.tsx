'use client'

import { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { motion } from 'framer-motion'
import { HeroObject } from './HeroObject'
import { OrbitalLight } from './OrbitalLight'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { useScroll } from 'framer-motion'

// A crisp, always-visible microphone for mobile and for any environment where
// WebGL is unavailable or its context is lost. No GPU dependency.
function MicGraphic({ anchorTop = false }: { anchorTop?: boolean }) {
  return (
    <div
      className={`pointer-events-none flex h-full justify-center ${
        anchorTop ? 'items-start pt-16' : 'items-center'
      }`}
    >
      <motion.svg
        width="220"
        height="380"
        viewBox="0 0 200 380"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-auto ${anchorTop ? 'max-h-[32vh]' : 'max-h-[60vh]'}`}
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
      >
        <defs>
          <linearGradient id="micHead" x1="40" y1="24" x2="160" y2="204" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#c4b5fd" />
            <stop offset="0.55" stopColor="#a78bfa" />
            <stop offset="1" stopColor="#67e8f9" />
          </linearGradient>
          <linearGradient id="micHandle" x1="0" y1="220" x2="0" y2="342" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#2a2a32" />
            <stop offset="1" stopColor="#141419" />
          </linearGradient>
          <radialGradient id="micGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="rgba(167,139,250,0.45)" />
            <stop offset="1" stopColor="rgba(167,139,250,0)" />
          </radialGradient>
        </defs>

        {/* Ambient glow halo */}
        <ellipse cx="100" cy="150" rx="130" ry="160" fill="url(#micGlow)" />

        {/* Microphone head */}
        <rect x="58" y="24" width="84" height="180" rx="42" fill="url(#micHead)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />

        {/* Grille mesh */}
        {[58, 82, 106, 130, 154, 178].map((y) => (
          <line key={y} x1="66" y1={y} x2="134" y2={y} stroke="rgba(10,10,16,0.28)" strokeWidth="3" strokeLinecap="round" />
        ))}
        <ellipse cx="100" cy="66" rx="42" ry="11" fill="none" stroke="rgba(103,232,249,0.7)" strokeWidth="2" />

        {/* Band */}
        <rect x="74" y="206" width="52" height="16" rx="8" fill="url(#micHandle)" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

        {/* Neck */}
        <rect x="88" y="221" width="24" height="20" fill="#1a1a1e" />

        {/* Handle */}
        <path d="M86 240 L114 240 L108 334 Q100 344 92 334 Z" fill="url(#micHandle)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

        {/* Glowing base ring */}
        <ellipse cx="100" cy="336" rx="30" ry="8" fill="none" stroke="#a78bfa" strokeWidth="3" opacity="0.9" />
      </motion.svg>
    </div>
  )
}

export function HeroCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  // Scroll progress is carried in a ref (read inside useFrame) so scrolling
  // never triggers a React re-render of the <Canvas> subtree.
  const scrollProgressRef = useRef(0)
  const { scrollY } = useScroll()
  const [isMobile, setIsMobile] = useState(false)
  // null = checking, true = WebGL usable, false = unavailable/lost → fallback
  const [webglOk, setWebglOk] = useState<boolean | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    // Detect WebGL support once, up front, so an unsupported environment
    // shows the static mic instead of attempting (and failing) to render.
    try {
      const probe = document.createElement('canvas')
      const gl = probe.getContext('webgl2') || probe.getContext('webgl')
      setWebglOk(!!gl)
    } catch {
      setWebglOk(false)
    }
  }, [])

  useEffect(() => {
    return scrollY.on('change', (v) => {
      const vh = window.innerHeight || 1
      const p = Math.min(1, Math.max(0, v / vh))
      scrollProgressRef.current = p
    })
  }, [scrollY])

  // Mobile: WebGL on phones is unreliable (context loss under memory pressure),
  // so always show the static mic — it's guaranteed to display.
  if (isMobile) {
    return (
      <div ref={canvasRef} className="relative h-full w-full">
        <MicGraphic anchorTop />
      </div>
    )
  }

  // No WebGL, still probing, or the context dropped → static mic.
  if (webglOk !== true) {
    return (
      <div ref={canvasRef} className="relative h-full w-full">
        <MicGraphic />
      </div>
    )
  }

  return (
    <div ref={canvasRef} className="relative h-full w-full">
      <CanvasErrorBoundary fallback={<MicGraphic />}>
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 5], fov: 45 }}
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => {
            // If the GPU context drops, fall back to the static mic
            // instead of leaving a frozen/blank canvas — and never crash.
            gl.domElement.addEventListener(
              'webglcontextlost',
              (e) => {
                e.preventDefault()
                setWebglOk(false)
              },
              false
            )
          }}
        >
          <ambientLight intensity={0.06} />

          {/* Three orbital coloured lights */}
          <OrbitalLight color="#A78BFA" intensity={8} period={14} phase={0} />
          <OrbitalLight color="#67E8F9" intensity={7} period={18} phase={2.1} />
          <OrbitalLight color="#FBA5C9" intensity={6} period={22} phase={4.2} />

          <HeroObject scrollProgressRef={scrollProgressRef} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  )
}
