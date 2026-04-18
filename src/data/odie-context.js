import { profile as seedProfile } from './profile.js'
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
  const quests = appendCoachQuests(
    updateQuests(seedProfile.quests, contextWorkouts, dailyLogs, session?.date || getLocalDateString()),
    coachNote?.quest_hints || [],
  )
  const skills = updateSkills(seedProfile.skills, contextWorkouts, coachNote?.skill_progress || [])
  const performance = updatePerformance(seedProfile.performance, contextWorkouts)
  const loadProfile = summarizeLoadProfile(contextWorkouts)

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
    loadProfile,
    focusGaps: summarizeFocusGaps(contextWorkouts, dailyLogs),
  }
}
