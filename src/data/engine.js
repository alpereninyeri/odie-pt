import { appendClassQuests } from './class-quests.js'
import { updatePerformance } from './performance-engine.js'
import { appendCoachQuests, updateQuests } from './quest-engine.js'
import { updateSkills } from './skill-engine.js'
import {
  countAllSets,
  getLocalDateString,
  hasLegFocus,
  normalizeDateString,
  normalizeSession,
} from './rules.js'

const EXERCISE_MUSCLES = {
  'Bench Press': ['Göğüs', 'Triceps', 'Omuz'],
  'Incline Press': ['Göğüs', 'Omuz'],
  'Chest Fly': ['Göğüs'],
  Dips: ['Göğüs', 'Triceps'],
  'Push-Up': ['Göğüs', 'Triceps'],
  OHP: ['Omuz', 'Triceps'],
  'Shoulder Press': ['Omuz', 'Triceps'],
  'Lateral Raise': ['Omuz'],
  'Arnold Press': ['Omuz'],
  'Face Pull': ['Üst Sırt', 'Omuz'],
  'Triceps Pushdown': ['Triceps'],
  'Tricep Extension': ['Triceps'],
  'Pull-Up': ['Lat', 'Biseps', 'Üst Sırt'],
  Pulldown: ['Lat', 'Biseps'],
  'Lat Pulldown': ['Lat', 'Biseps'],
  'Muscle-Up': ['Lat', 'Biseps', 'Göğüs'],
  'Barbell Row': ['Üst Sırt', 'Biseps', 'Lat'],
  'Cable Row': ['Üst Sırt', 'Biseps'],
  'Seated Cable Row': ['Üst Sırt', 'Biseps'],
  'Seated Row': ['Üst Sırt', 'Biseps'],
  'Dead Hang': ['Lat', 'Biseps'],
  Curl: ['Biseps'],
  'Hammer Curl': ['Biseps'],
  'Incline Curl': ['Biseps'],
  'Seated Incline Curl': ['Biseps'],
  Squat: ['Bacak (Parkour)', 'Kalf'],
  'Jump Squat': ['Bacak (Parkour)'],
  Lunge: ['Bacak (Parkour)'],
  'Leg Press': ['Bacak (Parkour)'],
  'Calf Raise': ['Kalf'],
  'Standing Calf Raise': ['Kalf'],
  'Hollow Body': ['Core'],
  'Hollow Rock': ['Core'],
  'L-Sit': ['Core'],
  Plank: ['Core'],
  'Dragon Flag': ['Core'],
  'Ab Wheel': ['Core'],
  'Leg Raise': ['Core'],
  'Hanging Leg Raise': ['Core'],
  Çakı: ['Core'],
  Crunch: ['Core'],
  'Anti-Rotation': ['Core'],
  'Pallof Press': ['Core'],
}

const MUSCLE_BUCKETS = ['Omuz', 'Göğüs', 'Triceps', 'Biseps', 'Üst Sırt', 'Lat', 'Bacak (Parkour)', 'Kalf', 'Core', 'Kardiyo']

export function recalculate(state) {
  const workouts = (state.workouts || []).map(workout => normalizeSession(workout))
  state.workouts = workouts

  const totalSets = workouts.reduce((sum, workout) => sum + (workout.sets || countAllSets(workout)), 0)
  const totalVolumeKg = workouts.reduce((sum, workout) => sum + (workout.volumeKg || 0), 0)
  const totalMinutes = workouts.reduce((sum, workout) => sum + (workout.durationMin || 0), 0)
  const sessions = workouts.length

  state.profile.sessions = sessions
  state.profile.totalSets = totalSets
  state.profile.totalVolumeKg = totalVolumeKg
  state.profile.totalMinutes = totalMinutes
  state.profile.totalVolume = _formatVolume(totalVolumeKg)
  state.profile.totalTime = _formatTime(totalMinutes)

  const lifetimeXp = Number(state.profile.xp.total) || Number(state.profile.xp.current) || 0
  const xpPerLevel = 2000
  const level = Math.floor(lifetimeXp / xpPerLevel) + 1
  const xpIntoLevel = lifetimeXp - ((level - 1) * xpPerLevel)
  state.profile.level = Math.max(1, level)
  state.profile.xp.max = xpPerLevel
  state.profile.xp.current = xpIntoLevel
  state.profile.xp.total = lifetimeXp

  _updateMuscleBalance(state)
  _updateMuscleCards(state)
  _applyProfileStatsToArray(state)
  _updatePerformance(state)
  _updateHealthAndGlobalStats(state)
  _updateQuests(state)
  _updateSkills(state)
  _updateDebuffs(state)
  _updateDynamicNarratives(state)
}

