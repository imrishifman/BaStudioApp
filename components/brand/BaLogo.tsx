import { Space_Grotesk } from 'next/font/google'
import { cn } from '@/lib/utils'

// The "Broadcast b" brand mark: a lowercase b whose bowl radiates two signal
// arcs (the b "transmits"). Single source of truth for the logo geometry;
// favicons and raster exports (public/logo.png, app/icon.*) are generated from
// this same art. All shapes use currentColor so the mark renders correctly in
// coral, white, or ink simply by setting the parent's text color.

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: '700' })

export const BRAND_CORAL = '#FF5C3C'

// viewBox aspect ratio: 190 wide x 220 tall.
const MARK_RATIO = 190 / 220

interface BaMarkProps {
  /** Rendered height in px (width follows the 190:220 aspect). */
  size?: number
  className?: string
}

export function BaMark({ size = 28, className }: BaMarkProps) {
  return (
    <svg
      viewBox="0 0 190 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={size * MARK_RATIO}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <rect x="6" y="8" width="18" height="204" rx="9" fill="currentColor" />
      <circle cx="70" cy="152" r="46" stroke="currentColor" strokeWidth="17" />
      <path
        className="ba-arc-1"
        d="M 132 116 A 52 52 0 0 1 132 188"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        opacity="0.75"
      />
      <path
        className="ba-arc-2"
        d="M 152 100 A 78 78 0 0 1 152 204"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  )
}

interface BaLogoProps {
  /** Mark height in px; the wordmark and gap scale with it. */
  size?: number
  className?: string
  /** Mark color; defaults to Signal Coral. Pass 'currentColor' to inherit. */
  markColor?: string
}

// Horizontal lockup: mark + lowercase "ba studio" wordmark. The wordmark
// inherits the parent's text color (set an ink/white text class on the
// parent); the mark stays Signal Coral unless overridden via markColor.
export function BaLogo({ size = 28, className, markColor = BRAND_CORAL }: BaLogoProps) {
  return (
    <span
      className={cn('inline-flex items-center', className)}
      style={{ gap: size * 0.28 }}
    >
      <span className="inline-flex shrink-0" style={{ color: markColor }}>
        <BaMark size={size} />
      </span>
      <span
        className={spaceGrotesk.className}
        style={{
          fontSize: size * 0.78,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        ba studio
      </span>
    </span>
  )
}
