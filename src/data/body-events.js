import { getLocalDateString, normalizeDateString, normalizeText } from './rules.js'

export const BODY_REGION_OPTIONS = [
  { id: 'shoulder', label: 'Omuz' },
  { id: 'chest', label: 'Gogus' },
  { id: 'upper-back', label: 'Ust sirt' },
  { id: 'lat', label: 'Kanat' },
  { id: 'core', label: 'Core' },
  { id: 'lower-back', label: 'Bel' },
  { id: 'hips', label: 'Kalca' },
  { id: 'quads', label: 'On bacak' },
  { id: 'hamstrings', label: 'Arka zincir' },
  { id: 'knees', label: 'Diz' },
  { id: 'calves', label: 'Kalf' },
  { id: 'ankles', label: 'Ayak bilegi' },
  { id: 'forearm', label: 'On kol / grip' },
  { id: 'wrist', label: 'Bilek' },
]

const REGION_LABELS = Object.fromEntries(BODY_REGION_OPTIONS.map(item => [item.id, item.label]))
const ACTIVE_STATUSES = new Set(['active', 'watch', 'rehab'])

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function addDays(dateStr, days = 0) {
  const base = new Date(`${normalizeDateString(dateStr)}T00:00:00`)
  base.setDate(base.getDate() + Math.max(0, Math.round(Number(days) || 0)))
  return getLocalDateString(base)
}

function subtractDays(dateStr, days = 0) {
  const base = new Date(`${normalizeDateString(dateStr)}T00:00:00`)
  base.setDate(base.getDate() - Math.max(0, Math.round(Number(days) || 0)))
  return getLocalDateString(base)
}

function dayDiff(fromDate, toDate) {
  const from = new Date(`${normalizeDateString(fromDate)}T00:00:00`).getTime()
  const to = new Date(`${normalizeDateString(toDate)}T00:00:00`).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(0, Math.ceil((to - from) / 86400000))
}

function resolveRecoveryStart(input = {}, expectedClearAt = '', today = getLocalDateString()) {
  const explicit = normalizeDateString(
    input.recoveryStartAt
      || input.recovery_start_at
      || input.startedAt
      || input.started_at
      || input.createdAt
      || input.created_at
      || input.loggedAt
      || input.logged_at
      || input.date
      || input.day
      || '',
    '',
  )
  if (explicit) return explicit
  const originalEta = Number(input.initialEtaDays ?? input.initial_eta_days ?? input.etaDays ?? input.eta_days ?? input.daysRemaining ?? input.days_remaining)
  if (expectedClearAt && Number.isFinite(originalEta) && originalEta > 0) return subtractDays(expectedClearAt, originalEta)
  return normalizeDateString(today)
}

function timedRecoveryPercent(baseRecovery = 0, recoveryStartAt = '', expectedClearAt = '', today = getLocalDateString()) {
  if (!expectedClearAt) return clamp(baseRecovery)
  const totalDays = dayDiff(recoveryStartAt, expectedClearAt)
  const elapsedDays = dayDiff(recoveryStartAt, today)
  if (totalDays <= 0) return clamp(baseRecovery)
  const ratio = clamp(elapsedDays / totalDays, 0, 1)
  const projected = baseRecovery + ((100 - baseRecovery) * ratio)
  return clamp(Math.round(Math.max(baseRecovery, projected)))
}

export function regionLabel(regionId = '') {
  return REGION_LABELS[regionId] || 'Vucut'
}

export function normalizeRegionId(value = '') {
  const normalized = normalizeText(value)
  const direct = BODY_REGION_OPTIONS.find(item => item.id === normalized)
  if (direct) return direct.id
  const alias = {
    bilek: 'wrist',
    bilegi: 'wrist',
    wrist: 'wrist',
    omuz: 'shoulder',
    shoulder: 'shoulder',
    diz: 'knees',
    knee: 'knees',
    knees: 'knees',
    ayak: 'ankles',
    ayakbilegi: 'ankles',
    ankle: 'ankles',
    ankles: 'ankles',
    bel: 'lower-back',
    back: 'lower-back',
    kalca: 'hips',
    hip: 'hips',
    core: 'core',
    grip: 'forearm',
    forearm: 'forearm',
    onkol: 'forearm',
  }[normalized]
  return alias || normalized || 'core'
}