function _updateMuscleBalance(state) {
  const delta = Object.fromEntries(MUSCLE_BUCKETS.map(label => [label, 0]))
  for (const workout of state.workouts || []) {
    if (Array.isArray(workout.exercises) && workout.exercises.length) {
      for (const exercise of workout.exercises) {
        const muscles = _findMuscles(exercise.name)
        if (!muscles.length) continue
        const exerciseSets = Array.isArray(exercise.sets) ? exercise.sets.length : 1
        for (const muscle of muscles) {
          delta[muscle] = (delta[muscle] || 0) + exerciseSets
        }
      }
      continue
    }

    const virtualSets = _estimateVirtualSets(workout)
    if (hasLegFocus(workout)) delta['Bacak (Parkour)'] = (delta['Bacak (Parkour)'] || 0) + virtualSets
    if (workout.tags.includes('walking') || workout.tags.includes('cycling') || workout.tags.includes('ski')) {
      delta.Kalf = (delta.Kalf || 0) + Math.max(1, Math.round(virtualSets / 2))
      delta.Kardiyo = (delta.Kardiyo || 0) + virtualSets
    }
    if (workout.tags.includes('parkour') || workout.tags.includes('acrobatics')) {
      delta.Core = (delta.Core || 0) + Math.max(1, Math.round(virtualSets / 2))
    }
  }

  state.muscleBalance = (state.muscleBalance || []).map(item => ({
    ...item,
    sets: Math.round((delta[item.label] || 0) * 10) / 10,
    critical: false,
  }))

  const maxSets = Math.max(...state.muscleBalance.map(item => item.sets), 1)
  state.muscleBalance = state.muscleBalance.map(item => ({
    ...item,
    critical:
      item.label === 'Core'
        ? item.sets < Math.max(24, maxSets * 0.2)
        : item.label === 'Bacak (Parkour)'
          ? item.sets < Math.max(48, maxSets * 0.28)
          : item.sets < maxSets * 0.33,
  }))
}

function _estimateVirtualSets(workout) {
  if (!workout.durationMin) return 2
  if (workout.primaryCategory === 'movement') return Math.min(12, Math.max(4, Math.round(workout.durationMin / 15)))
  if (workout.primaryCategory === 'endurance') return Math.min(10, Math.max(3, Math.round(workout.durationMin / 20)))
  return Math.min(8, Math.max(2, Math.round(workout.durationMin / 20)))
}

function _findMuscles(exerciseName = '') {
  const normalized = String(exerciseName || '').toLocaleLowerCase('tr-TR')
  const keys = Object.keys(EXERCISE_MUSCLES).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (normalized.includes(key.toLocaleLowerCase('tr-TR'))) return EXERCISE_MUSCLES[key]
  }
  if (/squat|lunge|leg|kalf/i.test(normalized)) return ['Bacak (Parkour)']
  if (/core|ab|hollow|plank|çakı|caki/i.test(normalized)) return ['Core']
  return []
}

function _updateMuscleCards(state) {
  const balance = Object.fromEntries((state.muscleBalance || []).map(item => [item.label, item.sets]))
  state.muscles = (state.muscles || []).map(card => {
    switch (card.name) {
      case 'Omuz Kompleksi':
        return { ...card, sets: String(balance.Omuz ?? card.sets), rank: _rankFromSets(balance.Omuz) }
      case 'Göğüs':
        return { ...card, sets: String(balance.Göğüs ?? card.sets), rank: _rankFromSets(balance.Göğüs) }
      case 'Biseps & Triceps':
        return {
          ...card,
          sets: `Tri: ${balance.Triceps ?? 0} | Bi: ${balance.Biseps ?? 0}`,
          rank: _rankFromSets(((balance.Triceps ?? 0) + (balance.Biseps ?? 0)) / 2),
        }
      case 'Kanat ve Üst Sırt':
        return {
          ...card,
          sets: `Lat: ${balance.Lat ?? 0} | Üst: ${balance['Üst Sırt'] ?? 0}`,
          rank: _rankFromSets(((balance.Lat ?? 0) + (balance['Üst Sırt'] ?? 0)) / 2),
        }
      case 'Bacak & Alt Vücut':
        return {
          ...card,
          sets: `Legs: ${balance['Bacak (Parkour)'] ?? 0} | Kalf: ${balance.Kalf ?? 0}`,
          rank: _rankFromSets(balance['Bacak (Parkour)']),
        }
      case 'Core (Gövde)':
        return { ...card, sets: String(balance.Core ?? 0), rank: _rankFromSets(balance.Core) }
      default:
        return card
    }
  })
}

