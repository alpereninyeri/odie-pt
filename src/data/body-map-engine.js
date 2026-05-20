import {
  getLocalDateString,
  hasDirectCoreStimulus,
  hasLegFocus,
  normalizeDateString,
  normalizeSession,
  normalizeText,
} from './rules.js'
import { buildSemanticProfile } from './semantic-profile.js'

const DAY_MS = 86400000

const REGION_CONFIG = [
  {
    id: 'chest',
    label: 'Gogus',
    group: 'muscle',
    muscleLabels: ['Gogus', 'Gogus', 'GÃ¶ÄŸÃ¼s', 'Göğüs'],
    tags: ['push'],
    patterns: ['bench', 'press', 'fly', 'dip', 'push up', 'push-up', 'pec', 'chest'],
    saturation: 34,
  },
  {
    id: 'shoulder',
    label: 'Omuz',
    group: 'joint',
    muscleLabels: ['Omuz', 'Omuz Kompleksi'],
    tags: ['push', 'shoulders', 'mobility'],
    patterns: ['shoulder', 'omuz', 'ohp', 'lateral raise', 'handstand', 'wall slide', 'dislocate'],
    saturation: 32,
  },
  {
    id: 'triceps',
    label: 'Triceps',
    group: 'muscle',
    muscleLabels: ['Triceps'],
    tags: ['push'],
    patterns: ['tricep', 'triceps', 'pushdown', 'extension', 'dip', 'press'],
    saturation: 30,
  },
  {
    id: 'biceps',
    label: 'Biceps',
    group: 'muscle',
    muscleLabels: ['Biseps', 'Biceps'],
    tags: ['pull'],
    patterns: ['bicep', 'biceps', 'biseps', 'curl', 'chin up', 'chin-up'],
    saturation: 28,
  },
  {
    id: 'forearm',
    label: 'Grip',
    group: 'joint',
    muscleLabels: ['On Kol', 'Forearm'],
    tags: ['grip', 'climbing'],
    patterns: ['dead hang', 'hang', 'grip', 'farmer', 'carry', 'fingerboard', 'towel'],
    saturation: 22,
  },
  {
    id: 'lat',
    label: 'Kanat',
    group: 'muscle',
    muscleLabels: ['Lat', 'Kanat'],
    tags: ['pull'],
    patterns: ['lat', 'pull up', 'pull-up', 'pulldown', 'muscle up', 'muscle-up'],
    saturation: 30,
  },
  {
    id: 'upper-back',
    label: 'Ust Sirt',
    group: 'muscle',
    muscleLabels: ['Ust Sirt', 'Ãœst SÄ±rt', 'Üst Sırt'],
    tags: ['pull'],
    patterns: ['row', 'face pull', 'rear delt', 'upper back', 'scapula', 'kurek'],
    saturation: 32,
  },
  {
    id: 'core',
    label: 'Core',
    group: 'muscle',
    muscleLabels: ['Core', 'Core (GÃ¶vde)', 'Core (Gövde)'],
    tags: ['core'],
    patterns: ['hollow', 'plank', 'l-sit', 'lsit', 'dragon', 'leg raise', 'ab wheel', 'core', 'pallof'],
    saturation: 20,
  },
  {
    id: 'hips',
    label: 'Kalca',
    group: 'joint',
    muscleLabels: ['Kalca', 'Glute'],
    tags: ['legs', 'mobility', 'parkour'],
    patterns: ['hip', 'kalca', 'glute', 'split squat', 'lunge', 'hip flexor', 'bridge'],
    saturation: 24,
  },
  {
    id: 'quads',
    label: 'On Bacak',
    group: 'muscle',
    muscleLabels: ['Bacak (Parkour)', 'Quad', 'Quads'],
    tags: ['legs', 'parkour'],
    patterns: ['squat', 'leg press', 'quad', 'jump', 'precision', 'landing', 'drop'],
    saturation: 30,
  },
  {
    id: 'hamstrings',
    label: 'Arka Zincir',
    group: 'muscle',
    muscleLabels: ['Hamstring', 'Arka Bacak'],
    tags: ['legs', 'posterior'],
    patterns: ['hamstring', 'deadlift', 'hinge', 'bridge', 'posterior', 'back chain'],
    saturation: 24,
  },
  {
    id: 'calves',
    label: 'Kalf',
    group: 'muscle',
    muscleLabels: ['Kalf', 'Calf'],
    tags: ['legs', 'walking', 'parkour'],
    patterns: ['calf', 'kalf', 'baldir', 'jump', 'sprint', 'walk', 'run', 'precision'],
    saturation: 22,
  },
  {
    id: 'knees',
    label: 'Diz',
    group: 'joint',
    muscleLabels: ['Diz'],
    tags: ['legs', 'parkour'],
    patterns: ['knee', 'diz', 'landing', 'jump', 'drop', 'squat', 'lunge'],
    saturation: 20,
  },
  {
    id: 'ankles',
    label: 'Ayak Bilegi',
    group: 'joint',
    muscleLabels: ['Ayak Bilegi', 'Ankle'],
    tags: ['legs', 'parkour', 'balance'],
    patterns: ['ankle', 'ayak bilegi', 'landing', 'precision', 'jump', 'vault', 'terrain', 'calf'],
    saturation: 20,
  },
  {
    id: 'lower-back',
    label: 'Bel',
    group: 'joint',
    muscleLabels: ['Bel', 'Lower Back'],
    tags: ['core', 'carry', 'posterior'],
    patterns: ['lower back', 'bel', 'lumbar', 'deadlift', 'hinge', 'carry', 'bridge'],
    saturation: 20,
  },
]

