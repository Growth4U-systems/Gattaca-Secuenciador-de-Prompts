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
    // Use dark text on light background for better visibility
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="bg-gray-100 text-gray-900 p-4 rounded-lg overflow-x-auto my-4 text-sm border border-gray-300"><code class="language-${lang} text-gray-900">${code.trim()}</code></pre>`
    })

    // Inline code - ensure dark text
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 text-gray-900 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-200">$1</code>')

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

    // Process lists with proper nesting support
    // This handles both ordered (1. 2. 3.) and unordered (- * ) lists with indentation
    const processLists = (text: string): string => {
      const lines = text.split('\n')
      const result: string[] = []
      let i = 0

      while (i < lines.length) {
        const line = lines[i]

        // Check if this line starts a list (unordered: - or *, ordered: 1. 2. etc)
        const unorderedMatch = line.match(/^(\s*)([-*])\s+(.+)$/)
        const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/)

        if (unorderedMatch || orderedMatch) {
          // Start collecting list items
          const listItems: { indent: number; content: string; type: 'ul' | 'ol' }[] = []

          while (i < lines.length) {
            const currentLine = lines[i]
            const ulMatch = currentLine.match(/^(\s*)([-*])\s+(.+)$/)
            const olMatch = currentLine.match(/^(\s*)(\d+)\.\s+(.+)$/)

            if (ulMatch) {
              const indent = ulMatch[1].length
              listItems.push({ indent, content: ulMatch[3], type: 'ul' })
              i++
            } else if (olMatch) {
              const indent = olMatch[1].length
              listItems.push({ indent, content: olMatch[3], type: 'ol' })
              i++
            } else if (currentLine.trim() === '') {
              // Empty line might end the list or continue it
              if (i + 1 < lines.length) {
                const nextLine = lines[i + 1]
                if (nextLine.match(/^(\s*)([-*]|\d+\.)\s+/)) {
                  i++ // Skip empty line, continue list
                  continue
                }
              }
              break
            } else {
              break
            }
          }

          // Build nested list HTML
          if (listItems.length > 0) {
            const buildNestedList = (items: typeof listItems, startIdx: number, baseIndent: number): { html: string; endIdx: number } => {
              if (startIdx >= items.length) return { html: '', endIdx: startIdx }

              const listType = items[startIdx].type
              const listClass = listType === 'ul'
                ? 'list-disc pl-5 my-2 space-y-1'
                : 'list-decimal pl-5 my-2 space-y-1'

              let html = `<${listType} class="${listClass}">`
              let idx = startIdx

              while (idx < items.length) {
                const item = items[idx]

                // Check if this item is at the same or lower level
                if (item.indent < baseIndent) {
                  break
                }

                if (item.indent === baseIndent) {
                  html += `<li class="text-gray-700">${item.content}`
                  idx++

                  // Check for nested items
                  if (idx < items.length && items[idx].indent > baseIndent) {
                    const nested = buildNestedList(items, idx, items[idx].indent)
                    html += nested.html
                    idx = nested.endIdx
                  }

                  html += '</li>'
                } else if (item.indent > baseIndent) {
                  // This shouldn't happen normally, but handle nested lists
                  const nested = buildNestedList(items, idx, item.indent)
                  html += nested.html
                  idx = nested.endIdx
                } else {
                  break
                }
              }

              html += `</${listType}>`
              return { html, endIdx: idx }
            }

            const { html: listHtml } = buildNestedList(listItems, 0, listItems[0].indent)
            result.push(listHtml)
          }
        } else {
          result.push(line)
          i++
        }
      }

      return result.join('\n')
    }

    html = processLists(html)

    // Tables - capture table rows including the last one without trailing newline
    const tableRegex = /(\|.+\|(?:[\r\n]+|$))+/g
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
      className={`markdown-content max-w-none text-gray-900 ${className}`}
      style={{ color: '#111827' }}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  )
}
