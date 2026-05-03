#!/usr/bin/env node
// Hevy CSV export parser — read-only inspection.
// Usage: node scripts/parse-hevy-csv.mjs <csv-path>

import fs from 'node:fs'
import path from 'node:path'

const TR_MONTHS = {
  Oca: 1, Şub: 2, Sub: 2, Mar: 3, Nis: 4, May: 5,
  Haz: 6, Tem: 7, Ağu: 8, Agu: 8, Eyl: 9, Eki: 10, Kas: 11, Ara: 12,
}

function parseTRDate(value) {
  // "29 Nis 2026 18:18"
  const m = String(value).trim().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})\s+(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const [, day, monthName, year, hour, min] = m
  const month = TR_MONTHS[monthName]
  if (!month) return null
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${min}:00`
  return iso
}

function parseCSVLine(line) {
  // Hevy CSV: simple quoted-field format with commas inside quotes possible
  const fields = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else {
        cur += c
      }
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

function groupWorkouts(rows) {
  const map = new Map()
  for (const row of rows) {
    const key = `${row.title}|${row.start_time}`
    if (!map.has(key)) {
      map.set(key, {
        title: row.title,
        start_time: row.start_time,
        end_time: row.end_time,
        description: row.description || '',
        startISO: parseTRDate(row.start_time),
        endISO: parseTRDate(row.end_time),
        exercises: new Map(),
      })
    }
    const w = map.get(key)
    const exKey = row.exercise_title
    if (!w.exercises.has(exKey)) {
      w.exercises.set(exKey, { title: exKey, sets: [] })
    }
    w.exercises.get(exKey).sets.push({
      type: row.set_type || 'normal',
      weight_kg: row.weight_kg ? Number(row.weight_kg) : null,
      reps: row.reps ? Number(row.reps) : null,
      distance_km: row.distance_km ? Number(row.distance_km) : null,
      duration_seconds: row.duration_seconds ? Number(row.duration_seconds) : null,
      rpe: row.rpe ? Number(row.rpe) : null,
    })
  }
  return [...map.values()].map(w => ({
    ...w,
    exercises: [...w.exercises.values()],
  }))
}

function summarizeWorkout(w) {
  let setCount = 0
  let volumeKg = 0
  let distanceKm = 0
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      setCount += 1
      if (Number.isFinite(s.weight_kg) && Number.isFinite(s.reps)) {
        volumeKg += s.weight_kg * s.reps
      }
      if (Number.isFinite(s.distance_km)) distanceKm += s.distance_km
    }
  }
  const startMs = Date.parse(w.startISO)
  const endMs = Date.parse(w.endISO)
  const durationMin = Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, Math.round((endMs - startMs) / 60000))
    : 0
  return { setCount, volumeKg, distanceKm, durationMin }
}

const csvPath = process.argv[2] || 'C:/Users/PC/Desktop/workouts.csv'
const content = fs.readFileSync(csvPath, 'utf8')
const rows = parseCSV(content)
const workouts = groupWorkouts(rows)

// Sort by date asc
workouts.sort((a, b) => String(a.startISO).localeCompare(String(b.startISO)))

let totalSets = 0, totalVolume = 0, totalMinutes = 0, totalDistance = 0
const yearTally = {}
const exerciseTally = {}
let parseErrors = 0

for (const w of workouts) {
  if (!w.startISO) { parseErrors += 1; continue }
  const s = summarizeWorkout(w)
  totalSets += s.setCount
  totalVolume += s.volumeKg
  totalMinutes += s.durationMin
  totalDistance += s.distanceKm
  const year = w.startISO.slice(0, 4)
  yearTally[year] = (yearTally[year] || 0) + 1
  for (const ex of w.exercises) {
    exerciseTally[ex.title] = (exerciseTally[ex.title] || 0) + ex.sets.length
  }
}

console.log('═══════ HEVY CSV ÖZET ═══════')
console.log('CSV satir sayisi (header haric):', rows.length)
console.log('Unique workout sayisi:', workouts.length)
console.log('Tarih dilimi:', workouts[0]?.startISO?.slice(0, 10), '→', workouts[workouts.length - 1]?.startISO?.slice(0, 10))
console.log('Yil dagilimi:', yearTally)
console.log('Parse hatasi:', parseErrors)
console.log()
console.log('Toplam set:', totalSets)
console.log('Toplam hacim (kg):', totalVolume.toLocaleString('tr-TR'))
console.log('Toplam sure (dk):', totalMinutes, '(~', Math.round(totalMinutes / 60), 'saat)')
console.log('Toplam mesafe (km):', totalDistance.toFixed(2))
console.log()
console.log('═══════ EN SIK 15 EGZERSIZ ═══════')
const top15 = Object.entries(exerciseTally).sort((a, b) => b[1] - a[1]).slice(0, 15)
for (const [name, sets] of top15) console.log(`  ${sets.toString().padStart(4)} set  │  ${name}`)
console.log()
console.log('═══════ ILK 3 WORKOUT ═══════')
for (const w of workouts.slice(0, 3)) {
  const s = summarizeWorkout(w)
  console.log(`  ${w.startISO?.slice(0, 10)} │ "${w.title}" │ ${w.exercises.length} egz │ ${s.setCount} set │ ${s.volumeKg}kg │ ${s.durationMin}dk`)
}
console.log()
console.log('═══════ SON 3 WORKOUT ═══════')
for (const w of workouts.slice(-3)) {
  const s = summarizeWorkout(w)
  console.log(`  ${w.startISO?.slice(0, 10)} │ "${w.title}" │ ${w.exercises.length} egz │ ${s.setCount} set │ ${s.volumeKg}kg │ ${s.durationMin}dk`)
}
