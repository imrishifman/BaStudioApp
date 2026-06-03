'use client'

import { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { HeroObject } from './HeroObject'
import { OrbitalLight } from './OrbitalLight'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { MicGraphic } from './MicGraphic'
import { useScroll } from 'framer-motion'

export function HeroCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null)
  // Scroll progress is carried in a ref (read inside useFrame) so scrolling
  // never triggers a React re-render of the <Canvas> subtree.
  const scrollProgressRef = useRef(0)
  const { scrollY } = useScroll()
  // null = checking, true = WebGL usable, false = unavailable/lost → fallback
  const [webglOk, setWebglOk] = useState<boolean | null>(null)

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

  // Still probing for WebGL support: render only a neutral glow (NOT the static
  // SVG mic). Showing the SVG here caused a visible "two mics" flash — the flat
  // mic appeared for a beat, then got replaced by the 3D mic once the probe
  // resolved. During the (sub-frame) probe we show nothing but ambient light.
  if (webglOk === null) {
    return (
      <div
        ref={canvasRef}
        className="pointer-events-none relative flex h-full w-full items-center justify-center"
      >
        <div
          className="h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: 'var(--accent-violet)' }}
        />
      </div>
    )
  }

  // WebGL genuinely unavailable or the context dropped → static SVG mic fallback.
  if (webglOk === false) {
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
            // instead of leaving a frozen/blank canvas - and never crash.
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
