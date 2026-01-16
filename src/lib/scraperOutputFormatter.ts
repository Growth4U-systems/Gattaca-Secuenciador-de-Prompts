/**
 * Scraper Output Formatter
 * Converts Apify dataset items to different output formats
 */

import { ScraperOutputFormat, ScraperOutputConfig, ApifyDatasetItem } from '@/types/scraper.types';

/**
 * Format scraper results based on output config
 */
export function formatScraperOutput(
  items: ApifyDatasetItem[],
  config: ScraperOutputConfig
): string {
  // Filter fields if specified
  const filteredItems = config.fields?.length
    ? items.map(item => filterFields(item, config.fields!))
    : items;

  switch (config.format) {
    case 'json':
      return formatAsJson(filteredItems);
    case 'jsonl':
      return formatAsJsonl(filteredItems);
    case 'csv':
      return formatAsCsv(filteredItems, config.flatten);
    case 'markdown':
      return formatAsMarkdown(filteredItems);
    case 'xml':
      return formatAsXml(filteredItems);
    default:
      return formatAsJson(filteredItems);
  }
}

/**
 * Filter item to only include specified fields
 */
function filterFields(item: ApifyDatasetItem, fields: string[]): ApifyDatasetItem {
  const filtered: ApifyDatasetItem = {};
  for (const field of fields) {
    if (field in item) {
      filtered[field] = item[field];
    }
  }
  return filtered;
}

/**
 * Format as pretty-printed JSON
 */
function formatAsJson(items: ApifyDatasetItem[]): string {
  return JSON.stringify(items, null, 2);
}

/**
 * Format as JSON Lines (one JSON object per line)
 */
function formatAsJsonl(items: ApifyDatasetItem[]): string {
  return items.map(item => JSON.stringify(item)).join('\n');
}

/**
 * Format as CSV
 */
function formatAsCsv(items: ApifyDatasetItem[], flatten?: boolean): string {
  if (items.length === 0) return '';

  // Get all unique keys from all items
  const allKeys = new Set<string>();
  for (const item of items) {
    const keys = flatten ? getFlattenedKeys(item) : Object.keys(item);
    keys.forEach(key => allKeys.add(key));
  }
  const headers = Array.from(allKeys);

  // Create CSV rows
  const rows: string[] = [];

  // Header row
  rows.push(headers.map(escapeCSV).join(','));

  // Data rows
  for (const item of items) {
    const values = headers.map(key => {
      const value = flatten ? getNestedValue(item, key) : item[key];
      return formatCsvValue(value);
    });
    rows.push(values.join(','));
  }

  return rows.join('\n');
}

/**
 * Get flattened keys from a nested object
 */
function getFlattenedKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getFlattenedKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Get nested value by dot notation key
 */
function getNestedValue(obj: Record<string, unknown>, key: string): unknown {
  const parts = key.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Format a value for CSV
 */
function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return escapeCSV(JSON.stringify(value));
  }
  return escapeCSV(String(value));
}

/**
 * Escape a value for CSV (handle quotes and commas)
 */
function escapeCSV(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format as Markdown
 */
function formatAsMarkdown(items: ApifyDatasetItem[]): string {
  if (items.length === 0) return '*No se encontraron resultados*';

  const lines: string[] = [];
  lines.push(`# Resultados del Scraper\n`);
  lines.push(`**Total de items:** ${items.length}\n`);
  lines.push(`---\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    lines.push(`## Item ${i + 1}\n`);

    for (const [key, value] of Object.entries(item)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'object') {
        lines.push(`### ${key}\n`);
        lines.push('```json');
        lines.push(JSON.stringify(value, null, 2));
        lines.push('```\n');
      } else {
        // Format key as readable label
        const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
        const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

        // For long text, use block format
        const strValue = String(value);
        if (strValue.length > 100) {
          lines.push(`**${capitalizedLabel}:**\n`);
          lines.push(`> ${strValue}\n`);
        } else {
          lines.push(`**${capitalizedLabel}:** ${strValue}\n`);
        }
      }
    }

    lines.push(`---\n`);
  }

  return lines.join('\n');
}

/**
 * Format as XML
 */
function formatAsXml(items: ApifyDatasetItem[]): string {
  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<results>');

  for (const item of items) {
    lines.push('  <item>');
    for (const [key, value] of Object.entries(item)) {
      const xmlKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
      const xmlValue = escapeXml(formatXmlValue(value));
      lines.push(`    <${xmlKey}>${xmlValue}</${xmlKey}>`);
    }
    lines.push('  </item>');
  }

  lines.push('</results>');
  return lines.join('\n');
}

/**
 * Format a value for XML
 */
function formatXmlValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Get file extension for output format
 */
export function getFileExtension(format: ScraperOutputFormat): string {
  switch (format) {
    case 'json': return '.json';
    case 'jsonl': return '.jsonl';
    case 'csv': return '.csv';
    case 'markdown': return '.md';
    case 'xml': return '.xml';
    default: return '.json';
  }
}

/**
 * Get MIME type for output format
 */
export function getMimeType(format: ScraperOutputFormat): string {
  switch (format) {
    case 'json': return 'application/json';
    case 'jsonl': return 'application/x-ndjson';
    case 'csv': return 'text/csv';
    case 'markdown': return 'text/markdown';
    case 'xml': return 'application/xml';
    default: return 'application/json';
  }
}
