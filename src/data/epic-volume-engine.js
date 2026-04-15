/**
 * Epic Volume & Geography Engine
 * -------------------------------
 * Tier eşiklerini tarar, mevcut değer için geçilen ve sonraki hedefi döner.
 * UI ise "Şu anda X, %YY → Z" gibi epic bir mesaj üretebilir.
 */

import { VOLUME_TIERS, GEOGRAPHY_TIERS, DEPTH_TIERS } from './epic-volume-config.js'

function _scan(tiers, value, key) {
  let achieved = null
  let next = tiers[0]
  for (const t of tiers) {
    if (value >= t[key]) {
      achieved = t
      next = tiers[tiers.indexOf(t) + 1] || null
    } else {
      next = t
      break
    }
  }
  const prev = achieved ? achieved[key] : 0
  const target = next ? next[key] : prev
  const span = Math.max(1, target - prev)
  const progress = next ? Math.min(1, (value - prev) / span) : 1
  return { achieved, next, progress }
}

export function computeVolumeTier(totalVolumeKg) {
  const r = _scan(VOLUME_TIERS, totalVolumeKg, 'kg')
  return {
    value: totalVolumeKg,
    unit: 'kg',
    achieved: r.achieved,
    next: r.next,
    progress: r.progress,
    message: _buildMsg(r, totalVolumeKg, 'kg'),
  }
}

export function computeGeographyTier(totalKm) {
  const r = _scan(GEOGRAPHY_TIERS, totalKm, 'km')
  return {
    value: totalKm,
    unit: 'km',
    achieved: r.achieved,
    next: r.next,
    progress: r.progress,
    message: _buildMsg(r, totalKm, 'km'),
  }
}

export function computeDepthTier(totalMeters) {
  const r = _scan(DEPTH_TIERS, totalMeters, 'm')
  return {
    value: totalMeters,
    unit: 'm',
    achieved: r.achieved,
    next: r.next,
    progress: r.progress,
    message: _buildMsg(r, totalMeters, 'm'),
  }
}

function _buildMsg(r, value, unit) {
  if (!r.achieved && r.next) {
    const pct = Math.round(r.progress * 100)
    return `${r.next.icon} ${r.next.name} hedefine %${pct} — ilk epic tier bekliyor.`
  }
  if (r.achieved && r.next) {
    const remaining = r.next[unit === 'kg' ? 'kg' : unit === 'km' ? 'km' : 'm'] - value
    const pct = Math.round(r.progress * 100)
    return `${r.achieved.icon} ${r.achieved.name} aşıldı. ${r.next.name} hedefine %${pct} — ${_fmt(remaining, unit)} kaldı.`
  }
  if (r.achieved && !r.next) {
    return `${r.achieved.icon} ${r.achieved.name} — son tier tamamlandı. Efsane.`
  }
  return 'Henüz veri yok.'
}

function _fmt(v, unit) {
  if (unit === 'kg') return `${Math.round(v).toLocaleString('tr-TR')} kg`
  if (unit === 'km') return `${v.toFixed(1)} km`
  return `${Math.round(v)} m`
}

/**
 * Antrenmanlardan toplam mesafeyi çıkar.
 * Yürüyüş/Parkour için km hesaplaması — duration_min * ortalama hız (km/h).
 * Güvenli varsayım: Yürüyüş 5 km/h, Parkour 6 km/h (kesikli ama yol kat eder), Akrobasi 0.
 */
export function estimateKm(workouts) {
  const rates = { 'Yürüyüş': 5, 'Yuruyus': 5, 'Parkour': 6 }
  let km = 0
  for (const w of workouts || []) {
    const rate = rates[w.type] || 0
    if (!rate) continue
    km += (w.durationMin || w.duration_min || 0) / 60 * rate
  }
  return km
}
