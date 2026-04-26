export function detectPRs(session, currentPrs = {}) {
  const updatedPrs = { ...currentPrs }
  const newPrs = {}

  ;(session.exercises || []).forEach(ex => {
    ;(ex.sets || []).forEach(set => {
      const score = _calcScore(set)
      if (!score) return

      const current = updatedPrs[ex.name]
      if (!current || _beats(score, current)) {
        const pr = {
          weightKg: set.weightKg ?? set.weight_kg ?? null,
          reps: set.reps ?? null,
          durationSec: set.durationSec ?? set.duration_sec ?? null,
          kind: score.kind,
          metric: score.metric,
          score: score.metric,
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

export function prSummary(newPrs) {
  const entries = Object.entries(newPrs)
  if (!entries.length) return ''
  return entries.map(([name, pr]) => {
    if (pr.weightKg && pr.reps) return `${name}: ${pr.weightKg}kg × ${pr.reps} rep`
    if (pr.reps) return `${name}: ${pr.reps} rep`
    if (pr.durationSec) return `${name}: ${pr.durationSec}sn`
    return name
  }).join(', ')
}

function _calcScore(set) {
  const weight = Number(set?.weightKg ?? set?.weight_kg) || 0
  const reps = Number(set?.reps) || 0
  const duration = Number(set?.durationSec ?? set?.duration_sec) || 0

  if (weight > 0 && reps > 0) {
    return { kind: 'loaded', metric: Math.round(weight * (1 + reps / 30) * 10) / 10 }
  }
  if (reps > 0) return { kind: 'reps', metric: reps }
  if (duration > 0) return { kind: 'duration', metric: duration }
  return null
}

function _beats(score, current) {
  if (!current?.kind) return score.metric > (Number(current?.score) || 0)
  if (current.kind !== score.kind) {
    const order = { loaded: 3, reps: 2, duration: 1 }
    return (order[score.kind] || 0) > (order[current.kind] || 0)
  }
  return score.metric > (Number(current.metric ?? current.score) || 0)
}
