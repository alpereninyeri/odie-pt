import { normalizeSession, normalizeText } from './rules.js'

const PATTERN_GROUPS = {
  bench: ['bench', 'incline press', 'chest press'],
  muscleUp: ['muscle-up', 'muscle up'],
  hang: ['dead hang', 'hang', 'bar hang'],
  hollow: ['hollow', 'hollow body', 'hollow rock'],
  lSit: ['l-sit', 'lsit'],
  plank: ['plank', 'side plank'],
  dragonFlag: ['dragon flag', 'dragon'],
  frontLever: ['front lever'],
  frontFlip: ['front flip'],
  backFlip: ['back flip'],
  fullTwist: ['full twist'],
  barani: ['barani'],
  roundOff: ['round off', 'roundoff'],
  diveRoll: ['dive roll', 'shoulder roll'],
  roll: ['roll'],
  bridge: ['bridge'],
  split: ['split'],
  hipFlexor: ['hip flexor'],
  shoulderMobility: ['shoulder mobility', 'shoulder flexibility', 'wall slide', 'dislocate'],
  carry: ['carry', 'farmers', 'farmer'],
  climb: ['climb', 'climbing', 'boulder', 'fingerboard'],
  landing: ['landing', 'precision'],
  rotation: ['twist', 'spin', 'rotation'],
  sprint: ['sprint'],
  jump: ['jump', 'plyo', 'bound'],
}

function hasPattern(text, patterns = []) {
  return patterns.some(pattern => text.includes(normalizeText(pattern)))
}

function workoutText(workout) {
  return normalizeText([
    workout.type,
    workout.highlight,
    workout.notes,
    ...(workout.tags || []),
    ...(workout.blocks || []).map(block => `${block.kind} ${block.label}`),
    ...(workout.exercises || []).map(exercise => exercise.name),
    ...(workout.exercises || []).flatMap(exercise => (exercise.sets || []).map(set => set.note || '')),
  ].join(' '))
}

function countBlocks(workouts = [], kind) {
  return workouts.reduce((sum, workout) => (
    sum + (workout.blocks || []).filter(block => block.kind === kind).length
  ), 0)
}

function maxMetric(workouts = [], patterns = [], metric = 'reps') {
  let best = 0
  for (const workout of workouts) {
    for (const exercise of (workout.exercises || [])) {
      const name = normalizeText(exercise.name)
      if (!hasPattern(name, patterns)) continue
      for (const set of (exercise.sets || [])) {
        const value = Number(set[metric] ?? set[`${metric}_sec`] ?? set[`${metric}_kg`]) || 0
        if (value > best) best = value
      }
    }
  }
  return best
}

function maxBenchKg(workouts = []) {
  let best = 0
  for (const workout of workouts) {
    for (const exercise of (workout.exercises || [])) {
      if (!hasPattern(normalizeText(exercise.name), PATTERN_GROUPS.bench)) continue
      for (const set of (exercise.sets || [])) {
        const kg = Number(set.weightKg ?? set.weight_kg) || 0
        if (kg > best) best = kg
      }
    }
  }
  return best
}

function maxReps(workouts = [], patterns = []) {
  let best = 0
  for (const workout of workouts) {
    for (const exercise of (workout.exercises || [])) {
      if (!hasPattern(normalizeText(exercise.name), patterns)) continue
      for (const set of (exercise.sets || [])) {
        const reps = Number(set.reps) || 0
        if (reps > best) best = reps
      }
    }
  }
  return best
}

function maxDuration(workouts = [], patterns = []) {
  let best = 0
  for (const workout of workouts) {
    for (const exercise of (workout.exercises || [])) {
      if (!hasPattern(normalizeText(exercise.name), patterns)) continue
      for (const set of (exercise.sets || [])) {
        const duration = Number(set.durationSec ?? set.duration_sec) || 0
        if (duration > best) best = duration
      }
    }
  }
  return best
}

function countSessions(workouts = [], matcher) {
  return workouts.filter(matcher).length
}

function share(count, total) {
  return total ? count / total : 0
}