const MOVEMENT_CONFIG = [
  {
    id: 'landing',
    label: 'Inis',
    linkedRegions: ['hips', 'knees', 'ankles', 'core'],
    score: ({ counts, chains, feats }) => (chains.landingControl * 20) + (counts.parkour * 10) + (feats.jumpSessions * 12),
    target: 90,
    todayStep: '3 dusuk yuk inis drill',
  },
  {
    id: 'flow',
    label: 'Akis',
    linkedRegions: ['hips', 'ankles', 'core', 'upper-back'],
    score: ({ counts, feats, variety }) => (counts.parkour * 14) + (counts.terrain * 12) + (feats.terrainSessions * 12) + Math.min(24, variety * 2),
    target: 92,
    todayStep: '10 dk dusuk riskli flow hatti',
  },
  {
    id: 'balance',
    label: 'Denge',
    linkedRegions: ['ankles', 'knees', 'hips', 'core'],
    score: ({ counts, chains }) => (counts.balance * 22) + (chains.landingControl * 14) + (counts.acrobatics * 8),
    target: 78,
    todayStep: '5 kontrollu denge gecisi',
  },
  {
    id: 'explosive',
    label: 'Patlayicilik',
    linkedRegions: ['quads', 'calves', 'hips', 'lat'],
    score: ({ counts, feats }) => (counts.explosive * 18) + (feats.jumpSessions * 12) + (feats.sprintSessions * 12) + (feats.muscleUpMaxReps * 8),
    target: 88,
    todayStep: '3 patlayici ama temiz tekrar',
  },
  {
    id: 'grip',
    label: 'Grip',
    linkedRegions: ['forearm', 'lat', 'upper-back'],
    score: ({ counts, chains, feats }) => (chains.gripControl * 20) + (counts.climbing * 12) + Math.min(28, feats.hangMaxSec / 3),
    target: 82,
    todayStep: '2-3 temiz dead hang',
  },
  {
    id: 'mobility',
    label: 'Mobilite',
    linkedRegions: ['shoulder', 'hips', 'lower-back', 'ankles'],
    score: ({ counts, chains, feats, recoveryDiscipline }) => (chains.mobilityBase * 14) + (counts.recovery * 8) + (feats.shoulderMobilitySessions * 8) + (feats.hipFlexorSessions * 8) + (recoveryDiscipline * 28),
    target: 86,
    todayStep: '10 dk omuz/kalca mobilite',
  },
]

