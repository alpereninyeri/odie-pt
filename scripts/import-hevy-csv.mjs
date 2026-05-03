#!/usr/bin/env node
// Hevy CSV export -> OdiePt Supabase import.
//
// CSV satirlarini Hevy workout shape'ine cevirir, normalizeHevyWorkout +
// ingestNormalizedExternalWorkout ile yazar. Tarih sirasiyla isler ki
// XP / streak / stat / class hesabi gercek akista olusur.
//
// External_id sentetik: `csv:<startTime>:<titleSlug>` — Hevy API'den gelen
// gercek UUID'lerle catismaz (farkli id formati).
//
// Usage:
//   node scripts/import-hevy-csv.mjs <csv-path>            (DRY RUN)
//   node scripts/import-hevy-csv.mjs <csv-path> --write    (gercek yaz)

import fs from 'node:fs'
import path from 'node:path'

// Dependency olmadan .env yukle
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = value
  }
}
loadEnv()

const args = process.argv.slice(2)
const csvPath = args.find(a => !a.startsWith('--')) || 'C:/Users/PC/Desktop/workouts.csv'
const isWrite = args.includes('--write')

if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('FATAL: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env yok (.env yuklenmeli)')
  process.exit(1)
}

const TR_MONTHS = {
  Oca: 1, Şub: 2, Sub: 2, Mar: 3, Nis: 4, May: 5,
  Haz: 6, Tem: 7, Ağu: 8, Agu: 8, Eyl: 9, Eki: 10, Kas: 11, Ara: 12,
}

