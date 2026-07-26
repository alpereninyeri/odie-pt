import { buildBodyMapState, getExerciseBodyRegions } from './body-map-engine.js'
import { buildClassTrack } from './class-track.js'
import {
  computeSessionStatDelta,
  getLocalDateString,
  normalizeDateString,
  normalizeText,
} from './rules.js'

const DAY_MS = 86_400_000
const STAT_LABELS = {
  str: ['KUV', 'Kuvvet'],
  agi: ['ÇEV', 'Çeviklik'],
  end: ['DAY', 'Dayanıklılık'],
  dex: ['BEC', 'Beceri'],
  con: ['GÖV', 'Gövde'],
  sta: ['STAM', 'Kondisyon'],
}

const REGION_GUIDES = {
  chest: {
    develops: 'Göğüs itiş gücü',
    recommendations: ['Incline Press', 'Şınav'],
  },
  shoulder: {
    develops: 'Omuz kuvveti + stabilite',
    recommendations: ['Lateral Raise', 'Shoulder Press'],
  },
  triceps: {
    develops: 'İtiş kilidi + arka kol',
    recommendations: ['Pushdown', 'Close Grip Press'],
  },
  biceps: {
    develops: 'Çekiş gücü + ön kol',
    recommendations: ['Chin-up', 'Biceps Curl'],
  },
  forearm: {
    develops: 'Kavrama + ön kol',
    recommendations: ['Farmer Carry', 'Dead Hang'],
  },
  wrist: {
    develops: 'Bilek dayanıklılığı',
    recommendations: ['Wrist Curl', 'Hafif Bilek Hazırlığı'],
  },
  lat: {
    develops: 'Dikey çekiş + kanat',
    recommendations: ['Pull-up', 'Lat Pulldown'],
  },
  'upper-back': {
    develops: 'Kürek kontrolü + üst sırt',
    recommendations: ['Row', 'Face Pull'],
  },
  core: {
    develops: 'Gövde stabilitesi',
    recommendations: ['Hollow Hold', 'Hanging Leg Raise'],
  },
  glute: {
    develops: 'Kalça gücü + ekstansiyon',
    recommendations: ['Hip Thrust', 'Split Squat'],
  },
  quads: {
    develops: 'Diz itişi + ön bacak',
    recommendations: ['Squat', 'Leg Press'],
  },
  hamstrings: {
    develops: 'Kalça menteşesi + arka bacak',
    recommendations: ['Romanian Deadlift', 'Leg Curl'],
  },
  calves: {
    develops: 'Ayak itişi + baldır',
    recommendations: ['Calf Raise', 'Jump Rope'],
  },
  knees: {
    develops: 'Diz kontrolü',
    recommendations: ['Step-up', 'Split Squat'],
  },
  ankles: {
    develops: 'Ayak bileği kontrolü',
    recommendations: ['Calf Raise', 'Ankle Mobility'],
  },
  'lower-back': {
    develops: 'Bel + arka zincir kontrolü',
    recommendations: ['Back Extension', 'Romanian Deadlift'],
  },
  hips: {
    develops: 'Kalça hareketliliği',
    recommendations: ['Hip Mobility', 'Split Squat'],
  },
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, number(value)))
}

function dayStamp(value) {
  const normalized = normalizeDateString(value)
  if (!normalized) return null
  const date = new Date(`${normalized}T12:00:00Z`)
  return Number.isNaN(date.getTime()) ? null : date.getTime()
}

function daysBetween(left, right) {
  const leftStamp = dayStamp(left)
  const rightStamp = dayStamp(right)
  if (leftStamp == null || rightStamp == null) return 99
  return Math.max(0, Math.floor((rightStamp - leftStamp) / DAY_MS))
}

function sum(list, selector) {
  return list.reduce((total, item) => total + number(selector(item)), 0)
}

function uniqueDays(workouts) {
  return new Set(workouts.map(workout => normalizeDateString(workout.date)).filter(Boolean)).size
}

function inWindow(workouts, today, from, to = 0) {
  return workouts.filter(workout => {
    const age = daysBetween(workout.date, today)
    return age >= to && age < from
  })
}