const CLASS_SIGNATURE_QUESTS = {
  cekirdek_alevi: { title: 'Core Hattini Yak', step: '8 dk hollow/plank odak', linkedRegion: 'core', linkedMovement: 'mobility', xpReward: 35 },
  ayi_pencesi: { title: 'Arka Zinciri Uyandir', step: '2 cekis + 1 core destek', linkedRegion: 'lat', linkedMovement: 'grip', xpReward: 35 },
  ruzgar_kosucusu: { title: 'Nefes Hattini Ac', step: '25 dk dusuk tempo yuruyus', linkedRegion: 'calves', linkedMovement: 'flow', xpReward: 30 },
  mermer_heykel: { title: 'Kalkan Onarimi', step: '10 dk mobilite + gunluk log', linkedRegion: 'shoulder', linkedMovement: 'mobility', xpReward: 30 },
  golge_akrobat: { title: 'Gecis Hattini Temizle', step: '3 teknik gecis, risk yok', linkedRegion: 'core', linkedMovement: 'balance', xpReward: 35 },
  gok_kartali: { title: 'Hava Kontrolu', step: '3 kontrollu rotasyon hazirligi', linkedRegion: 'core', linkedMovement: 'balance', xpReward: 35 },
  duvar_orucu: { title: 'Inisi Temizle', step: '3 kontrollu landing drill', linkedRegion: 'ankles', linkedMovement: 'landing', xpReward: 35 },
  vinc_gezgini: { title: 'Akis Hatti', step: '10 dk dusuk riskli vault/flow', linkedRegion: 'hips', linkedMovement: 'flow', xpReward: 35 },
  celik_omurga: { title: 'Alt Govde Kilidi', step: '3 kontrollu squat/hinge seti', linkedRegion: 'quads', linkedMovement: 'landing', xpReward: 35 },
  golge_gezgini: { title: 'Sessiz Akis', step: '20 dk dusuk nabiz outdoor', linkedRegion: 'calves', linkedMovement: 'flow', xpReward: 30 },
  merakli_ruh: { title: 'Yeni Hat Yokla', step: '1 guc + 1 mobilite mini blok', linkedRegion: 'core', linkedMovement: 'mobility', xpReward: 30 },
}

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function toDateMs(value, today = getLocalDateString()) {
  const parsed = new Date(`${normalizeDateString(value, today)}T00:00:00`).getTime()
  return Number.isFinite(parsed) ? parsed : new Date(`${today}T00:00:00`).getTime()
}

function daysAgo(date, today) {
  return Math.max(0, Math.round((toDateMs(today, today) - toDateMs(date, today)) / DAY_MS))
}

function workoutText(workout = {}) {
  return normalizeText([
    workout.type,
    workout.highlight,
    workout.notes,
    ...(workout.tags || []),
    ...(workout.blocks || []).map(block => `${block.kind || ''} ${block.label || ''} ${(block.tags || []).join(' ')}`),
    ...(workout.exercises || []).map(exercise => exercise.name),
    ...(workout.exercises || []).flatMap(exercise => (exercise.sets || []).map(set => set.note || '')),
  ].join(' '))
}

function hasAnyText(text, patterns = []) {
  return patterns.some(pattern => {
    const normalized = normalizeText(pattern)
    return normalized && text.includes(normalized)
  })
}

function exerciseScore(workout, region) {
  let score = 0
  for (const exercise of (workout.exercises || [])) {
    const name = normalizeText(exercise.name || '')
    if (!hasAnyText(name, region.patterns)) continue
    const sets = Array.isArray(exercise.sets) ? exercise.sets.length : (Number(exercise.sets) || 1)
    score += Math.max(1, sets) * 2.4
  }
  return score
}

function regionSessionScore(workout, region) {
  const tags = new Set(workout.tags || [])
  const text = workoutText(workout)
  let score = exerciseScore(workout, region)

  if (region.tags.some(tag => tags.has(tag))) score += 4
  if (hasAnyText(text, region.patterns)) score += 3
  if (region.id === 'core' && hasDirectCoreStimulus(workout)) score += 5
  if (['quads', 'hamstrings', 'calves', 'knees', 'ankles', 'hips'].includes(region.id) && hasLegFocus(workout)) score += 2
  if (region.group === 'joint' && (tags.has('mobility') || workout.primaryCategory === 'recovery')) score += 1.5

  if (score <= 0) return 0
  return score + Math.min(6, (Number(workout.durationMin) || 0) / 20)
}

function balanceFallback(state, region) {
  const balance = state?.muscleBalance || []
  const item = balance.find(entry => {
    const label = normalizeText(entry.label || '')
    return region.muscleLabels.some(name => label === normalizeText(name))
  })
  if (!item) return 0
  return Math.min(100, Math.round(((Number(item.sets) || 0) / Math.max(12, region.saturation * 2.2)) * 100))
}

