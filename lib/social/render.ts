// Renders a PostSpec to a 1080x1350 PNG, reproducing the BaStudio post system
// (brand-design-spec.md): logo lockup, coral eyebrow, headline with a one-phrase
// coral break, sub-line, a vector diagram of the claim, caption, and the CTA
// pill. Satori (VDOM -> SVG) + resvg (SVG -> PNG). No JSX, plain object VDOM.

import satori from 'satori'
import { Resvg } from '@resvg/resvg-js'
import sharp from 'sharp'
import { getFonts } from './fonts'
import { TOKENS, broadcastBSvg, svgDataUri } from './brand'
import type { PostSpec, DiagramSpec } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type VNode = { type: string; props: Record<string, any> }
const el = (type: string, style: Record<string, any>, children?: any): VNode => ({
  type,
  props: children === undefined ? { style } : { style, children },
})
const img = (src: string, style: Record<string, any>): VNode => ({
  type: 'img',
  props: { src, style },
})

function palette(bg: 'ink' | 'cloud') {
  const dark = bg === 'ink'
  return {
    background: dark ? TOKENS.ink : TOKENS.cloud,
    text: dark ? TOKENS.cloud : TOKENS.ink,
    slate: dark ? TOKENS.slateDark : TOKENS.slateLight,
    coral: TOKENS.coral,
    pillBg: dark ? TOKENS.coral : TOKENS.ink,
    pillText: dark ? TOKENS.ink : TOKENS.cloud,
    card: dark ? TOKENS.cardDark : TOKENS.white,
    muted: dark ? TOKENS.slateDark : TOKENS.slateLight,
    dark,
  }
}

// Headline split into word spans, coloring the words covered by coralPhrase.
function headlineNode(spec: PostSpec, p: ReturnType<typeof palette>): VNode {
  const { headline, coralPhrase } = spec
  const start = coralPhrase ? headline.indexOf(coralPhrase) : -1
  const end = start >= 0 ? start + coralPhrase.length : -1
  const words: VNode[] = []
  let offset = 0
  for (const word of headline.split(' ')) {
    const wStart = offset
    const wEnd = offset + word.length
    const isCoral = start >= 0 && wStart < end && wEnd > start
    words.push(
      el('div', { color: isCoral ? p.coral : p.text, marginRight: 22 }, word),
    )
    offset = wEnd + 1 // + space
  }
  return el(
    'div',
    {
      display: 'flex',
      flexWrap: 'wrap',
      fontFamily: 'Space Grotesk',
      fontWeight: 700,
      // Headline is the hero: scale it up, bigger when the line is shorter.
      fontSize:
        spec.headline.length <= 16
          ? 132
          : spec.headline.length <= 28
            ? 112
            : spec.headline.length <= 42
              ? 94
              : 80,
      lineHeight: 1.04,
      letterSpacing: -3,
      marginTop: 28,
    },
    words,
  )
}

function bar(width: number, height: number, color: string, opacity = 1): VNode {
  return el('div', {
    width,
    height,
    borderRadius: height / 2,
    backgroundColor: color,
    opacity,
    marginBottom: 0,
  })
}

