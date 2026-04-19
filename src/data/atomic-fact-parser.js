import {
  deriveBlockKindFromSignals,
  deriveTagsFromSignals,
  deriveTypeFromSignals,
  detectOntologySignals,
  normalizeOntologyText,
} from './sports-ontology.js'

function parseMinutes(text = '') {
  const normalized = normalizeOntologyText(text)
  let minutes = 0

  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:saat|hr|hour)/)
  if (hourMatch) minutes += Math.round(Number(hourMatch[1].replace(',', '.')) * 60)

  const minuteMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:dk|min|dakika)\b/)
  if (minuteMatch) minutes += Math.round(Number(minuteMatch[1].replace(',', '.')))

  return minutes
}

function parseDistanceKm(text = '') {
  const match = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*km\b/i)
  return match ? Number(match[1].replace(',', '.')) : 0
}

function cleanupLabel(line = '') {
  return String(line || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(\d+(?:[.,]\d+)?)\s*km\b/ig, ' ')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:saat|hr|hour|dk|min|dakika|sn|sec|saniye)\b/ig, ' ')
    .replace(/[-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitDrillLine(line = '') {
  const raw = String(line || '').trim()
  if (!raw.startsWith('(') && !raw.endsWith(')')) return []

  return raw
    .replace(/[()]/g, '')
    .split(/,| ve /i)
    .map(item => item.trim())
    .filter(Boolean)
}

function buildFact(raw, kind = 'activity') {
  const signals = detectOntologySignals(raw)
  const durationMin = parseMinutes(raw)
  const distanceKm = parseDistanceKm(raw)
  const label = cleanupLabel(raw) || summarizeLabelFromSignals(signals) || 'Session Signal'

  return {
    kind,
    raw: String(raw || '').trim(),
    label,
    durationMin,
    distanceKm,
    signals,
    tags: deriveTagsFromSignals(signals),
    blockKind: deriveBlockKindFromSignals(signals, distanceKm ? 'locomotion' : 'mixed'),
  }
}

function summarizeLabelFromSignals(signals = []) {
  const ranked = signals
    .slice()
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
  return ranked[0]?.label || ''
}

function factToExercise(fact) {
  return {
    name: fact.label,
    sets: [{
      reps: null,
      weight_kg: 0,
      duration_sec: fact.durationMin ? fact.durationMin * 60 : null,
      note: fact.raw,
    }],
  }
}

function factToBlock(fact) {
  return {
    kind: fact.blockKind,
    label: fact.label,
    tags: fact.tags,
    sets: fact.kind === 'drill' ? 1 : 0,
    reps: null,
    volumeKg: 0,
    durationMin: fact.durationMin || 0,
    distanceKm: fact.distanceKm || 0,
    source: 'fact',
  }
}

export function extractAtomicWorkoutFacts(text = '') {
  const rawLines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const facts = []
  let explicitDurationMin = 0

  for (const line of rawLines) {
    const normalized = normalizeOntologyText(line)
    if (!normalized) continue
    if (/^guncel kilo\b|^kilom\b|^boyum\b/.test(normalized)) continue
    if (/^(pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar)\b/.test(normalized)) continue
    if (/^set\s*\d+\s*:/i.test(normalized)) continue
    if (/^\d{1,2}\s+(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(normalized) || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(normalized)) continue

    if (/^toplam sure\b|^toplam s?ure:/i.test(normalized)) {
      explicitDurationMin = parseMinutes(line)
      continue
    }

    const drillItems = splitDrillLine(line)
    if (drillItems.length) {
      for (const item of drillItems) {
        const fact = buildFact(item, 'drill')
        if (fact.signals.length) facts.push(fact)
      }
      continue
    }

    const fact = buildFact(line, 'activity')
    if (fact.durationMin && !fact.signals.length && !fact.distanceKm) {
      const normalizedLabel = normalizeOntologyText(fact.label)
      if (/^(?:\d+|[\d.]+s|0s)$/.test(normalizedLabel) || normalizedLabel.length <= 2) continue
    }
    if (fact.signals.length || fact.distanceKm || fact.durationMin) facts.push(fact)
  }

  const allSignals = facts.flatMap(fact => fact.signals || [])
  const tags = deriveTagsFromSignals(allSignals)
  const type = deriveTypeFromSignals(allSignals, 'Custom')
  const blocks = facts.map(factToBlock)
  const exercises = facts.map(factToExercise)
  const durationMin = explicitDurationMin || facts.reduce((sum, fact) => sum + (fact.durationMin || 0), 0)
  const distanceKm = Math.round(facts.reduce((sum, fact) => sum + (fact.distanceKm || 0), 0) * 100) / 100
  const evidence = facts.map(fact => fact.raw)
  const highlight = facts
    .slice()
    .sort((left, right) => Number(right.durationMin || 0) - Number(left.durationMin || 0) || Number(right.distanceKm || 0) - Number(left.distanceKm || 0))
    .map(fact => fact.label)[0] || ''

  return {
    facts,
    evidence,
    blocks,
    exercises,
    type,
    tags,
    durationMin,
    distanceKm,
    highlight,
    totalSets: facts.filter(fact => fact.kind === 'drill').length,
  }
}
