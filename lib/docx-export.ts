import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  AlignmentType,
  PageBreak,
  TabStopType,
} from 'docx'

// Parse a single line of markdown-ish text into TextRun[] handling **bold**.
// Strips the asterisks and applies real bold formatting.
function runsFor(line: string): TextRun[] {
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
  if (parts.length === 0) return [new TextRun({ text: '' })]
  return parts.map((p) => {
    const m = p.match(/^\*\*([^*]+)\*\*$/)
    if (m) return new TextRun({ text: m[1], bold: true })
    return new TextRun({ text: p })
  })
}

// Italic note (used for the "context" lines under questions).
function italicRunsFor(line: string): TextRun[] {
  return runsFor(line).map(() => null as unknown) // placeholder — replaced below
    .map((_, i, _arr) => {
      const _u = _arr // satisfy ts
      void _u
      // Re-derive with italic
      const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
      const part = parts[i]
      const m = part?.match(/^\*\*([^*]+)\*\*$/)
      if (m) return new TextRun({ text: m[1], bold: true, italics: true })
      return new TextRun({ text: part ?? '', italics: true })
    })
}

interface DocxOpts {
  title: string
  subtitle?: string
}

// Generate a polished, Apple-clean .docx from the script markdown and download it.
// Heading hierarchy is mapped to real Word headings (large, bold). Lines starting
// with "HOST:" get styled as cue lines. Bullets render as proper bullets.
export async function downloadScriptDocx(opts: DocxOpts, markdown: string) {
  const children: Paragraph[] = []

  // Cover / title page
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 240 },
      children: [new TextRun({ text: opts.title, bold: true, size: 72 })],
    })
  )
  if (opts.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
        children: [new TextRun({ text: opts.subtitle, size: 28, color: '6B6B72' })],
      })
    )
  }
  children.push(new Paragraph({ children: [new PageBreak()] }))

  // Body — convert each line.
  const lines = markdown.split('\n')
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')

    // Headings — strip the # and any surrounding **.
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const text = h[2].replace(/^\*\*|\*\*$/g, '').trim()
      const sizeByLevel = [48, 40, 32, 26][level - 1] ?? 26
      const headingLevel = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][level - 1]
      children.push(
        new Paragraph({
          heading: headingLevel,
          spacing: { before: 360, after: 160 },
          children: [new TextRun({ text, bold: true, size: sizeByLevel })],
        })
      )
      continue
    }

    // Blank lines → preserve as visual rhythm.
    if (!line.trim()) {
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }))
      continue
    }

    // "HOST:" cue lines → tinted, bold label.
    const host = line.match(/^HOST:\s*(.*)$/)
    if (host) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 80 },
          children: [
            new TextRun({ text: 'HOST  ', bold: true, color: 'A78BFA' }),
            ...runsFor(host[1]),
          ],
        })
      )
      continue
    }

    // Bullets ("- ", "* ").
    const bullet = line.match(/^\s*[-*]\s+(.*)$/)
    if (bullet) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: runsFor(bullet[1]),
        })
      )
      continue
    }

    // Italic context note (often starts with "(context:" or "Context:") — keep readable.
    const ctx = line.match(/^\s*(Context:|Why:)\s*(.*)$/)
    if (ctx) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${ctx[1]} `, bold: true, italics: true, color: '6B6B72' }),
            ...runsFor(ctx[2]).map(
              (r) => new TextRun({ text: (r as unknown as { text: string }).text, italics: true, color: '6B6B72' })
            ),
          ],
        })
      )
      continue
    }

    // Default paragraph.
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: runsFor(line),
      })
    )
  }

  const doc = new Document({
    creator: 'Ba Studio',
    title: opts.title,
    styles: {
      default: {
        document: {
          run: { font: 'Inter', size: 22 },
          paragraph: { spacing: { line: 320 } },
        },
      },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
        children,
      },
    ],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${opts.title.replace(/[^a-z0-9]+/gi, '-')}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
