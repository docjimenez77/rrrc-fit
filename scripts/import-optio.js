#!/usr/bin/env node
/**
 * scripts/import-optio.js (updated)
 *
 * Fetches the Optio feed, attempts JSON/csv parsing, and if that fails
 * falls back to line-based parsing for feeds like:
 *
 * 190340661600    M QW-K v4 081 Black/Grey/Nightlife 7 D
 *
 * The fallback extracts:
 *  - upc (digits at start)
 *  - optional gender token after UPC (M/W etc. — ignored)
 *  - description (middle)
 *  - size (penultimate token, e.g. 7 or 7.5)
 *  - width (last token, e.g. D, 2E)
 *
 * Usage:
 *   DATABASE_URL="file:./dev.db" node scripts/import-optio.js
 * or to specify a test feed:
 *   OPTIO_FEED_URL="https://app.getopt.io/app/api.php?p=udswksyt" DATABASE_URL="file:./dev.db" node scripts/import-optio.js
 */

const { PrismaClient } = require('@prisma/client')
const { parse } = require('csv-parse/sync')

const prisma = new PrismaClient()

const FEED_URL = process.env.OPTIO_FEED_URL || 'https://app.getopt.io/app/api.php?p=udswksyt'
const MAX_ROWS_LOG = 5

function tryParseJSON(text) {
  try {
    const v = JSON.parse(text)
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') {
      for (const k of ['data', 'rows', 'items', 'results']) {
        if (Array.isArray(v[k])) return v[k]
      }
    }
  } catch (e) {
    // ignore
  }
  return null
}

function tryParseCSVish(text) {
  const delimiters = [',', '\t', '|', ';', ' - ']
  for (const delim of delimiters) {
    try {
      const records = parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        delimiter: delim,
      })
      if (Array.isArray(records) && records.length > 0) {
        const first = records[0]
        const fieldCount = Object.keys(first).length
        if (fieldCount >= 1) return records
      }
    } catch (err) {
      // parsing failed for this delimiter — try the next
    }
  }
  // fallback: try a simple split-based heuristic - but we prefer the line parser below
  return null
}

/**
 * Parse single line formatted like:
 * 190340661600    M QW-K v4 081 Black/Grey/Nightlife 7 D
 *
 * Regex:
 *  ^(\d{8,14})\s+(?:([A-Za-z]+)\s+)?(.*?)\s+(\d{1,2}(?:\.\d+)?)\s+([A-Za-z0-9]+)\s*$
 *
 * groups:
 * 1 - UPC
 * 2 - optional gender/marker (M/W) -> ignored
 * 3 - description (non-greedy)
 * 4 - size (7, 7.5, 12.5)
 * 5 - width (D, 2E, B etc.)
 */
function parseLineFormat(line) {
  const re = /^(\d{8,14})\s+(?:([A-Za-z]+)\s+)?(.+?)\s+(\d{1,2}(?:\.\d+)?)\s+([A-Za-z0-9]+)\s*$/
  const m = line.match(re)
  if (!m) return null
  const upc = m[1].replace(/\D/g, '')
  const description = m[3].trim()
  const size = m[4].trim()
  const width = m[5].trim()
  return { upc, description, size, width, metadata_line: line }
}

/**
 * Generic normalizer for parsed rows (objects with keys)
 * Attempts to find UPC in common fields or within values
 */
function normalizeRowFromObject(raw) {
  const normalized = {}
  for (const k of Object.keys(raw || {})) {
    const key = String(k).trim().toLowerCase()
    const val = raw[k] == null ? '' : String(raw[k]).trim()
    normalized[key] = val
  }
  const pick = (...names) => {
    for (const n of names) {
      if (normalized[n]) return normalized[n]
    }
    return ''
  }

  // detect UPC by common names
  let upc = pick('upc', 'barcode', 'gtin', 'sku', 'upc_code', 'upc13', 'ean', 'ean13')
  if (!upc) {
    // look through values for a numeric UPC
    for (const k of Object.keys(normalized)) {
      const v = normalized[k].replace(/\D/g, '')
      if (/^\d{8,14}$/.test(v)) {
        upc = v
        break
      }
    }
  }
  upc = (upc || '').replace(/\D/g, '')

  const description = pick('description', 'desc', 'product', 'name') || ''
  const size = pick('size', 'shoe_size', 'us_size', 'uk_size') || ''
  const width = pick('width', 'shoe_width') || ''
  const modelName = pick('model', 'modelname', 'style', 'style_number') || ''
  const brand = pick('brand', 'manufacturer', 'maker') || ''
  const imageUrl = pick('image', 'image_url', 'imageurl', 'picture') || ''

  return {
    upc,
    description,
    size,
    width,
    modelName,
    brand,
    imageUrl,
    metadata: raw,
  }
}

/**
 * If CSV parsing produced odd records (first row as header), the parsed objects
 * might have keys equal to entire data lines. So try line-based parse if many rows
 * have missing UPCs/fields.
 */
function detectNeedLineFallback(parsedRows, originalText) {
  if (!parsedRows || parsedRows.length === 0) return true
  const sample = parsedRows.slice(0, Math.min(20, parsedRows.length))
  let missingUpc = 0
  for (const r of sample) {
    const nr = normalizeRowFromObject(r)
    if (!nr.upc) missingUpc++
  }
  // if many missing UPCs in sample, fallback
  if (missingUpc >= Math.ceil(sample.length * 0.6)) return true

  // Also check originalText for lines that look like the line format (UPC at line start)
  const lines = originalText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  let matches = 0
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    if (/^\d{8,14}\s+/.test(lines[i])) matches++
  }
  if (matches >= 3) return true

  return false
}

