'use client'

import { useRef, useState, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitalLight } from './OrbitalLight'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { TravelingMic } from './TravelingMic'
import { MicGraphic } from './MicGraphic'

// One shared mic that lives across the hero and "How it works". It starts
// centered and large in the hero, then glides down to the right column of
// "How it works" as you scroll, rotating and lighting up along the way.
//
// The shell is `position: sticky` with a negative bottom margin so it takes up
// no layout height (the hero draws over it) yet stays pinned through both
// sections, releasing only when the shared wrapper ends.
export function TravelingMicCanvas() {
  // 0 = centered in the hero, 1 = docked on the right of "How it works".
  const travelRef = useRef(0)
  // 0..1 progress through the "How it works" steps.
  const workRef = useRef(0)
  // The sticky shell element — on mobile we blur + fade it via inline styles so
  // the overlapping step text stays legible and the mic bows out with step 4.
  const shellRef = useRef<HTMLDivElement>(null)

  // null = checking, true = WebGL usable, false = unavailable/lost → fallback
  const [webglOk, setWebglOk] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      const probe = document.createElement('canvas')
      const gl = probe.getContext('webgl2') || probe.getContext('webgl')
      setWebglOk(!!gl)
    } catch {
      setWebglOk(false)
    }
  }, [])

  // Drive the two refs from window scroll. travelRef ramps from 0→1 as the
  // "How it works" section scrolls up to the top of the viewport; workRef then
  // tracks progress through the (sticky) section itself.
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const hiw = document.getElementById('how-it-works')
      const vh = window.innerHeight || 1
      const y = window.scrollY || window.pageYOffset || 0
      if (!hiw) {
        travelRef.current = 0
        workRef.current = 0
        return
      }
      const hiwTop = hiw.getBoundingClientRect().top + y
      const travel = hiwTop > 0 ? Math.min(1, Math.max(0, y / hiwTop)) : 1
      const span = hiw.offsetHeight - vh
      const work = span > 0 ? Math.min(1, Math.max(0, (y - hiwTop) / span)) : 0
      travelRef.current = travel
      workRef.current = work

      // Mobile only: the mic stays centered (it never docks right on narrow
      // screens), so it sits behind the step text. Blur it for legibility as it
      // enters the section, and fade it out in sync with step 4's reveal so it
      // bows out instead of flying off the side.
      const el = shellRef.current
      if (el) {
        if (window.innerWidth < 768) {
          const blur = (travel * 7).toFixed(2)
          el.style.filter = `blur(${blur}px)`
          // Step 4 fades in over work [0.72, 0.88]; mirror that to fade the mic out.
          const fade = Math.min(1, Math.max(0, (work - 0.72) / 0.16))
          el.style.opacity = String(1 - fade)
        } else if (el.style.filter || el.style.opacity) {
          el.style.filter = ''
          el.style.opacity = ''
        }
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // The sticky shell: pinned for the whole hero + how-it-works wrapper, with a
  // negative bottom margin so it contributes no height of its own.
  const shell = 'pointer-events-none sticky top-0 z-[1] h-screen w-full'
  const shellStyle = { marginBottom: '-100vh' as const }

  // While probing, render a neutral glow (avoids a flash of the flat SVG mic).
  if (webglOk === null) {
    return (
      <div ref={shellRef} className={shell} style={shellStyle}>
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="h-64 w-64 rounded-full opacity-20 blur-3xl"
            style={{ background: 'var(--accent-violet)' }}
          />
        </div>
      </div>
    )
  }

  if (webglOk === false) {
    return (
      <div ref={shellRef} className={shell} style={shellStyle}>
        <MicGraphic />
      </div>
    )
  }

  return (
    <div ref={shellRef} className={shell} style={shellStyle}>
      <CanvasErrorBoundary fallback={<MicGraphic />}>
        <Canvas
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          camera={{ position: [0, 0, 5], fov: 45 }}
          style={{ background: 'transparent' }}
          onCreated={({ gl }) => {
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

          {/* Three orbital coloured lights, matching the hero */}
          <OrbitalLight color="#A78BFA" intensity={8} period={14} phase={0} />
          <OrbitalLight color="#67E8F9" intensity={7} period={18} phase={2.1} />
          <OrbitalLight color="#FBA5C9" intensity={6} period={22} phase={4.2} />

          <TravelingMic travelRef={travelRef} workRef={workRef} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  )
}
