/**
 * Performance Engine — antrenmanlardan dinamik performans metrikleri türetir.
 * Bench PR, Muscle-Up max reps, Dead Hang max sn, Parkour aktivitesi vs.
 *
 * Her seansla yeni rekor kırıldıysa değer + trend otomatik güncellenir.
 */

function _findExercise(workouts, keywords) {
  // En son antrenmandan geriye doğru, adı keywords'le eşleşen egzersizleri topla
  const hits = []
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      const name = (ex.name || '').toLowerCase()
      if (keywords.some(k => name.includes(k))) {
        hits.push({ workout: w, ex })
      }
    }
  }
  return hits
}

function _maxWeightReps(hits) {
  let best = { weight: 0, reps: 0, date: null }
  for (const { workout, ex } of hits) {
    for (const s of (ex.sets || [])) {
      const w = Number(s.weightKg ?? s.weight_kg) || 0
      const r = Number(s.reps) || 0
      if (w > best.weight || (w === best.weight && r > best.reps)) {
        best = { weight: w, reps: r, date: workout.date }
      }
    }
  }
  return best
}

function _maxReps(hits) {
  let best = { reps: 0, date: null }
  for (const { workout, ex } of hits) {
    for (const s of (ex.sets || [])) {
      const r = Number(s.reps) || 0
      if (r > best.reps) best = { reps: r, date: workout.date }
    }
  }
  return best
}

function _maxDuration(hits) {
  let best = { sec: 0, date: null }
  for (const { workout, ex } of hits) {
    for (const s of (ex.sets || [])) {
      const d = Number(s.durationSec ?? s.duration_sec) || 0
      if (d > best.sec) best = { sec: d, date: workout.date }
    }
  }
  return best
}

function _trend(current, previous) {
  if (previous == null || previous === 0) return { text: '🆕 Yeni', color: 'var(--gold)' }
  const delta = current - previous
  if (delta > 0) return { text: `📈 +${delta.toFixed(delta >= 10 ? 0 : 1)}`, color: 'var(--grn)' }
  if (delta < 0) return { text: `📉 ${delta.toFixed(delta <= -10 ? 0 : 1)}`, color: 'var(--red)' }
  return { text: '➡️ Stabil', color: 'var(--dim)' }
}

/**
 * Geçmiş aylardan değerleri seed olarak al, workouts'tan son ayları eklemeye çalış.
 * seedHistory formatı: [{ date: 'Ock', val: 40 }, ...]
 */
function _mergeHistory(seedHistory, currentVal, currentMonth) {
  if (!Array.isArray(seedHistory)) return [{ date: currentMonth, val: currentVal }]
  const last = seedHistory[seedHistory.length - 1]
  if (last?.date === currentMonth) {
    // Son aydaki değeri güncelle
    return [...seedHistory.slice(0, -1), { date: currentMonth, val: currentVal }]
  }
  return [...seedHistory, { date: currentMonth, val: currentVal }]
}

const MONTH_TR = ['Ock','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara']
function _currentMonth() { return MONTH_TR[new Date().getMonth()] }

/**
 * Static performance seed array'ini workouts'a göre günceller.
 */
export function updatePerformance(performanceSeed, workouts) {
  if (!Array.isArray(performanceSeed)) return performanceSeed || []
  const month = _currentMonth()

  return performanceSeed.map(perf => {
    switch (perf.key) {
      case 'bench': {
        const hits = _findExercise(workouts, ['bench'])
        const best = _maxWeightReps(hits)
        if (best.weight === 0) return perf
        const lastHistVal = perf.history?.[perf.history.length - 2]?.val ?? 0
        const trend = _trend(best.weight, lastHistVal)
        return {
          ...perf,
          val: `${best.weight} kg`,
          trend: trend.text, trendColor: trend.color,
          note: best.weight > lastHistVal ? `${best.weight}kg PR kırıldı — ${best.date}` : perf.note,
          history: _mergeHistory(perf.history, best.weight, month),
        }
      }
      case 'mu': {
        const hits = _findExercise(workouts, ['muscle-up', 'muscle up'])
        const best = _maxReps(hits)
        if (best.reps === 0) return perf
        const lastHistVal = perf.history?.[perf.history.length - 2]?.val ?? 0
        const trend = _trend(best.reps, lastHistVal)
        return {
          ...perf,
          val: `${best.reps} rep`,
          trend: trend.text, trendColor: trend.color,
          note: best.reps > lastHistVal ? `${best.reps} clean rep — ${best.date}` : perf.note,
          history: _mergeHistory(perf.history, best.reps, month),
        }
      }
      case 'hang': {
        const hits = _findExercise(workouts, ['dead hang', 'hang'])
        const best = _maxDuration(hits)
        if (best.sec === 0) return perf
        const lastHistVal = perf.history?.[perf.history.length - 2]?.val ?? 0
        const trend = _trend(best.sec, lastHistVal)
        const mm = Math.floor(best.sec / 60)
        const ss = best.sec % 60
        return {
          ...perf,
          val: mm > 0 ? `${mm}:${String(ss).padStart(2,'0')}` : `${best.sec}sn`,
          trend: best.sec >= 75 ? '👑 Elite' : trend.text,
          trendColor: best.sec >= 75 ? 'var(--grn)' : trend.color,
          history: _mergeHistory(perf.history, best.sec, month),
        }
      }
      case 'flip': {
        const parkour = workouts.filter(w => w.type === 'Parkour' || w.type === 'Akrobasi')
        if (!parkour.length) return perf
        const recent = parkour.slice(0, 5)
        return {
          ...perf,
          val: recent.length >= 2 ? 'Aktif 🔥' : 'Ara',
          trend: recent.length >= 2 ? '📈 Gelişiyor' : '⏸ Duraklama',
          trendColor: recent.length >= 2 ? 'var(--grn)' : 'var(--org)',
          note: `Son ${recent.length} parkour/akro seansı — ${recent[0]?.date}`,
        }
      }
      default:
        return perf
    }
  })
}
