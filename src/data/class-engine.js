/**
 * Class Evolution Engine
 * ----------------------
 * Son 10 antrenmanın dağılımına bakar, en uygun sınıfı döner.
 * 10 antrenmandan azsa "Çırak" kalır.
 */

import { CLASSES, DEFAULT_CLASS } from './classes-config.js'

const MIN_WORKOUTS = 5

export function computeClass(workouts) {
  if (!Array.isArray(workouts) || workouts.length < MIN_WORKOUTS) {
    return { ...DEFAULT_CLASS, evolving: true, progress: (workouts?.length || 0) / MIN_WORKOUTS }
  }

  const recent = workouts.slice(0, MIN_WORKOUTS)

  for (const cls of CLASSES) {
    try {
      if (cls.trigger(recent)) {
        return { ...cls, evolving: false, progress: 1 }
      }
    } catch (e) {
      console.warn('[class-engine] trigger error:', cls.id, e)
    }
  }

  return { ...DEFAULT_CLASS, evolving: false, progress: 1 }
}

/**
 * Sınıf buff'ını statlara uygula — display değeri döner (state değişmez).
 */
export function applyClassStatBuff(baseStats, classObj) {
  const mult = classObj?.passive?.statMult || {}
  const out = {}
  for (const [k, v] of Object.entries(baseStats)) {
    out[k] = Math.round(v * (mult[k] || 1))
  }
  return out
}

/**
 * XP multiplier — sınıfın o antrenman türüne verdiği bonus.
 */
export function classXpMult(classObj, workoutType) {
  return classObj?.passive?.xpMult?.[workoutType] || 1.0
}

/**
 * Armor regen için çarpan.
 */
export function classArmorRegen(classObj) {
  return classObj?.passive?.armorRegen || 1.0
}

/**
 * Fatigue decay — 1.0 normal, 0.7 = %30 daha yavaş birikir.
 */
export function classFatigueDecay(classObj) {
  return classObj?.passive?.fatigueDecay || 1.0
}