function buildRegionState(region, workouts, state, today) {
  let loadScore = 0
  let freshScore = 0
  let latestMatch = null
  let latestSource = ''

  for (const workout of workouts) {
    const age = daysAgo(workout.date, today)
    if (age > 28) continue
    const score = regionSessionScore(workout, region)
    if (score <= 0) continue
    const weight = age <= 7 ? 1 : age <= 14 ? 0.68 : 0.34
    loadScore += score * weight
    if (age <= 4) freshScore += score
    if (!latestMatch || age < latestMatch) {
      latestMatch = age
      latestSource = workout.type || 'Seans'
    }
  }

  const fallbackLoad = balanceFallback(state, region)
  const load = Math.max(fallbackLoad ? Math.round(fallbackLoad * 0.62) : 0, clamp(Math.round((loadScore / region.saturation) * 100)))
  const fatigue = Number(state?.profile?.fatigue) || 0
  const armor = Number(state?.profile?.armor) || 100
  const daysSince = latestMatch == null ? 99 : latestMatch
  const freshPenalty = daysSince <= 2 ? Math.min(24, freshScore * 2) : 0
  const neglect = load < 28 && daysSince > 10
  const recovery = clamp(Math.round((armor * 0.42) + ((100 - fatigue) * 0.38) + ((100 - Math.min(100, load)) * 0.2) - freshPenalty))
  const jointBias = region.group === 'joint' ? 8 : 0
  const risk = clamp(Math.round((fatigue * 0.35) + freshPenalty + Math.max(0, load - recovery) * 0.42 + jointBias - (neglect ? 8 : 0)))

  let trend = 'hazir'
  if (risk >= 68) trend = 'dikkat'
  else if (neglect) trend = 'ihmal'
  else if (daysSince <= 3 && load >= 55) trend = 'sicak'
  else if (recovery >= 72) trend = 'topar'

  return {
    id: region.id,
    label: region.label,
    group: region.group,
    load,
    recovery,
    risk,
    trend,
    daysSince,
    source: latestSource ? `${latestSource} / ${daysSince}g once` : 'Canli veri bekliyor',
  }
}

function buildMovementLines(semantic, regions = [], state = {}) {
  const regionMap = new Map(regions.map(region => [region.id, region]))
  const fatigue = Number(state?.profile?.fatigue) || 0

  return MOVEMENT_CONFIG.map(config => {
    const raw = config.score(semantic || {})
    const progress = clamp(Math.round((raw / config.target) * 100))
    const linkedRisk = config.linkedRegions
      .map(id => regionMap.get(id)?.risk || 0)
      .reduce((sum, risk) => sum + risk, 0) / Math.max(1, config.linkedRegions.length)
    const risk = clamp(Math.round((linkedRisk * 0.52) + (fatigue * 0.25) + (progress < 35 ? 14 : 0)))
    const tone = risk >= 66 ? 'risk' : progress < 35 ? 'gap' : progress >= 70 ? 'ready' : 'build'

    return {
      id: config.id,
      label: config.label,
      progress,
      risk,
      tone,
      linkedRegions: config.linkedRegions,
      todayStep: config.todayStep,
    }
  })
}

function progressFrom(value, target) {
  return clamp(Math.round(((Number(value) || 0) / Math.max(1, Number(target) || 1)) * 100))
}

function averageProgress(parts = []) {
  if (!parts.length) return 0
  return clamp(Math.round(parts.reduce((sum, value) => sum + clamp(value), 0) / parts.length))
}

