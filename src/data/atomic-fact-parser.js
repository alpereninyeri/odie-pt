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

function factWeightScore(fact = {}) {
  const signalScore = (fact.signals || []).reduce((sum, signal) => sum + Number(signal.score || 0), 0)
  const durationScore = Math.min(5, (Number(fact.durationMin) || 0) / 20)
  const distanceScore = Math.min(5, (Number(fact.distanceKm) || 0) * 0.8)
  const drillBonus = fact.kind === 'drill' ? 1.2 : 0
  return Math.max(1, signalScore + durationScore + distanceScore + drillBonus)
}

function buildBlockMix(facts = []) {
  const totals = facts.reduce((acc, fact) => {
    const kind = fact.blockKind || 'mixed'
    acc[kind] = (acc[kind] || 0) + factWeightScore(fact)
    return acc
  }, {})

  const totalWeight = Object.values(totals).reduce((sum, value) => sum + Number(value || 0), 0)
  return Object.entries(totals)
    .sort((left, right) => right[1] - left[1])
    .map(([kind, weight]) => ({
      kind,
      weight: Math.round(weight * 10) / 10,
      percent: totalWeight ? Math.round((weight / totalWeight) * 100) : 0,
    }))
}

function buildChainSignals(facts = [], tags = []) {
  const text = normalizeOntologyText(facts.map(fact => fact.raw || fact.label || '').join(' '))
  const tagSet = new Set(tags || [])
  const chains = []
  const missingChains = []
  const riskSignals = []

  if (/(vault|underbar|cat leap|climb up|tic tac|wall run)/.test(text) || tagSet.has('parkour')) {
    chains.push({ name: 'vault chain', status: 'active', reason: 'vault/parkour drill kaniti var' })
  }
  if (/(precision|landing|drop|stick landing)/.test(text) || tagSet.has('terrain')) {
    chains.push({ name: 'landing chain', status: 'active', reason: 'precision/terrain iniş sinyali var' })
    riskSignals.push('landing load birikti')
  }
  if (/(box jump|precision jump|stride|tic tac|wall run)/.test(text) || tagSet.has('explosive')) {
    chains.push({ name: 'reactive legs', status: 'active', reason: 'explosive lower-chain sinyali var' })
  }
  if (/(flow|balance|precision|trail|terrain)/.test(text) || tagSet.has('balance')) {
    chains.push({ name: 'spatial control', status: 'active', reason: 'denge ve rota okuma sinyali var' })
  }
  if (/(core|hollow|plank|underbar|quadrupedal|crawl)/.test(text) || tagSet.has('core')) {
    chains.push({ name: 'trunk tension', status: 'active', reason: 'direkt trunk sinyali var' })
  } else if (tagSet.has('parkour') || tagSet.has('explosive')) {
    missingChains.push('direct trunk chain')
  }

  if (/(downhill|yokus asagi)/.test(text)) riskSignals.push('eccentric downhill load var')
  if (/(uphill|yokus yukari|incline)/.test(text)) riskSignals.push('calf ve posterior chain yuklenmesi var')
  if ((tagSet.has('terrain') || tagSet.has('parkour')) && tagSet.has('walking')) riskSignals.push('ankle stiffness takibi gerekli olabilir')

  return {
    chains: [...new Map(chains.map(chain => [chain.name, chain])).values()],
    missingChains: [...new Set(missingChains)],
    riskSignals: [...new Set(riskSignals)],
  }
}

function buildConfidence(facts = [], { explicitDurationMin = 0 } = {}) {
  const evidenceCount = facts.length
  const signalCount = facts.reduce((sum, fact) => sum + ((fact.signals || []).length || 0), 0)
  const hasDistance = facts.some(fact => Number(fact.distanceKm) > 0)
  const hasDuration = explicitDurationMin > 0 || facts.some(fact => Number(fact.durationMin) > 0)
  const drillFacts = facts.filter(fact => fact.kind === 'drill').length
  const confidenceScore = Math.min(100, Math.round(
    (signalCount * 8)
    + (evidenceCount * 6)
    + (hasDistance ? 14 : 0)
    + (hasDuration ? 14 : 0)
    + (drillFacts * 6)
  ))

  const level = confidenceScore >= 70 ? 'high' : confidenceScore >= 45 ? 'medium' : 'low'
  const reasons = []
  if (hasDistance) reasons.push('mesafe sinyali net')
  if (hasDuration) reasons.push('sure sinyali net')
  if (drillFacts) reasons.push(`drill kaniti ${drillFacts} adet`)
  if (!signalCount) reasons.push('serbest metin yorumu agirlikli')

  return {
    score: confidenceScore,
    level,
    reasons,
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
  const blockMix = buildBlockMix(facts)
  const chainSignals = buildChainSignals(facts, tags)
  const confidence = buildConfidence(facts, { explicitDurationMin })

  return {
    facts,
    evidence,
    blocks,
    blockMix,
    exercises,
    type,
    tags,
    durationMin,
    distanceKm,
    highlight,
    totalSets: facts.filter(fact => fact.kind === 'drill').length,
    confidence,
    chains: chainSignals.chains,
    missingChains: chainSignals.missingChains,
    riskSignals: chainSignals.riskSignals,
  }
}