function _rankFromSets(sets = 0) {
  if (sets >= 90) return 'S'
  if (sets >= 60) return 'A'
  if (sets >= 40) return 'B+'
  if (sets >= 25) return 'B-'
  if (sets >= 15) return 'C'
  if (sets >= 8) return 'D+'
  if (sets >= 4) return 'E+'
  return 'F'
}

function _applyProfileStatsToArray(state) {
  const base = state.profile?.stats || {}
  const criticalKey = Object.entries(base)
    .sort((left, right) => Number(left[1]) - Number(right[1]))[0]?.[0] || null
  state.stats = (state.stats || []).map(stat => {
    const value = Number(base[stat.key])
    return Number.isFinite(value)
      ? {
        ...stat,
        val: Math.max(0, Math.min(100, value)),
        critical: stat.key === criticalKey && value < 40,
      }
      : stat
  })
}

function _updatePerformance(state) {
  state.performance = updatePerformance(state.performance, state.workouts || [], _extractCoachPayload(state))
}

function _updateHealthAndGlobalStats(state) {
  const today = getLocalDateString()
  const todayMonth = today.slice(0, 7)
  const daysInMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0).getDate()
  const recentLogs = [...(state.dailyLogs || [])]
    .sort((a, b) => normalizeDateString(b.date).localeCompare(normalizeDateString(a.date)))
    .slice(0, 7)
  const workouts = state.workouts || []

  const avg = (values, fallback = 0) => {
    if (!values.length) return fallback
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  const avgDuration = Math.round(avg(workouts.slice(0, 10).map(workout => Number(workout.durationMin) || 0), 0))
  const monthWorkoutDays = new Set(workouts.filter(workout => normalizeDateString(workout.date).startsWith(todayMonth)).map(workout => normalizeDateString(workout.date)))
  const totalKm = Math.round((Number(state.profile.totalKm) || 0) * 10) / 10
  const survivalBase = Math.max(0, Math.min(100, Math.round(((state.profile.armor ?? 100) - (state.profile.fatigue ?? 0)) + 20)))
  const lifestyleLogs = recentLogs.slice(0, 3).filter(log => (Number(log.sleepHours) || 0) > 0 || (Number(log.waterMl) || 0) > 0 || (Number(log.steps) || 0) > 0)
  const lifestyleSamples = lifestyleLogs.length
  const avgSleep = avg(lifestyleLogs.map(log => Number(log.sleepHours) || 0))
  const avgWaterMl = avg(lifestyleLogs.map(log => Number(log.waterMl) || 0))
  const avgSteps = avg(lifestyleLogs.map(log => Number(log.steps) || 0))
  const lifestyleNotes = []
  let lifestyleDelta = 0
  if (lifestyleSamples) {
    if (avgSleep >= 7.5) { lifestyleDelta += 8; lifestyleNotes.push(`uyku ort. ${avgSleep.toFixed(1)}h ↑`) }
    else if (avgSleep >= 6.5) lifestyleDelta += 3
    else if (avgSleep > 0 && avgSleep < 5.5) { lifestyleDelta -= 10; lifestyleNotes.push(`uyku ort. ${avgSleep.toFixed(1)}h ↓`) }
    else if (avgSleep > 0 && avgSleep < 6.5) { lifestyleDelta -= 4; lifestyleNotes.push(`uyku ort. ${avgSleep.toFixed(1)}h kısa`) }

    if (avgWaterMl >= 2200) lifestyleDelta += 4
    else if (avgWaterMl > 0 && avgWaterMl < 1200) { lifestyleDelta -= 5; lifestyleNotes.push('su < 1.2L') }

    if (avgSteps >= 8000) lifestyleDelta += 4
    else if (avgSteps > 0 && avgSteps < 3500) { lifestyleDelta -= 4; lifestyleNotes.push('adım < 3.5k') }
  }
  lifestyleDelta = Math.max(-15, Math.min(15, lifestyleDelta))
  const recoveryScore = Math.max(0, Math.min(100, survivalBase + lifestyleDelta))
  const bm = state.bodyMetrics || {}
  const weightKg = Number(bm.weightKg) || 0
  const heightCm = Number(bm.heightCm) || 0
  const bmi = weightKg && heightCm ? Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10 : null
  const enoughRecoveryLogs = recentLogs.filter(log => (Number(log.sleepHours) || 0) > 0 || (Number(log.waterMl) || 0) > 0 || (Number(log.steps) || 0) > 0).length
  const hasTrainingLoad = workouts.length >= 3
  const readinessSource = enoughRecoveryLogs >= 4
    ? 'daily_logs + training_load'
    : hasTrainingLoad
      ? 'training_load_only'
      : 'limited_data'
  const readinessConfidence = enoughRecoveryLogs >= 4
    ? 'high'
    : hasTrainingLoad
      ? 'medium'
      : 'low'
  const lifestyleReason = lifestyleSamples
    ? (lifestyleNotes.length ? lifestyleNotes.join(' · ') : 'lifestyle stabil')
    : 'lifestyle logu yok'
  const readinessReason = enoughRecoveryLogs >= 4
    ? `Son 7 gün uyku/su/adım yeterli. ${lifestyleReason}.`
    : hasTrainingLoad
      ? `Yük verisi var, recovery logu zayıf. ${lifestyleReason}.`
      : 'Hem günlük recovery verisi hem de yük örneği düşük.'
  const staticWeight = weightKg
    ? { icon: '⚖️', label: 'Kilo', val: `${weightKg} kg`, sub: heightCm ? `${heightCm}cm` : 'Manuel giriş', color: 'var(--emerald)' }
    : { icon: '⚖️', label: 'Kilo', val: '—', sub: 'Telegram: "kilom 72"', color: 'var(--dim)' }
  const staticBmi = bmi !== null
    ? { icon: '📏', label: 'BMI', val: String(bmi), sub: `${weightKg}kg / ${heightCm}cm`, color: 'var(--dim)' }
    : { icon: '📏', label: 'BMI', val: '—', sub: 'Kilo ve boy gerekli', color: 'var(--dim)' }

  const weeklyWorkouts = workouts.filter(workout =>
    normalizeDateString(workout.date) >= normalizeDateString(getLocalDateString(new Date(Date.now() - (6 * 86400000))))
  ).length

  state.globalStats = [
    { val: `${avgDuration || 0}dk`, label: 'Ort. Seans' },
    { val: `${monthWorkoutDays.size}/${daysInMonth}`, label: 'Bu Ay Seans' },
    { val: String(weeklyWorkouts), label: 'Son 7 Gün' },
    { val: `${totalKm.toLocaleString('tr-TR')} km`, label: 'Outdoor Toplam' },
  ]

  const healthWarnings = []
  if (state.profile?.survivalWarnings?.length) {
    for (const warning of state.profile.survivalWarnings.slice(0, 3)) {
      healthWarnings.push({ color: 'var(--coral)', icon: '🛡️', name: 'RECOVERY UYARISI', desc: warning })
    }
  }

  state.health = {
    metrics: [
      { icon: '⏱️', label: 'Ortalama Seans', val: `${avgDuration || 0} dk`, sub: 'Son 10 antrenman', color: 'var(--mist-strong)' },
      { icon: '🛡️', label: 'Readiness', val: `${recoveryScore}/100`, sub: `${state.profile.survivalStatus || 'healthy'} · ${readinessSource}`, color: 'var(--emerald)' },
      { icon: '🗺️', label: 'Toplam Mesafe', val: `${totalKm.toLocaleString('tr-TR')} km`, sub: 'Tahmini outdoor toplam', color: 'var(--cobalt)' },
      staticWeight,
      staticBmi,
    ],
    warnings: healthWarnings.slice(0, 4),
    readiness: {
      score: recoveryScore,
      confidence: readinessConfidence,
      source: readinessSource,
      reason: readinessReason,
    },
  }
}

