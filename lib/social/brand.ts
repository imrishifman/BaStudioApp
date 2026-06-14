// Brand tokens + the Broadcast-b logo, for the renderer.
// Mirrors ~/Documents/Ba Studio/Marketing/brand-design-spec.md exactly.

export const TOKENS = {
  coral: '#FF5C3C',
  ink: '#0E1117',
  cloud: '#F6F3EE',
  indigo: '#4B43FF',
  slateLight: '#6B7280', // secondary text on light
  slateDark: '#8A93A3', // secondary text on dark
  cardDark: '#151A23',
  chipDark: '#2A3140',
  white: '#FFFFFF',
} as const

// The Broadcast-b mark, recolorable. viewBox 0 0 190 220, all one color.
// small=true drops the second arc and thickens the first (favicon rule).
export function broadcastBSvg(color: string, small = false): string {
  const arc1Width = small ? 14 : 11
  const arc2 = small
    ? ''
    : `<path d="M 152 100 A 78 78 0 0 1 152 204" stroke="${color}" stroke-width="11" stroke-linecap="round" opacity="0.45"/>`
  return `<svg width="190" height="220" viewBox="0 0 190 220" xmlns="http://www.w3.org/2000/svg" fill="none"><rect x="6" y="8" width="18" height="204" rx="9" fill="${color}"/><circle cx="70" cy="152" r="46" stroke="${color}" stroke-width="17" fill="none"/><path d="M 132 116 A 52 52 0 0 1 132 188" stroke="${color}" stroke-width="${arc1Width}" stroke-linecap="round" fill="none" opacity="0.75"/>${arc2}</svg>`
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