function normalizeLineRow(line) {
  // try the well-formed regex first
  const p = parseLineFormat(line)
  if (p) {
    return {
      upc: p.upc,
      description: p.description,
      size: p.size,
      width: p.width,
      modelName: undefined,
      brand: undefined,
      imageUrl: undefined,
      metadata: { raw_line: line },
    }
  }

  // fallback heuristic: split tokens and guess fields
  const tokens = line.split(/\s+/).filter(Boolean)
  if (tokens.length >= 3 && /^\d{8,14}$/.test(tokens[0])) {
    const upc = tokens[0]
    // last token is width, previous token is size
    const width = tokens[tokens.length - 1]
    const size = tokens[tokens.length - 2]
    // description is everything between index 1 and tokens.length - 3
    let descTokens = tokens.slice(1, Math.max(1, tokens.length - 2))
    // drop a leading single-letter gender token like M/W if present
    if (descTokens.length > 0 && /^[A-Za-z]$/.test(descTokens[0])) {
      descTokens = descTokens.slice(1)
    }
    const description = descTokens.join(' ')
    return {
      upc,
      description,
      size,
      width,
      modelName: undefined,
      brand: undefined,
      imageUrl: undefined,
      metadata: { raw_line: line },
    }
  }
  return null
}

async function upsertRow(prisma, r) {
  if (!r || !r.upc) return { skipped: true }
  const data = {
    upc: r.upc,
    description: r.description || undefined,
    size: r.size || undefined,
    width: r.width || undefined,
    modelName: r.modelName || undefined,
    brand: r.brand || undefined,
    imageUrl: r.imageUrl || undefined,
    metadata: r.metadata || undefined,
  }
  const rec = await prisma.productUPC.upsert({
    where: { upc: r.upc },
    update: data,
    create: data,
  })
  return { skipped: false, id: rec.id }
}

async function main() {
  try {
    if (typeof fetch === 'undefined') {
      console.error('Global fetch is not available. Please run with Node 18+ or set up node-fetch.')
      process.exit(1)
    }

    console.log('Fetching feed from:', FEED_URL)
    const res = await fetch(FEED_URL, { headers: { Accept: '*/*' }, redirect: 'follow' })
    if (!res.ok) {
      throw new Error(`Feed fetch failed: ${res.status} ${res.statusText}`)
    }
    const text = await res.text()
    if (!text || !text.trim()) {
      throw new Error('Feed returned empty content')
    }

    // Try JSON
    let rawRows = tryParseJSON(text)
    let parsedWith = null

    if (rawRows) {
      parsedWith = 'json'
    } else {
      // Try csv-ish parsing
      const csvRows = tryParseCSVish(text)
      if (csvRows && csvRows.length > 0) {
        rawRows = csvRows
        parsedWith = 'csvish'
      } else {
        // fallback to line-based parsing if CSVish fails
        parsedWith = 'lines'
      }
    }

    // Heuristic: if CSV-ish produced records but many missing UPCs, prefer line fallback
    if (parsedWith === 'csvish' && detectNeedLineFallback(rawRows, text)) {
      parsedWith = 'lines'
    }

    let rowsForProcessing = []

    if (parsedWith === 'json') {
      rowsForProcessing = rawRows.map(r => normalizeRowFromObject(r))
    } else if (parsedWith === 'csvish') {
      rowsForProcessing = rawRows.map(r => normalizeRowFromObject(r))
    } else {
      // Line-based parsing
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
      for (const line of lines) {
        const nr = normalizeLineRow(line)
        if (nr) rowsForProcessing.push(nr)
      }
    }

    console.log(`Parsed ${rowsForProcessing.length} rows (parser: ${parsedWith}) — processing...`)

    let created = 0
    let updated = 0
    let skipped = 0

    for (let i = 0; i < rowsForProcessing.length; i++) {
      const norm = rowsForProcessing[i]
      if (!norm || !norm.upc) {
        skipped++
        continue
      }
      try {
        const existed = await prisma.productUPC.findUnique({ where: { upc: norm.upc } })
        await upsertRow(prisma, norm)
        if (existed) updated++ ; else created++
      } catch (err) {
        console.error(`Error upserting UPC=${norm.upc}:`, err && err.message ? err.message : err)
        skipped++
      }
      if ((i + 1) % 500 === 0) {
        console.log(`Processed ${i + 1}/${rowsForProcessing.length} rows...`)
      }
    }

    console.log('Import complete:', { created, updated, skipped })
    if (created || updated) {
      console.log(`Example records (up to ${MAX_ROWS_LOG} rows):`)
      const examples = await prisma.productUPC.findMany({ take: Math.min(MAX_ROWS_LOG, created + updated), orderBy: { updatedAt: 'desc' } })
      for (const e of examples) {
        console.log({ id: e.id, upc: e.upc, description: e.description, size: e.size, width: e.width, modelName: e.modelName, brand: e.brand })
      }
    }
  } catch (err) {
    console.error('Import failed:', err && err.message ? err.message : err)
    process.exitCode = 2
  } finally {
    await prisma.$disconnect()
  }
}

main()
