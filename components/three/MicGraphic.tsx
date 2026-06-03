'use client'

import { motion } from 'framer-motion'

// A crisp, always-visible microphone for mobile and for any environment where
// WebGL is unavailable or its context is lost. No GPU dependency. Shared by the
// hero canvas and the "How it works" canvas as their static fallback.
export function MicGraphic({ anchorTop = false }: { anchorTop?: boolean }) {
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
