'use client'

import { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { useInView } from 'framer-motion'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { HeroObject } from './HeroObject'
import { OrbitalLight } from './OrbitalLight'
import { useScroll, useTransform } from 'framer-motion'

function useScrollProgress() {
  const { scrollY } = useScroll()
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    return scrollY.on('change', (v) => {
      const vh = window.innerHeight
      setProgress(Math.min(1, Math.max(0, v / vh)))
    })
  }, [scrollY])

  return progress
}

export function HeroCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const inView = useInView(canvasRef, { margin: '200px' })
  const scrollProgress = useScrollProgress()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    setIsMobile(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (isMobile) {
    return (
      <div className="flex h-full items-center justify-center" ref={canvasRef}>
        {/* CSS-only SVG fallback for mobile */}
        <svg
          width="260"
          height="320"
          viewBox="0 0 260 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ opacity: Math.max(0, 1 - scrollProgress * 2) }}
        >
          {/* Mic silhouette */}
          <rect x="95" y="40" width="70" height="160" rx="35" fill="rgba(167,139,250,0.12)" stroke="rgba(167,139,250,0.3)" strokeWidth="1" />
          {/* DNA ring */}
          <ellipse cx="130" cy="200" rx="90" ry="18" stroke="rgba(103,232,249,0.4)" strokeWidth="1.5" fill="none" />
          {/* Top ring */}
          <ellipse cx="130" cy="120" rx="100" ry="20" stroke="rgba(251,165,201,0.3)" strokeWidth="1" fill="none" />
          <style>{`
            @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          `}</style>
        </svg>
      </div>
    )
  }

  return (
    <div ref={canvasRef} className="h-full w-full">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0, 5], fov: 45 }}
        frameloop={inView ? 'always' : 'demand'}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.06} />

        {/* Three orbital coloured lights */}
        <OrbitalLight color="#A78BFA" intensity={8} period={14} phase={0} />
        <OrbitalLight color="#67E8F9" intensity={7} period={18} phase={2.1} />
        <OrbitalLight color="#FBA5C9" intensity={6} period={22} phase={4.2} />

        <HeroObject scrollProgress={scrollProgress} />

        <EffectComposer>
          <Bloom intensity={0.6} luminanceThreshold={0.5} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  )
}
