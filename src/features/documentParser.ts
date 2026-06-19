import * as pdfjs from 'pdfjs-dist'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const TEXT_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
  'text/json',
])

const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv'])

export function isSupportedDocument(file: File): boolean {
  if (TEXT_TYPES.has(file.type)) return true
  if (file.type === 'application/pdf') return true
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  return TEXT_EXTENSIONS.has(ext)
}

async function parsePdf(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    pages.push(text)
  }

  return pages.join('\n\n')
}

export async function extractDocumentText(file: File): Promise<string> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return parsePdf(file)
  }
  return file.text()
}
