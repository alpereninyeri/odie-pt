/**
 * Quest Engine — daily/weekly görev ilerlemesini antrenmanlardan türetir.
 * Bot'un gönderdiği quest_hints'i de ek progress olarak uygular.
 */

function _daysAgo(dateStr) {
  if (!dateStr) return Infinity
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function _isThisWeek(dateStr) {
  return _daysAgo(dateStr) <= 7
}

function _isToday(dateStr) {
  const today = new Date().toISOString().slice(0, 10)
  return dateStr === today
}

function _findExerciseInWorkouts(workouts, keywords, filter = null) {
  let total = 0
  for (const w of workouts) {
    if (filter && !filter(w)) continue
    for (const ex of (w.exercises || [])) {
      const name = (ex.name || '').toLowerCase()
      if (keywords.some(k => name.includes(k))) {
        total += (ex.sets || []).length
      }
    }
  }
  return total
}

function _maxRepsForExercise(workouts, keywords) {
  let max = 0
  for (const w of workouts) {
    if (!_isThisWeek(w.date)) continue
    for (const ex of (w.exercises || [])) {
      const name = (ex.name || '').toLowerCase()
      if (keywords.some(k => name.includes(k))) {
        for (const s of (ex.sets || [])) {
          if ((s.reps || 0) > max) max = s.reps
        }
      }
    }
  }
  return max
}

function _maxBenchThisWeek(workouts) {
  let max = 0
  for (const w of workouts) {
    if (!_isThisWeek(w.date)) continue
    for (const ex of (w.exercises || [])) {
      if (!(ex.name || '').toLowerCase().includes('bench')) continue
      for (const s of (ex.sets || [])) {
        const kg = Number(s.weightKg ?? s.weight_kg) || 0
        if (kg > max) max = kg
      }
    }
  }
  return max
}

/**
 * Quest progress'i workouts'a göre güncelle.
 */
export function updateQuests(questsSeed, workouts) {
  if (!questsSeed) return questsSeed

  const today = workouts.filter(w => _isToday(w.date))
  const thisWeek = workouts.filter(w => _isThisWeek(w.date))

  const daily = (questsSeed.daily || []).map(q => {
    switch (q.name) {
      case 'Core Aktivasyon': {
        // Bugün core egzersiz yapıldı mı?
        const coreSets = _findExerciseInWorkouts(today, ['hollow', 'l-sit', 'lsit', 'plank', 'dragon', 'leg raise', 'ab wheel', 'crunch', 'çakı'])
        return { ...q, progress: Math.min(q.total, coreSets > 0 ? 1 : 0), done: coreSets > 0 }
      }
      default:
        return q
    }
  })

  const weekly = (questsSeed.weekly || []).map(q => {
    switch (q.name) {
      case 'Bacak Günü': {
        const legSessions = thisWeek.filter(w =>
          w.type === 'Bacak' ||
          (w.exercises || []).some(ex => /squat|lunge|calf|leg|bacak/i.test(ex.name || ''))
        ).length
        const done = legSessions >= q.total
        return { ...q, progress: Math.min(q.total, legSessions), done }
      }
      case 'Muscle-Up Challenge': {
        const mu = _maxRepsForExercise(workouts, ['muscle-up', 'muscle up'])
        return { ...q, progress: Math.min(q.total, mu), done: mu >= q.total }
      }
      case 'Bench Progress': {
        const bestBench = _maxBenchThisWeek(workouts)
        const target = Number(q.targetKg) || 65
        const done = bestBench >= target
        return {
          ...q,
          progress: done ? q.total : Math.min(q.total, Math.round(bestBench / target)),
          done,
          desc: done ? `${bestBench}kg bu hafta kırıldı!` : q.desc,
        }
      }
      case 'Esneklik Seansları': {
        const stretches = thisWeek.filter(w => w.type === 'Stretching').length
        return { ...q, progress: Math.min(q.total, stretches), done: stretches >= q.total }
      }
      case 'Antrenman Tutarlılığı': {
        const sessions = thisWeek.length
        return { ...q, progress: Math.min(q.total, sessions), done: sessions >= q.total }
      }
      default:
        return q
    }
  })

  return { daily, weekly }
}

/**
 * Koçun quest_hints'ini daily listesinin sonuna "Coach hedefi" başlığıyla ekle.
 */
export function appendCoachQuests(quests, coachHints) {
  if (!Array.isArray(coachHints) || !coachHints.length) return quests
  const hintQuests = coachHints.map((hint, i) => {
    // "Core 10 set/hafta — 3/10" formatındaki hint'i parse et
    const m = String(hint).match(/(.+?)\s*—\s*(\d+)\s*\/\s*(\d+)/)
    if (m) {
      const [, name, prog, total] = m
      const p = Number(prog), t = Number(total)
      return {
        icon: '🎯',
        name: name.trim(),
        desc: 'Koç hedefi — bu hafta',
        reward: '+30 XP',
        done: p >= t,
        progress: p,
        total: t,
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
