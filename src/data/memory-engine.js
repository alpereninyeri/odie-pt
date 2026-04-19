import { normalizeDateString } from './rules.js'

function clampConfidence(value, fallback = 0.5) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  if (numeric > 1) return Math.max(0, Math.min(1, numeric / 100))
  return Math.max(0, Math.min(1, numeric))
}

function toArray(value) {
  return Array.isArray(value) ? value : []
}

function toIsoDate(value, fallback = null) {
  const normalized = normalizeDateString(value, '')
  return normalized || fallback
}

function sortByNewest(items = [], field = 'createdAt') {
  return [...items].sort((left, right) => {
    const leftValue = String(left?.[field] || left?.date || '')
    const rightValue = String(right?.[field] || right?.date || '')
    return rightValue.localeCompare(leftValue)
  })
}

export function normalizeAthleteMemoryRow(row = {}) {
  const value = row.value_jsonb || row.value || {}
  return {
    id: row.id || null,
    profileId: row.profile_id || row.profileId || null,
    memoryType: row.memory_type || row.memoryType || 'episodic',
    scope: row.scope || 'global',
    key: row.key || '',
    summary: row.summary || value.summary || row.note || '',
    value,
    confidence: clampConfidence(row.confidence, 0.7),
    source: row.source || 'system_derived',
    active: row.active !== false,
    lastConfirmedAt: row.last_confirmed_at || row.lastConfirmedAt || null,
    lastUsedAt: row.last_used_at || row.lastUsedAt || null,
    createdAt: row.created_at || row.createdAt || null,
  }
}

export function normalizeMemoryFeedbackRow(row = {}) {
  return {
    id: row.id || null,
    profileId: row.profile_id || row.profileId || null,
    coachNoteId: row.coach_note_id || row.coachNoteId || null,
    memoryId: row.memory_id || row.memoryId || null,
    feedbackType: row.feedback_type || row.feedbackType || 'correct',
    note: row.note || '',
    createdAt: row.created_at || row.createdAt || null,
  }
}

export function normalizeBodyMetricsHistoryRow(row = {}) {
  const weightKg = Number(row.weight_kg ?? row.weightKg)
  const heightCm = Number(row.height_cm ?? row.heightCm)
  return {
    id: row.id || null,
    profileId: row.profile_id || row.profileId || null,
    date: toIsoDate(row.date, row.created_at || row.createdAt || null),
    weightKg: Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 10) / 10 : null,
    heightCm: Number.isFinite(heightCm) && heightCm > 0 ? Math.round(heightCm) : null,
    source: row.source || 'telegram',
    note: row.note || '',
    createdAt: row.created_at || row.createdAt || null,
  }
}

export function normalizeWorkoutBlockRow(row = {}) {
  return {
    id: row.id || null,
    profileId: row.profile_id || row.profileId || null,
    workoutId: row.workout_id || row.workoutId || null,
    kind: row.kind || 'mixed',
    label: row.label || '',
    weightPct: Number(row.weight_pct ?? row.weightPct) || 0,
    tags: toArray(row.tags),
    sets: Number(row.sets) || 0,
    reps: row.reps == null ? null : Number(row.reps),
    volumeKg: Number(row.volume_kg ?? row.volumeKg) || 0,
    durationMin: Number(row.duration_min ?? row.durationMin) || 0,
    distanceKm: Number(row.distance_km ?? row.distanceKm) || 0,
    source: row.source || 'session',
    createdAt: row.created_at || row.createdAt || null,
  }
}

export function normalizeWorkoutFactRow(row = {}) {
  return {
    id: row.id || null,
    profileId: row.profile_id || row.profileId || null,
    workoutId: row.workout_id || row.workoutId || null,
    factKind: row.fact_kind || row.factKind || 'activity',
    raw: row.raw || '',
    label: row.label || '',
    durationMin: Number(row.duration_min ?? row.durationMin) || 0,
    distanceKm: Number(row.distance_km ?? row.distanceKm) || 0,
    blockKind: row.block_kind || row.blockKind || 'mixed',
    signals: toArray(row.signals),
    tags: toArray(row.tags),
    confidence: clampConfidence(row.confidence, 0.65),
    createdAt: row.created_at || row.createdAt || null,
  }
}

export function buildWorkoutBlockRows(profileId, workoutId, blocks = [], blockMix = []) {
  const mix = new Map((blockMix || []).map(item => [item.kind, Number(item.percent) || 0]))
  return toArray(blocks).map(block => ({
    profile_id: profileId,
    workout_id: workoutId,
    kind: block.kind || 'mixed',
    label: block.label || '',
    weight_pct: mix.get(block.kind) || 0,
    tags: toArray(block.tags),
    sets: Number(block.sets) || 0,
    reps: block.reps == null ? null : Number(block.reps),
    volume_kg: Number(block.volumeKg) || 0,
    duration_min: Number(block.durationMin) || 0,
    distance_km: Number(block.distanceKm) || 0,
    source: block.source || 'session',
  }))
}

