import { checkStreakHealth, computeStreakInfo, getLocalDateString } from './rules.js'

export function computeStreak(workouts, newDate) {
  return computeStreakInfo(workouts, newDate)
}

export function checkStreakIntact(streak, today = getLocalDateString()) {
  return checkStreakHealth(streak, today)
}
