/**
 * Survival Engine — PR Fatigue + Armor + Injury
 * ------------------------------------------------
 * Gerçek bir yaralanma mekaniği. Sadece XP cezası değil; katman katman durumlar.
 *
 * Ana kavramlar:
 *   - fatigue   : 0-100 CNS yük seviyesi. Ağır antrenman biriktirir, dinlenme eritir.
 *   - armor     : 0-100 eklem/tendon sağlığı. Aşırı yük ile azalır, stretching ile geri gelir.
 *   - status    : 'healthy' | 'cns_overloaded' | 'tendon_alarm' | 'critical_wear' | 'injured'
 *   - injuryUntil: ISO date — o tarihe kadar XP alamaz, heavy antrenman yapamaz.
 *
 * Durum hiyerarşisi (en ağırdan hafife):
 *   injured (armor=0)              → XP = 0, uyarı: "YARALI — 3-7 gün recovery"
 *   critical_wear (armor < 20)     → XP x0.5, coach: kırmızı alarm
 *   tendon_alarm (armor < 50)      → XP x0.8, coach: sarı uyarı
 *   cns_overloaded (fatigue >= 75) → heavy XP x0.7, stretching XP x1.5
 *   healthy                        → normal
 */

const HEAVY_TYPES = ['Push', 'Pull', 'Bacak', 'Parkour', 'Akrobasi']
const RECOVERY_TYPES = ['Stretching', 'Yürüyüş', 'Yuruyus']

const FATIGUE_PER_HEAVY = 25
const FATIGUE_PR_BONUS = 15          // PR kırıldığında extra CNS yükü
const FATIGUE_DECAY_REST = 15         // rest gününde fatigue düşüşü
const FATIGUE_DECAY_RECOVERY = 20     // stretching/yürüyüş fatigue düşüşü

const ARMOR_MAX = 100
const ARMOR_DMG_OVERLOADED = 10       // CNS overloaded iken heavy yaparsan armor -10
const ARMOR_DMG_DAILY_HEAVY = 4       // her heavy antrenman baseline wear
const ARMOR_REGEN_STRETCH = 12
const ARMOR_REGEN_WALK = 6
const ARMOR_REGEN_REST = 3            // rest gününde otomatik onarım

const INJURY_DAYS_RANGE = { min: 3, max: 7 }

/**
 * Tek antrenman sonrası yeni armor/fatigue hesaplar.
 * @param {object} prev - { armor, fatigue, injuryUntil, consecutiveHeavy, lastPrDate }
 * @param {object} session - yeni antrenman { type, date, hasPr }
 * @param {object} classBuff - { armorRegen, fatigueDecay } (class-engine'den)
 */
export function applySurvival(prev, session, classBuff = {}) {
  const armorRegenMult = classBuff.armorRegen || 1.0
  const fatigueDecayMult = classBuff.fatigueDecay || 1.0

  let fatigue = prev.fatigue ?? 0
  let armor = prev.armor ?? ARMOR_MAX
  let consecutiveHeavy = prev.consecutiveHeavy ?? 0
  let injuryUntil = prev.injuryUntil || null

  const isHeavy = HEAVY_TYPES.includes(session.type)
  const isRecovery = RECOVERY_TYPES.includes(session.type)

  // Injured — antrenman blokladı, state'i geri dön
  if (injuryUntil && new Date(session.date) < new Date(injuryUntil)) {
    return {
      armor, fatigue,
      consecutiveHeavy,
      injuryUntil,
      status: 'injured',
      xpMultiplier: 0,
      warnings: [`⛔ YARALI — ${injuryUntil} tarihine kadar antrenman yasak. Sadece Stretching/Yürüyüş kabul.`],
      armorDelta: 0,
      fatigueDelta: 0,
    }
  }

  let armorDelta = 0
  let fatigueDelta = 0
  const warnings = []

  if (isHeavy) {
    consecutiveHeavy += 1

    // CNS birikimi
    let fatigueAdd = FATIGUE_PER_HEAVY * fatigueDecayMult
    if (session.hasPr) fatigueAdd += FATIGUE_PR_BONUS
    fatigueDelta = fatigueAdd

    // 3+ ardışık heavy → CNS overload zorla
    if (consecutiveHeavy >= 3) {
      fatigueDelta += 10
      warnings.push('⚠️ 3 gün üst üste ağır — CNS yorgun, dinlenme öner.')
    }

    // Armor wear
    armorDelta = -ARMOR_DMG_DAILY_HEAVY
    if (fatigue >= 75) {
      armorDelta -= ARMOR_DMG_OVERLOADED
      warnings.push('🛑 CNS aşırı yüklüyken ağır antrenman yaptın — tendon aşınması!')
    }
  } else if (isRecovery) {
    consecutiveHeavy = 0
    fatigueDelta = -FATIGUE_DECAY_RECOVERY
    const regenBase = session.type === 'Stretching' ? ARMOR_REGEN_STRETCH : ARMOR_REGEN_WALK
    armorDelta = regenBase * armorRegenMult
  } else {
    consecutiveHeavy = 0
    fatigueDelta = -FATIGUE_DECAY_REST
    armorDelta = ARMOR_REGEN_REST * armorRegenMult
  }

  fatigue = Math.max(0, Math.min(100, fatigue + fatigueDelta))
  armor = Math.max(0, Math.min(ARMOR_MAX, armor + armorDelta))

  // Status hesapla
  let status = 'healthy'
  let xpMultiplier = 1.0

  if (armor <= 0) {
    status = 'injured'
    xpMultiplier = 0
    // Rastgele 3-7 gün yaralı
    const days = INJURY_DAYS_RANGE.min + Math.floor(Math.random() * (INJURY_DAYS_RANGE.max - INJURY_DAYS_RANGE.min + 1))
    const until = new Date(session.date)
    until.setDate(until.getDate() + days)
    injuryUntil = until.toISOString().slice(0, 10)
    warnings.push(`🚨 YARALANDIN — ${days} gün recovery zorunlu (${injuryUntil} tarihine kadar).`)
  } else if (armor < 20) {
    status = 'critical_wear'
    xpMultiplier = 0.5
    warnings.push('🔴 Critical Wear — armor %20 altı. XP yarıya indi, stretching öner.')
  } else if (armor < 50) {
    status = 'tendon_alarm'
    xpMultiplier = 0.8
    warnings.push('🟡 Tendon Alarm — armor %50 altı. XP -%20.')
  } else if (fatigue >= 75) {
    status = 'cns_overloaded'
    // Heavy'de -%30, recovery'de +%50
    xpMultiplier = isHeavy ? 0.7 : 1.5
    if (isHeavy) warnings.push('🧠 CNS Overloaded — heavy XP -%30.')
    else warnings.push('🧠 CNS Overloaded + Recovery — stretching XP +%50!')
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

/**
 * Status için renk kodu — UI bar'ları boyamak için.
 */
export function statusColor(status) {
  return {
    healthy:        '#22c55e',
    cns_overloaded: '#eab308',
    tendon_alarm:   '#f97316',
    critical_wear:  '#ef4444',
    injured:        '#7f1d1d',
  }[status] || '#64748b'
}

export function statusLabel(status) {
  return {
    healthy:        '🟢 Hazır',
    cns_overloaded: '🧠 CNS Aşırı Yüklü',
    tendon_alarm:   '🟡 Tendon Alarmı',
    critical_wear:  '🔴 Kritik Aşınma',
    injured:        '⛔ Yaralı',
  }[status] || 'Bilinmiyor'
}