export function buildWorkoutFactRows(profileId, workoutId, facts = [], confidence = null) {
  const confidenceValue = clampConfidence(confidence?.score ?? confidence, 0.65)
  return toArray(facts).map(fact => ({
    profile_id: profileId,
    workout_id: workoutId,
    fact_kind: fact.kind || 'activity',
    raw: fact.raw || '',
    label: fact.label || '',
    duration_min: Number(fact.durationMin) || 0,
    distance_km: Number(fact.distanceKm) || 0,
    block_kind: fact.blockKind || 'mixed',
    signals: toArray(fact.signals),
    tags: toArray(fact.tags),
    confidence: confidenceValue,
  }))
}

export function buildBodyMetricsHistoryEntry(profileId, bodyMetrics = {}, { date = null, source = 'telegram', note = '' } = {}) {
  const weightKg = Number(bodyMetrics.weightKg)
  const heightCm = Number(bodyMetrics.heightCm)
  if (!Number.isFinite(weightKg) && !Number.isFinite(heightCm)) return null

  return {
    profile_id: profileId,
    date: toIsoDate(date, null),
    weight_kg: Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 10) / 10 : null,
    height_cm: Number.isFinite(heightCm) && heightCm > 0 ? Math.round(heightCm) : null,
    source,
    note: String(note || '').trim(),
  }
}

export function bodyMetricsChanged(current = {}, next = {}) {
  const currentWeight = Number(current.weightKg ?? current.weight_kg)
  const nextWeight = Number(next.weightKg ?? next.weight_kg)
  const currentHeight = Number(current.heightCm ?? current.height_cm)
  const nextHeight = Number(next.heightCm ?? next.height_cm)
  const weightChanged = Number.isFinite(nextWeight) && Math.abs(nextWeight - (Number.isFinite(currentWeight) ? currentWeight : 0)) > 0.01
  const heightChanged = Number.isFinite(nextHeight) && Math.abs(nextHeight - (Number.isFinite(currentHeight) ? currentHeight : 0)) > 0.01
  return weightChanged || heightChanged
}

function weakestStat(stats = {}) {
  return Object.entries(stats || {})
    .map(([key, value]) => ({ key, value: Number(value) || 0 }))
    .sort((left, right) => left.value - right.value)[0] || null
}

function strongestBlock(blockMix = []) {
  return [...toArray(blockMix)].sort((left, right) => (Number(right.percent) || 0) - (Number(left.percent) || 0))[0] || null
}

export function buildAthleteMemoryCandidates({
  profileId,
  session = {},
  nextStats = {},
  nextClass = null,
  survival = {},
} = {}) {
  const candidates = []
  const now = new Date().toISOString()
  const weakest = weakestStat(nextStats)
  const dominantBlock = strongestBlock(session.blockMix || [])

  if (weakest) {
    candidates.push({
      profile_id: profileId,
      memory_type: 'constraint',
      scope: 'global',
      key: 'weakest_stat',
      summary: `${String(weakest.key).toUpperCase()} hatti en zayif kolon olarak kaliyor.`,
      value_jsonb: { stat: weakest.key, value: weakest.value, sourceSession: session.type },
      confidence: 0.92,
      source: 'system_derived',
      active: true,
      last_confirmed_at: now,
      last_used_at: now,
    })
  }

  if (nextClass?.id) {
    candidates.push({
      profile_id: profileId,
      memory_type: 'identity',
      scope: 'class',
      key: 'active_class_pattern',
      summary: `${nextClass.name} build'i su an baskin oynanis hattini temsil ediyor.`,
      value_jsonb: {
        classId: nextClass.id,
        className: nextClass.name,
        reason: nextClass.reason || '',
        signals: nextClass.signals || [],
      },
      confidence: 0.84,
      source: 'system_derived',
      active: true,
      last_confirmed_at: now,
      last_used_at: now,
    })
  }

  if ((session.tags || []).includes('parkour') || (session.tags || []).includes('acrobatics')) {
    candidates.push({
      profile_id: profileId,
      memory_type: 'sport_bias',
      scope: 'parkour',
      key: 'parkour_chain_state',
      summary: 'Parkour teknik zinciri aktif; landing ve reactive legs tekrar ediyor.',
      value_jsonb: {
        blocks: session.blockMix || [],
        chains: session.chains || [],
        evidence: (session.evidence || []).slice(0, 4),
      },
      confidence: 0.82,
      source: 'system_derived',
      active: true,
      last_confirmed_at: now,
      last_used_at: now,
    })
  }

  if ((session.missingChains || []).includes('direct trunk chain')) {
    candidates.push({
      profile_id: profileId,
      memory_type: 'constraint',
      scope: 'core',
      key: 'trunk_gap',
      summary: 'Direkt trunk/core zinciri hibrit seanslarda hala acik veriyor.',
      value_jsonb: {
        missingChains: session.missingChains || [],
        riskSignals: session.riskSignals || [],
        sourceSession: session.type,
      },
      confidence: 0.9,
      source: 'system_derived',
      active: true,
      last_confirmed_at: now,
      last_used_at: now,
    })
  }

  if (dominantBlock?.kind === 'locomotion' && Number(session.distanceKm) >= 1) {
    candidates.push({
      profile_id: profileId,
      memory_type: 'sport_bias',
      scope: 'outdoor',
      key: 'outdoor_locomotion_bias',
      summary: 'Outdoor locomotion bloklari build icinde anlamli pay tutuyor.',
      value_jsonb: {
        dominantBlock,
        distanceKm: Number(session.distanceKm) || 0,
        tags: session.tags || [],
      },
      confidence: 0.76,
      source: 'system_derived',
      active: true,
      last_confirmed_at: now,
      last_used_at: now,
    })
  }

  if ((session.riskSignals || []).length || (survival.warnings || []).length) {
    candidates.push({
      profile_id: profileId,
      memory_type: 'recovery',
      scope: 'recovery',
      key: 'active_risk_pattern',
      summary: (survival.warnings || [])[0] || (session.riskSignals || [])[0] || 'Recovery riski takip edilmeli.',
      value_jsonb: {
        riskSignals: session.riskSignals || [],
        survivalWarnings: survival.warnings || [],
        status: survival.status || 'healthy',
      },
      confidence: 0.79,
      source: 'system_derived',
      active: true,
      last_confirmed_at: now,
      last_used_at: now,
    })
  }

  return candidates.slice(0, 5)
}

