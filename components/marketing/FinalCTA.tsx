'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

export function FinalCTA() {
  return (
    <section
      className="mx-auto max-w-[1240px] text-center"
      style={{ padding: '0 clamp(20px, 5vw, 80px) clamp(96px, 12vw, 200px)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-15%' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center gap-8"
      >
        <h2 className="display-lg text-gradient">
          Your next episode
          <br />
          starts here.
        </h2>

        <Link
          href="/?signin=1"
          className="pill-primary pill-primary-lg group inline-flex items-center gap-2"
        >
          Get started free
          <ArrowRight
            size={16}
            className="transition-transform duration-240 group-hover:translate-x-1"
          />
        </Link>

        <p className="body-sm text-[var(--ink-3)]">No credit card required.</p>
      </motion.div>
    </section>
  )
}