function activeRecoveryScore(dailyLogs = []) {
  const recent = dailyLogs.slice(0, 7)
  if (!recent.length) return 0
  let score = 0
  for (const log of recent) {
    if ((Number(log.sleepHours) || 0) >= 7) score += 1
    if ((Number(log.waterMl) || 0) >= 2200) score += 1
    if ((Number(log.steps) || 0) >= 8000) score += 1
  }
  return score / (recent.length * 3)
}

export function buildSemanticProfile(workouts = [], dailyLogs = []) {
  const normalized = (workouts || []).map(workout => normalizeSession(workout))
  const total = normalized.length || 1
  const texts = normalized.map(workout => workoutText(workout))

  const counts = {
    strength: countSessions(normalized, workout => workout.primaryCategory === 'strength'),
    movement: countSessions(normalized, workout => workout.primaryCategory === 'movement'),
    endurance: countSessions(normalized, workout => workout.primaryCategory === 'endurance'),
    recovery: countSessions(normalized, workout => workout.primaryCategory === 'recovery'),
    push: countSessions(normalized, workout => (workout.tags || []).includes('push')),
    pull: countSessions(normalized, workout => (workout.tags || []).includes('pull')),
    legs: countSessions(normalized, workout => (workout.tags || []).includes('legs')),
    core: countSessions(normalized, workout => (workout.tags || []).includes('core')),
    mobility: countSessions(normalized, workout => (workout.tags || []).includes('mobility')),
    parkour: countSessions(normalized, workout => (workout.tags || []).includes('parkour')),
    acrobatics: countSessions(normalized, workout => (workout.tags || []).includes('acrobatics')),
    locomotion: countSessions(normalized, workout => ['walking', 'cycling', 'ski'].some(tag => (workout.tags || []).includes(tag))),
    climbing: countSessions(normalized, workout => (workout.tags || []).includes('climbing')),
    grip: countSessions(normalized, workout => (workout.tags || []).includes('grip')),
    carry: countSessions(normalized, workout => (workout.tags || []).includes('carry')),
    terrain: countSessions(normalized, workout => (workout.tags || []).includes('terrain')),
    explosive: countSessions(normalized, workout => (workout.tags || []).includes('explosive')),
    balance: countSessions(normalized, workout => (workout.tags || []).includes('balance')),
    outdoor: countSessions(normalized, workout => ['parkour', 'walking', 'cycling', 'ski', 'climbing'].some(tag => (workout.tags || []).includes(tag))),
    calisthenics: countSessions(normalized, workout => (workout.tags || []).includes('calisthenics')),
    gym: countSessions(normalized, workout => (workout.tags || []).includes('gym')),
    strengthBlocks: countBlocks(normalized, 'strength'),
    locomotionBlocks: countBlocks(normalized, 'locomotion'),
    coreBlocks: countBlocks(normalized, 'core'),
    mobilityBlocks: countBlocks(normalized, 'mobility'),
    explosiveBlocks: countBlocks(normalized, 'explosive'),
    recoveryBlocks: countBlocks(normalized, 'recovery'),
    skillBlocks: countBlocks(normalized, 'skill'),
  }

  const chains = {
    upperStrength: counts.push + counts.pull,
    lowerPower: counts.legs + counts.parkour + counts.explosive + counts.explosiveBlocks,
    trunkControl: counts.core + counts.coreBlocks + counts.carry + counts.climbing,
    aerialControl: counts.acrobatics + counts.balance + counts.skillBlocks,
    landingControl: normalized.filter((workout, index) => hasPattern(texts[index], [...PATTERN_GROUPS.landing, ...PATTERN_GROUPS.roll, ...PATTERN_GROUPS.diveRoll, ...PATTERN_GROUPS.roundOff])).length,
    mobilityBase: counts.mobility + counts.mobilityBlocks + counts.recovery + counts.recoveryBlocks,
    enduranceBase: counts.endurance + counts.locomotion + counts.locomotionBlocks,
    gripControl: counts.grip + counts.climbing,
  }

  const feats = {
    benchMaxKg: maxBenchKg(normalized),
    muscleUpMaxReps: maxReps(normalized, PATTERN_GROUPS.muscleUp),
    hangMaxSec: maxDuration(normalized, PATTERN_GROUPS.hang),
    hollowMaxSec: maxDuration(normalized, PATTERN_GROUPS.hollow),
    lSitMaxSec: maxDuration(normalized, PATTERN_GROUPS.lSit),
    plankMaxSec: maxDuration(normalized, PATTERN_GROUPS.plank),
    frontFlipSeen: texts.some(text => hasPattern(text, PATTERN_GROUPS.frontFlip)),
    backFlipSeen: texts.some(text => hasPattern(text, PATTERN_GROUPS.backFlip)),
    fullTwistSeen: texts.some(text => hasPattern(text, PATTERN_GROUPS.fullTwist)),
    baraniSeen: texts.some(text => hasPattern(text, PATTERN_GROUPS.barani)),
    roundOffSeen: texts.some(text => hasPattern(text, PATTERN_GROUPS.roundOff)),
    diveRollSeen: texts.some(text => hasPattern(text, PATTERN_GROUPS.diveRoll)) || texts.some(text => hasPattern(text, PATTERN_GROUPS.roll)),
    bridgeSessions: normalized.filter((workout, index) => hasPattern(texts[index], PATTERN_GROUPS.bridge)).length,
    splitSessions: normalized.filter((workout, index) => hasPattern(texts[index], PATTERN_GROUPS.split)).length,
    hipFlexorSessions: normalized.filter((workout, index) => hasPattern(texts[index], PATTERN_GROUPS.hipFlexor)).length,
    shoulderMobilitySessions: normalized.filter((workout, index) => hasPattern(texts[index], PATTERN_GROUPS.shoulderMobility)).length,
    dragonFlagSeen: texts.some(text => hasPattern(text, PATTERN_GROUPS.dragonFlag)),
    frontLeverSeen: texts.some(text => hasPattern(text, PATTERN_GROUPS.frontLever)),
    carrySessions: normalized.filter((workout, index) => hasPattern(texts[index], PATTERN_GROUPS.carry)).length,
    terrainSessions: normalized.filter((workout, index) => hasPattern(texts[index], ['terrain', 'trail', 'stairs', 'hill', 'uphill', 'zemin'])).length,
    climbSessions: normalized.filter((workout, index) => hasPattern(texts[index], PATTERN_GROUPS.climb)).length,
    jumpSessions: normalized.filter((workout, index) => hasPattern(texts[index], PATTERN_GROUPS.jump)).length,
    sprintSessions: normalized.filter((workout, index) => hasPattern(texts[index], PATTERN_GROUPS.sprint)).length,
  }

  const varietySignals = new Set()
  for (const workout of normalized) {
    varietySignals.add(workout.primaryCategory)
    varietySignals.add(workout.type)
    for (const tag of (workout.tags || [])) varietySignals.add(tag)
  }

  const categoryDepth = ['strength', 'movement', 'endurance', 'recovery']
    .filter(key => share(counts[key], total) >= 0.15)
    .length

  return {
    workouts: normalized,
    counts,
    shares: {
      strength: share(counts.strength, total),
      movement: share(counts.movement, total),
      endurance: share(counts.endurance, total),
      recovery: share(counts.recovery, total),
      core: share(counts.core, total),
      legs: share(counts.legs, total),
      outdoor: share(counts.outdoor, total),
      acrobatics: share(counts.acrobatics, total),
      parkour: share(counts.parkour, total),
      mobility: share(counts.mobility, total),
    },
    chains,
    feats,
    variety: varietySignals.size,
    hybridScore: categoryDepth + Math.min(4, Math.round(varietySignals.size / 3)),
    recoveryDiscipline: activeRecoveryScore(dailyLogs),
    nightSessions: normalized.filter(workout => {
      if (!workout.createdAt && !workout.created_at) return false
      const hour = new Date(workout.createdAt || workout.created_at).getHours()
      return hour >= 22 || hour < 6
    }).length,
  }
}
