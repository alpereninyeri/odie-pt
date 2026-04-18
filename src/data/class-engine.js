import { CLASSES, DEFAULT_CLASS, normalizeClassWorkouts } from './classes-config.js'
import { buildSemanticProfile } from './semantic-profile.js'

const LOOKBACK_WORKOUTS = 10

function classScore(id, profile) {
  const shares = profile.shares || {}
  const chains = profile.chains || {}
  const feats = profile.feats || {}

  switch (id) {
    case 'golge_akrobat':
      return (shares.strength * 2.4) + (shares.movement * 2.8) + (profile.hybridScore * 0.35) + (chains.aerialControl * 0.12)
    case 'gok_kartali':
      return (shares.movement * 3.2) + (shares.acrobatics * 2.4) + (chains.aerialControl * 0.18) + (feats.frontFlipSeen ? 1.4 : 0) + (feats.baraniSeen ? 0.8 : 0)
    case 'duvar_orucu':
      return (shares.acrobatics * 3.4) + (chains.landingControl * 0.25) + (feats.roundOffSeen ? 1.1 : 0) + (feats.baraniSeen ? 1.3 : 0)
    case 'vinc_gezgini':
      return (shares.parkour * 3.3) + (shares.outdoor * 1.5) + (chains.lowerPower * 0.14) + (chains.landingControl * 0.18)
    case 'ayi_pencesi':
      return (shares.strength * 3.5) + (chains.upperStrength * 0.16) + (feats.benchMaxKg / 40) + (feats.muscleUpMaxReps * 0.12)
    case 'celik_omurga':
      return (shares.legs * 2.2) + (shares.endurance * 2.1) + (chains.lowerPower * 0.15) + (profile.counts.carry * 0.4)
    case 'cekirdek_alevi':
      return (shares.core * 3.6) + (chains.trunkControl * 0.22) + (feats.hollowMaxSec / 45) + (feats.lSitMaxSec / 20)
    case 'ruzgar_kosucusu':
      return (shares.endurance * 3.4) + (profile.counts.locomotion * 0.16) + (shares.outdoor * 1.4) + (profile.counts.terrain * 0.35)
    case 'mermer_heykel':
      return (shares.recovery * 3.1) + (shares.mobility * 2.5) + (chains.mobilityBase * 0.18) + (profile.recoveryDiscipline * 2)
    case 'golge_gezgini':
      return (profile.nightSessions * 0.45) + (shares.movement * 0.9) + (profile.hybridScore * 0.15)
    case 'merakli_ruh':
      return (profile.hybridScore * 0.55) + (profile.variety * 0.08) + (shares.outdoor * 0.8) + (shares.strength * 0.4) + (shares.movement * 0.4) + (shares.endurance * 0.4)
    default:
      return 0
  }
}

