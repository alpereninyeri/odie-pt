import { profile as seedProfile } from './profile.js'
import { appendClassQuests } from './class-quests.js'
import {
  summarizeBlockArchive,
  summarizeBodyMetricsTrend,
  summarizeFactArchive,
  summarizeFeedbackLoop,
} from './memory-engine.js'
import { updatePerformance } from './performance-engine.js'
import { appendCoachQuests, updateQuests } from './quest-engine.js'
import { updateSkills } from './skill-engine.js'
import { getLocalDateString, normalizeDateString, normalizeSession } from './rules.js'

function avg(values, fallback = 0) {
  if (!values.length) return fallback
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function sortByDateDesc(items = []) {
  return [...items].sort((left, right) => {
    const leftDate = normalizeDateString(left.date)
    const rightDate = normalizeDateString(right.date)
    if (leftDate !== rightDate) return rightDate.localeCompare(leftDate)
    return String(right.createdAt || right.created_at || '').localeCompare(String(left.createdAt || left.created_at || ''))
  })
}

function visibleCoachSections(coachNote) {
  return (coachNote?.sections || []).filter(section => !section?.hidden)
}

function summarizeRecentWorkouts(workouts = [], limit = 6) {
  return workouts.slice(0, limit).map(workout => ({
    date: workout.date,
    type: workout.type,
    durationMin: Number(workout.durationMin) || 0,
    highlight: workout.highlight || '',
    primaryCategory: workout.primaryCategory,
    tags: (workout.tags || []).slice(0, 4),
  }))
}

function summarizeRecentPrs(prs = {}, limit = 5) {
  return Object.entries(prs)
    .sort((left, right) => String(right[1]?.date || '').localeCompare(String(left[1]?.date || '')))
    .slice(0, limit)
    .map(([name, pr]) => ({
      name,
      date: pr.date,
      value: pr.weightKg && pr.reps
        ? `${pr.weightKg}kg x${pr.reps}`
        : pr.reps
          ? `${pr.reps} rep`
          : pr.durationSec
            ? `${pr.durationSec}sn`
            : '-',
    }))
}

function summarizeQuestPressure(quests = {}) {
  return [...(quests.weekly || []), ...(quests.daily || [])]
    .filter(quest => !quest.done && Number(quest.progress) < Number(quest.total))
    .sort((left, right) => {
      const leftPct = Number(left.total) ? Number(left.progress) / Number(left.total) : 0
      const rightPct = Number(right.total) ? Number(right.progress) / Number(right.total) : 0
      return leftPct - rightPct
    })
    .slice(0, 5)
    .map(quest => ({
      name: quest.name,
      progress: quest.progress,
      total: quest.total,
      reward: quest.reward,
      desc: quest.desc,
    }))
}

function summarizeSkillPressure(skills = []) {
  return skills.flatMap(branch => branch.items.map(item => ({ branch: branch.branch, ...item })))
    .filter(item => item.status !== 'done')
    .slice(0, 6)
    .map(item => ({
      branch: item.branch,
      name: item.name,
      status: item.status,
      req: item.req || '',
      desc: item.desc,
    }))
}

function summarizeRecovery(dailyLogs = [], survival = {}, today = getLocalDateString()) {
  const recentLogs = sortByDateDesc(dailyLogs).slice(0, 7)
  const avgSteps = Math.round(avg(recentLogs.map(log => Number(log.steps) || 0), 0))
  const avgSleep = Math.round(avg(recentLogs.map(log => Number(log.sleepHours) || 0), 0) * 10) / 10
  const avgWaterMl = Math.round(avg(recentLogs.map(log => Number(log.waterMl) || 0), 0))
  const todayLog = dailyLogs.find(log => normalizeDateString(log.date) === today) || null

  return {
    avgSteps,
    avgSleep,
    avgWaterL: Math.round((avgWaterMl / 1000) * 10) / 10,
    todaySteps: Number(todayLog?.steps) || 0,
    todaySleep: Number(todayLog?.sleepHours) || 0,
    todayWaterL: Math.round(((Number(todayLog?.waterMl) || 0) / 1000) * 10) / 10,
    armor: Number(survival.armor) || 0,
    fatigue: Number(survival.fatigue) || 0,
    status: survival.status || 'healthy',
    xpMultiplier: Number(survival.xpMultiplier) || 1,
    xpReason: survival.xpReason || '',
    warnings: survival.warnings || [],
  }
}

function summarizeStats(stats = {}) {
  const entries = Object.entries(stats).map(([key, val]) => ({ key, val: Number(val) || 0 }))
  const sorted = [...entries].sort((left, right) => left.val - right.val)
  return {
    weakest: sorted[0] || null,
    strongest: sorted[sorted.length - 1] || null,
    spread: entries.reduce((acc, item) => ({ ...acc, [item.key]: item.val }), {}),
  }
}

function summarizeDisciplineMix(workouts = []) {
  const recent = workouts.slice(0, 10)
  const counts = recent.reduce((acc, workout) => {
    const key = workout.primaryCategory || 'mixed'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  return counts
}

function summarizeCoachMemory(coachNote) {
  const sections = visibleCoachSections(coachNote).slice(0, 2)
  return sections.map(section => ({
    title: section.title,
    lines: (section.lines || []).slice(0, 2),
  }))
}

function summarizeAthleteMemory(memories = []) {
  return [...(memories || [])]
    .filter(item => item?.active !== false)
    .sort((left, right) => String(right.lastUsedAt || right.createdAt || '').localeCompare(String(left.lastUsedAt || left.createdAt || '')))
    .slice(0, 5)
    .map(item => ({
      scope: item.scope || 'global',
      key: item.key || '',
      summary: item.summary || '',
      confidence: Number(item.confidence) || 0,
    }))
}

function summarizeLoadProfile(workouts = []) {
  const recent = workouts.slice(0, 14)
  const previous = workouts.slice(14, 28)
  const summarizeBlock = (items = []) => items.reduce((acc, workout) => {
    acc.sessions += 1
    acc.minutes += Number(workout.durationMin) || 0
    acc.km += Number(workout.distanceKm) || 0
    acc.volume += Number(workout.volumeKg) || 0
    const key = workout.primaryCategory || 'mixed'
    acc.mix[key] = (acc.mix[key] || 0) + 1
    return acc
  }, { sessions: 0, minutes: 0, km: 0, volume: 0, mix: {} })

  const current = summarizeBlock(recent)
  const previousBlock = summarizeBlock(previous)
  const deltaSessions = current.sessions - previousBlock.sessions
  const deltaMinutes = current.minutes - previousBlock.minutes
  const deltaKm = Math.round((current.km - previousBlock.km) * 10) / 10
  const deltaVolume = Math.round(current.volume - previousBlock.volume)

  const trendSignals = []
  if (deltaSessions > 0) trendSignals.push(`Frekans ${deltaSessions} seans yukarida`)
  else if (deltaSessions < 0) trendSignals.push(`Frekans ${Math.abs(deltaSessions)} seans geride`)

  if (deltaMinutes > 60) trendSignals.push(`Toplam sure +${deltaMinutes}dk`)
  else if (deltaMinutes < -60) trendSignals.push(`Toplam sure ${deltaMinutes}dk`)

  if (deltaKm >= 2) trendSignals.push(`Outdoor hacmi +${deltaKm}km`)
  if (deltaVolume >= 500) trendSignals.push(`Kuvvet hacmi +${deltaVolume}kg`)

  return {
    current,
    previous: previousBlock,
    trendSignals: trendSignals.slice(0, 4),
  }
}

function _windowDays(workouts = [], startOffsetDays, endOffsetDays, todayStr = getLocalDateString()) {
  const today = new Date(`${todayStr}T00:00:00`)
  const startTs = today.getTime() - (startOffsetDays * 86400000)
  const endTs = today.getTime() - (endOffsetDays * 86400000)
  const lo = Math.min(startTs, endTs)
  const hi = Math.max(startTs, endTs)
  return workouts.filter(workout => {
    const ts = new Date(`${normalizeDateString(workout.date)}T00:00:00`).getTime()
    return ts >= lo && ts < hi
  })
}

function _windowStats(workouts = []) {
  return workouts.reduce((acc, workout) => {
    acc.sessions += 1
    acc.minutes += Number(workout.durationMin) || 0
    acc.volume += Number(workout.volumeKg) || 0
    acc.km += Number(workout.distanceKm) || 0
    return acc
  }, { sessions: 0, minutes: 0, volume: 0, km: 0 })
}

function _topExercises(workouts = [], limit = 3) {
  const counts = {}
  for (const workout of workouts) {
    for (const exercise of (workout.exercises || [])) {
      const name = String(exercise.name || '').trim()
      if (!name) continue
      counts[name] = (counts[name] || 0) + 1
    }
  }
  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }))
}

