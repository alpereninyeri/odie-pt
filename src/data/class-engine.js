import { CLASSES, DEFAULT_CLASS, normalizeClassWorkouts } from './classes-config.js'

const LOOKBACK_WORKOUTS = 10

export function computeClass(workouts) {
  const normalized = normalizeClassWorkouts(workouts || [])
  if (normalized.length < LOOKBACK_WORKOUTS) {
    return {
      ...DEFAULT_CLASS,
      evolving: true,
      progress: Math.min(1, normalized.length / LOOKBACK_WORKOUTS),
      lookback: LOOKBACK_WORKOUTS,
    }
  }

  const recent = normalized.slice(0, LOOKBACK_WORKOUTS)
  for (const cls of CLASSES) {
    try {
      if (cls.trigger(recent)) {
        return { ...cls, evolving: false, progress: 1, lookback: LOOKBACK_WORKOUTS }
      }
    } catch (error) {
      console.warn('[class-engine] trigger error:', cls.id, error)
    }
  }

  return { ...DEFAULT_CLASS, evolving: false, progress: 1, lookback: LOOKBACK_WORKOUTS }
}

export function applyClassStatBuff(baseStats, classObj) {
  const multiplier = classObj?.passive?.statMult || {}
  const out = {}
  for (const [key, value] of Object.entries(baseStats)) {
    out[key] = Math.round((Number(value) || 0) * (multiplier[key] || 1))
  }
  return out
}

export function classXpMult(classObj, workoutType) {
  return classObj?.passive?.xpMult?.[workoutType] || 1.0
}

export function classArmorRegen(classObj) {
  return classObj?.passive?.armorRegen || 1.0
}

export function classFatigueDecay(classObj) {
  return classObj?.passive?.fatigueDecay || 1.0
}