function classSignals(id, profile) {
  const feats = profile.feats || {}
  const chains = profile.chains || {}
  const signalMap = {
    golge_akrobat: [
      `Hybrid skor ${profile.hybridScore}`,
      `Strength ${Math.round((profile.shares?.strength || 0) * 100)}%`,
      `Movement ${Math.round((profile.shares?.movement || 0) * 100)}%`,
    ],
    gok_kartali: [
      `Acrobatics ${Math.round((profile.shares?.acrobatics || 0) * 100)}%`,
      feats.frontFlipSeen ? 'Front flip sinyali aktif' : 'Aerial zincir kuruluyor',
      `Aerial control ${chains.aerialControl}`,
    ],
    duvar_orucu: [
      feats.baraniSeen ? 'Barani izi var' : 'Twist hattina yaklasiyor',
      feats.roundOffSeen ? 'Round off aktif' : 'Round off eksik',
      `Landing control ${chains.landingControl}`,
    ],
    vinc_gezgini: [
      `Parkour ${Math.round((profile.shares?.parkour || 0) * 100)}%`,
      `Outdoor ${Math.round((profile.shares?.outdoor || 0) * 100)}%`,
      `Lower power ${chains.lowerPower}`,
    ],
    ayi_pencesi: [
      `Bench ${feats.benchMaxKg || 0}kg`,
      `Upper chain ${chains.upperStrength}`,
      `Strength ${Math.round((profile.shares?.strength || 0) * 100)}%`,
    ],
    celik_omurga: [
      `Legs ${Math.round((profile.shares?.legs || 0) * 100)}%`,
      `Endurance ${Math.round((profile.shares?.endurance || 0) * 100)}%`,
      `Carry ${profile.counts?.carry || 0}`,
    ],
    cekirdek_alevi: [
      `Core ${Math.round((profile.shares?.core || 0) * 100)}%`,
      `Hollow ${feats.hollowMaxSec || 0}sn`,
      `L-Sit ${feats.lSitMaxSec || 0}sn`,
    ],
    ruzgar_kosucusu: [
      `Locomotion ${profile.counts?.locomotion || 0}`,
      `Outdoor ${Math.round((profile.shares?.outdoor || 0) * 100)}%`,
      `Terrain ${profile.counts?.terrain || 0}`,
    ],
    mermer_heykel: [
      `Mobility ${Math.round((profile.shares?.mobility || 0) * 100)}%`,
      `Recovery ${Math.round((profile.shares?.recovery || 0) * 100)}%`,
      `Recovery discipline ${Math.round((profile.recoveryDiscipline || 0) * 100)}%`,
    ],
    golge_gezgini: [
      `Night sessions ${profile.nightSessions || 0}`,
      `Movement ${Math.round((profile.shares?.movement || 0) * 100)}%`,
      `Variety ${profile.variety || 0}`,
    ],
    merakli_ruh: [
      `Variety ${profile.variety || 0}`,
      `Hybrid skor ${profile.hybridScore}`,
      `Outdoor ${Math.round((profile.shares?.outdoor || 0) * 100)}%`,
    ],
  }
  return (signalMap[id] || []).filter(Boolean)
}

function classReason(id, profile) {
  const reasons = {
    golge_akrobat: 'Kuvvet, movement ve cesitlilik ayni blokta birlikte calisiyor.',
    gok_kartali: 'Aerial ve akrobasi hatti build kimligini baskin sekilde tasiyor.',
    duvar_orucu: 'Twist, landing ve koordinasyon odagi buildi daha ince motor bir profile cekiyor.',
    vinc_gezgini: 'Parkour, rota okuma ve alt vucut akisi on plana cikiyor.',
    ayi_pencesi: 'Ust vucut kuvveti ve pressing-pulling bloklari ana eksen haline gelmis.',
    celik_omurga: 'Alt vucut ve dayanıklilik birlikte isleniyor; tasiyici bir build cikiyor.',
    cekirdek_alevi: 'Trunk control ve core zinciri buildin merkezine yerlesmeye baslamis.',
    ruzgar_kosucusu: 'Lokomotion, outdoor hacim ve hareket surekliligi buildin motoru.',
    mermer_heykel: 'Mobilite ve toparlanma disiplini buildi sakin ama kaliteli bir profile cekiyor.',
    golge_gezgini: 'Gece seanslari ve dusuk gürültülü süreklilik profile gizli bir ritim veriyor.',
    merakli_ruh: 'Tek bir bransa kitlenmek yerine birden cok disiplin birlikte tasiniyor.',
  }
  return reasons[id] || ''
}

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
  const profile = buildSemanticProfile(recent)
  const ranked = CLASSES.map(cls => ({
    ...cls,
    matchScore: classScore(cls.id, profile),
    signals: classSignals(cls.id, profile),
    reason: classReason(cls.id, profile),
  })).sort((left, right) => right.matchScore - left.matchScore)

  const winner = ranked[0]
  if (winner?.matchScore > 1.2) {
    return {
      ...winner,
      evolving: false,
      progress: 1,
      lookback: LOOKBACK_WORKOUTS,
      runnerUp: ranked[1] ? { id: ranked[1].id, name: ranked[1].name, score: ranked[1].matchScore } : null,
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