function unlockRuleFor(name = '') {
  const normalized = normalizeText(name)
  if (normalized.includes('precision landing')) {
    return {
      linkedRegions: ['hips', 'knees', 'ankles', 'core'],
      linkedMovement: 'landing',
      progress: semantic => averageProgress([progressFrom(semantic.chains?.landingControl, 3), progressFrom(semantic.counts?.parkour, 2)]),
      missing: semantic => Number(semantic.chains?.landingControl) >= 3 ? 'Parkour hatti hazir' : 'Inis tekrarlarini temizle',
      todayStep: '3 dusuk yuk inis drill',
    }
  }
  if (normalized.includes('hollow 45')) {
    return {
      linkedRegions: ['core'],
      linkedMovement: 'mobility',
      progress: semantic => progressFrom(semantic.feats?.hollowMaxSec, 45),
      missing: semantic => `${Math.max(0, 45 - (Number(semantic.feats?.hollowMaxSec) || 0))} sn eksik`,
      todayStep: '3 x kontrollu hollow',
    }
  }
  if (normalized.includes('hollow')) {
    return {
      linkedRegions: ['core'],
      linkedMovement: 'mobility',
      progress: semantic => progressFrom(semantic.feats?.hollowMaxSec, 30),
      missing: semantic => `${Math.max(0, 30 - (Number(semantic.feats?.hollowMaxSec) || 0))} sn eksik`,
      todayStep: '3 x kontrollu hollow',
    }
  }
  if (normalized.includes('l-sit') || normalized.includes('lsit')) {
    return {
      linkedRegions: ['core', 'hips'],
      linkedMovement: 'mobility',
      progress: semantic => progressFrom(semantic.feats?.lSitMaxSec, 10),
      missing: semantic => `${Math.max(0, 10 - (Number(semantic.feats?.lSitMaxSec) || 0))} sn eksik`,
      todayStep: '3 x 5-10 sn L-Sit deneme',
    }
  }
  if (normalized.includes('muscle-up') || normalized.includes('muscle up')) {
    const target = normalized.includes('5') || normalized.includes('temiz') ? 5 : 1
    return {
      linkedRegions: ['lat', 'forearm', 'core', 'chest'],
      linkedMovement: 'grip',
      progress: semantic => averageProgress([
        progressFrom(semantic.feats?.muscleUpMaxReps, target),
        progressFrom(semantic.chains?.upperStrength, 5),
        progressFrom(semantic.chains?.trunkControl, 4),
      ]),
      missing: semantic => Number(semantic.feats?.muscleUpMaxReps) >= target ? 'Tekrar var, temizlik kaldı' : 'Patlayici cekis + gecis eksik',
      todayStep: 'pull + transition drill',
    }
  }
  if (normalized.includes('barani')) {
    return {
      linkedRegions: ['core', 'hips', 'ankles'],
      linkedMovement: 'balance',
      progress: semantic => averageProgress([
        semantic.feats?.frontFlipSeen ? 75 : 20,
        progressFrom(semantic.chains?.aerialControl, 4),
        progressFrom(semantic.chains?.landingControl, 3),
      ]),
      missing: semantic => semantic.feats?.frontFlipSeen ? 'Donus ve inis kontrolu eksik' : 'Front flip tabani lazim',
      todayStep: 'rotasyon yok; 3 inis + core kontrol',
    }
  }
  if (normalized.includes('back flip')) {
    return {
      linkedRegions: ['core', 'hips', 'lower-back'],
      linkedMovement: 'balance',
      progress: semantic => averageProgress([progressFrom(semantic.chains?.trunkControl, 5), progressFrom(semantic.chains?.aerialControl, 4)]),
      missing: () => 'Govde kontrolu ve guvenli iniş eksik',
      todayStep: 'core kontrol + dusuk riskli inis',
    }
  }
  if (normalized.includes('shoulder')) {
    return {
      linkedRegions: ['shoulder', 'upper-back'],
      linkedMovement: 'mobility',
      progress: semantic => progressFrom(semantic.feats?.shoulderMobilitySessions, 4),
      missing: semantic => `${Math.max(0, 4 - (Number(semantic.feats?.shoulderMobilitySessions) || 0))} mobilite izi eksik`,
      todayStep: '10 dk shoulder mobility',
    }
  }
  if (normalized.includes('active splits') || normalized.includes('bridge')) {
    return {
      linkedRegions: ['hips', 'lower-back'],
      linkedMovement: 'mobility',
      progress: semantic => averageProgress([progressFrom(semantic.feats?.splitSessions, 4), progressFrom(semantic.feats?.bridgeSessions, 2)]),
      missing: () => 'Kalca/omurga mobilite izi eksik',
      todayStep: '10 dk kalca + bridge prep',
    }
  }
  if (normalized.includes('one-arm hang') || normalized.includes('dead hang')) {
    return {
      linkedRegions: ['forearm', 'lat'],
      linkedMovement: 'grip',
      progress: semantic => averageProgress([progressFrom(semantic.feats?.hangMaxSec, normalized.includes('one-arm') ? 105 : 75), progressFrom(semantic.chains?.gripControl, 4)]),
      missing: () => 'Grip suresi ve kontrol eksik',
      todayStep: '2-3 temiz dead hang',
    }
  }
  if (normalized.includes('front lever') || normalized.includes('dragon flag')) {
    return {
      linkedRegions: ['core', 'lat', 'forearm'],
      linkedMovement: 'grip',
      progress: semantic => averageProgress([progressFrom(semantic.chains?.trunkControl, 5), progressFrom(semantic.chains?.gripControl, 4)]),
      missing: () => 'Core + grip zinciri eksik',
      todayStep: 'hollow + hang superset',
    }
  }
  return null
}

