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

const BASE_BALANCE = {
  Omuz: 198.5,
  Göğüs: 169.5,
  Triceps: 163.5,
  Biseps: 156,
  'Üst Sırt': 128.5,
  Lat: 108.5,
  'Bacak (Parkour)': 45,
  Kalf: 36,
  Core: 0,
  Kardiyo: 0,
}

const SEED_IDS = new Set(['w44', 'w45', 'w46', 'w47', 'w48', 'w49', 'w50', 'w51', 'w52', 'w53'])

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
}

function _updateMuscleBalance(state) {
  const delta = {}
  for (const workout of state.workouts || []) {
    if (SEED_IDS.has(String(workout.id))) continue

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
    sets: Math.round(((BASE_BALANCE[item.label] ?? item.sets) + (delta[item.label] || 0)) * 10) / 10,
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
  if (sets >= 180) return 'S'
  if (sets >= 140) return 'A'
  if (sets >= 100) return 'B+'
  if (sets >= 60) return 'B-'
  if (sets >= 30) return 'C'
  if (sets >= 12) return 'D+'
  if (sets >= 6) return 'E+'
  return 'F'
}

function _applyProfileStatsToArray(state) {
  const base = state.profile?.stats || {}
  state.stats = (state.stats || []).map(stat => {
    const value = Number(base[stat.key])
    return Number.isFinite(value)
      ? { ...stat, val: Math.max(0, Math.min(100, value)) }
      : stat
  })
}

function _updatePerformance(state) {
  state.performance = updatePerformance(state.performance, state.workouts || [])
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

  const avgSteps = Math.round(avg(recentLogs.map(log => Number(log.steps) || 0), 0))
  const avgSleep = Math.round(avg(recentLogs.map(log => Number(log.sleepHours) || 0), 0) * 10) / 10
  const avgWaterMl = Math.round(avg(recentLogs.map(log => Number(log.waterMl) || 0), 0))
  const avgDuration = Math.round(avg(workouts.slice(0, 10).map(workout => Number(workout.durationMin) || 0), 0))
  const monthWorkoutDays = new Set(workouts.filter(workout => normalizeDateString(workout.date).startsWith(todayMonth)).map(workout => normalizeDateString(workout.date)))
  const monthMovementDays = new Set([
    ...workouts
      .filter(workout => normalizeDateString(workout.date).startsWith(todayMonth) && (workout.primaryCategory === 'movement' || workout.primaryCategory === 'endurance' || workout.durationMin >= 40))
      .map(workout => normalizeDateString(workout.date)),
    ...(state.dailyLogs || [])
      .filter(log => normalizeDateString(log.date).startsWith(todayMonth) && (Number(log.steps) || 0) >= 8000)
      .map(log => normalizeDateString(log.date)),
  ])
  const totalKm = Math.round((Number(state.profile.totalKm) || 0) * 10) / 10
  const recoveryScore = Math.max(0, Math.min(100, Math.round(((state.profile.armor ?? 100) - (state.profile.fatigue ?? 0)) + 20)))
  const seedMetrics = state.health?.metrics || []
  const staticWeight = seedMetrics.find(metric => metric.label === 'Kilo') || { icon: '⚖️', label: 'Kilo', val: '74 kg', sub: 'Stabil', color: 'var(--emerald)' }
  const staticBmi = seedMetrics.find(metric => metric.label === 'BMI') || { icon: '📏', label: 'BMI', val: '23.4', sub: '178cm / 74kg', color: 'var(--dim)' }

  state.globalStats = [
    { val: avgSteps.toLocaleString('tr-TR'), label: 'Ort. Adım/Gün' },
    { val: `${avgDuration || 0}dk`, label: 'Ort. Seans' },
    { val: `${monthWorkoutDays.size}/${daysInMonth}`, label: 'Egzersiz Halkası' },
    { val: `${monthMovementDays.size}/${daysInMonth}`, label: 'Hareket Halkası', red: monthMovementDays.size < Math.round(daysInMonth * 0.55) },
  ]

  const healthWarnings = []
  if (avgSleep && avgSleep < 7) {
    healthWarnings.push({ color: 'var(--amber)', icon: '😴', name: 'UYKU BORCU', desc: `${avgSleep} saat ortalama. Recovery ve koordinasyon aşağı çekiliyor.` })
  }
  if (avgWaterMl && avgWaterMl < 2200) {
    healthWarnings.push({ color: 'var(--cobalt)', icon: '💧', name: 'HİDRASYON DÜŞÜK', desc: `${Math.round(avgWaterMl / 100) / 10}L ortalama. Performans ve toparlanma için artır.` })
  }
  if (monthMovementDays.size < Math.round(daysInMonth * 0.5)) {
    healthWarnings.push({ color: 'var(--coral)', icon: '🔥', name: 'HAREKET HALKASI GERİDE', desc: `Bu ay ${monthMovementDays.size}/${daysInMonth}. Gün içi hareket tekrar yükselmeli.` })
  }
  if (state.profile?.survivalWarnings?.length) {
    for (const warning of state.profile.survivalWarnings.slice(0, 2)) {
      healthWarnings.push({ color: 'var(--coral)', icon: '🛡️', name: 'RECOVERY UYARISI', desc: warning })
    }
  }

  state.health = {
    rings: [
      {
        name: 'Egzersiz',
        icon: '🏃',
        current: monthWorkoutDays.size,
        max: daysInMonth,
        unit: 'gün',
        color: 'var(--emerald)',
        pct: Math.round((monthWorkoutDays.size / Math.max(1, daysInMonth)) * 100),
      },
      {
        name: 'Hareket',
        icon: '🔥',
        current: monthMovementDays.size,
        max: daysInMonth,
        unit: 'gün',
        color: 'var(--amber)',
        pct: Math.round((monthMovementDays.size / Math.max(1, daysInMonth)) * 100),
      },
      {
        name: 'Adım',
        icon: '👟',
        current: avgSteps,
        max: 12000,
        unit: '/gün avg',
        color: 'var(--cobalt)',
        pct: Math.min(100, Math.round((avgSteps / 12000) * 100)),
      },
    ],
    metrics: [
      { icon: '😴', label: 'Uyku', val: `${avgSleep || 0} saat`, sub: 'Son 7 gün ort.', color: 'var(--amber)' },
      { icon: '💧', label: 'Günlük Su', val: `${Math.round(avgWaterMl / 100) / 10} L`, sub: 'Son 7 gün ort.', color: 'var(--cobalt)' },
      { icon: '⏱️', label: 'Ortalama Seans', val: `${avgDuration || 0} dk`, sub: 'Son 10 antrenman', color: 'var(--mist-strong)' },
      { icon: '🛡️', label: 'Readiness', val: `${recoveryScore}/100`, sub: `${state.profile.survivalStatus || 'healthy'}`, color: 'var(--emerald)' },
      { icon: '🗺️', label: 'Toplam Mesafe', val: `${totalKm.toLocaleString('tr-TR')} km`, sub: 'Tahmini outdoor toplam', color: 'var(--cobalt)' },
      staticWeight,
      staticBmi,
    ],
    warnings: healthWarnings.slice(0, 4),
  }
}

function _updateQuests(state) {
  const quests = updateQuests(state.quests, state.workouts || [], state.dailyLogs || [])
  state.quests = appendCoachQuests(quests, state.coachQuestHints || [])
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
