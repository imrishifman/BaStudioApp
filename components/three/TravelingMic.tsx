'use client'

import { useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

interface TravelingMicProps {
  // 0 = centered & large in the hero, 1 = docked on the right of "How it works".
  travelRef: RefObject<number>
  // 0..1 progress through the "How it works" steps (drives rotation + rings).
  workRef: RefObject<number>
}

const GRILLE_COUNT = 7

// Smootherstep for a soft ease in/out along the travel path.
const smoother = (x: number) => x * x * x * (x * (x * 6 - 15) + 10)

export function TravelingMic({ travelRef, workRef }: TravelingMicProps) {
  const groupRef = useRef<THREE.Group>(null)
  const ringMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const baseMat = useRef<THREE.MeshStandardMaterial | null>(null)

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return
    const t = THREE.MathUtils.clamp(travelRef.current ?? 0, 0, 1)
    const p = THREE.MathUtils.clamp(workRef.current ?? 0, 0, 1)
    const time = state.clock.getElapsedTime()
    const ease = smoother(t)

    // Travel across the screen: centered in the hero, gliding to the right
    // column once "How it works" takes over. On narrow screens it stays centered.
    const wide = state.size.width >= 768

    // Once the steps are nearly done (last stretch of the section), the mic
    // flies out past the right edge so it exits cleanly after "How it works".
    const exit = smoother(THREE.MathUtils.clamp((p - 0.82) / 0.18, 0, 1))
    const dockX = wide ? state.viewport.width * 0.27 * ease : 0
    const exitX = wide ? exit * (state.viewport.width * 0.5 + 2) : 0
    const targetX = dockX + exitX

    // A gentle downward arc midway makes the move feel like a path, not a slide.
    const arc = -Math.sin(ease * Math.PI) * 0.25
    // Shrinks as it docks, then shrinks further as it leaves.
    const targetScale = THREE.MathUtils.lerp(1.0, wide ? 0.82 : 0.66, ease) * (1 - exit * 0.35)

    g.position.x = THREE.MathUtils.damp(g.position.x, targetX, 5, delta)
    g.position.y = THREE.MathUtils.damp(g.position.y, arc, 5, delta)
    const s = THREE.MathUtils.damp(g.scale.x, targetScale, 5, delta)
    g.scale.setScalar(s)

    // Turn the mic as you scroll through the steps (about 290°), idle drift layered on.
    const targetRotY = p * Math.PI * 1.6
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, targetRotY, 4, delta) + delta * 0.04
    g.rotation.x = Math.sin(time * 0.5) * 0.05

    // Rings light up progressively as the story advances.
    for (let i = 0; i < GRILLE_COUNT; i++) {
      const m = ringMats.current[i]
      if (!m) continue
      const threshold = i / (GRILLE_COUNT - 1)
      const lit = p + 0.06 >= threshold
      m.emissiveIntensity = THREE.MathUtils.damp(m.emissiveIntensity, lit ? 2.4 : 0.18, 6, delta)
    }

    // Base ring ramps with progress and pulses once the journey completes.
    if (baseMat.current) {
      const pulse = p > 0.82 ? 0.6 + Math.sin(time * 3) * 0.4 : 0
      baseMat.current.emissiveIntensity = THREE.MathUtils.damp(
        baseMat.current.emissiveIntensity,
        0.3 + p * 1.6 + pulse,
        6,
        delta
      )
    }
  })

  return (
    <group ref={groupRef}>
      {/* Microphone head (capsule) */}
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.5, 0.95, 24, 48]} />
        <meshPhysicalMaterial
          color="#17171c"
          roughness={0.22}
          metalness={0.95}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Grille rings around the head — these light up with scroll */}
      {Array.from({ length: GRILLE_COUNT }).map((_, i) => {
        const y = 0.18 + (i / (GRILLE_COUNT - 1)) * 0.74
        const color = i % 2 === 0 ? '#67e8f9' : '#a78bfa'
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.505, 0.014, 12, 80]} />
            <meshStandardMaterial
              ref={(m) => {
                ringMats.current[i] = m
              }}
              color={color}
              emissive={color}
              emissiveIntensity={0.18}
              roughness={0.3}
              metalness={0.5}
            />
          </mesh>
        )
      })}

      {/* Band between head and body */}
      <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.06, 20, 64]} />
        <meshPhysicalMaterial color="#26262c" roughness={0.2} metalness={0.95} clearcoat={1} />
      </mesh>

      {/* Body / handle */}
      <mesh position={[0, -0.72, 0]}>
        <cylinderGeometry args={[0.17, 0.22, 1.1, 48]} />
        <meshPhysicalMaterial
          color="#1a1a1e"
          roughness={0.25}
          metalness={0.95}
          clearcoat={1}
          clearcoatRoughness={0.06}
          envMapIntensity={1.3}
        />
      </mesh>

      {/* Glowing base ring */}
      <mesh position={[0, -1.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.22, 0.03, 16, 48]} />
        <meshStandardMaterial
          ref={(m) => {
            baseMat.current = m
          }}
          color="#a78bfa"
          emissive="#7c3aed"
          emissiveIntensity={0.45}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Reflections for the metallic mic, built entirely in-scene (no remote
          HDR fetch) so the 3D mic always renders and never drops to a fallback. */}
      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#06060c']} />
        {/* Bright soft key from above */}
        <Lightformer
          intensity={2.2}
          color="#ffffff"
          position={[0, 6, -4]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[12, 12, 1]}
        />
        {/* Coloured rim reflections matching the brand accents */}
        <Lightformer
          intensity={2}
          color="#a78bfa"
          position={[-6, 1, 3]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[6, 8, 1]}
        />
        <Lightformer
          intensity={2}
          color="#67e8f9"
          position={[6, 0, 3]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[6, 8, 1]}
        />
        <Lightformer
          intensity={1.2}
          color="#fba5c9"
          position={[0, -4, 4]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[8, 8, 1]}
        />
      </Environment>
    </group>
  )
}