export function interpretBodyEvent(input = {}) {
  const region = normalizeRegionId(input.region || input.regionId || input.region_id)
  const label = regionLabel(region)
  const severity = clamp(input.severity, 1, 5)
  const recovery = clamp(input.recoveryPercent ?? input.recovery_percent ?? input.recoveryPct ?? input.recovery_pct, 0, 100)
  const eta = Math.max(0, Math.round(Number(input.etaDays ?? input.eta_days) || 0))
  const hard = severity >= 4 || recovery < 45
  const tone = hard ? 'kilit' : 'temkin'

  const templates = {
    wrist: {
      locks: 'Agir grip, bar, handstand, sert push ve ani landing yok.',
      free: 'Yuruyus, alt govde, core kontrol ve nazik bilek mobilitesi serbest.',
      command: 'Bilek temkinde: grip ve sert push kilitli, hareket temiz ve dusuk riskli kalsin.',
    },
    shoulder: {
      locks: 'Agir overhead, dip derinligi ve handstand baskisi yok.',
      free: 'Scapula kontrol, hafif row, yuruyus ve alt govde serbest.',
      command: 'Omuz kalkanini koru: ust govdeyi teknik tut, mobiliteyi kacirma.',
    },
    knees: {
      locks: 'Sert landing, depth jump, agresif sprint ve yuksek hacimli squat yok.',
      free: 'Kontrollu yuruyus, kalca mobilitesi ve dusuk yuk kuvvet serbest.',
      command: 'Diz hattini sakin tut: inis ve patlayicilik bugun kilitli.',
    },
    ankles: {
      locks: 'Sert zemin, drop, precision ve ani yon degisimi yok.',
      free: 'Nazik mobilite, duz yuruyus ve kontrollu calf aktivasyonu serbest.',
      command: 'Ayak bilegi alarmda: zemini kolay sec, landing kovalamiyoruz.',
    },
    'lower-back': {
      locks: 'Agir hinge, deadlift, carry ve ani rotasyon yok.',
      free: 'Nefes, core brace, yuruyus ve mobilite serbest.',
      command: 'Bel hattini koru: yuk degil, govde kontrolu yaz.',
    },
  }

  const selected = templates[region] || {
    locks: `${label} uzerine agir yuk ve PR denemesi yok.`,
    free: 'Yuruyus, mobilite ve dusuk riskli teknik is serbest.',
    command: `${label} temkinde: bugun temiz hareket, kisa blok ve risk azaltma.`,
  }

  return {
    tone,
    summary: `${label}: %${Math.round(recovery)} toparlandi${eta ? `, ${eta} gun temkin` : ''}.`,
    locks: selected.locks,
    free: selected.free,
    command: selected.command,
  }
}

export function normalizeBodyEvent(input = {}, { today = getLocalDateString() } = {}) {
  const region = normalizeRegionId(input.region || input.regionId || input.region_id || input.linkedRegion)
  const kind = normalizeText(input.kind || 'injury') || 'injury'
  const baseRecoveryPercent = clamp(
    input.baseRecoveryPercent
      ?? input.base_recovery_percent
      ?? input.initialRecoveryPercent
      ?? input.initial_recovery_percent
      ?? input.storedRecoveryPercent
      ?? input.stored_recovery_percent
      ?? input.recovery_percent
      ?? input.recoveryPct
      ?? input.recovery_pct
      ?? input.recoveryPercent
      ?? input.recovery,
    0,
    100,
  )
  const expectedClearAt = normalizeDateString(
    input.expectedClearAt || input.expected_clear_at || input.clearAt || input.clear_at || '',
    '',
  ) || addDays(today, input.etaDays ?? input.eta_days ?? input.daysRemaining ?? input.days_remaining ?? 0)
  const recoveryStartAt = resolveRecoveryStart(input, expectedClearAt, today)
  const recoveryPercent = timedRecoveryPercent(baseRecoveryPercent, recoveryStartAt, expectedClearAt, today)
  const etaDays = dayDiff(today, expectedClearAt)
  const status = String(input.status || (etaDays > 0 ? 'active' : 'watch')).toLowerCase()
  const severity = clamp(input.severity ?? (100 - recoveryPercent) / 20, 1, 5)
  const recoveredByTime = recoveryPercent >= 100 && etaDays <= 0
  const base = {
    id: input.id || null,
    kind,
    region,
    regionId: region,
    side: String(input.side || 'unknown').toLowerCase(),
    severity: Math.round(severity),
    baseRecoveryPercent,
    baseRecoveryPct: baseRecoveryPercent,
    recoveryPercent,
    recoveryPct: recoveryPercent,
    remainingPct: clamp(100 - recoveryPercent),
    expectedClearAt,
    recoveryStartAt,
    etaDays,
    status,
    note: String(input.note || '').trim(),
    source: input.source || 'manual',
    createdAt: input.createdAt || input.created_at || null,
    updatedAt: input.updatedAt || input.updated_at || null,
  }
  const interpretation = input.odieInterpretation || input.odie_interpretation || interpretBodyEvent(base)
  return {
    ...base,
    label: input.label || `${regionLabel(region)} ${kind === 'pain' ? 'agri sinyali' : 'sakatligi'}`,
    odieInterpretation: interpretation,
    active: ACTIVE_STATUSES.has(status) && !recoveredByTime,
  }
}