function summarizeHistoricalEcho(workouts = [], prs = {}, todayStr = getLocalDateString()) {
  const last30 = _windowDays(workouts, 30, 0, todayStr)
  const prev30 = _windowDays(workouts, 60, 30, todayStr)
  const oneYearWindow = _windowDays(workouts, 372, 358, todayStr)

  const current = _windowStats(last30)
  const previous = _windowStats(prev30)
  const yearAgo = _windowStats(oneYearWindow)
  const fmtDelta = (curr, prev) => {
    if (!prev && !curr) return null
    const diff = curr - prev
    return { current: curr, previous: prev, delta: diff }
  }

  const monthlyDeltas = {
    sessions: fmtDelta(current.sessions, previous.sessions),
    minutes: fmtDelta(current.minutes, previous.minutes),
    volume: fmtDelta(Math.round(current.volume), Math.round(previous.volume)),
    km: fmtDelta(Math.round(current.km * 10) / 10, Math.round(previous.km * 10) / 10),
  }

  const recentPrs = Object.entries(prs)
    .map(([name, pr]) => ({ name, ...pr }))
    .filter(pr => pr.date)
    .sort((left, right) => String(right.date).localeCompare(String(left.date)))
  const last30Cutoff = new Date(`${todayStr}T00:00:00`).getTime() - (30 * 86400000)
  const last30Prs = recentPrs.filter(pr => new Date(`${normalizeDateString(pr.date)}T00:00:00`).getTime() >= last30Cutoff)

  const sentence = []
  if (monthlyDeltas.sessions?.delta) {
    sentence.push(`Son 30 gun ${monthlyDeltas.sessions.current} seans (oncesi ${monthlyDeltas.sessions.previous}, fark ${monthlyDeltas.sessions.delta >= 0 ? '+' : ''}${monthlyDeltas.sessions.delta}).`)
  }
  if (monthlyDeltas.volume?.delta && Math.abs(monthlyDeltas.volume.delta) >= 200) {
    sentence.push(`Hacim ${monthlyDeltas.volume.current.toLocaleString('tr-TR')}kg (oncesi ${monthlyDeltas.volume.previous.toLocaleString('tr-TR')}kg).`)
  }
  if (yearAgo.sessions) {
    sentence.push(`1 yil once ayni hafta ${yearAgo.sessions} seans / ${Math.round(yearAgo.minutes)}dk yapilmisti.`)
  }
  if (last30Prs.length) {
    sentence.push(`Son 30 gunde ${last30Prs.length} egzersizde PR guncellendi: ${last30Prs.slice(0, 3).map(pr => pr.name).join(', ')}.`)
  }

  return {
    last30: current,
    prev30: previous,
    yearAgo,
    monthlyDeltas,
    recentPrs: last30Prs.slice(0, 5).map(pr => ({
      name: pr.name,
      date: pr.date,
      kind: pr.kind || null,
      metric: pr.metric ?? pr.score,
      weightKg: pr.weightKg,
      reps: pr.reps,
      durationSec: pr.durationSec,
    })),
    topExercisesLast30: _topExercises(last30, 3),
    topExercisesPrev30: _topExercises(prev30, 3),
    summarySentences: sentence.slice(0, 4),
  }
}