function flattenSkillTargets(skills = []) {
  return (skills || []).flatMap(branch => (branch.items || []).map(item => ({
    ...item,
    branch: branch.branch,
    source: 'skill',
  })))
}

export function scoreUnlockTargets(skills = [], semantic = buildSemanticProfile([])) {
  const existing = flattenSkillTargets(skills)
    .filter(item => item.status !== 'done')
    .map(item => {
      const rule = unlockRuleFor(item.name)
      const progress = rule ? rule.progress(semantic) : (item.status === 'prog' ? 55 : 18)
      return {
        name: item.name,
        branch: item.branch || 'Skill',
        status: item.status || 'lock',
        progress,
        missing: rule ? rule.missing(semantic) : (item.req || item.desc || 'Bir sonraki iz bekleniyor'),
        todayStep: rule ? rule.todayStep : 'Teknik mini blok ekle',
        linkedRegions: rule?.linkedRegions || ['core'],
        linkedMovement: rule?.linkedMovement || 'mobility',
        source: item.source || 'skill',
      }
    })

  const virtual = [
    { name: 'Precision Landing I', branch: 'PARKOUR HATTI' },
    { name: 'Hollow 45', branch: 'CORE HATTI' },
    { name: 'Muscle-Up Temiz Tekrar', branch: 'STRENGTH HATTI' },
  ]
    .filter(item => !existing.some(target => normalizeText(target.name) === normalizeText(item.name)))
    .map(item => {
      const rule = unlockRuleFor(item.name)
      return {
        ...item,
        status: 'prog',
        progress: rule.progress(semantic),
        missing: rule.missing(semantic),
        todayStep: rule.todayStep,
        linkedRegions: rule.linkedRegions,
        linkedMovement: rule.linkedMovement,
        source: 'movement',
      }
    })

  return [...existing, ...virtual]
    .sort((left, right) => (right.progress - left.progress) || String(left.name).localeCompare(String(right.name)))
    .slice(0, 8)
}

function selectPriority(regions, movementLines, unlockTargets) {
  const repairWeight = { core: 28, quads: 20, hamstrings: 18, calves: 14, 'upper-back': 12, lat: 12 }
  const risky = [...regions].filter(region => region.risk >= 64).sort((a, b) => b.risk - a.risk)[0]
  const neglected = [...regions]
    .filter(region => region.trend === 'ihmal' && region.group === 'muscle')
    .sort((a, b) => (repairWeight[b.id] || 0) - (repairWeight[a.id] || 0) || b.daysSince - a.daysSince || a.load - b.load)[0]
  const linkedUnlock = unlockTargets.find(target => target.progress >= 45 && target.progress < 100)
  const unlockRegion = linkedUnlock?.linkedRegions?.[0]
    ? regions.find(region => region.id === linkedUnlock.linkedRegions[0])
    : null
  const region = risky || neglected || unlockRegion || [...regions].sort((a, b) => b.risk - a.risk)[0] || null
  const movement = [...movementLines].sort((a, b) => {
    const aScore = (a.tone === 'gap' ? 25 : 0) + a.risk + (100 - a.progress)
    const bScore = (b.tone === 'gap' ? 25 : 0) + b.risk + (100 - b.progress)
    return bScore - aScore
  })[0] || null

  return {
    region,
    movement,
    unlock: linkedUnlock || unlockTargets[0] || null,
  }
}