function _updateQuests(state) {
  const quests = updateQuests(state.quests, state.workouts || [], state.dailyLogs || [])
  const withCoach = appendCoachQuests(quests, state.coachQuestHints || [])
  state.quests = appendClassQuests(withCoach, state.profile?.classObj?.id || state.profile?.classId, state.workouts || [], state.dailyLogs || [])
}

function _updateSkills(state) {
  state.skills = updateSkills(state.skills, state.workouts || [], state.coachSkillProgress || [])
}

function _updateDebuffs(state) {
  const existing = Array.isArray(state.debuffs) ? state.debuffs : []
  const coachWarnings = Array.isArray(state.profile?.survivalWarnings) ? state.profile.survivalWarnings : []
  const coachNoteWarnings = Array.isArray(state.coachNote?.warnings) ? state.coachNote.warnings : []
  const healthWarnings = Array.isArray(state.health?.warnings) ? state.health.warnings.map(warning => warning.desc) : []

  const seen = new Set()
  const dynamic = []
  for (const warning of [...coachWarnings, ...coachNoteWarnings, ...healthWarnings]) {
    if (!warning) continue
    const text = String(warning).trim()
    if (!text) continue
    const key = text.toLocaleLowerCase('tr-TR')
    if (seen.has(key)) continue
    seen.add(key)
    dynamic.push({
      level: /yarali|alarm|kritik|critical|injur|aşınma/i.test(text) ? 'coral' : /uyku|hidra|cns|recovery/i.test(text) ? 'amber' : 'cobalt',
      icon: text.match(/^([\p{Emoji}\u2600-\u27BF])/u)?.[1] || '⚠️',
      name: _shortTitle(text),
      desc: text,
      dynamic: true,
    })
  }

  const staticSeed = existing.filter(item => !item.dynamic && item.name && !seen.has(String(item.name).toLocaleLowerCase('tr-TR').trim()))
  state.debuffs = [...dynamic, ...staticSeed]
}

