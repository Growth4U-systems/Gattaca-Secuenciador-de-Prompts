/**
 * Parser de tablas markdown para extraer datos estructurados de step outputs
 */

export interface ParsedTable {
  headers: string[]
  rows: string[][]
}

/**
 * Extrae todas las tablas markdown de un texto
 */
export function parseMarkdownTables(markdown: string): ParsedTable[] {
  const tables: ParsedTable[] = []

  // Regex para detectar bloques de tabla markdown
  // Busca: | header1 | header2 | ... |
  //        |---------|---------|-----|
  //        | data1   | data2   | ... |
  const tableRegex = /\|[^\n]+\|\n\|[\s:|-]+\|\n(\|[^\n]+\|\n?)+/g
  const matches = markdown.match(tableRegex) || []

  for (const tableText of matches) {
    const lines = tableText.trim().split('\n')
    if (lines.length < 3) continue

    // Primera linea: headers
    const headers = lines[0]
      .split('|')
      .slice(1, -1)  // Remover | vacios del inicio/fin
      .map(h => cleanCell(h))

    // Saltar linea separadora (---)
    // Resto: filas de datos
    const rows = lines.slice(2).map(line =>
      line.split('|').slice(1, -1).map(cell => cleanCell(cell))
    )

    tables.push({ headers, rows })
  }

  return tables
}

/**
 * Limpia el contenido de una celda de tabla markdown
 */
function cleanCell(cell: string): string {
  return cell
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // **bold** -> bold
    .replace(/\*([^*]+)\*/g, '$1')       // *italic* -> italic
    .replace(/<br\s*\/?>/gi, ' ')        // <br> -> espacio
    .replace(/\n/g, ' ')                 // newlines -> espacio
    .replace(/\s+/g, ' ')                // multiple spaces -> single space
    .trim()
}

/**
 * Busca una tabla por un header especifico
 */
export function findTableByHeader(tables: ParsedTable[], headerKeyword: string): ParsedTable | undefined {
  return tables.find(table =>
    table.headers.some(h =>
      h.toLowerCase().includes(headerKeyword.toLowerCase())
    )
  )
}

/**
 * Extrae un valor de una fila por nombre de columna
 */
export function getColumnValue(table: ParsedTable, row: string[], columnName: string): string | undefined {
  const colIndex = table.headers.findIndex(h =>
    h.toLowerCase().includes(columnName.toLowerCase())
  )
  return colIndex >= 0 ? row[colIndex] : undefined
}
