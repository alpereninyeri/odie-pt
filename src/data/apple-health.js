import { getLocalDateString, normalizeDateString, normalizeSession, normalizeText } from './rules.js'

function round(value, digits = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  const factor = 10 ** digits
  return Math.round(numeric * factor) / factor
}

function firstFinite(...values) {
  for (const value of values) {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

function toIso(value = '') {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function minutesBetween(startAt, endAt) {
  const start = startAt ? new Date(startAt).getTime() : NaN
  const end = endAt ? new Date(endAt).getTime() : NaN
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  return Math.round((end - start) / 60000)
}

function distanceKmFrom(input = {}) {
  const km = firstFinite(input.distanceKm, input.distance_km, input.distance)
  if (km != null && km > 0) return round(km, 2)
  const meters = firstFinite(input.distanceMeters, input.distance_meters, input.totalDistanceMeters)
  if (meters != null && meters > 0) return round(meters / 1000, 2)
  const miles = firstFinite(input.distanceMiles, input.distance_miles)
  if (miles != null && miles > 0) return round(miles * 1.609344, 2)
  return 0
}

export function normalizeAppleHealthActivityType(value = '') {
  const raw = normalizeText(value || 'walking')
  if (raw.includes('hik') || raw.includes('trail') || raw.includes('doga')) {
    return { type: 'Yuruyus', label: 'Doga yuruyusu', tags: ['walking', 'terrain', 'endurance', 'recovery'] }
  }
  if (raw.includes('run') || raw.includes('kos') || raw.includes('jog')) {
    return { type: 'Kosu', label: 'Kosu', tags: ['legs', 'endurance'] }
  }
  if (raw.includes('cycl') || raw.includes('bike') || raw.includes('bisiklet')) {
    return { type: 'Bisiklet', label: 'Bisiklet', tags: ['cycling', 'legs', 'endurance'] }
  }
  if (raw.includes('walk') || raw.includes('yuruy')) {
    return { type: 'Yuruyus', label: 'Yuruyus', tags: ['walking', 'endurance', 'recovery'] }
  }
  return { type: 'Custom', label: value || 'Apple Health aktivitesi', tags: ['endurance'] }
}

export function buildAppleHealthExternalId(input = {}) {
  if (input.externalId || input.external_id || input.id) return String(input.externalId || input.external_id || input.id)
  const start = toIso(input.startAt || input.start_at || input.startDate || input.start_date) || normalizeDateString(input.date, getLocalDateString())
  const type = normalizeText(input.activityType || input.activity_type || input.type || 'activity')
  const distance = distanceKmFrom(input)
  const duration = firstFinite(input.durationMin, input.duration_min, input.durationMinutes, input.duration_minutes) || 0
  return `apple-health:${type}:${start}:${distance}:${Math.round(duration)}`
}

export function normalizeAppleHealthPayload(input = {}, { now = new Date() } = {}) {
  const startAt = toIso(input.startAt || input.start_at || input.startDate || input.start_date || input.date) || now.toISOString()
  const endAt = toIso(input.endAt || input.end_at || input.endDate || input.end_date)
  const durationMin = Math.max(0, Math.round(
    firstFinite(input.durationMin, input.duration_min, input.durationMinutes, input.duration_minutes)
    ?? minutesBetween(startAt, endAt)
  ))
  const distanceKm = distanceKmFrom(input)
  const elevationM = Math.max(0, Math.round(firstFinite(input.elevationM, input.elevation_m, input.elevationGainM, input.elevation_gain_m) || 0))
  const steps = Math.max(0, Math.round(firstFinite(input.steps, input.stepCount, input.step_count) || 0))
  const activeEnergyKcal = Math.max(0, Math.round(firstFinite(input.activeEnergyKcal, input.active_energy_kcal, input.calories) || 0))
  const avgHeartRate = Math.max(0, Math.round(firstFinite(input.avgHeartRate, input.avg_heart_rate, input.heartRateAvg) || 0))
  const activity = normalizeAppleHealthActivityType(input.activityType || input.activity_type || input.type || 'walking')
  const routeName = String(input.routeName || input.route_name || input.locationName || '').trim()
  const date = normalizeDateString(input.date || startAt, getLocalDateString(now))
  const terrainTag = activity.tags.includes('terrain') || normalizeText(routeName).includes('trail')
  const tags = [...new Set([
    ...activity.tags,
    ...(terrainTag ? ['terrain'] : []),
    'apple_health',
  ])]
  const label = routeName ? `${activity.label} / ${routeName}` : activity.label
  const notes = [
    steps ? `${steps} adim` : '',
    elevationM ? `${elevationM}m yukselti` : '',
    activeEnergyKcal ? `${activeEnergyKcal} kcal` : '',
    avgHeartRate ? `ort nabiz ${avgHeartRate}` : '',
  ].filter(Boolean).join(' / ')

  const session = normalizeSession({
    date,
    type: activity.type,
    durationMin,
    distanceKm,
    elevationM,
    tags,
    blocks: [{
      kind: 'locomotion',
      label,
      tags,
      durationMin,
      distanceKm,
      source: 'apple_health',
    }],
    highlight: distanceKm ? `Apple Health: ${distanceKm} km ${activity.label}` : `Apple Health: ${activity.label}`,
    notes,
    source: 'apple_health',
    startedAt: startAt,
    createdAt: now.toISOString(),
    confidence: { score: 0.86, source: 'apple_health_shortcut' },
    facts: [{
      kind: 'locomotion',
      raw: JSON.stringify({ distanceKm, durationMin, steps, elevationM }),
      label,
      durationMin,
      distanceKm,
      blockKind: 'locomotion',
      signals: ['apple_health', activity.label],
      tags,
    }],
    evidence: [
      `Apple Health: ${activity.label}`,
      distanceKm ? `${distanceKm} km` : '',
      durationMin ? `${durationMin} dk` : '',
      steps ? `${steps} adim` : '',
    ].filter(Boolean),
  }, { source: 'apple_health', now })

  return {
    ...session,
    source: 'apple_health',
    externalSource: 'apple_health_shortcut',
    externalId: buildAppleHealthExternalId(input),
    rawExternal: input,
    healthMetrics: {
      steps,
      activeEnergyKcal,
      avgHeartRate,
      maxHeartRate: Math.max(0, Math.round(firstFinite(input.maxHeartRate, input.max_heart_rate, input.heartRateMax) || 0)),
      routeName,
      endAt,
    },
  }
}
