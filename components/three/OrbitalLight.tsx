'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface OrbitalLightProps {
  color: string
  intensity: number
  period: number
  phase?: number
  radius?: number
  height?: number
}

export function OrbitalLight({
  color,
  intensity,
  period,
  phase = 0,
  radius = 3.5,
  height = 1.5,
}: OrbitalLightProps) {
  const ref = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = (clock.getElapsedTime() / period) * Math.PI * 2 + phase
    ref.current.position.x = Math.cos(t) * radius
    ref.current.position.z = Math.sin(t) * radius * 0.6
    ref.current.position.y = Math.sin(t * 0.5) * height
  })

  return <pointLight ref={ref} color={color} intensity={intensity} distance={12} decay={2} />
}
