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

function _sumSets(hits) {
  return hits.reduce((sum, hit) => sum + (hit.exercise.sets || []).length, 0)
}

function _trend(current, previous) {
  if (previous == null || previous === 0) return { text: 'Yeni sinyal', color: 'var(--amber)' }
  const delta = current - previous
  if (delta > 0) return { text: `+${delta.toFixed(delta >= 10 ? 0 : 1)}`, color: 'var(--emerald)' }
  if (delta < 0) return { text: `${delta.toFixed(delta <= -10 ? 0 : 1)}`, color: 'var(--coral)' }
  return { text: 'Stabil', color: 'var(--dim)' }
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

function _estimateOneRm(weight, reps) {
  if (!weight) return 0
  return Math.round(weight * (1 + (Math.max(1, reps) / 30)))
}

function _latestWorkoutDate(workouts, predicate) {
  const hit = workouts.find(predicate)
  return hit?.date || null
}

function _coachOverride(group, key, field) {
  const entry = group?.[key]
  if (!entry || entry[field] == null) return null
  return entry[field]
}

function _coachDetails(entry) {
  if (!Array.isArray(entry?.details)) return null
  return entry.details.slice(0, 4).map((val, index) => ({
    label: ['Peak', 'Trend', 'Driver', 'Next'][index] || `Item ${index + 1}`,
    val: String(val || '-'),
  }))
}

export function updatePerformance(performanceSeed, workouts, coachPayload = null) {
  if (!Array.isArray(performanceSeed)) return performanceSeed || []
  const normalizedWorkouts = (workouts || []).map(workout => normalizeSession(workout))
  const month = _currentMonth(normalizedWorkouts)
  const coachPerf = coachPayload?.performance || null

  return performanceSeed.map(perf => {
    switch (perf.key) {
      case 'bench': {
        const hits = _findExercise(normalizedWorkouts, ['bench'])
        const best = _maxWeightReps(hits)
        if (!best.weight) return perf
        const previous = perf.history?.[perf.history.length - 2]?.val ?? 0
        const trend = _trend(best.weight, previous)
        const oneRm = _estimateOneRm(best.weight, best.reps)
        const recentPushDate = _latestWorkoutDate(normalizedWorkouts, workout => workout.primaryCategory === 'strength')
        const coachDetails = _coachDetails(coachPerf?.bench)
        return {
          ...perf,
          val: `${best.weight} kg`,
          trend: trend.text,
          trendColor: trend.color,
          note: _coachOverride(coachPerf, 'bench', 'note') || `En iyi bench ${best.weight}kg x${best.reps} - ${best.date}`,
          tip: _coachOverride(coachPerf, 'bench', 'tip') || `Push hattin guncel. Son kuvvet izi ${recentPushDate || best.date}; bir sonraki hedef ${best.weight + 2.5}kg civari olabilir.`,
          history: _mergeHistory(perf.history, best.weight, month),
          details: coachDetails || [
            { label: 'Peak', val: `${best.weight}kg x${best.reps}` },
            { label: '1RM Est.', val: `${oneRm}kg` },
            { label: 'Bench Sets', val: String(_sumSets(hits)) },
            { label: 'Next', val: `${(best.weight + 2.5).toFixed(best.weight % 1 ? 1 : 0)}kg` },
          ],
        }
      }
      case 'mu': {
        const hits = _findExercise(normalizedWorkouts, ['muscle-up', 'muscle up'])
        const best = _maxReps(hits)
        if (!best.reps) return perf
        const previous = perf.history?.[perf.history.length - 2]?.val ?? 0
        const trend = _trend(best.reps, previous)
        const coachDetails = _coachDetails(coachPerf?.mu)
        return {
          ...perf,
          val: `${best.reps} rep`,
          trend: trend.text,
          trendColor: trend.color,
          note: _coachOverride(coachPerf, 'mu', 'note') || `En temiz muscle-up sinyali ${best.reps} rep - ${best.date}`,
          tip: _coachOverride(coachPerf, 'mu', 'tip') || `Cekis ve bar gecisi halen ana driver. ${Math.max(0, 5 - best.reps)} rep daha geldiginde 5 clean kapisi acilir.`,
          history: _mergeHistory(perf.history, best.reps, month),
          details: coachDetails || [
            { label: 'Peak', val: `${best.reps} rep` },
            { label: 'Trend', val: trend.text },
            { label: 'MU Sets', val: String(_sumSets(hits)) },
            { label: 'Next', val: `${Math.max(best.reps + 1, 4)} rep` },
          ],
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
        const display = minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${best.sec}sn`
        const coachDetails = _coachDetails(coachPerf?.hang)
        return {
          ...perf,
          val: display,
          trend: best.sec >= 75 ? 'Elite' : trend.text,
          trendColor: best.sec >= 75 ? 'var(--emerald)' : trend.color,
          note: _coachOverride(coachPerf, 'hang', 'note') || `Dead hang zirvesi ${display} - ${best.date}`,
          tip: _coachOverride(coachPerf, 'hang', 'tip') || `Grip kalitesi yuksek. Bunu climb, pull ve carry gunlerinde koru; bir sonraki hedef 90sn bariyeri.`,
          history: _mergeHistory(perf.history, best.sec, month),
          details: coachDetails || [
            { label: 'Peak', val: display },
            { label: 'Trend', val: best.sec >= 75 ? 'Elite' : trend.text },
            { label: 'Hang Sets', val: String(_sumSets(hits)) },
            { label: 'Next', val: best.sec >= 90 ? '2:00' : '1:30' },
          ],
        }
      }
      case 'flip': {
        const recent = normalizedWorkouts.filter(workout =>
          workout.primaryCategory === 'movement' || workout.tags.includes('parkour') || workout.tags.includes('acrobatics')
        ).slice(0, 5)
        if (!recent.length) return perf
        const latest = recent[0]
        const coachDetails = _coachDetails(coachPerf?.flip)
        return {
          ...perf,
          val: recent.length >= 2 ? 'Aktif' : 'Beklemede',
          trend: recent.length >= 2 ? 'Yukseliyor' : 'Duraklama',
          trendColor: recent.length >= 2 ? 'var(--emerald)' : 'var(--amber)',
          note: _coachOverride(coachPerf, 'flip', 'note') || `Son ${recent.length} movement seansi - ${latest.date}`,
          tip: _coachOverride(coachPerf, 'flip', 'tip') || `Parkour ve akrobasi aktif. Core ve landing kalitesi beraber ilerlerse skill hatti daha temiz acilir.`,
          details: coachDetails || [
            { label: 'Movement 5', val: String(recent.length) },
            { label: 'Latest', val: latest.type },
            { label: 'Duration', val: `${latest.durationMin || 0}dk` },
            { label: 'Need', val: 'Core + landing' },
          ],
        }
      }
      default:
        return perf
    }
  })
}