export function normalizeBodyEventRow(row = {}) {
  return normalizeBodyEvent({
    id: row.id,
    kind: row.kind,
    region: row.region,
    side: row.side,
    severity: row.severity,
    recovery_percent: row.recovery_percent,
    expected_clear_at: row.expected_clear_at,
    status: row.status,
    note: row.note,
    source: row.source,
    odie_interpretation: row.odie_interpretation,
    created_at: row.created_at,
    updated_at: row.updated_at,
  })
}

export function applyBodyEventAction(event = {}, patch = {}, { today = getLocalDateString() } = {}) {
  const current = normalizeBodyEvent(event, { today })
  const action = String(patch.action || patch.type || 'set_recovery').trim()
  const amount = Number(patch.amount ?? patch.delta ?? 10)
  const explicitRecovery = Number(patch.recoveryPercent ?? patch.recovery_percent ?? patch.value)
  let recoveryPercent = current.recoveryPercent
  let status = current.status || 'active'
  let expectedClearAt = current.expectedClearAt || addDays(today, current.etaDays || 0)

  if (action === 'increase_recovery') {
    recoveryPercent = clamp(current.recoveryPercent + (Number.isFinite(amount) ? amount : 10), 0, 100)
  } else if (action === 'resolve') {
    recoveryPercent = 100
    status = 'resolved'
    expectedClearAt = today
  } else if (action === 'archive') {
    status = 'archived'
  } else {
    recoveryPercent = clamp(Number.isFinite(explicitRecovery) ? explicitRecovery : current.recoveryPercent, 0, 100)
  }

  if (action !== 'archive' && recoveryPercent >= 100) {
    recoveryPercent = 100
    status = 'resolved'
    expectedClearAt = today
  }

  if (action !== 'archive' && recoveryPercent < 100 && !ACTIVE_STATUSES.has(status)) {
    status = 'active'
  }

  if (patch.etaDays != null || patch.eta_days != null) {
    expectedClearAt = addDays(today, patch.etaDays ?? patch.eta_days)
  }
  if (patch.expectedClearAt || patch.expected_clear_at) {
    expectedClearAt = normalizeDateString(patch.expectedClearAt || patch.expected_clear_at, expectedClearAt)
  }

  return normalizeBodyEvent({
    ...current,
    recoveryPercent,
    baseRecoveryPercent: recoveryPercent,
    expectedClearAt,
    recoveryStartAt: today,
    status,
    note: patch.note != null ? String(patch.note || '').trim() : current.note,
    updatedAt: new Date().toISOString(),
  }, { today })
}

export function toSupabaseBodyEvent(event = {}) {
  const normalized = normalizeBodyEvent(event)
  return {
    kind: normalized.kind,
    region: normalized.region,
    side: normalized.side,
    severity: normalized.severity,
    recovery_percent: normalized.baseRecoveryPercent ?? normalized.recoveryPercent,
    expected_clear_at: normalized.expectedClearAt,
    status: normalized.status,
    note: normalized.note,
    source: normalized.source,
    odie_interpretation: normalized.odieInterpretation,
  }
}

export function bodyEventToInjury(event = {}, options = {}) {
  const normalized = normalizeBodyEvent(event, options)
  if (!normalized.active) return null
  return {
    id: normalized.id || `${normalized.region}_body_event`,
    regionId: normalized.region,
    label: normalized.label,
    tissue: normalized.kind === 'pain' ? 'Agri sinyali' : 'Kas temelli',
    recoveryPct: normalized.recoveryPercent,
    remainingPct: normalized.remainingPct,
    etaDays: normalized.etaDays,
    note: normalized.note || normalized.odieInterpretation?.command || '',
    source: normalized.source === 'manual' ? 'Beden kaydi' : normalized.source,
    active: true,
    severity: normalized.severity,
    odieInterpretation: normalized.odieInterpretation,
  }
}

export function getActiveBodyEvents(events = [], today = getLocalDateString()) {
  return (events || [])
    .map(event => normalizeBodyEvent(event, { today }))
    .filter(event => event.active)
    .sort((left, right) => (right.severity - left.severity) || (left.expectedClearAt || '').localeCompare(right.expectedClearAt || ''))
}

export function bodyEventFromInjury(injury = {}) {
  return normalizeBodyEvent({
    id: injury.id,
    kind: injury.kind || 'injury',
    region: injury.regionId || injury.region_id,
    severity: injury.severity || 3,
    recoveryPercent: injury.recoveryPct ?? injury.recovery_pct ?? injury.recoveryPercent,
    expectedClearAt: injury.expectedClearAt ?? injury.expected_clear_at,
    etaDays: injury.etaDays ?? injury.eta_days,
    status: injury.active === false ? 'resolved' : 'active',
    note: injury.note || '',
    source: injury.source || 'seed',
    label: injury.label,
    createdAt: injury.createdAt ?? injury.created_at,
    updatedAt: injury.updatedAt ?? injury.updated_at,
  })
}