function summarize(workouts) {
  return {
    sessions: workouts.length,
    activeDays: uniqueDays(workouts),
    sets: Math.round(sum(workouts, workout => workout.sets)),
    volumeKg: Math.round(sum(workouts, workout => workout.volumeKg)),
    minutes: Math.round(sum(workouts, workout => workout.durationMin)),
    prs: workouts.filter(workout => workout.hasPr).length,
  }
}

function delta(current, previous) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function mondayOf(date) {
  const copy = new Date(date)
  const day = copy.getUTCDay() || 7
  copy.setUTCDate(copy.getUTCDate() - day + 1)
  copy.setUTCHours(12, 0, 0, 0)
  return copy
}

function weeklySeries(workouts, today, count = 8) {
  const todayDate = new Date(`${today}T12:00:00Z`)
  const thisMonday = mondayOf(todayDate)
  const weeks = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = new Date(thisMonday.getTime() - (index * 7 * DAY_MS))
    const end = new Date(start.getTime() + (7 * DAY_MS))
    const rows = workouts.filter(workout => {
      const stamp = dayStamp(workout.date)
      return stamp != null && stamp >= start.getTime() && stamp < end.getTime()
    })
    weeks.push({
      key: start.toISOString().slice(0, 10),
      label: start.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' }),
      ...summarize(rows),
    })
  }
  const max = Math.max(...weeks.map(week => week.volumeKg || week.minutes || week.sessions), 1)
  return weeks.map(week => ({
    ...week,
    chartValue: week.volumeKg || week.minutes || week.sessions,
    height: Math.max(5, Math.round(((week.volumeKg || week.minutes || week.sessions) / max) * 100)),
  }))
}

function heatmap(workouts, today, count = 28) {
  const byDay = new Map()
  for (const workout of workouts) {
    const day = normalizeDateString(workout.date)
    if (!day) continue
    byDay.set(day, (byDay.get(day) || 0) + Math.max(1, number(workout.sets) || Math.round(number(workout.durationMin) / 20)))
  }
  const todayStamp = dayStamp(today)
  const values = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(todayStamp - (index * DAY_MS)).toISOString().slice(0, 10)
    values.push({ date, value: byDay.get(date) || 0 })
  }
  const max = Math.max(...values.map(item => item.value), 1)
  return values.map(item => ({
    ...item,
    level: item.value === 0 ? 0 : Math.max(1, Math.ceil((item.value / max) * 4)),
  }))
}

function statRows(profile = {}) {
  const input = profile.stats || {}
  const rows = Array.isArray(input)
    ? input.map(stat => [String(stat.key || stat.label || '').toLowerCase(), stat.scaleScore ?? stat.val ?? stat.rawVal])
    : Object.entries(input)
  return rows
    .map(([key, value]) => {
      const normalizedKey = String(key).toLowerCase()
      const labels = STAT_LABELS[normalizedKey]
      if (!labels) return null
      const score = clamp(value)
      return {
        key: normalizedKey,
        short: labels[0],
        name: labels[1],
        score,
        rank: rankFromScore(score),
      }
    })
    .filter(Boolean)
}

function rankFromScore(value) {
  const score = number(value)
  if (score >= 92) return 'S'
  if (score >= 82) return 'A'
  if (score >= 68) return 'B'
  if (score >= 52) return 'C'
  if (score >= 34) return 'D'
  return 'E'
}

function categoryRows(workouts) {
  const groups = new Map()
  for (const workout of workouts) {
    const key = workout.primaryCategory || workout.type || 'Diğer'
    const item = groups.get(key) || { key, label: categoryLabel(key), sessions: 0, minutes: 0 }
    item.sessions += 1
    item.minutes += number(workout.durationMin)
    groups.set(key, item)
  }
  const rows = [...groups.values()].sort((left, right) => right.sessions - left.sessions)
  const total = Math.max(1, sum(rows, row => row.sessions))
  return rows.map(row => ({ ...row, share: Math.round((row.sessions / total) * 100) }))
}

