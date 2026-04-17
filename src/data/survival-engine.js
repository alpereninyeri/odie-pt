import { normalizeSession } from './rules.js'

const FATIGUE_PER_HEAVY = 25
const FATIGUE_PR_BONUS = 15
const FATIGUE_DECAY_REST = 15
const FATIGUE_DECAY_RECOVERY = 20

const ARMOR_MAX = 100
const ARMOR_DMG_OVERLOADED = 10
const ARMOR_DMG_DAILY_HEAVY = 4
const ARMOR_REGEN_STRETCH = 12
const ARMOR_REGEN_WALK = 6
const ARMOR_REGEN_REST = 3

const INJURY_DAYS_RANGE = { min: 3, max: 7 }

export function applySurvival(prev, session, classBuff = {}) {
  const normalized = normalizeSession(session)
  const armorRegenMult = classBuff.armorRegen || 1
  const fatigueDecayMult = classBuff.fatigueDecay || 1

  let fatigue = prev.fatigue ?? 0
  let armor = prev.armor ?? ARMOR_MAX
  let consecutiveHeavy = prev.consecutiveHeavy ?? 0
  let injuryUntil = prev.injuryUntil || null

  const isRecovery = normalized.primaryCategory === 'recovery'
  const isHeavy = normalized.primaryCategory === 'strength'
    || normalized.primaryCategory === 'movement'
    || (normalized.primaryCategory === 'endurance' && normalized.intensity === 'high')

  if (injuryUntil && new Date(normalized.date) < new Date(injuryUntil)) {
    return {
      armor,
      fatigue,
      consecutiveHeavy,
      injuryUntil,
      status: 'injured',
      xpMultiplier: 0,
      warnings: [`YARALI - ${injuryUntil} tarihine kadar sadece recovery seanslari kabul.`],
      armorDelta: 0,
      fatigueDelta: 0,
    }
  }

  let armorDelta = 0
  let fatigueDelta = 0
  const warnings = []

  if (isHeavy) {
    consecutiveHeavy += 1
    let fatigueAdd = FATIGUE_PER_HEAVY * fatigueDecayMult
    if (normalized.primaryCategory === 'endurance') fatigueAdd *= 0.7
    if (normalized.hasPr) fatigueAdd += FATIGUE_PR_BONUS
    fatigueDelta = Math.round(fatigueAdd)

    if (consecutiveHeavy >= 3) {
      fatigueDelta += 10
      warnings.push('3 gun ust uste agir yuk - CNS yorgunlugu artiyor.')
    }

    armorDelta = -ARMOR_DMG_DAILY_HEAVY
    if (fatigue >= 75) {
      armorDelta -= ARMOR_DMG_OVERLOADED
      warnings.push('Yuksek fatigue ustune agir seans tendon stresini buyuttu.')
    }
  } else if (isRecovery) {
    consecutiveHeavy = 0
    fatigueDelta = -FATIGUE_DECAY_RECOVERY
    const regenBase = normalized.type === 'Stretching' ? ARMOR_REGEN_STRETCH : ARMOR_REGEN_WALK
    armorDelta = Math.round(regenBase * armorRegenMult)
  } else {
    consecutiveHeavy = 0
    fatigueDelta = -FATIGUE_DECAY_REST
    armorDelta = Math.round(ARMOR_REGEN_REST * armorRegenMult)
  }

  fatigue = Math.max(0, Math.min(100, fatigue + fatigueDelta))
  armor = Math.max(0, Math.min(ARMOR_MAX, armor + armorDelta))

  let status = 'healthy'
  let xpMultiplier = 1

  if (armor <= 0) {
    status = 'injured'
    xpMultiplier = 0
    const days = INJURY_DAYS_RANGE.min + Math.floor(Math.random() * (INJURY_DAYS_RANGE.max - INJURY_DAYS_RANGE.min + 1))
    const until = new Date(normalized.date)
    until.setDate(until.getDate() + days)
    injuryUntil = until.toISOString().slice(0, 10)
    warnings.push(`YARALANMA riski gerceklesti - ${injuryUntil} tarihine kadar deload zorunlu.`)
  } else if (armor < 20) {
    status = 'critical_wear'
    xpMultiplier = 0.5
    warnings.push('Critical wear - armor %20 altina dustu.')
  } else if (armor < 50) {
    status = 'tendon_alarm'
    xpMultiplier = 0.8
    warnings.push('Tendon alarmi - armor %50 altinda.')
  } else if (fatigue >= 75) {
    status = 'cns_overloaded'
    xpMultiplier = isHeavy ? 0.7 : 1.5
    warnings.push(isHeavy ? 'CNS overloaded - agir seans verimi dusuyor.' : 'Recovery seansi overloaded durumu toparliyor.')
  }

  return {
    armor: Math.round(armor),
    fatigue: Math.round(fatigue),
    consecutiveHeavy,
    injuryUntil,
    status,
    xpMultiplier,
    warnings,
    armorDelta: Math.round(armorDelta),
    fatigueDelta: Math.round(fatigueDelta),
  }
}

export function statusColor(status) {
  return {
    healthy: '#22c55e',
    cns_overloaded: '#eab308',
    tendon_alarm: '#f97316',
    critical_wear: '#ef4444',
    injured: '#7f1d1d',
  }[status] || '#64748b'
}

export function statusLabel(status) {
  return {
    healthy: 'Hazir',
    cns_overloaded: 'CNS Yuklu',
    tendon_alarm: 'Tendon Alarmi',
    critical_wear: 'Kritik Asinma',
    injured: 'Yarali',
  }[status] || 'Bilinmiyor'
}