function questFromSignature(classId, priority) {
  const fallback = CLASS_SIGNATURE_QUESTS[classId] || CLASS_SIGNATURE_QUESTS.merakli_ruh
  return {
    id: `signature_${classId || 'merakli_ruh'}`,
    kind: 'signature',
    name: fallback.title,
    desc: fallback.step,
    why: priority?.movement ? `${priority.movement.label} hattini karakter tipine bagliyoruz.` : 'Build dengeli, imza gorev zamani.',
    xpReward: fallback.xpReward,
    reward: `+${fallback.xpReward} XP`,
    progress: 0,
    total: 1,
    done: false,
    linkedRegion: fallback.linkedRegion,
    linkedMovement: fallback.linkedMovement,
    linkedUnlock: priority?.unlock?.name || '',
    safeMode: false,
    fromGame: true,
  }
}

function buildDailyGameQuest({ state, priority, classId }) {
  const fatigue = Number(state?.profile?.fatigue) || 0
  const armor = Number(state?.profile?.armor) || 100
  const region = priority.region
  const movement = priority.movement
  const unlock = priority.unlock

  if (fatigue >= 72 || armor < 55 || region?.risk >= 68) {
    const linkedRegion = region?.id || 'shoulder'
    return {
      id: `guard_${linkedRegion}`,
      kind: 'recovery',
      name: linkedRegion === 'shoulder' ? 'Omuz Kalkanı' : 'Kalkan Onarımı',
      desc: linkedRegion === 'shoulder' ? '10 dk shoulder mobility, rekor yok.' : '25 dk yürüyüş veya 10 dk mobilite.',
      why: `Risk sinyali yuksek: ${region?.label || 'vucut'} ${region?.risk ?? Math.round(fatigue)}.`,
      xpReward: 30,
      reward: '+30 XP',
      progress: 0,
      total: 1,
      done: false,
      linkedRegion,
      linkedMovement: 'mobility',
      linkedUnlock: unlock?.name || '',
      safeMode: true,
      fromGame: true,
    }
  }

  if (region?.trend === 'ihmal') {
    const taskMap = {
      core: ['Core Hattını Yak', '8 dk hollow/plank odak'],
      lat: ['Kanat Hattını Aç', '2 çekiş seti + 1 kontrollü row'],
      'upper-back': ['Arka Zinciri Uyandır', '2 row/face pull destek seti'],
      quads: ['İnişi Besle', '3 kontrollü squat veya landing drill'],
      hamstrings: ['Arka Zinciri Kapat', '3 hinge/bridge destek seti'],
      calves: ['Zemin Hattı', '5 dk calf + 10 dk yürüyüş'],
      chest: ['Ön Hattı Sabitle', '2 temiz press destek seti'],
    }
    const [name, desc] = taskMap[region.id] || [`${region.label} Hattını Kapat`, 'Kısa ve temiz teknik blok']
    return {
      id: `repair_${region.id}`,
      kind: 'repair',
      name,
      desc,
      why: `${region.label} son 28 gunde geride kaldi.`,
      xpReward: 35,
      reward: '+35 XP',
      progress: 0,
      total: 1,
      done: false,
      linkedRegion: region.id,
      linkedMovement: movement?.id || 'mobility',
      linkedUnlock: unlock?.name || '',
      safeMode: false,
      fromGame: true,
    }
  }

  if (unlock && unlock.progress >= 45 && unlock.progress < 100) {
    return {
      id: `unlock_${normalizeText(unlock.name).replace(/[^a-z0-9]+/g, '_')}`,
      kind: 'unlock',
      name: `${unlock.name} Yaklaştır`,
      desc: unlock.todayStep,
      why: `${unlock.name} ${unlock.progress}% yakin. ${unlock.missing}`,
      xpReward: 40,
      reward: '+40 XP',
      progress: 0,
      total: 1,
      done: false,
      linkedRegion: unlock.linkedRegions?.[0] || region?.id || 'core',
      linkedMovement: unlock.linkedMovement || movement?.id || 'mobility',
      linkedUnlock: unlock.name,
      safeMode: false,
      fromGame: true,
    }
  }

  return questFromSignature(classId, priority)
}