function categoryLabel(value = '') {
  const key = String(value).toLowerCase()
  if (/strength|push|pull|gym|bacak|shoulder/.test(key)) return 'Kuvvet'
  if (/movement|parkour|akro/.test(key)) return 'Hareket'
  if (/endurance|koş|kos|yür|yur|bisiklet/.test(key)) return 'Kondisyon'
  if (/recovery|stretch|mobil/.test(key)) return 'Toparlanma'
  return String(value || 'Diğer')
}

function workoutVerdict(workout = {}, statGains = []) {
  const tags = new Set((workout.tags || []).map(tag => normalizeText(tag)))
  const text = normalizeText([
    workout.type,
    workout.primaryCategory,
    workout.highlight,
    ...(workout.exercises || []).map(exercise => exercise.name),
  ].join(' '))
  const category = normalizeText(workout.primaryCategory)

  if (category === 'recovery' || tags.has('mobility') || /stretch|mobility|mobilite/.test(text)) return 'Aktif Toparlanma'
  if (tags.has('legs') || /squat|leg press|lunge|bacak|quad|hamstring/.test(text)) return 'Bacak Gücü'
  if (tags.has('push') || /bench|chest press|shoulder press|pushdown/.test(text)) return 'İtiş Gücü'
  if (tags.has('pull') || /pull up|pulldown|row|curl|deadlift/.test(text)) return 'Çekiş Gücü'
  if (tags.has('core') || /plank|hollow|leg raise|core/.test(text)) return 'Gövde Gücü'
  if (category === 'endurance' || tags.has('running') || tags.has('walking')) return 'Kondisyon'
  if (category === 'movement' && (tags.has('explosive') || /jump|sprint|plyo/.test(text))) return 'Patlayıcı Beceri'
  if (category === 'movement') return 'Hareket Becerisi'
  if (category === 'mixed') return 'Karma Güç'

  const fallback = statGains[0]?.key
  if (fallback === 'str') return 'Kuvvet'
  if (fallback === 'con') return 'Gövde Gücü'
  if (fallback === 'agi' || fallback === 'dex') return 'Teknik Beceri'
  if (fallback === 'end' || fallback === 'sta') return 'Kondisyon'
  return 'Karma Antrenman'
}

function sessionRows(workouts) {
  return workouts.slice(0, 40).map(workout => {
    const exercises = (workout.exercises || []).filter(exercise => exercise?.name)
    const exerciseRows = exercises.map(exercise => ({
      ...exercise,
      targets: getExerciseBodyRegions(exercise.name),
    }))
    const topExercises = exerciseRows.slice(0, 4).map(exercise => {
      const sets = Array.isArray(exercise.sets) ? exercise.sets.length : 0
      return `${exercise.name}${sets ? ` ×${sets}` : ''}`
    })
    const statDelta = computeSessionStatDelta(workout)
    const statGains = Object.entries(statDelta)
      .filter(([, value]) => number(value) > 0)
      .map(([key, value]) => ({
        key,
        short: STAT_LABELS[key]?.[0] || key.toUpperCase(),
        name: STAT_LABELS[key]?.[1] || key,
        value: Math.round(number(value) * 10) / 10,
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 2)
    return {
      ...workout,
      exercises: exerciseRows,
      typeLabel: categoryLabel(workout.type || workout.primaryCategory),
      verdict: workoutVerdict(workout, statGains),
      statGains,
      topExercises,
      dateLabel: new Date(`${normalizeDateString(workout.date)}T12:00:00Z`).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }),
    }
  })
}