function _updateDynamicNarratives(state) {
  const coachPayload = _extractCoachPayload(state)
  _updateStatNarratives(state, coachPayload)
  _updateMuscleNarratives(state, coachPayload)
}

function _extractCoachPayload(state) {
  const hidden = (state.coachNote?.sections || []).find(section => section?.hidden && section?.payload)
  return hidden?.payload || null
}

function _findExerciseHits(workouts = [], keywords = []) {
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

function _maxWeightReps(hits = []) {
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

function _maxReps(hits = []) {
  let best = { reps: 0, date: null }
  for (const hit of hits) {
    for (const set of (hit.exercise.sets || [])) {
      const reps = Number(set.reps) || 0
      if (reps > best.reps) best = { reps, date: hit.workout.date }
    }
  }
  return best
}

function _maxDuration(hits = []) {
  let best = { sec: 0, date: null }
  for (const hit of hits) {
    for (const set of (hit.exercise.sets || [])) {
      const sec = Number(set.durationSec ?? set.duration_sec) || 0
      if (sec > best.sec) best = { sec, date: hit.workout.date }
    }
  }
  return best
}

function _sumSetCount(hits = []) {
  return hits.reduce((sum, hit) => sum + (hit.exercise.sets || []).length, 0)
}

function _estimateOneRm(weight, reps) {
  if (!weight) return 0
  return Math.round(weight * (1 + (Math.max(1, reps) / 30)))
}

function _rankLabel(score = 0) {
  if (score >= 85) return 'A'
  if (score >= 75) return 'B+'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  if (score >= 35) return 'D'
  return 'F'
}

function _coachEntry(payload, group, key) {
  return payload?.[group]?.[key] || null
}

function _detailFromCoach(entry, fallbackLabels = []) {
  if (!Array.isArray(entry?.detail) && !Array.isArray(entry?.details)) return null
  const values = Array.isArray(entry.detail) ? entry.detail : entry.details
  return values.slice(0, 4).map((value, index) => ({
    label: fallbackLabels[index] || `Item ${index + 1}`,
    val: String(value || '-'),
  }))
}

function _recentWorkouts(workouts = [], predicate, limit = 6) {
  return workouts.filter(predicate).slice(0, limit)
}

function _lastWorkout(workouts = [], predicate) {
  return workouts.find(predicate) || null
}

function _formatDuration(minutes = 0) {
  if (!minutes) return '0dk'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (!hours) return `${mins}dk`
  if (!mins) return `${hours}s`
  return `${hours}s ${mins}dk`
}

function _updateStatNarratives(state, coachPayload) {
  const workouts = state.workouts || []
  const strengthWorkouts = _recentWorkouts(workouts, workout => workout.primaryCategory === 'strength', 8)
  const movementWorkouts = _recentWorkouts(workouts, workout => workout.primaryCategory === 'movement', 8)
  const enduranceWorkouts = _recentWorkouts(workouts, workout => workout.primaryCategory === 'endurance', 8)
  const coreHits = _findExerciseHits(workouts, ['hanging leg raise', 'leg raise', 'hollow', 'l-sit', 'lsit', 'dragon flag', 'ab wheel', 'plank', 'anti-rotation', 'pallof', 'caki', 'çakı'])
  const benchBest = _maxWeightReps(_findExerciseHits(workouts, ['bench']))
  const ohpBest = _maxWeightReps(_findExerciseHits(workouts, ['ohp', 'shoulder press', 'overhead press']))
  const muBest = _maxReps(_findExerciseHits(workouts, ['muscle-up', 'muscle up']))
  const hangBest = _maxDuration(_findExerciseHits(workouts, ['dead hang', 'hang']))
  const hlrBest = _maxReps(_findExerciseHits(workouts, ['hanging leg raise', 'leg raise']))
  const hollowBest = _maxDuration(_findExerciseHits(workouts, ['hollow']))
  const longestSession = workouts.reduce((best, workout) => Number(workout.durationMin) > Number(best.durationMin || 0) ? workout : best, {})
  const weeklyMinutes = workouts
    .filter(workout => normalizeDateString(workout.date) >= normalizeDateString(getLocalDateString(new Date(Date.now() - (6 * 86400000)))))
    .reduce((sum, workout) => sum + (Number(workout.durationMin) || 0), 0)

  state.stats = (state.stats || []).map(stat => {
    const coach = _coachEntry(coachPayload, 'stats', stat.key)
    switch (stat.key) {
      case 'str': {
        const detail = _detailFromCoach(coach, ['Bench Peak', '1RM Est.', 'MU Signal', 'Next']) || [
          { label: 'Bench Peak', val: benchBest.weight ? `${benchBest.weight}kg x${benchBest.reps}` : '-' },
          { label: '1RM Est.', val: benchBest.weight ? `${_estimateOneRm(benchBest.weight, benchBest.reps)}kg` : '-' },
          { label: 'MU Signal', val: muBest.reps ? `${muBest.reps} rep` : '-' },
          { label: 'Next', val: benchBest.weight ? `${(benchBest.weight + 2.5).toFixed(benchBest.weight % 1 ? 1 : 0)}kg` : 'push kalite' },
        ]
        return {
          ...stat,
          desc: coach?.desc || `Kuvvet skoru artik sabit seed degil. En guncel driver bench ${benchBest.weight || 0}kg ve ${strengthWorkouts.length} kuvvet seansi.`,
          coach: coach?.coach || `Push hizi yuksek; OHP ${ohpBest.weight || 0}kg ve muscle-up ${muBest.reps || 0} rep cekis tarafini da tasiyor. STR su an ${stat.val}/100.`,
          detail,
        }
      }
      case 'agi': {
        const latestMovement = movementWorkouts[0]
        const detail = _detailFromCoach(coach, ['Movement 14g', 'Latest', 'Landing', 'Need']) || [
          { label: 'Movement 14g', val: String(movementWorkouts.length) },
          { label: 'Latest', val: latestMovement?.type || '-' },
          { label: 'Landing', val: latestMovement ? _rankLabel(stat.val) : '-' },
          { label: 'Need', val: 'flow + control' },
        ]
        return {
          ...stat,
          desc: coach?.desc || `AGI dogrudan movement hacmine bagli. Son ${movementWorkouts.length} seans parkour/akrobasi hizi ve zemin gecisini calistirdi.`,
          coach: coach?.coach || `${latestMovement?.highlight || 'Son movement izi yok'}. Core ve landing kalite arttikca AGI daha rahat yukselecek.`,
          detail,
        }
      }
      case 'end': {
        const avgEndurance = enduranceWorkouts.length
          ? Math.round(enduranceWorkouts.reduce((sum, workout) => sum + (Number(workout.durationMin) || 0), 0) / enduranceWorkouts.length)
          : 0
        const detail = _detailFromCoach(coach, ['Avg Session', 'Outdoor Km', 'Endurance 14g', 'Recovery']) || [
          { label: 'Avg Session', val: avgEndurance ? `${avgEndurance}dk` : '-' },
          { label: 'Outdoor Km', val: `${Math.round((Number(state.profile.totalKm) || 0) * 10) / 10}km` },
          { label: 'Endurance 14g', val: String(enduranceWorkouts.length) },
          { label: 'Recovery', val: `${Math.max(0, 100 - (state.profile.fatigue || 0))}/100` },
        ]
        return {
          ...stat,
          desc: coach?.desc || `END seans uzunlugu, yuruyus/bisiklet/ski akisi ve hareket halkasindan besleniyor. Ortalama endurance izi ${avgEndurance || 0}dk.`,
          coach: coach?.coach || `Outdoor toplam ${Math.round((Number(state.profile.totalKm) || 0) * 10) / 10}km oldu. END sadece gym degil, tum lokomotion tabanindan guncelleniyor.`,
          detail,
        }
      }
      case 'dex': {
        const dexSignals = workouts.filter(workout => workout.tags.includes('balance') || workout.tags.includes('parkour') || workout.tags.includes('acrobatics')).slice(0, 8)
        const detail = _detailFromCoach(coach, ['Skill Sync', 'Balance', 'Timing', 'Need']) || [
          { label: 'Skill Sync', val: `${dexSignals.length} seans` },
          { label: 'Balance', val: _rankLabel(stat.val) },
          { label: 'Timing', val: movementWorkouts.length ? 'aktif' : 'dusuk' },
          { label: 'Need', val: 'landing calm' },
        ]
        return {
          ...stat,
          desc: coach?.desc || `DEX artik koordinasyon, denge ve skill baglantisina gore yaziliyor. Son ${dexSignals.length} teknik seans bu alani diri tutuyor.`,
          coach: coach?.coach || `Parkour, akrobasi ve teknik gecisler DEX'i tasiyor. Core ve bacak kalitesi artarsa koordinasyon daha temiz okunur.`,
          detail,
        }
      }
      case 'con': {
        const detail = _detailFromCoach(coach, ['Core Sets', 'Hollow', 'HLR', 'Need']) || [
          { label: 'Core Sets', val: String(_sumSetCount(coreHits)) },
          { label: 'Hollow', val: hollowBest.sec ? `${hollowBest.sec}sn` : '-' },
          { label: 'HLR', val: hlrBest.reps ? `${hlrBest.reps} rep` : '-' },
          { label: 'Need', val: 'anti-rotation' },
        ]
        return {
          ...stat,
          desc: coach?.desc || `CON yalnizca direkt core ve body-tension isinden yaziliyor. Lokomotion tek basina core sayilmiyor; su an ${_sumSetCount(coreHits)} net core seti kayitli.`,
          coach: coach?.coach || `Hollow ${hollowBest.sec || 0}sn ve HLR ${hlrBest.reps || 0} rep su anki tabani gosteriyor. CON kritik halka olarak canli takipte.`,
          detail,
        }
      }
      case 'sta': {
        const detail = _detailFromCoach(coach, ['Longest', 'Load 7g', 'Double Days', 'Need']) || [
          { label: 'Longest', val: longestSession?.durationMin ? _formatDuration(longestSession.durationMin) : '-' },
          { label: 'Load 7g', val: `${weeklyMinutes}dk` },
          { label: 'Double Days', val: String(_countDoubleDays(workouts)) },
          { label: 'Need', val: 'ritim + yakit' },
        ]
        return {
          ...stat,
          desc: coach?.desc || `STA artik sadece seed max seans degil; en uzun seans, son 7 gun yuku ve ayni gun cift isten hesaplanmis anlatim tasiyor.`,
          coach: coach?.coach || `En uzun kayit ${_formatDuration(longestSession?.durationMin || 0)}. Son 7 gun yuk toplam ${weeklyMinutes}dk; ritim korundukca STA yukselir.`,
          detail,
        }
      }
      default:
        return stat
    }
  })
}

function _countDoubleDays(workouts = []) {
  const seen = new Set()
  const doubles = new Set()
  for (const workout of workouts) {
    const date = normalizeDateString(workout.date)
    if (seen.has(date)) doubles.add(date)
    seen.add(date)
  }
  return doubles.size
}

function _updateMuscleNarratives(state, coachPayload) {
  const balance = Object.fromEntries((state.muscleBalance || []).map(item => [item.label, item.sets]))
  const workouts = state.workouts || []
  const benchBest = _maxWeightReps(_findExerciseHits(workouts, ['bench']))
  const ohpBest = _maxWeightReps(_findExerciseHits(workouts, ['ohp', 'shoulder press', 'overhead press']))
  const muBest = _maxReps(_findExerciseHits(workouts, ['muscle-up', 'muscle up']))
  const hangBest = _maxDuration(_findExerciseHits(workouts, ['dead hang', 'hang']))
  const coreHits = _findExerciseHits(workouts, ['hanging leg raise', 'leg raise', 'hollow', 'l-sit', 'lsit', 'dragon flag', 'ab wheel', 'plank', 'anti-rotation', 'pallof', 'caki', 'çakı'])

  state.muscles = (state.muscles || []).map(card => {
    let detail = card.detail
    let tip = card.tip
    let tag = card.tag
    let tagClass = card.tagClass
    const coachKey = _muscleCoachKey(card.name)
    const coach = _coachEntry(coachPayload, 'muscles', coachKey)

    switch (card.name) {
      case 'Omuz Kompleksi':
        detail = coach?.detail || `Omuzlarin guncel kuvvet izi shoulder press ${ohpBest.weight || 0}kg. Push hacmi yuksek, ama on/arka omuz dengesi halen takip edilmeli.`
        tip = coach?.tip || 'Face pull ve arka omuz seti ekle; sadece press yigmayi birak.'
        tag = coach?.tag || ((balance.Omuz || 0) >= 180 ? 'Dominant' : 'Stabil')
        tagClass = tag === 'Dominant' ? 'tf' : 'ts'
        break
      case 'Göğüs':
      case 'GÃ¶ÄŸÃ¼s':
        detail = coach?.detail || `Gogus metni artik stale degil. Guncel peak bench ${benchBest.weight || 0}kg x${benchBest.reps || 0}; yani eski 60kg referansi bitti.`
        tip = coach?.tip || 'Bench hattini korurken incline ve dips ile on zinciri tek acida birakma.'
        tag = coach?.tag || ((balance['GÃ¶ÄŸÃ¼s'] || balance.Göğüs || 0) >= 170 ? 'Gelisiyor' : 'Toparlaniyor')
        tagClass = tag === 'Toparlaniyor' ? 'tw' : 'ts'
        break
      case 'Biseps & Triceps':
        detail = coach?.detail || `Kol hatti compound veriden okunuyor. Muscle-up ${muBest.reps || 0} rep ve push/pull hacmi dirsek zincirini aktif tutuyor.`
        tip = coach?.tip || 'Izole kol isi tamamlayici olsun; ana sinyal compound cekis ve itis tarafindan gelsin.'
        tag = coach?.tag || 'Stabil'
        tagClass = 'ts'
        break
      case 'Kanat ve Üst Sırt':
      case 'Kanat ve Ãœst SÄ±rt':
        detail = coach?.detail || `Sirt tarafinin guncel peakleri muscle-up ${muBest.reps || 0} rep ve dead hang ${hangBest.sec || 0}sn. Arka zincir push kadar dolu degil.`
        tip = coach?.tip || 'Row, pull-up ve carry hacmini biraz daha yukari cekersen omuz-gogus baskisi dengelenir.'
        tag = coach?.tag || (((balance.Lat || 0) + (balance['Ãœst SÄ±rt'] || 0)) / 2 >= 120 ? 'Stabil' : 'Geride')
        tagClass = tag === 'Geride' ? 'tw' : 'ts'
        break
      case 'Bacak & Alt Vücut':
      case 'Bacak & Alt VÃ¼cut':
        detail = coach?.detail || `Bacak analizi sadece gym squat degil; parkour, yuruyus, bisiklet ve ski de burada hesaba giriyor. Toplam legs ${balance['Bacak (Parkour)'] || 0}.`
        tip = coach?.tip || 'Lokomotion iyi ama izole bacak kuvveti eklendikce landing ve speed daha guvenli artar.'
        tag = coach?.tag || ((balance['Bacak (Parkour)'] || 0) < 60 ? 'Eksik' : 'Gelisiyor')
        tagClass = tag === 'Eksik' ? 'tw' : 'ts'
        break
      case 'Core (Gövde)':
      case 'Core (GÃ¶vde)':
        detail = coach?.detail || `Core yorumlari artik direkt hareketlerden geliyor. HLR, hollow ve plank tarafi toplam ${_sumSetCount(coreHits)} set uretti.`
        tip = coach?.tip || 'Her seansa kisa ama net core blogu eklemek CON ve skill guvenligini birlikte yukseltir.'
        tag = coach?.tag || ((balance.Core || 0) < 24 ? 'Kritik' : 'Acilmis')
        tagClass = tag === 'Kritik' ? 'tw' : 'ts'
        break
    }

    return { ...card, detail, tip, tag, tagClass }
  })
}

function _muscleCoachKey(name = '') {
  if (/omuz/i.test(name)) return 'omuz'
  if (/gÃ¶ÄŸÃ¼s|göğüs/i.test(name)) return 'gogus'
  if (/biseps|triceps/i.test(name)) return 'arms'
  if (/kanat|sÄ±rt|sırt/i.test(name)) return 'back'
  if (/bacak/i.test(name)) return 'legs'
  if (/core/i.test(name)) return 'core'
  return String(name || '').toLocaleLowerCase('tr-TR')
}

function _shortTitle(text) {
  const clean = text.replace(/^[\p{Emoji}\u2600-\u27BF\s]+/u, '').trim()
  const first = clean.split(/[.—–\-:]/)[0].trim()
  return first.length > 42 ? `${first.slice(0, 42).toUpperCase()}…` : first.toUpperCase()
}

function _formatVolume(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)}k kg`
  return `${Math.round(kg)} kg`
}

function _formatTime(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}min`
}