function buildXpPreview({ state, dailyQuest, priority }) {
  const fatigue = Number(state?.profile?.fatigue) || 0
  const armor = Number(state?.profile?.armor) || 100
  const readiness = Number(state?.health?.readiness?.score)
  const parts = []

  parts.push({ key: 'base', label: 'Ana Hamle', value: readiness < 45 || armor < 55 ? 55 : 80 })
  if (priority?.region?.trend === 'ihmal') parts.push({ key: 'gap', label: 'Kapanan Hat', value: 25 })
  if (priority?.unlock?.progress >= 45 && priority?.unlock?.progress < 100) parts.push({ key: 'unlock', label: 'Açılım İzi', value: 20 })
  if (dailyQuest?.xpReward) parts.push({ key: 'quest', label: 'Ara Görev', value: Number(dailyQuest.xpReward) || 0 })
  if (fatigue >= 70) parts.push({ key: 'recovery', label: 'Toparlanma', value: 35 })
  else parts.push({ key: 'form', label: 'Form', value: 20 })

  return {
    total: parts.reduce((sum, part) => sum + part.value, 0),
    parts,
    text: parts.map(part => `+${part.value} ${part.label}`).join(' / '),
  }
}

export function buildBodyMapState({
  state = {},
  profile = state.profile || {},
  semantic = null,
  today = getLocalDateString(),
} = {}) {
  const workouts = (state.workouts || profile.workouts || []).map(workout => normalizeSession(workout))
  const semanticProfile = semantic || buildSemanticProfile(workouts, state.dailyLogs || profile.dailyLogs || [])
  const regions = REGION_CONFIG.map(region => buildRegionState(region, workouts, state, today))
  const movementLines = buildMovementLines(semanticProfile, regions, state)
  const unlockTargets = scoreUnlockTargets(state.skills || profile.skills || [], semanticProfile)
  const priority = selectPriority(regions, movementLines, unlockTargets)
  const dailyQuest = buildDailyGameQuest({
    state,
    priority,
    classId: state.profile?.classObj?.id || state.profile?.classId || profile.classId,
  })
  const xpPreview = buildXpPreview({ state, dailyQuest, priority })

  return {
    generatedAt: today,
    regions,
    movementLines,
    priority,
    dailyQuest,
    unlockTargets,
    xpPreview,
  }
}

function sessionMatchesRegion(session = {}, regionId = '') {
  const normalized = normalizeSession(session)
  const region = REGION_CONFIG.find(item => item.id === regionId)
  if (!region) return false
  return regionSessionScore(normalized, region) > 0
}

function sessionMatchesMovement(session = {}, movementId = '') {
  const normalized = normalizeSession(session)
  const tags = new Set(normalized.tags || [])
  const text = workoutText(normalized)
  switch (movementId) {
    case 'landing':
      return tags.has('parkour') || hasAnyText(text, ['landing', 'precision', 'drop', 'roll', 'jump'])
    case 'flow':
      return tags.has('parkour') || tags.has('terrain') || hasAnyText(text, ['vault', 'flow', 'wall run', 'tic tac', 'terrain'])
    case 'balance':
      return tags.has('balance') || tags.has('acrobatics') || hasAnyText(text, ['balance', 'landing', 'round off', 'barani'])
    case 'explosive':
      return tags.has('explosive') || hasAnyText(text, ['jump', 'sprint', 'plyo', 'muscle up', 'muscle-up', 'flip'])
    case 'grip':
      return tags.has('grip') || tags.has('climbing') || hasAnyText(text, ['dead hang', 'hang', 'grip', 'farmer'])
    case 'mobility':
      return tags.has('mobility') || normalized.primaryCategory === 'recovery' || hasAnyText(text, ['stretch', 'mobility', 'bridge', 'hip flexor'])
    default:
      return false
  }
}

export function sessionClosesBodyMapPriority(session = {}, bodyMapState = null) {
  if (!bodyMapState?.priority) return false
  const regionHit = sessionMatchesRegion(session, bodyMapState.priority.region?.id)
  const movementHit = sessionMatchesMovement(session, bodyMapState.priority.movement?.id)
  return regionHit || movementHit
}

export function sessionClosesGameQuest(session = {}, quest = null) {
  if (!quest) return false
  const normalized = normalizeSession(session)
  if (quest.kind === 'recovery') {
    return normalized.primaryCategory === 'recovery'
      || normalized.tags.includes('mobility')
      || normalized.tags.includes('walking')
  }
  return sessionMatchesRegion(normalized, quest.linkedRegion)
    || sessionMatchesMovement(normalized, quest.linkedMovement)
}
