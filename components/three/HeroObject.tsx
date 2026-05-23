'use client'

import { useRef, useEffect, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, MeshDistortMaterial } from '@react-three/drei'
import * as THREE from 'three'

interface HeroObjectProps {
  scrollProgressRef: RefObject<number>
}

export function HeroObject({ scrollProgressRef }: HeroObjectProps) {
  const groupRef = useRef<THREE.Group>(null)
  const micRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const backdropRef = useRef<THREE.Mesh>(null)
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

    // Idle rotation
    groupRef.current.rotation.y += delta * 0.06

    // Mouse parallax — lerp toward target
    targetRotation.current.x +=
      (mouse.current.y * 0.14 - targetRotation.current.x) * 0.08
    targetRotation.current.y +=
      (mouse.current.x * 0.14 - targetRotation.current.y) * 0.08

    groupRef.current.rotation.x = THREE.MathUtils.clamp(
      targetRotation.current.x,
      -0.14,
      0.14
    )

    // Scroll behaviour: scale down + translate
    const scale = 1 - scrollProgress * 0.38
    groupRef.current.scale.setScalar(Math.max(0.1, scale))
    groupRef.current.position.y = scrollProgress * -2.0

    // Ring rotates to face-on at scroll > 0.5
    if (ringRef.current) {
      ringRef.current.rotation.x = scrollProgress * (Math.PI / 3)
    }
  })

  return (
    <group ref={groupRef}>
      {/* Backdrop sphere */}
      <mesh ref={backdropRef}>
        <sphereGeometry args={[1.8, 32, 32]} />
        <meshStandardMaterial
          color="#0a0a10"
          emissive="#0a0a10"
          emissiveIntensity={0.2}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Mic capsule body */}
      <mesh ref={micRef} position={[0, 0, 0]}>
        <capsuleGeometry args={[0.45, 1.6, 16, 32]} />
        <meshPhysicalMaterial
          color="#1a1a1e"
          roughness={0.18}
          metalness={0.9}
          clearcoat={1.0}
          clearcoatRoughness={0.04}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* DNA ring — torus halo */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.02, 32, 200]} />
        <meshPhysicalMaterial
          color="#c4b5fd"
          roughness={0.1}
          metalness={0.6}
          emissive="#7c3aed"
          emissiveIntensity={0.4}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Second ring slightly tilted */}
      <mesh rotation={[Math.PI / 2.4, 0.3, 0]}>
        <torusGeometry args={[1.15, 0.012, 24, 160]} />
        <meshPhysicalMaterial
          color="#67e8f9"
          roughness={0.1}
          metalness={0.5}
          emissive="#0e7490"
          emissiveIntensity={0.3}
          transparent
          opacity={0.5}
        />
      </mesh>

      <Environment preset="city" />
    </group>
  )
}
