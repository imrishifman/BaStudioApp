import { Document, Packer, Paragraph, HeadingLevel, TextRun } from 'docx'

// Convert a markdown-ish script into a .docx and trigger a download. Handles
// #/##/### headings and plain paragraphs — enough for the script document.
export async function downloadScriptDocx(title: string, markdown: string) {
  const children = markdown.split('\n').map((line) => {
    if (line.startsWith('### ')) return new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 })
    if (line.startsWith('## ')) return new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 })
    if (line.startsWith('# ')) return new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 })
    return new Paragraph({ children: [new TextRun(line)] })
  })

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-z0-9]+/gi, '-')}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