function parseTRDateToISO(value, tzOffset = '+03:00') {
  // "29 Nis 2026 18:18" -> "2026-04-29T18:18:00+03:00"
  const m = String(value).trim().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})\s+(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const [, day, monthName, year, hour, min] = m
  const month = TR_MONTHS[monthName]
  if (!month) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${min}:00${tzOffset}`
}

function parseCSVLine(line) {
  const fields = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else { cur += c }
    } else {
      if (c === ',') { fields.push(cur); cur = '' }
      else if (c === '"') { inQuotes = true }
      else { cur += c }
    }
  }
  fields.push(cur)
  return fields
}

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
  const header = parseCSVLine(lines[0])
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    const row = {}
    for (let j = 0; j < header.length; j++) {
      row[header[j]] = fields[j] === undefined || fields[j] === '' ? null : fields[j]
    }
    rows.push(row)
  }
  return rows
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase()
    .slice(0, 40)
}

function csvRowsToHevyWorkouts(rows) {
  const map = new Map()
  for (const row of rows) {
    const key = `${row.title}|${row.start_time}`
    if (!map.has(key)) {
      const startISO = parseTRDateToISO(row.start_time)
      const endISO = parseTRDateToISO(row.end_time)
      const id = `csv:${startISO?.slice(0, 19) || row.start_time}:${slugify(row.title)}`
      map.set(key, {
        id,
        title: row.title,
        description: row.description || '',
        start_time: startISO,
        end_time: endISO,
        created_at: startISO,
        exercises: new Map(),
      })
    }
    const w = map.get(key)
    const exTitle = row.exercise_title
    if (!w.exercises.has(exTitle)) {
      w.exercises.set(exTitle, { title: exTitle, sets: [] })
    }
    const set = {
      type: row.set_type || 'normal',
      weight_kg: row.weight_kg ? Number(row.weight_kg) : null,
      reps: row.reps ? Number(row.reps) : null,
      duration_seconds: row.duration_seconds ? Number(row.duration_seconds) : null,
      rpe: row.rpe ? Number(row.rpe) : null,
    }
    if (row.distance_km) {
      set.distance_meters = Number(row.distance_km) * 1000
    }
    w.exercises.get(exTitle).sets.push(set)
  }
  return [...map.values()].map(w => ({
    ...w,
    exercises: [...w.exercises.values()],
  }))
}

// ── Main ────────────────────────────────────────────────────────────────────
const content = fs.readFileSync(csvPath, 'utf8')
const rows = parseCSV(content)
const workouts = csvRowsToHevyWorkouts(rows)

// Tarih sirasiyla isle (eski -> yeni)
workouts.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)))

console.log(`CSV: ${rows.length} satir, ${workouts.length} workout`)
console.log(`Tarih dilimi: ${workouts[0]?.start_time?.slice(0, 10)} -> ${workouts[workouts.length - 1]?.start_time?.slice(0, 10)}`)
console.log(`Mode: ${isWrite ? 'WRITE' : 'DRY RUN'}`)
console.log()

if (!isWrite) {
  // Dry run: ilk 3 + son 3 workout'u normalize edip goster
  const { normalizeHevyWorkout } = await import('../lib/hevy/normalize.js')
  const sample = [...workouts.slice(0, 3), ...workouts.slice(-3)]
  for (const w of sample) {
    const n = normalizeHevyWorkout(w)
    console.log(`  ${n.date} | ${n.type.padEnd(10)} | ${String(n.durationMin).padStart(3)}dk | ${String(n.sets).padStart(3)} set | ${String(n.volumeKg).padStart(6)}kg | ext=${n.externalId}`)
  }
  console.log()
  console.log('Gercek yazim icin: node scripts/import-hevy-csv.mjs <csv> --write')
  process.exit(0)
}

// WRITE mode
const { normalizeHevyWorkout } = await import('../lib/hevy/normalize.js')
const { ingestNormalizedExternalWorkout, resolveProfile, updateSyncState } = await import('../lib/hevy/persist.js')

const profile = await resolveProfile()
if (!profile) {
  console.error('FATAL: profil bulunamadi')
  process.exit(1)
}
console.log(`Profil: ${profile.nick} (${profile.id})`)
console.log()

const summary = { inserted: 0, updated: 0, skipped: 0, errors: [] }
const startMs = Date.now()

for (let i = 0; i < workouts.length; i++) {
  const w = workouts[i]
  const idx = String(i + 1).padStart(2, '0')
  try {
    const normalized = normalizeHevyWorkout(w)
    const result = await ingestNormalizedExternalWorkout(normalized, { onUpdate: 'skip' })
    if (result.status === 'inserted') summary.inserted += 1
    else if (result.status === 'updated') summary.updated += 1
    else summary.skipped += 1
    console.log(`  ${idx}/${workouts.length}  ${result.status.padEnd(8)}  ${normalized.date}  ${normalized.type.padEnd(10)}  ${String(normalized.sets).padStart(3)}set  ${String(normalized.volumeKg).padStart(6)}kg  +${result.xpEarned || 0}XP  "${w.title.slice(0, 30)}"`)
  } catch (error) {
    summary.errors.push({ id: w.id, message: String(error?.message || error).slice(0, 200) })
    console.error(`  ${idx}/${workouts.length}  ERROR    ${w.start_time}  ${w.title}  -> ${error.message}`)
  }
}

// Sync cursor'u CSV son tarihinden +1 saat sonraya pinle
const lastStart = workouts[workouts.length - 1]?.start_time
if (lastStart) {
  const cursor = new Date(Date.parse(lastStart) + 60 * 60 * 1000).toISOString()
  await updateSyncState(profile.id, {
    events_since: cursor,
    last_synced_at: new Date().toISOString(),
    last_error: summary.errors.length ? JSON.stringify(summary.errors).slice(0, 500) : null,
  })
  console.log()
  console.log(`Sync cursor pinned: ${cursor}`)
}

const elapsedSec = Math.round((Date.now() - startMs) / 1000)
console.log()
console.log('═══════ SONUC ═══════')
console.log(`Sure: ${elapsedSec}s`)
console.log(`Inserted: ${summary.inserted}`)
console.log(`Updated:  ${summary.updated}`)
console.log(`Skipped:  ${summary.skipped}`)
console.log(`Errors:   ${summary.errors.length}`)
if (summary.errors.length) {
  console.log('Hatalar:')
  for (const e of summary.errors.slice(0, 10)) console.log(`  - ${e.id}: ${e.message}`)
}
