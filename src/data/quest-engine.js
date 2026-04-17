import { countCoreSets, getLocalDateString, hasLegFocus, normalizeDateString, normalizeSession } from './rules.js'

function _daysAgo(dateStr) {
  if (!dateStr) return Infinity
  return Math.round((Date.now() - new Date(`${normalizeDateString(dateStr)}T00:00:00`).getTime()) / 86400000)
}

function _isThisWeek(dateStr) {
  return _daysAgo(dateStr) <= 7
}

function _todayLog(dailyLogs = [], today = getLocalDateString()) {
  return dailyLogs.find(log => normalizeDateString(log.date) === today) || { waterMl: 0, sleepHours: 0, steps: 0 }
}

function _maxRepsForExercise(workouts, keywords) {
  let max = 0
  for (const workout of workouts) {
    if (!_isThisWeek(workout.date)) continue
    for (const exercise of (workout.exercises || [])) {
      const name = String(exercise.name || '').toLocaleLowerCase('tr-TR')
      if (!keywords.some(keyword => name.includes(keyword))) continue
      for (const set of (exercise.sets || [])) {
        if ((set.reps || 0) > max) max = set.reps
      }
    }
  }
  return max
}

function _maxBenchThisWeek(workouts) {
  let max = 0
  for (const workout of workouts) {
    if (!_isThisWeek(workout.date)) continue
    for (const exercise of (workout.exercises || [])) {
      if (!String(exercise.name || '').toLocaleLowerCase('tr-TR').includes('bench')) continue
      for (const set of (exercise.sets || [])) {
        const kg = Number(set.weightKg ?? set.weight_kg) || 0
        if (kg > max) max = kg
      }
    }
  }
  return max
}

export function updateQuests(questsSeed, workouts = [], dailyLogs = [], today = getLocalDateString()) {
  if (!questsSeed) return questsSeed

  const normalizedWorkouts = workouts.map(workout => normalizeSession(workout))
  const todaySessions = normalizedWorkouts.filter(workout => normalizeDateString(workout.date) === today)
  const thisWeek = normalizedWorkouts.filter(workout => _isThisWeek(workout.date))
  const todayLog = _todayLog(dailyLogs, today)

  const daily = (questsSeed.daily || []).map(quest => {
    switch (quest.name) {
      case 'Core Aktivasyon': {
        const coreSets = todaySessions.reduce((sum, workout) => sum + countCoreSets(workout), 0)
        return { ...quest, progress: Math.min(quest.total, coreSets > 0 ? 1 : 0), done: coreSets > 0 }
      }
      case 'Adım Hedefi': {
        return { ...quest, progress: todayLog.steps || 0, done: (todayLog.steps || 0) >= quest.total }
      }
      case 'Hidrasyon': {
        const liters = Math.round((((todayLog.waterMl || 0) / 1000) * 10)) / 10
        return { ...quest, progress: liters, done: liters >= quest.total }
      }
      case 'Uyku Kalitesi': {
        return { ...quest, progress: todayLog.sleepHours || 0, done: (todayLog.sleepHours || 0) >= quest.total }
      }
      default:
        return quest
    }
  })

  const weekly = (questsSeed.weekly || []).map(quest => {
    switch (quest.name) {
      case 'Bacak Günü': {
        const legSessions = thisWeek.filter(hasLegFocus).length
        return { ...quest, progress: Math.min(quest.total, legSessions), done: legSessions >= quest.total }
      }
      case 'Muscle-Up Challenge': {
        const reps = _maxRepsForExercise(thisWeek, ['muscle-up', 'muscle up'])
        return { ...quest, progress: Math.min(quest.total, reps), done: reps >= quest.total }
      }
      case 'Bench Progress': {
        const target = Number(quest.targetKg) || 65
        const bestBench = _maxBenchThisWeek(thisWeek)
        const done = bestBench >= target
        return {
          ...quest,
          progress: done ? quest.total : Math.min(quest.total, Math.round(bestBench / target)),
          done,
          desc: done ? `${bestBench}kg bu hafta kırıldı!` : quest.desc,
        }
      }
      case 'Esneklik Seansları': {
        const stretches = thisWeek.filter(workout => workout.tags.includes('mobility') || workout.type === 'Stretching').length
        return { ...quest, progress: Math.min(quest.total, stretches), done: stretches >= quest.total }
      }
      case 'Antrenman Tutarlılığı': {
        return { ...quest, progress: Math.min(quest.total, thisWeek.length), done: thisWeek.length >= quest.total }
      }
      default:
        return quest
    }
  })

  return { daily, weekly }
}

export function appendCoachQuests(quests, coachHints = []) {
  if (!Array.isArray(coachHints) || !coachHints.length) return quests
  const hintQuests = coachHints.map(hint => {
    const match = String(hint).match(/(.+?)\s*—\s*(\d+)\s*\/\s*(\d+)/)
    if (match) {
      const [, name, progress, total] = match
      return {
        icon: '🎯',
        name: name.trim(),
        desc: 'Koç hedefi — bu hafta',
        reward: '+30 XP',
        done: Number(progress) >= Number(total),
        progress: Number(progress),
        total: Number(total),
        fromCoach: true,
      }
    }
    return {
      icon: '🎯',
      name: 'Koç Hedefi',
      desc: hint,
      reward: '+30 XP',
      done: false,
      progress: 0,
      total: 1,
      fromCoach: true,
    }
  })

  return {
    ...quests,
    weekly: [...(quests.weekly || []), ...hintQuests],
  }
}
