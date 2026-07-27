import { computeClass } from '../../src/data/class-engine.js'
import { buildClassTrack } from '../../src/data/class-track.js'
import {
  checkStreakHealth,
  computeProfileStatsFromWorkouts,
  computeSessionXp,
  computeStreakInfo,
  getLocalDateString,
  normalizeDateString,
  normalizeText,
} from '../../src/data/rules.js'
import { countWorkouts, getUserInfo, listWorkouts } from './client.js'
import { normalizeHevyWorkout } from './normalize.js'

const PAGE_SIZE = 10
const DEFAULT_WORKOUT_LIMIT = 120
const MAX_CONCURRENCY = 4
const MAX_HISTORY_PAGES = 500
const XP_PER_LEVEL = 2000

function finite(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function safeLimit(value, fallback = DEFAULT_WORKOUT_LIMIT) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(10, Math.min(160, Math.round(numeric)))
}

function safePageCap(value, fallback = MAX_HISTORY_PAGES) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.max(1, Math.min(MAX_HISTORY_PAGES, Math.round(numeric)))
}

function newestFirst(left, right) {
  return String(right.startedAt || right.createdAt || right.date || '')
    .localeCompare(String(left.startedAt || left.createdAt || left.date || ''))
}

function pageCount(value) {
  const numeric = Number(value)
  return Number.isInteger(numeric) && numeric >= 1 ? numeric : null
}

function rawWorkoutId(workout = {}) {
  return String(workout?.id || '').trim()
}

export async function collectHevyWorkoutHistory({
  listPage = listWorkouts,
  firstPage = null,
  expectedWorkoutCount = 0,
  concurrency = MAX_CONCURRENCY,
  maxPages = MAX_HISTORY_PAGES,
} = {}) {
  const cleanPageCap = safePageCap(maxPages)
  const first = firstPage || await listPage(1, PAGE_SIZE)
  const reportedPages = pageCount(first?.page_count)
  const expectedPages = Math.max(0, Math.ceil(finite(expectedWorkoutCount) / PAGE_SIZE))
  const availablePages = Math.max(1, reportedPages || 0, expectedPages)
  const wantedPages = Math.min(availablePages, cleanPageCap)
  const pages = new Array(wantedPages)
  pages[0] = first

  let nextPage = 2
  const workerCount = Math.min(
    Math.max(1, Number(concurrency) || 1),
    Math.max(0, wantedPages - 1),
  )
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextPage <= wantedPages) {
      const page = nextPage
      nextPage += 1
      pages[page - 1] = await listPage(page, PAGE_SIZE)
    }
  })
  await Promise.all(workers)

  const warnings = []
  if (!reportedPages) warnings.push('invalid_page_count')
  if (reportedPages && expectedPages && reportedPages !== expectedPages) {
    warnings.push(`page_count_mismatch:${reportedPages}:${expectedPages}`)
  }
  if (availablePages > cleanPageCap) {
    warnings.push(`page_cap_reached:${availablePages}:${cleanPageCap}`)
  }

  const workouts = []
  const seenIds = new Set()
  let duplicateWorkoutsRemoved = 0
  let missingIdsDropped = 0
  let missingPages = 0

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index]
    const expectedPage = index + 1
    const responsePage = Number(page?.page)
    if (Number.isFinite(responsePage) && responsePage !== expectedPage) {
      warnings.push(`page_number_mismatch:${expectedPage}:${responsePage}`)
    }
    if (!Array.isArray(page?.workouts)) {
      missingPages += 1
      warnings.push(`missing_workouts_page:${expectedPage}`)
      continue
    }
    for (const workout of page.workouts) {
      const id = rawWorkoutId(workout)
      if (!id) {
        missingIdsDropped += 1
        continue
      }
      if (seenIds.has(id)) {
        duplicateWorkoutsRemoved += 1
        continue
      }
      seenIds.add(id)
      workouts.push(workout)
    }
  }

  if (missingIdsDropped) warnings.push(`missing_ids_dropped:${missingIdsDropped}`)
  if (duplicateWorkoutsRemoved) warnings.push(`duplicates_removed:${duplicateWorkoutsRemoved}`)

  const totalWorkoutCount = Math.max(workouts.length, finite(expectedWorkoutCount))
  const pageCapReached = availablePages > cleanPageCap
  const countGap = totalWorkoutCount > workouts.length
  const complete = !pageCapReached && !missingPages && !missingIdsDropped && !countGap

  return {
    workouts,
    pagination: {
      page_size: PAGE_SIZE,
      reported_pages: reportedPages,
      expected_pages: expectedPages || null,
      requested_pages: wantedPages,
      fetched_pages: pages.filter(Boolean).length,
      max_pages: cleanPageCap,
      page_cap_reached: pageCapReached,
      duplicate_workouts_removed: duplicateWorkoutsRemoved,
      missing_ids_dropped: missingIdsDropped,
      missing_pages: missingPages,
      complete,
      warnings: [...new Set(warnings)],
    },
  }
}

