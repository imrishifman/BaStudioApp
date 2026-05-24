'use client'

import { useRef, useEffect, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'

interface HeroObjectProps {
  scrollProgressRef: RefObject<number>
}

const GRILLE_COUNT = 7

export function HeroObject({ scrollProgressRef }: HeroObjectProps) {
  const groupRef = useRef<THREE.Group>(null)
  const mouse = useRef({ x: 0, y: 0 })
  const targetRotation = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', onMouseMove)
    return () => window.removeEventListener('mousemove', onMouseMove)
  }, [])

  useFrame((state, delta) => {
    if (!groupRef.current) return
    const scrollProgress = scrollProgressRef.current ?? 0

    // Slow idle spin
    groupRef.current.rotation.y += delta * 0.18

    // Mouse parallax tilt
    targetRotation.current.x +=
      (mouse.current.y * 0.14 - targetRotation.current.x) * 0.08
    groupRef.current.rotation.x = THREE.MathUtils.clamp(
      targetRotation.current.x,
      -0.16,
      0.16
    )

    // Scroll: scale down + drift away
    const scale = 1 - scrollProgress * 0.38
    groupRef.current.scale.setScalar(Math.max(0.1, scale))
    groupRef.current.position.y = scrollProgress * -2.0
  })

  return (
    <group ref={groupRef}>
      {/* Backdrop sphere */}
      <mesh>
        <sphereGeometry args={[1.9, 32, 32]} />
        <meshStandardMaterial
          color="#0a0a10"
          emissive="#0a0a10"
          emissiveIntensity={0.2}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>

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

      {/* Grille rings around the head */}
      {Array.from({ length: GRILLE_COUNT }).map((_, i) => {
        const y = 0.18 + (i / (GRILLE_COUNT - 1)) * 0.74
        const color = i % 2 === 0 ? '#67e8f9' : '#a78bfa'
        return (
          <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.505, 0.012, 12, 80]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.6}
              roughness={0.3}
              metalness={0.5}
            />
          </mesh>
        )
      })}

      {/* Band between head and body */}
      <mesh position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.06, 20, 64]} />
        <meshPhysicalMaterial
          color="#26262c"
          roughness={0.2}
          metalness={0.95}
          clearcoat={1}
        />
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
          color="#a78bfa"
          emissive="#7c3aed"
          emissiveIntensity={0.45}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      <Environment preset="city" />
    </group>
  )
}