function diagramNode(d: DiagramSpec, p: ReturnType<typeof palette>): VNode {
  const center = {
    display: 'flex',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 36,
    marginBottom: 12,
  }
  switch (d.type) {
    case 'signal': {
      const svg = broadcastBSvg(p.coral)
      return el('div', center, [img(svgDataUri(svg), { width: 280, height: 324 })])
    }
    case 'numbered_rows': {
      const rows = d.rows ?? 5
      const coralRow = d.coralRow ?? 3
      const widths = [740, 700, 730, 690, 710, 720, 680]
      const items: VNode[] = []
      for (let i = 0; i < rows; i++) {
        const isC = i + 1 === coralRow
        items.push(
          el(
            'div',
            { display: 'flex', alignItems: 'center', marginBottom: 30 },
            [
              el(
                'div',
                {
                  width: 70,
                  fontFamily: 'Space Grotesk',
                  fontWeight: 700,
                  fontSize: 34,
                  color: isC ? p.coral : p.muted,
                  opacity: isC ? 1 : 0.55,
                },
                '0' + (i + 1),
              ),
              bar(widths[i % widths.length], isC ? 22 : 18, isC ? p.coral : p.muted, isC ? 1 : 0.2),
            ],
          ),
        )
      }
      return el('div', { ...center, alignItems: 'flex-start', flexDirection: 'column', justifyContent: 'center' }, items)
    }
    case 'dots': {
      const total = d.totalUnits ?? 10
      const coral = d.coralUnits ?? 9
      const dots: VNode[] = []
      for (let i = 0; i < total; i++) {
        dots.push(
          el('div', {
            width: 70,
            height: 70,
            borderRadius: 35,
            backgroundColor: i < coral ? p.coral : p.muted,
            opacity: i < coral ? 1 : 0.25,
            marginRight: i === total - 1 ? 0 : 20,
          }),
        )
      }
      return el('div', center, [el('div', { display: 'flex', flexWrap: 'wrap', maxWidth: 936, justifyContent: 'center' }, dots)])
    }
    case 'card': {
      const lines = [720, 650, 700].map((w) =>
        el('div', { width: w, height: 14, borderRadius: 7, backgroundColor: p.muted, opacity: 0.22, marginBottom: 20 }, undefined),
      )
      return el('div', center, [
        el(
          'div',
          { display: 'flex', flexDirection: 'column', width: 840, padding: 40, borderRadius: 28, backgroundColor: p.card },
          [
            el('div', { display: 'flex', alignItems: 'center', marginBottom: 28 }, [
              el('div', { width: 14, height: 14, borderRadius: 3, backgroundColor: p.coral, marginRight: 12 }, undefined),
              el('div', { fontFamily: 'Inter', fontWeight: 600, fontSize: 18, letterSpacing: 3, color: p.slate }, (d.cardLabel ?? 'GUEST DOSSIER').toUpperCase()),
            ]),
            ...lines,
            el('div', { width: 560, height: 18, borderRadius: 9, backgroundColor: p.coral }, undefined),
          ],
        ),
      ])
    }
    case 'comparison': {
      const panel = (label: string, coral: boolean): VNode => {
        const bars: VNode[] = []
        for (let i = 0; i < 12; i++) {
          const h = coral ? 30 + ((i * 37) % 90) : 40
          bars.push(el('div', { width: 12, height: h, borderRadius: 6, backgroundColor: coral ? p.coral : p.muted, opacity: coral ? 1 : 0.3, marginRight: 8 }))
        }
        return el(
          'div',
          { display: 'flex', flexDirection: 'column', width: 420, height: 360, padding: 36, borderRadius: 28, backgroundColor: p.card, marginRight: coral ? 0 : 24 },
          [
            el('div', { fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 40, color: coral ? p.coral : p.slate, marginBottom: 'auto' }, label),
            el('div', { display: 'flex', alignItems: 'flex-end', height: 130 }, bars),
          ],
        )
      }
      return el('div', center, [el('div', { display: 'flex' }, [panel(d.leftLabel ?? 'Before', false), panel(d.rightLabel ?? 'After', true)])])
    }
    case 'stat':
    default: {
      const total = d.totalUnits ?? 36
      const coral = d.coralUnits ?? 6
      const cells: VNode[] = []
      for (let i = 0; i < total; i++) {
        cells.push(el('div', { width: 54, height: 54, borderRadius: 12, backgroundColor: i < coral ? p.coral : p.muted, opacity: i < coral ? 1 : 0.2, marginRight: 10, marginBottom: 10 }))
      }
      return el('div', { ...center, flexDirection: 'column' }, [
        el('div', { fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 150, color: p.coral, lineHeight: 1 }, d.bigNumber ?? ''),
        d.unit ? el('div', { fontFamily: 'Inter', fontWeight: 600, fontSize: 24, letterSpacing: 4, color: p.slate, marginTop: 6, marginBottom: 28 }, d.unit.toUpperCase()) : el('div', { height: 28 }, undefined),
        el('div', { display: 'flex', flexWrap: 'wrap', maxWidth: 768, justifyContent: 'center' }, cells),
      ])
    }
  }
}

function tree(spec: PostSpec): VNode {
  const p = palette(spec.bg)
  return el(
    'div',
    {
      width: 1080,
      height: 1350,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: p.background,
      padding: '64px 72px',
      fontFamily: 'Inter',
    },
    [
      // logo lockup
      el('div', { display: 'flex', alignItems: 'center' }, [
        img(svgDataUri(broadcastBSvg(p.coral)), { width: 38, height: 44, marginRight: 16 }),
        el('div', { fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 30, letterSpacing: -0.5, color: p.text }, 'ba studio'),
      ]),
      // eyebrow
      el('div', { fontFamily: 'Inter', fontWeight: 600, fontSize: 22, letterSpacing: 5, color: p.coral, marginTop: 90 }, spec.eyebrow.toUpperCase()),
      // headline
      headlineNode(spec, p),
      // sub-line
      el('div', { fontFamily: 'Space Grotesk', fontWeight: 500, fontSize: 42, letterSpacing: -0.5, color: p.slate, marginTop: 26, maxWidth: 936 }, spec.subline),
      // diagram (grows to fill)
      diagramNode(spec.diagram, p),
      // (no caption on the image — it goes in the Instagram post text. Keep the image minimal.)
      // CTA pill
      el('div', { display: 'flex', alignSelf: 'center', marginTop: 28, backgroundColor: p.pillBg, borderRadius: 999, paddingTop: 22, paddingBottom: 22, paddingLeft: 48, paddingRight: 48 }, [
        el('div', { fontFamily: 'Inter', fontWeight: 600, fontSize: 26, color: p.pillText }, `${spec.ctaVerb} · bastudiopodcast.com`),
      ]),
    ],
  )
}

export async function renderPost(spec: PostSpec): Promise<Buffer> {
  const fonts = await getFonts()
  const svg = await satori(tree(spec) as unknown as React.ReactNode, {
    width: 1080,
    height: 1350,
    fonts: fonts as never,
  })
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } })
  const png = Buffer.from(resvg.render().asPng())
  // Instagram's content-publishing API requires JPEG, so convert before upload.
  return sharp(png).jpeg({ quality: 90 }).toBuffer()
}