export function summarizeBodyMetricsTrend(history = [], current = {}) {
  const normalized = sortByNewest(history.map(item => normalizeBodyMetricsHistoryRow(item)), 'date')
  const currentWeight = Number(current.weightKg) || normalized[0]?.weightKg || null
  const currentHeight = Number(current.heightCm) || normalized[0]?.heightCm || null
  const latest = normalized[0] || null
  const oldest = normalized[normalized.length - 1] || null
  const deltaKg = latest?.weightKg != null && oldest?.weightKg != null && normalized.length > 1
    ? Math.round((latest.weightKg - oldest.weightKg) * 10) / 10
    : 0

  return {
    currentWeightKg: currentWeight,
    currentHeightCm: currentHeight,
    deltaKg,
    samples: normalized.length,
    latestDate: latest?.date || null,
    history: normalized.slice(0, 5),
  }
}

export function summarizeFeedbackLoop(feedback = []) {
  const normalized = sortByNewest(feedback.map(item => normalizeMemoryFeedbackRow(item)))
  const counts = normalized.reduce((acc, item) => {
    const key = item.feedbackType || 'correct'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return {
    total: normalized.length,
    correct: counts.correct || 0,
    wrong: counts.wrong || 0,
    outdated: counts.outdated || 0,
    prefer: counts.prefer || 0,
    latest: normalized.slice(0, 4),
  }
}

export function summarizeBlockArchive(blocks = []) {
  const totals = {}
  for (const raw of blocks.map(item => normalizeWorkoutBlockRow(item))) {
    const bucket = totals[raw.kind] || {
      kind: raw.kind,
      count: 0,
      weightPct: 0,
      durationMin: 0,
      distanceKm: 0,
      tags: new Set(),
    }
    bucket.count += 1
    bucket.weightPct += Number(raw.weightPct) || 0
    bucket.durationMin += Number(raw.durationMin) || 0
    bucket.distanceKm += Number(raw.distanceKm) || 0
    for (const tag of raw.tags || []) bucket.tags.add(tag)
    totals[raw.kind] = bucket
  }

  return Object.values(totals)
    .map(item => ({
      kind: item.kind,
      count: item.count,
      weightPct: Math.round(item.weightPct / Math.max(1, item.count)),
      durationMin: Math.round(item.durationMin),
      distanceKm: Math.round(item.distanceKm * 10) / 10,
      tags: [...item.tags].slice(0, 4),
    }))
    .sort((left, right) => right.count - left.count || right.weightPct - left.weightPct)
    .slice(0, 6)
}

export function summarizeFactArchive(facts = []) {
  return sortByNewest(facts.map(item => normalizeWorkoutFactRow(item)))
    .slice(0, 8)
    .map(item => ({
      id: item.id,
      label: item.label || item.blockKind,
      raw: item.raw,
      blockKind: item.blockKind,
      distanceKm: item.distanceKm,
      durationMin: item.durationMin,
      confidence: item.confidence,
      createdAt: item.createdAt,
    }))
}