export function createDashboardModel(sourceState = {}, { today = getLocalDateString() } = {}) {
  const profile = sourceState.profile || {}
  const workouts = [...(sourceState.workouts || [])]
    .filter(workout => normalizeDateString(workout.date))
    .sort((left, right) => String(right.startedAt || right.date).localeCompare(String(left.startedAt || left.date)))
  const classTrack = profile.classTrack || buildClassTrack(workouts)
  const displayProfile = {
    ...profile,
    classTrack,
    displayTitle: profile.displayTitle || classTrack.displayTitle || profile.className,
  }
  const current28Rows = inWindow(workouts, today, 28)
  const previous28Rows = inWindow(workouts, today, 56, 28)
  const current7Rows = inWindow(workouts, today, 7)
  const current28 = summarize(current28Rows)
  const previous28 = summarize(previous28Rows)
  const bodyMap = buildBodyMapState({
    state: { profile: displayProfile, workouts, dailyLogs: [], bodyEvents: [] },
    profile: displayProfile,
    today,
  })
  const regions = (bodyMap.regions || []).map(region => ({
    ...region,
    load: Math.round(clamp(region.load)),
    recovery: Math.round(clamp(region.recovery)),
    risk: Math.round(clamp(region.risk)),
    develops: REGION_GUIDES[region.id]?.develops || 'Temel bölge kapasitesi',
    recommendations: REGION_GUIDES[region.id]?.recommendations || ['Kontrollü temel çalışma'],
    exercisePreview: (region.contributors || []).length
      ? region.contributors.slice(0, 2).map(item => item.name)
      : (REGION_GUIDES[region.id]?.recommendations || ['Kontrollü temel çalışma']).slice(0, 2),
    action: (REGION_GUIDES[region.id]?.recommendations || ['Kontrollü temel çalışma']).join(' veya '),
  }))
  const muscleRegions = regions.filter(region => region.group === 'muscle')
  const weakestFirst = [...muscleRegions]
    .sort((left, right) => left.load - right.load || right.daysSince - left.daysSince)
  const neglected = weakestFirst
    .filter(region => region.trend === 'ihmal' || region.load < 38)
  const gaps = [
    ...neglected,
    ...weakestFirst.filter(region => !neglected.some(item => item.id === region.id)),
  ].slice(0, 4)
  const covered = [...muscleRegions].sort((left, right) => right.load - left.load).slice(0, 3)
  const latestWorkout = workouts[0] || null
  const latestAge = latestWorkout ? daysBetween(latestWorkout.date, today) : 99
  const stats = statRows(profile)
  const weakest = gaps[0] || null
  const xp = profile.xp || { current: 0, max: 2000 }

  return {
    today,
    profile: displayProfile,
    workouts,
    latestWorkout,
    latestAge,
    mode: sourceState.mode || 'demo',
    status: sourceState.status || 'ready',
    error: sourceState.error || '',
    lastSyncedAt: sourceState.lastSyncedAt || null,
    syncSummary: sourceState.syncSummary || null,
    recent7: summarize(current7Rows),
    current28,
    previous28,
    momentum: {
      sessions: delta(current28.sessions, previous28.sessions),
      volume: delta(current28.volumeKg, previous28.volumeKg),
      sets: delta(current28.sets, previous28.sets),
      minutes: delta(current28.minutes, previous28.minutes),
    },
    weekly: weeklySeries(workouts, today),
    heatmap: heatmap(workouts, today),
    categories: categoryRows(current28Rows),
    stats,
    regions,
    gaps,
    covered,
    sessions: sessionRows(workouts),
    xp: {
      current: number(xp.current),
      max: Math.max(1, number(xp.max) || 2000),
      percent: clamp((number(xp.current) / Math.max(1, number(xp.max) || 2000)) * 100),
    },
    streak: profile.streak || { current: 0, max: 0 },
    statusLine:
      latestAge <= 3 ? 'Ritim aktif'
        : latestAge <= 7 ? 'Ritim soğuyor'
          : latestAge <= 20 ? 'Geri dönüş zamanı'
            : 'Uzun ara',
    quest: weakest ? {
      region: weakest,
      eyebrow: 'ANA GÖREV',
      title: `${weakest.label} açığını kapat`,
      action: weakest.action,
      reward: `+${Math.max(20, Math.round((100 - weakest.load) * 0.8))} XP`,
    } : {
      region: null,
      eyebrow: 'ANA GÖREV',
      title: 'Dengeyi koru',
      action: 'Normal programına devam et',
      reward: '+20 XP',
    },
  }
}

export const dashboardInternals = {
  categoryLabel,
  daysBetween,
  heatmap,
  rankFromScore,
  sessionRows,
  summarize,
  workoutVerdict,
  weeklySeries,
}
