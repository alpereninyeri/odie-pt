/**
 * Skill Engine
 * Skill unlock ve progress durumlarini ortak semantic profile uzerinden hesaplar.
 * Boylece tek tek egzersiz isimlerine baglilik azalir; workout tipi, tags, highlight ve coach notlari da islenir.
 */

import { normalizeSession } from './rules.js'
import { buildSemanticProfile } from './semantic-profile.js'

function evaluateSkill(name, profile) {
  const feats = profile.feats || {}
  const chains = profile.chains || {}
  const counts = profile.counts || {}

  switch (name) {
    case 'Dead Hang Elite':
      if (feats.hangMaxSec >= 75) return 'done'
      if (feats.hangMaxSec >= 45 || chains.gripControl >= 2) return 'prog'
      return 'lock'
    case 'Muscle-Up':
      if (feats.muscleUpMaxReps >= 1) return 'done'
      if (chains.upperStrength >= 4 && counts.calisthenics >= 2) return 'prog'
      return 'lock'
    case 'Bench Press 65kg':
      if (feats.benchMaxKg >= 65) return 'done'
      if (feats.benchMaxKg >= 55 || chains.upperStrength >= 4) return 'prog'
      return 'lock'
    case 'Muscle-Up ×5 Clean':
    case 'Muscle-Up Ã—5 Clean':
      if (feats.muscleUpMaxReps >= 5) return 'done'
      if (feats.muscleUpMaxReps >= 3) return 'prog'
      return 'lock'
    case 'One-Arm Hang':
      if (feats.hangMaxSec >= 105 && chains.gripControl >= 4) return 'done'
      if (feats.hangMaxSec >= 75) return 'prog'
      return 'lock'
    case 'Front Flip':
      if (feats.frontFlipSeen) return 'done'
      if (chains.aerialControl >= 2) return 'prog'
      return 'lock'
    case 'Dive Roll':
      if (feats.diveRollSeen) return 'done'
      if (chains.landingControl >= 1) return 'prog'
      return 'lock'
    case 'Round Off':
      if (feats.roundOffSeen) return 'done'
      if (chains.aerialControl >= 2) return 'prog'
      return 'lock'
    case 'Barani':
      if (feats.baraniSeen) return 'done'
      if (feats.frontFlipSeen && chains.aerialControl >= 3) return 'prog'
      return 'lock'
    case 'Back Flip':
      if (feats.backFlipSeen) return 'done'
      if ((feats.baraniSeen || feats.frontFlipSeen) && chains.trunkControl >= 3) return 'prog'
      return 'lock'
    case 'Full Twist':
      if (feats.fullTwistSeen) return 'done'
      if (feats.baraniSeen && chains.aerialControl >= 4) return 'prog'
      return 'lock'
    case 'Hip Flexor Base':
      if (feats.hipFlexorSessions >= 1 || counts.mobility >= 2 || counts.acrobatics >= 2) return 'done'
      if (counts.mobility >= 1) return 'prog'
      return 'lock'
    case 'Shoulder Flexibility':
      if (feats.shoulderMobilitySessions >= 4) return 'done'
      if (feats.shoulderMobilitySessions >= 1 || counts.mobility >= 2) return 'prog'
      return 'lock'
    case 'Active Splits':
      if (feats.splitSessions >= 4) return 'done'
      if (feats.splitSessions >= 1 || counts.mobility >= 3) return 'prog'
      return 'lock'
    case 'Bridge':
      if (feats.bridgeSessions >= 2) return 'done'
      if (feats.bridgeSessions >= 1 || (counts.mobility >= 2 && chains.trunkControl >= 2)) return 'prog'
      return 'lock'
    case 'Hollow Body 30sn':
      if (feats.hollowMaxSec >= 30) return 'done'
      if (feats.hollowMaxSec >= 15 || counts.core >= 1) return 'prog'
      return 'lock'
    case 'L-Sit 10sn':
      if (feats.lSitMaxSec >= 10) return 'done'
      if (feats.lSitMaxSec >= 5 || chains.trunkControl >= 2) return 'prog'
      return 'lock'
    case 'Plank Variations':
      if (feats.plankMaxSec >= 45) return 'done'
      if (feats.plankMaxSec >= 20 || counts.core >= 2) return 'prog'
      return 'lock'
    case 'Dragon Flag':
      if (feats.dragonFlagSeen) return 'done'
      if (chains.trunkControl >= 4 && feats.hollowMaxSec >= 20) return 'prog'
      return 'lock'
    case 'Front Lever Tuck':
      if (feats.frontLeverSeen) return 'done'
      if (chains.gripControl >= 3 && chains.trunkControl >= 3) return 'prog'
      return 'lock'
    default:
      return null
  }
}

function statusMeta(status, item) {
  if (status === 'done') {
    return {
      ...item,
      status: 'done',
      val: 'UNLOCKED',
      valColor: 'var(--grn)',
      req: undefined,
    }
  }
  if (status === 'prog') {
    return {
      ...item,
      status: 'prog',
      val: 'IN PROG',
    }
  }
  return item
}

export function updateSkills(skillsSeed, workouts, coachSkillProgress = []) {
  if (!Array.isArray(skillsSeed)) return skillsSeed
  const normalizedWorkouts = (workouts || []).map(workout => normalizeSession(workout))
  const profile = buildSemanticProfile(normalizedWorkouts)

  const coachMap = {}
  for (const cp of (coachSkillProgress || [])) {
    if (cp?.name) coachMap[String(cp.name).toLowerCase()] = cp.note || ''
  }

  return skillsSeed.map(branch => ({
    ...branch,
    items: branch.items.map(item => {
      let desc = item.desc
      const coachNote = coachMap[String(item.name).toLowerCase()]
      if (coachNote) desc = `${item.desc} · ${coachNote}`

      const semanticStatus = evaluateSkill(item.name, profile)
      if (semanticStatus) return { ...statusMeta(semanticStatus, { ...item, desc }) }

      return { ...item, desc }
    }),
  }))
}