function summarizeFocusGaps(workouts = [], dailyLogs = []) {
  const recent = workouts.slice(0, 10)
  const tags = new Set(recent.flatMap(workout => workout.tags || []))
  const types = new Set(recent.map(workout => workout.type))
  const gaps = []

  const hasCore = recent.some(workout => (workout.tags || []).includes('core'))
  const hasLegs = recent.some(workout => (workout.tags || []).includes('legs')) || recent.some(workout => workout.type === 'Bacak')
  const hasMobility = tags.has('mobility') || types.has('Stretching')
  const hasRecoveryDay = recent.some(workout => workout.primaryCategory === 'recovery')
  const stepDays = dailyLogs.filter(log => (Number(log.steps) || 0) >= 8000).length

  if (!hasCore) gaps.push('Direkt core zinciri son 10 seansta eksik')
  if (!hasLegs) gaps.push('Bacak/alt vucut frekansi geri kaldi')
  if (!hasMobility) gaps.push('Mobilite seansi yok')
  if (!hasRecoveryDay) gaps.push('Planli recovery sinyali gorunmuyor')
  if (stepDays < 4) gaps.push('Gunluk hareket zinciri zayif')

  return gaps.slice(0, 5)
}

export function buildOdieContext({
  profile = {},
  workouts = [],
  dailyLogs = [],
  athleteMemory = [],
  memoryFeedback = [],
  bodyMetricsHistory = [],
  workoutBlocks = [],
  workoutFacts = [],
  prs = {},
  coachNote = null,
  nextStats = null,
  nextClass = null,
  session = null,
  streak = 0,
  xpEarned = 0,
  survival = {},
} = {}) {
  const normalizedWorkouts = sortByDateDesc((workouts || []).map(workout => normalizeSession(workout)))
  const contextWorkouts = session
    ? sortByDateDesc([normalizeSession(session), ...normalizedWorkouts])
    : normalizedWorkouts
  const stats = nextStats || profile.stats || {}
  const quests = appendClassQuests(
    appendCoachQuests(
      updateQuests(seedProfile.quests, contextWorkouts, dailyLogs, session?.date || getLocalDateString()),
      coachNote?.quest_hints || [],
    ),
    nextClass?.id || profile.classId,
    contextWorkouts,
    dailyLogs,
    session?.date || getLocalDateString(),
  )
  const skills = updateSkills(seedProfile.skills, contextWorkouts, coachNote?.skill_progress || [])
  const performance = updatePerformance(seedProfile.performance, contextWorkouts)
  const loadProfile = summarizeLoadProfile(contextWorkouts)
  const historicalEcho = summarizeHistoricalEcho(contextWorkouts, prs, session?.date || getLocalDateString())

  return {
    athlete: {
      rank: profile.rank || '',
      className: nextClass?.name || profile.class || '',
      subClass: nextClass?.subName || profile.subClass || '',
      classReason: nextClass?.reason || '',
      classSignals: nextClass?.signals || [],
      sessions: Number(profile.sessions) || contextWorkouts.length,
      level: Number(profile.level) || 1,
      xpEarned: Number(xpEarned) || 0,
      streak: Number(streak) || 0,
    },
    stats: summarizeStats(stats),
    recovery: summarizeRecovery(dailyLogs, survival, session?.date || getLocalDateString()),
    disciplineMix: summarizeDisciplineMix(contextWorkouts),
    recentWorkouts: summarizeRecentWorkouts(contextWorkouts),
    recentPrs: summarizeRecentPrs(prs),
    questPressure: summarizeQuestPressure(quests),
    skillPressure: summarizeSkillPressure(skills),
    performance: performance.map(item => ({
      key: item.key,
      name: item.name,
      val: item.val,
      trend: item.trend,
      note: item.note,
    })),
    coachMemory: summarizeCoachMemory(coachNote),
    athleteMemory: summarizeAthleteMemory(athleteMemory),
    correctiveMemory: summarizeFeedbackLoop(memoryFeedback),
    bodyMetricsTrend: summarizeBodyMetricsTrend(bodyMetricsHistory, profile.body_metrics || {}),
    blockArchive: summarizeBlockArchive(workoutBlocks),
    factArchive: summarizeFactArchive(workoutFacts),
    loadProfile,
    historicalEcho,
    focusGaps: summarizeFocusGaps(contextWorkouts, dailyLogs),
  }
}
