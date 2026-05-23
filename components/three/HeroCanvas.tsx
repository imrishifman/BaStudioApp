'use client'

import { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { HeroObject } from './HeroObject'
import { OrbitalLight } from './OrbitalLight'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { useScroll } from 'framer-motion'

function AmbientFallback() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{
        background:
          'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(167,139,250,0.10) 0%, transparent 70%)',
      }}
    >
      <div
        className="h-72 w-72 rounded-full opacity-25 blur-3xl"
        style={{ background: 'var(--accent-violet)' }}
      />
    </div>
  )
}

export function HeroCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
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
    // shows the static fallback instead of attempting (and failing) to render.
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
      // Imperatively fade the mobile fallback without a re-render.
      if (svgRef.current) {
        svgRef.current.style.opacity = String(Math.max(0, 1 - p * 2))
      }
    })
  }, [scrollY])

  if (isMobile) {
    return (
      <div className="flex h-full items-center justify-center" ref={canvasRef}>
        {/* CSS-only SVG fallback for mobile */}
        <svg
          ref={svgRef}
          width="260"
          height="320"
          viewBox="0 0 260 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ opacity: 1 }}
        >
          {/* Mic silhouette */}
          <rect x="95" y="40" width="70" height="160" rx="35" fill="rgba(167,139,250,0.12)" stroke="rgba(167,139,250,0.3)" strokeWidth="1" />
          {/* DNA ring */}
          <ellipse cx="130" cy="200" rx="90" ry="18" stroke="rgba(103,232,249,0.4)" strokeWidth="1.5" fill="none" />
          {/* Top ring */}
          <ellipse cx="130" cy="120" rx="100" ry="20" stroke="rgba(251,165,201,0.3)" strokeWidth="1" fill="none" />
        </svg>
      </div>
    )
  }

  // No WebGL (or it dropped) → static gradient instead of a broken/blank canvas.
  if (webglOk === false) {
    return (
      <div ref={canvasRef} className="relative h-full w-full">
        <AmbientFallback />
      </div>
    )
  }

  // Still probing support — render the ambient gradient as a placeholder.
  if (webglOk === null) {
    return (
      <div ref={canvasRef} className="relative h-full w-full">
        <AmbientFallback />
      </div>
    )
  }

  return (
    <div ref={canvasRef} className="relative h-full w-full">
      <CanvasErrorBoundary fallback={<AmbientFallback />}>
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 5], fov: 45 }}
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => {
            // If the GPU context drops, fall back to the static gradient
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
