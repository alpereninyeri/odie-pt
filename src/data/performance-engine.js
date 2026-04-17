import { formatMonthShort, normalizeSession } from './rules.js'

function _findExercise(workouts, keywords) {
  const hits = []
  for (const workout of workouts) {
    for (const exercise of (workout.exercises || [])) {
      const name = String(exercise.name || '').toLocaleLowerCase('tr-TR')
      if (keywords.some(keyword => name.includes(keyword))) {
        hits.push({ workout, exercise })
      }
    }
  }
  return hits
}

function _maxWeightReps(hits) {
  let best = { weight: 0, reps: 0, date: null }
  for (const hit of hits) {
    for (const set of (hit.exercise.sets || [])) {
      const weight = Number(set.weightKg ?? set.weight_kg) || 0
      const reps = Number(set.reps) || 0
      if (weight > best.weight || (weight === best.weight && reps > best.reps)) {
        best = { weight, reps, date: hit.workout.date }
      }
    }
  }
  return best
}

function _maxReps(hits) {
  let best = { reps: 0, date: null }
  for (const hit of hits) {
    for (const set of (hit.exercise.sets || [])) {
      const reps = Number(set.reps) || 0
      if (reps > best.reps) best = { reps, date: hit.workout.date }
    }
  }
  return best
}

function _maxDuration(hits) {
  let best = { sec: 0, date: null }
  for (const hit of hits) {
    for (const set of (hit.exercise.sets || [])) {
      const duration = Number(set.durationSec ?? set.duration_sec) || 0
      if (duration > best.sec) best = { sec: duration, date: hit.workout.date }
    }
  }
  return best
}

function _trend(current, previous) {
  if (previous == null || previous === 0) return { text: '🆕 Yeni', color: 'var(--amber)' }
  const delta = current - previous
  if (delta > 0) return { text: `📈 +${delta.toFixed(delta >= 10 ? 0 : 1)}`, color: 'var(--emerald)' }
  if (delta < 0) return { text: `📉 ${delta.toFixed(delta <= -10 ? 0 : 1)}`, color: 'var(--coral)' }
  return { text: '→ Stabil', color: 'var(--dim)' }
}

function _mergeHistory(seedHistory, currentVal, currentMonth) {
  if (!Array.isArray(seedHistory)) return [{ date: currentMonth, val: currentVal }]
  const last = seedHistory[seedHistory.length - 1]
  if (last?.date === currentMonth) {
    return [...seedHistory.slice(0, -1), { date: currentMonth, val: currentVal }]
  }
  return [...seedHistory, { date: currentMonth, val: currentVal }]
}

function _currentMonth(workouts) {
  const latest = workouts[0]?.date
  return formatMonthShort(latest || new Date().toISOString()).split(' ')[1] || 'Nis'
}

export function updatePerformance(performanceSeed, workouts) {
  if (!Array.isArray(performanceSeed)) return performanceSeed || []
  const normalizedWorkouts = (workouts || []).map(workout => normalizeSession(workout))
  const month = _currentMonth(normalizedWorkouts)

  return performanceSeed.map(perf => {
    switch (perf.key) {
      case 'bench': {
        const hits = _findExercise(normalizedWorkouts, ['bench'])
        const best = _maxWeightReps(hits)
        if (!best.weight) return perf
        const previous = perf.history?.[perf.history.length - 2]?.val ?? 0
        const trend = _trend(best.weight, previous)
        return {
          ...perf,
          val: `${best.weight} kg`,
          trend: trend.text,
          trendColor: trend.color,
          note: best.weight > previous ? `${best.weight}kg en iyi bench — ${best.date}` : perf.note,
          history: _mergeHistory(perf.history, best.weight, month),
        }
      }
      case 'mu': {
        const hits = _findExercise(normalizedWorkouts, ['muscle-up', 'muscle up'])
        const best = _maxReps(hits)
        if (!best.reps) return perf
        const previous = perf.history?.[perf.history.length - 2]?.val ?? 0
        const trend = _trend(best.reps, previous)
        return {
          ...perf,
          val: `${best.reps} rep`,
          trend: trend.text,
          trendColor: trend.color,
          note: best.reps > previous ? `${best.reps} clean rep — ${best.date}` : perf.note,
          history: _mergeHistory(perf.history, best.reps, month),
        }
      }
      case 'hang': {
        const hits = _findExercise(normalizedWorkouts, ['dead hang', 'hang'])
        const best = _maxDuration(hits)
        if (!best.sec) return perf
        const previous = perf.history?.[perf.history.length - 2]?.val ?? 0
        const trend = _trend(best.sec, previous)
        const minutes = Math.floor(best.sec / 60)
        const seconds = best.sec % 60
        return {
          ...perf,
          val: minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${best.sec}sn`,
          trend: best.sec >= 75 ? '👑 Elite' : trend.text,
          trendColor: best.sec >= 75 ? 'var(--emerald)' : trend.color,
          history: _mergeHistory(perf.history, best.sec, month),
        }
      }
      case 'flip': {
        const recent = normalizedWorkouts.filter(workout =>
          workout.primaryCategory === 'movement' || workout.tags.includes('parkour') || workout.tags.includes('acrobatics')
        ).slice(0, 5)
        if (!recent.length) return perf
        return {
          ...perf,
          val: recent.length >= 2 ? 'Aktif' : 'Beklemede',
          trend: recent.length >= 2 ? '📈 Gelişiyor' : '⏸ Duraklama',
          trendColor: recent.length >= 2 ? 'var(--emerald)' : 'var(--amber)',
          note: `Son ${recent.length} movement seansı — ${recent[0]?.date}`,
        }
      }
      default:
        return perf
    }
  })
}
