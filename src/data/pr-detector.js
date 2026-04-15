/**
 * PR (Personal Record) Dedektörü
 * Her egzersiz için en yüksek performans kaydını tutar ve yeni PR'ları tespit eder.
 * Score = weightKg × reps (güç egzersizleri) veya reps/durationSec (bodyweight/zaman)
 */

/**
 * Yeni antrenmanı mevcut PR'larla karşılaştır.
 * @param {Object} session - yeni antrenman (exercises dizisi ile)
 * @param {Object} currentPrs - mevcut PR'lar { 'Exercise Name': { score, ... } }
 * @returns {{ hasPr: boolean, newPrs: Object, updatedPrs: Object }}
 */
export function detectPRs(session, currentPrs = {}) {
  const updatedPrs = { ...currentPrs }
  const newPrs = {}

  ;(session.exercises || []).forEach(ex => {
    ;(ex.sets || []).forEach(set => {
      const score = _calcScore(set)
      if (score === 0) return

      const current = updatedPrs[ex.name]
      if (!current || score > current.score) {
        const pr = {
          weightKg:    set.weightKg || null,
          reps:        set.reps || null,
          durationSec: set.durationSec || null,
          score,
          date: session.date,
        }
        updatedPrs[ex.name] = pr
        newPrs[ex.name] = pr
      }
    })
  })

  return {
    hasPr: Object.keys(newPrs).length > 0,
    newPrs,
    updatedPrs,
  }
}

/**
 * PR özetini Türkçe metin olarak oluştur (coach notu için).
 */
export function prSummary(newPrs) {
  const entries = Object.entries(newPrs)
  if (!entries.length) return ''
  return entries.map(([name, pr]) => {
    if (pr.weightKg && pr.reps) return `${name}: ${pr.weightKg}kg × ${pr.reps} rep`
    if (pr.reps)                return `${name}: ${pr.reps} rep`
    if (pr.durationSec)         return `${name}: ${pr.durationSec}sn`
    return name
  }).join(', ')
}

function _calcScore(set) {
  if (set.weightKg && set.reps) return set.weightKg * set.reps
  if (set.reps)                 return set.reps
  if (set.durationSec)          return set.durationSec
  return 0
}
