import { getLocalDateString, normalizeDateString, normalizeSession } from './rules.js'
import { buildSemanticProfile } from './semantic-profile.js'

function daysBetween(fromStr, toStr) {
  if (!fromStr || !toStr) return Infinity
  const from = new Date(`${normalizeDateString(fromStr)}T00:00:00`).getTime()
  const to = new Date(`${normalizeDateString(toStr)}T00:00:00`).getTime()
  return Math.round((to - from) / 86400000)
}

function isThisWeek(dateStr, todayStr) {
  return daysBetween(dateStr, todayStr) <= 7
}

function todayLog(dailyLogs = [], today = getLocalDateString()) {
  return dailyLogs.find(log => normalizeDateString(log.date) === today) || { waterMl: 0, sleepHours: 0, steps: 0 }
}

function updateDailyQuest(quest, dayProfile, todayDailyLog, todaySessions) {
  switch (quest.name) {
    case 'Core Aktivasyon': {
      const progress = dayProfile.counts?.core ? 1 : 0
      return { ...quest, progress, done: progress >= 1, desc: progress ? 'Bugun trunk activation sinyali alindi.' : quest.desc }
    }
    case 'Günlük Antrenman':
    case 'Gunluk Antrenman': {
      const progress = todaySessions.length > 0 ? 1 : 0
      return { ...quest, progress, done: progress >= 1, desc: progress ? `Bugun ${todaySessions[0]?.type || 'seans'} tamamlandi.` : quest.desc }
    }
    case 'Mobility Aktivasyon': {
      const progress = dayProfile.counts?.mobility > 0 ? 1 : 0
      return { ...quest, progress, done: progress >= 1, desc: progress ? 'Bugun mobility/recovery blogu alindi.' : quest.desc }
    }
    default:
      return quest
  }
}

function updateWeeklyQuest(quest, weekProfile, thisWeek = []) {
  switch (quest.name) {
    case 'Bacak Günü':
    case 'Bacak Gunu': {
      const progress = Math.min(quest.total, weekProfile.counts?.legs || 0)
      return {
        ...quest,
        progress,
        done: progress >= quest.total,
        desc: progress ? `Alt vucut sinyali ${progress}/${quest.total}. Parkour, bike veya legs bloklari sayiliyor.` : quest.desc,
      }
    }
    case 'Muscle-Up Challenge': {
      const reps = weekProfile.feats?.muscleUpMaxReps || 0
      return {
        ...quest,
        progress: Math.min(quest.total, reps),
        done: reps >= quest.total,
        desc: reps ? `Haftanin en iyi clean rep'i ${reps}.` : quest.desc,
      }
    }
    case 'Bench Progress': {
      const target = Number(quest.targetKg) || 65
      const bestBench = weekProfile.feats?.benchMaxKg || 0
      const done = bestBench >= target
      return {
        ...quest,
        progress: done ? quest.total : Math.min(quest.total, Math.round((bestBench / Math.max(1, target)) * quest.total)),
        done,
        desc: bestBench ? (done ? `${bestBench}kg bu hafta kirildi!` : `Su an haftalik peak ${bestBench}kg.`) : quest.desc,
      }
    }
    case 'Esneklik Seansları':
    case 'Esneklik Seanslari': {
      const stretches = Math.min(quest.total, weekProfile.counts?.mobility || 0)
      return {
        ...quest,
        progress: stretches,
        done: stretches >= quest.total,
        desc: stretches ? `Mobilite/recovery bloklari ${stretches}/${quest.total}.` : quest.desc,
      }
    }
    case 'Antrenman Tutarlılığı':
    case 'Antrenman Tutarliligi': {
      const progress = Math.min(quest.total, thisWeek.length)
      return { ...quest, progress, done: progress >= quest.total }
    }
    default:
      return quest
  }
}

export function updateQuests(questsSeed, workouts = [], dailyLogs = [], today = getLocalDateString()) {
  if (!questsSeed) return questsSeed

  const normalizedWorkouts = workouts.map(workout => normalizeSession(workout))
  const todaySessions = normalizedWorkouts.filter(workout => normalizeDateString(workout.date) === today)
  const thisWeek = normalizedWorkouts.filter(workout => isThisWeek(workout.date, today))
  const todayDailyLog = todayLog(dailyLogs, today)
  const dayProfile = buildSemanticProfile(todaySessions, [todayDailyLog])
  const weekProfile = buildSemanticProfile(thisWeek, dailyLogs)

  return {
    daily: (questsSeed.daily || []).map(quest => updateDailyQuest(quest, dayProfile, todayDailyLog, todaySessions)),
    weekly: (questsSeed.weekly || []).map(quest => updateWeeklyQuest(quest, weekProfile, thisWeek)),
  }
}

export function appendCoachQuests(quests, coachHints = []) {
  const baseWeekly = (quests?.weekly || []).filter(quest => !quest.fromCoach)
  if (!Array.isArray(coachHints) || !coachHints.length) {
    return { ...quests, weekly: baseWeekly }
  }
  const hintQuests = coachHints.map(hint => {
    const match = String(hint).match(/(.+?)\s*[—-]\s*(\d+)\s*\/\s*(\d+)/)
    if (match) {
      const [, name, progress, total] = match
      return {
        icon: '🎯',
        name: name.trim(),
        desc: 'Koc hedefi - bu hafta',
        reward: '+30 XP',
        done: Number(progress) >= Number(total),
        progress: Number(progress),
        total: Number(total),
        fromCoach: true,
      }
    }
    return {
      icon: '🎯',
      name: 'Koc Hedefi',
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
    weekly: [...baseWeekly, ...hintQuests],
  }
}