export async function collectRecentHevyWorkouts({
  limit = DEFAULT_WORKOUT_LIMIT,
  listPage = listWorkouts,
  concurrency = MAX_CONCURRENCY,
} = {}) {
  const cleanLimit = safeLimit(limit)
  const { workouts } = await collectHevyWorkoutHistory({
    listPage,
    concurrency,
    maxPages: Math.ceil(cleanLimit / PAGE_SIZE),
  })
  return workouts.slice(0, cleanLimit)
}

function exerciseBest(exercise = {}) {
  let best = 0
  for (const set of exercise.sets || []) {
    const weight = finite(set.weightKg)
    const reps = finite(set.reps)
    const distance = finite(set.distanceMeters)
    const duration = finite(set.durationSec)
    best = Math.max(best, weight * (1 + reps / 30), distance / 100, duration / 10)
  }
  return best
}

function dayOrdinal(value) {
  const date = normalizeDateString(value)
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 86_400_000) : null
}

function gamifyWorkouts(workouts = []) {
  const personalBests = new Map()
  let totalXp = 0
  let currentStreak = 0
  let previousDay = null
  const ordered = [...workouts].sort((left, right) => -newestFirst(left, right))

  for (const workout of ordered) {
    let hasPr = false
    for (const exercise of workout.exercises || []) {
      const key = normalizeText(exercise.name)
      const best = exerciseBest(exercise)
      const previous = personalBests.get(key) || 0
      if (key && previous > 0 && best > previous * 1.01) hasPr = true
      if (key && best > previous) personalBests.set(key, best)
    }

    const workoutDay = dayOrdinal(workout.date)
    if (workoutDay != null) {
      if (previousDay == null) currentStreak = 1
      else if (workoutDay === previousDay) {
        // Ayni gun ikinci antrenman streak gununu tekrar arttirmaz.
      } else if (workoutDay - previousDay === 1) currentStreak += 1
      else currentStreak = 1
      previousDay = workoutDay
    }

    const xpEarned = computeSessionXp({ ...workout, hasPr }, {
      streakDays: Math.max(0, currentStreak - 1),
    }).xpEarned
    totalXp += xpEarned
    workout.hasPr = hasPr
    workout.xpEarned = xpEarned
  }

  return {
    workouts: [...ordered].sort(newestFirst),
    totalXp,
  }
}

function publicExercise(exercise = {}) {
  return {
    name: String(exercise.name || '').slice(0, 120),
    sets: (exercise.sets || []).slice(0, 30).map(set => ({
      reps: set.reps == null ? null : finite(set.reps),
      weightKg: finite(set.weightKg),
      durationSec: set.durationSec == null ? null : finite(set.durationSec),
      distanceMeters: finite(set.distanceMeters),
    })),
  }
}

function publicWorkout(workout = {}) {
  return {
    id: workout.externalId || `${workout.date}-${workout.type}`,
    date: workout.date,
    type: workout.type,
    durationMin: finite(workout.durationMin),
    distanceKm: finite(workout.distanceKm),
    tags: workout.tags || [],
    exercises: (workout.exercises || []).slice(0, 40).map(publicExercise),
    volumeKg: Math.round(finite(workout.volumeKg)),
    sets: Math.round(finite(workout.sets)),
    highlight: String(workout.highlight || '').slice(0, 80),
    hasPr: Boolean(workout.hasPr),
    source: 'hevy',
    createdAt: workout.createdAt || null,
    startedAt: workout.startedAt || null,
    xpEarned: Math.round(finite(workout.xpEarned)),
  }
}

