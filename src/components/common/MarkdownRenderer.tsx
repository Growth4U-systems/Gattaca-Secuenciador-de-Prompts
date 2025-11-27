'use client'

import { useMemo } from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

interface TableData {
  headers: string[]
  rows: string[][]
}

// Extract all tables from markdown content
export function extractTables(content: string): TableData[] {
  const tables: TableData[] = []
  const lines = content.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i].trim()

    // Check if this line looks like a table row
    if (line.startsWith('|') && line.endsWith('|')) {
      const tableLines: string[] = [line]
      i++

      // Collect all consecutive table lines
      while (i < lines.length) {
        const nextLine = lines[i].trim()
        if (nextLine.startsWith('|') && nextLine.endsWith('|')) {
          tableLines.push(nextLine)
          i++
        } else {
          break
        }
      }

      // Parse the table if we have at least 2 rows (header + separator or data)
      if (tableLines.length >= 2) {
        const parseRow = (row: string): string[] => {
          return row
            .slice(1, -1) // Remove leading and trailing |
            .split('|')
            .map(cell => cell.trim())
        }

        const headers = parseRow(tableLines[0])
        const rows: string[][] = []

        // Skip separator row (contains ---) and parse data rows
        for (let j = 1; j < tableLines.length; j++) {
          if (!tableLines[j].includes('---')) {
            rows.push(parseRow(tableLines[j]))
          }
        }

        if (headers.length > 0) {
          tables.push({ headers, rows })
        }
      }
    } else {
      i++
    }
  }

  return tables
}

// Convert tables to CSV format
export function tablesToCSV(tables: TableData[]): string {
  return tables.map((table, index) => {
    const escapeCSV = (cell: string) => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`
      }
      return cell
    }

    const headerRow = table.headers.map(escapeCSV).join(',')
    const dataRows = table.rows.map(row => row.map(escapeCSV).join(','))

    const tableTitle = tables.length > 1 ? `\n--- Table ${index + 1} ---\n` : ''
    return tableTitle + [headerRow, ...dataRows].join('\n')
  }).join('\n\n')
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const renderedContent = useMemo(() => {
    if (!content) return ''

    let html = content

    // Escape HTML entities first
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // Code blocks (must be processed before other formatting)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm"><code class="language-${lang}">${code.trim()}</code></pre>`
    })

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')

    // Headers (process from h6 to h1 to avoid conflicts)
    html = html.replace(/^###### (.+)$/gm, '<h6 class="text-sm font-semibold text-gray-700 mt-4 mb-2">$1</h6>')
    html = html.replace(/^##### (.+)$/gm, '<h5 class="text-base font-semibold text-gray-700 mt-4 mb-2">$1</h5>')
    html = html.replace(/^#### (.+)$/gm, '<h4 class="text-lg font-semibold text-gray-800 mt-5 mb-2">$1</h4>')
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold text-gray-800 mt-6 mb-3">$1</h3>')
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200">$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-8 mb-4 pb-2 border-b-2 border-blue-500">$1</h1>')

    // Bold and italic (process bold first to handle ***text***)
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold"><em>$1</em></strong>')
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    html = html.replace(/__(.+?)__/g, '<strong class="font-bold">$1</strong>')
    html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>')

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del class="line-through text-gray-500">$1</del>')

    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr class="my-6 border-t border-gray-300" />')
    html = html.replace(/^\*\*\*$/gm, '<hr class="my-6 border-t border-gray-300" />')

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 text-gray-700 italic">$1</blockquote>')

    // Unordered lists
    html = html.replace(/^[\-\*] (.+)$/gm, '<li class="ml-4 list-disc list-inside text-gray-700">$1</li>')

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal list-inside text-gray-700">$1</li>')

    // Tables
    const tableRegex = /(\|.+\|[\r\n]+)+/g
    html = html.replace(tableRegex, (tableMatch) => {
      const rows = tableMatch.trim().split('\n').filter(row => row.trim())
      if (rows.length < 2) return tableMatch

      const parseRow = (row: string): string[] => {
        return row
          .trim()
          .slice(1, -1)
          .split('|')
          .map(cell => cell.trim())
      }

      const headerCells = parseRow(rows[0])
      const isSeparator = (row: string) => /^\|[\s\-:]+\|$/.test(row.trim().replace(/\|/g, '|'))

      let dataStartIndex = 1
      if (rows.length > 1 && isSeparator(rows[1])) {
        dataStartIndex = 2
      }

      const headerHtml = headerCells
        .map(cell => `<th class="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider bg-gray-100 border-b-2 border-gray-300">${cell}</th>`)
        .join('')

      const bodyRows = rows.slice(dataStartIndex).map((row, rowIndex) => {
        const cells = parseRow(row)
        const cellsHtml = cells
          .map(cell => `<td class="px-4 py-3 text-sm text-gray-700 border-b border-gray-200">${cell}</td>`)
          .join('')
        const bgClass = rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'
        return `<tr class="${bgClass} hover:bg-blue-50 transition-colors">${cellsHtml}</tr>`
      }).join('')

      return `
        <div class="my-6 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table class="min-w-full divide-y divide-gray-200">
            <thead><tr>${headerHtml}</tr></thead>
            <tbody class="divide-y divide-gray-200">${bodyRows}</tbody>
          </table>
        </div>
      `
    })

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>')

    // Paragraphs - wrap text blocks that aren't already wrapped
    const lines = html.split('\n')
    const processedLines = lines.map(line => {
      const trimmed = line.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<')) return line // Already HTML
      return `<p class="text-gray-700 leading-relaxed my-3">${line}</p>`
    })
    html = processedLines.join('\n')

    // Clean up empty paragraphs
    html = html.replace(/<p class="[^"]*"><\/p>/g, '')

    return html
  }, [content])

  return (
    <div
      className={`markdown-content prose prose-sm max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}
