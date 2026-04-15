/**
 * Streak Engine
 * Arka arkaya antrenman günlerini hesaplar.
 * Kural: 1 gün rest izni var — 2 gün geçerse streak sıfırlanır.
 */

/**
 * Mevcut workout listesine ve yeni antrenman tarihine göre streak hesapla.
 * @param {Array} workouts - mevcut workout'lar (tarih bazlı sıralı)
 * @param {string} newDate - yeni antrenman tarihi 'YYYY-MM-DD'
 * @returns {{ current: number, max: number, lastWorkoutDate: string, multiplier: number, label: string }}
 */
export function computeStreak(workouts, newDate) {
  // Tüm antrenman günlerini topla (duplicate günleri tek say)
  const allDates = [...new Set(workouts.map(w => w.date))]
  if (!allDates.includes(newDate)) allDates.push(newDate)
  allDates.sort((a, b) => a.localeCompare(b))

  // En son tarihten geriye doğru giderek streak say
  // (1 gün boşluk izni var — 2 gün üst üste boşsa sıfırla)
  let current = 1
  for (let i = allDates.length - 2; i >= 0; i--) {
    const gap = _dayDiff(allDates[i], allDates[i + 1])
    if (gap <= 2) {
      current++
    } else {
      break
    }
  }

  // Max streak — tarihsel en yüksek
  let max = 1
  let running = 1
  for (let i = 1; i < allDates.length; i++) {
    const gap = _dayDiff(allDates[i - 1], allDates[i])
    if (gap <= 2) {
      running++
      if (running > max) max = running
    } else {
      running = 1
    }
  }

  const multiplier = _streakMultiplier(current)
  const label = _streakLabel(current)

  return { current, max, lastWorkoutDate: newDate, multiplier, label }
}

/**
 * Streak kırılıp kırılmadığını kontrol et (sayfa yüklenirken çağrılır).
 * lastWorkoutDate'ten bugüne 2+ gün geçmişse streak sıfırlanır.
 */
export function checkStreakIntact(streak, today = _todayStr()) {
  if (!streak.lastWorkoutDate) return streak
  const gap = _dayDiff(streak.lastWorkoutDate, today)
  if (gap > 2) {
    return { ...streak, current: 0, multiplier: 1.0, label: '' }
  }
  return streak
}

function _dayDiff(dateA, dateB) {
  const a = new Date(dateA)
  const b = new Date(dateB)
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

function _todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function _streakMultiplier(days) {
  if (days >= 30) return 2.0
  if (days >= 14) return 1.5
  if (days >= 7)  return 1.25
  if (days >= 3)  return 1.1
  return 1.0
}

function _streakLabel(days) {
  if (days >= 30) return '⚡ Efsane'
  if (days >= 14) return '💀 Durdurulamaz'
  if (days >= 7)  return '🔥🔥 Yanıyor'
  if (days >= 3)  return '🔥 Ateşlendi'
  return ''
}