function rankFromStats(stats = {}) {
  const values = Object.values(stats).map(finite).filter(value => value > 0)
  const average = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0
  if (average >= 82) return 'ELIT'
  if (average >= 68) return 'USTA'
  if (average >= 52) return 'SAVAŞÇI'
  if (average >= 34) return 'YÜKSELEN'
  return 'ÇIRAK'
}

function handleFromUser(user = {}) {
  try {
    const slug = new URL(user.url || '').pathname.split('/').filter(Boolean).at(-1)
    if (slug) return `@${slug}`
  } catch {}
  return '@senuzulme27'
}

export function buildHevyProfile(workouts = [], {
  user = null,
  totalWorkoutCount = workouts.length,
  now = new Date(),
} = {}) {
  const today = getLocalDateString(now)
  const stats = computeProfileStatsFromWorkouts(workouts, {}, {
    todayStr: today,
    blendCurrent: false,
  })
  const latestDate = workouts[0]?.date || today
  const streak = checkStreakHealth(computeStreakInfo(workouts, latestDate), today)
  const classState = computeClass(workouts)
  const classTrack = buildClassTrack(workouts, { currentClass: classState })
  const totalXp = workouts.reduce((sum, workout) => sum + finite(workout.xpEarned), 0)
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1

  return {
    id: 'hevy-player',
    nick: String(user?.name || 'Alperen').slice(0, 60),
    handle: handleFromUser(user),
    level,
    rank: rankFromStats(stats),
    class: classState?.name || 'Hybrid Athlete',
    display_title: classTrack.displayTitle,
    class_track: classTrack,
    sub_class: classState?.evolving ? 'Build gelişiyor' : '',
    xp_current: totalXp % XP_PER_LEVEL,
    xp_max: XP_PER_LEVEL,
    lifetime_xp: totalXp,
    stats,
    streak_current: streak.current,
    streak_max: streak.max,
    last_workout_date: streak.lastWorkoutDate,
    sessions: Math.max(workouts.length, finite(totalWorkoutCount)),
    total_volume_kg: Math.round(workouts.reduce((sum, workout) => sum + finite(workout.volumeKg), 0)),
    total_sets: Math.round(workouts.reduce((sum, workout) => sum + finite(workout.sets), 0)),
    total_minutes: Math.round(workouts.reduce((sum, workout) => sum + finite(workout.durationMin), 0)),
    armor_current: 100,
    fatigue_current: 0,
    survival_status: 'healthy',
    last_updated: now.toISOString(),
  }
}

export async function buildDirectHevySnapshot({
  listPage = listWorkouts,
  getCount = countWorkouts,
  getUser = getUserInfo,
  maxHistoryPages = MAX_HISTORY_PAGES,
  now = new Date(),
} = {}) {
  const [firstPage, totalWorkoutCount, user] = await Promise.all([
    listPage(1, PAGE_SIZE),
    getCount().catch(() => 0),
    getUser().catch(() => null),
  ])
  const history = await collectHevyWorkoutHistory({
    listPage,
    firstPage,
    expectedWorkoutCount: totalWorkoutCount,
    maxPages: maxHistoryPages,
  })
  const normalized = history.workouts
    .map(normalizeHevyWorkout)
    .filter(workout => workout.date)
    .sort(newestFirst)
  const gamified = gamifyWorkouts(normalized)
  const fetchedAt = now.toISOString()
  const reportedWorkoutCount = Math.max(gamified.workouts.length, finite(totalWorkoutCount))
  const historyComplete = history.pagination.complete
    && reportedWorkoutCount === gamified.workouts.length

  return {
    ok: true,
    profile: buildHevyProfile(gamified.workouts, {
      user,
      totalWorkoutCount,
      now,
    }),
    workouts: gamified.workouts.map(publicWorkout),
    syncState: {
      mode: 'direct',
      last_synced_at: fetchedAt,
      fetched_workouts: gamified.workouts.length,
      total_workouts: reportedWorkoutCount,
      truncated: !historyComplete,
      history_complete: historyComplete,
      pagination: history.pagination,
    },
    source: {
      hevy: 'live-direct',
      storage: 'none',
    },
    privacy: 'public-summary',
  }
}

export const dashboardSnapshotInternals = {
  gamifyWorkouts,
  publicWorkout,
  rankFromStats,
  safeLimit,
  safePageCap,
}
