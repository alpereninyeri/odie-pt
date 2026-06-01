import {
  countAllSets,
  getLocalDateString,
  hasDirectCoreStimulus,
  normalizeDateString,
  normalizeSession,
  normalizeText,
} from './rules.js'

export const BOUNTY_XP_CAP = 120

const DAILY_KINDS = new Set(['daily_active', 'streak_guard', 'movement_patrol', 'recovery_contract', 'combo_chain'])
const WEEKLY_KINDS = new Set(['weak_line', 'unlock_gate', 'core_seal'])

function number(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function percent(progress = 0, total = 1) {
  return clamp((number(progress) / Math.max(1, number(total, 1))) * 100)
}

function text(value = '', fallback = '') {
  const clean = String(value || '').replace(/\s+/g, ' ').trim()
  return clean || fallback
}

function weekKey(today = getLocalDateString()) {
  const date = new Date(`${normalizeDateString(today)}T12:00:00`)
  if (!Number.isFinite(date.getTime())) return `week:${today}`
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `week:${normalizeDateString(monday.toISOString().slice(0, 10))}`
}

function dayWorkouts(workouts = [], today = getLocalDateString()) {
  const day = normalizeDateString(today)
  return (workouts || [])
    .map(workout => normalizeSession(workout))
    .filter(workout => normalizeDateString(workout.date) === day)
}

function weekWorkouts(workouts = [], today = getLocalDateString()) {
  const end = new Date(`${normalizeDateString(today)}T12:00:00`).getTime()
  const start = end - (6 * 86400000)
  return (workouts || [])
    .map(workout => normalizeSession(workout))
    .filter(workout => {
      const ts = new Date(`${normalizeDateString(workout.date)}T12:00:00`).getTime()
      return Number.isFinite(ts) && ts >= start && ts <= end
    })
}

function hasTag(session = {}, tag = '') {
  return (session.tags || []).includes(tag)
}

function sessionWords(session = {}) {
  return normalizeText([
    session.type,
    session.highlight,
    session.notes,
    ...(session.tags || []),
    ...(session.blocks || []).map(block => `${block.kind || ''} ${block.label || ''}`),
    ...(session.exercises || []).map(exercise => exercise.name || ''),
  ].join(' '))
}

function includesAny(textValue = '', needles = []) {
  return needles.some(needle => textValue.includes(normalizeText(needle)))
}

function sessionMatchesRegion(session = {}, region = '') {
  const normalized = normalizeSession(session)
  const words = sessionWords(normalized)
  switch (region) {
    case 'chest':
      return hasTag(normalized, 'push') || includesAny(words, ['bench', 'press', 'chest', 'göğüs', 'gogus', 'dip'])
    case 'lat':
    case 'upper-back':
      return hasTag(normalized, 'pull') || includesAny(words, ['pull', 'row', 'sırt', 'sirt', 'kanat', 'lat', 'face pull'])
    case 'quads':
    case 'hamstrings':
    case 'calves':
    case 'knees':
    case 'ankles':
    case 'hips':
      return hasTag(normalized, 'legs') || hasTag(normalized, 'parkour') || includesAny(words, ['squat', 'lunge', 'leg', 'bacak', 'kalf', 'calf', 'landing'])
    case 'core':
    case 'lower-back':
      return hasDirectCoreStimulus(normalized) || hasTag(normalized, 'core') || includesAny(words, ['core', 'hollow', 'plank', 'l-sit', 'lsit'])
    case 'wrist':
    case 'forearm':
      return hasTag(normalized, 'grip') || includesAny(words, ['grip', 'hang', 'farmer', 'bilek', 'wrist'])
    case 'shoulder':
    case 'triceps':
    case 'biceps':
      return hasTag(normalized, 'push') || hasTag(normalized, 'pull') || includesAny(words, ['omuz', 'shoulder', 'curl', 'triceps', 'biceps'])
    default:
      return false
  }
}

function sessionMatchesMovement(session = {}, movement = '') {
  const normalized = normalizeSession(session)
  const words = sessionWords(normalized)
  switch (movement) {
    case 'landing':
      return hasTag(normalized, 'parkour') || includesAny(words, ['landing', 'precision', 'drop', 'roll', 'jump', 'iniş', 'inis'])
    case 'flow':
      return hasTag(normalized, 'parkour') || hasTag(normalized, 'terrain') || includesAny(words, ['vault', 'flow', 'wall run', 'tic tac', 'akış', 'akis'])
    case 'balance':
      return hasTag(normalized, 'balance') || hasTag(normalized, 'acrobatics') || includesAny(words, ['balance', 'denge', 'barani', 'round off'])
    case 'explosive':
      return hasTag(normalized, 'explosive') || includesAny(words, ['jump', 'sprint', 'plyo', 'muscle up', 'flip', 'patlayıcı', 'patlayici'])
    case 'grip':
      return hasTag(normalized, 'grip') || hasTag(normalized, 'climbing') || includesAny(words, ['dead hang', 'hang', 'grip', 'farmer'])
    case 'mobility':
      return hasTag(normalized, 'mobility') || normalized.primaryCategory === 'recovery' || includesAny(words, ['stretch', 'mobility', 'mobilite'])
    default:
      return false
  }
}

function sessionMatchesQuest(session = {}, quest = {}) {
  const normalized = normalizeSession(session)
  if (quest.safeMode || ['recovery', 'injury', 'health_recovery', 'movement_care', 'movement_ring'].includes(quest.kind)) {
    return normalized.primaryCategory === 'recovery'
      || normalized.primaryCategory === 'endurance'
      || hasTag(normalized, 'mobility')
      || hasTag(normalized, 'walking')
      || hasTag(normalized, 'terrain')
  }
  return sessionMatchesRegion(normalized, quest.linkedRegion) || sessionMatchesMovement(normalized, quest.linkedMovement)
}

function areaFromBalance(nextSession = {}, bodyMap = {}) {
  const lowest = nextSession.questImpact?.balance?.lowest || null
  if (lowest?.key) {
    return {
      key: lowest.key,
      label: lowest.label || lowest.key,
      region: lowest.key === 'push' ? 'chest' : lowest.key === 'pull' ? 'lat' : lowest.key === 'legs' ? 'quads' : 'core',
    }
  }
  const region = bodyMap.priority?.region || null
  if (region?.id) return { key: region.id, label: region.label || 'Bölge', region: region.id }
  return { key: 'core', label: 'Core', region: 'core' }
}

function sessionMatchesArea(session = {}, area = {}) {
  const normalized = normalizeSession(session)
  const key = area.key || area.region
  if (key === 'push') return sessionMatchesRegion(normalized, 'chest')
  if (key === 'pull') return sessionMatchesRegion(normalized, 'lat') || sessionMatchesRegion(normalized, 'upper-back')
  if (key === 'legs') return sessionMatchesRegion(normalized, 'quads') || sessionMatchesRegion(normalized, 'hamstrings')
  if (key === 'core') return sessionMatchesRegion(normalized, 'core')
  return sessionMatchesRegion(normalized, area.region || key)
}

function areaProgress(workouts = [], area = {}) {
  const matched = workouts.filter(workout => sessionMatchesArea(workout, area))
  if (area.key === 'core' || area.region === 'core') {
    const directCoreMinutes = matched.some(workout => hasDirectCoreStimulus(workout)) ? 8 : 0
    const coreMinutes = matched.reduce((sum, workout) => sum + number(workout.durationMin), 0)
    return Math.max(
      matched.length ? 1 : 0,
      directCoreMinutes,
      Math.min(8, coreMinutes),
    )
  }
  return matched.reduce((sum, workout) => sum + Math.max(1, countAllSets(workout) || number(workout.sets) || 1), 0)
}

function coreProgress(workouts = []) {
  return workouts.some(workout => sessionMatchesRegion(workout, 'core')) ? 1 : 0
}

function movementProgress(workouts = []) {
  const movement = workouts.filter(workout => (
    workout.primaryCategory === 'movement'
    || workout.primaryCategory === 'endurance'
    || hasTag(workout, 'walking')
    || hasTag(workout, 'parkour')
    || hasTag(workout, 'terrain')
  ))
  const minutes = movement.reduce((sum, workout) => sum + number(workout.durationMin), 0)
  const distance = movement.reduce((sum, workout) => sum + number(workout.distanceKm), 0)
  return Math.max(minutes, distance * 10)
}

function recoveryProgress(workouts = []) {
  return workouts.some(workout => (
    workout.primaryCategory === 'recovery'
    || workout.primaryCategory === 'endurance'
    || hasTag(workout, 'mobility')
    || hasTag(workout, 'walking')
  )) ? 1 : 0
}

function comboScore(session = {}) {
  const normalized = normalizeSession(session)
  const tags = new Set(normalized.tags || [])
  const signals = new Set()
  if (normalized.primaryCategory) signals.add(normalized.primaryCategory)
  if (hasDirectCoreStimulus(normalized) || tags.has('core')) signals.add('core')
  if (tags.has('mobility')) signals.add('mobility')
  if (tags.has('parkour') || tags.has('balance') || tags.has('explosive')) signals.add('movement')
  if (tags.has('push') || tags.has('pull') || tags.has('legs') || normalized.primaryCategory === 'strength') signals.add('strength')
  if (tags.has('walking') || normalized.primaryCategory === 'endurance') signals.add('endurance')
  if (signals.has('recovery') && signals.has('mobility')) signals.delete('mobility')
  return signals.size
}

function comboProgress(workouts = []) {
  return workouts.some(workout => comboScore(workout) >= 2) ? 1 : 0
}

function zoneForQuest(quest = {}) {
  if (quest.safeMode) return 'recovery'
  if (quest.linkedUnlock) return 'skill'
  if (quest.linkedMovement && quest.linkedMovement !== 'mobility') return 'parkour'
  if (quest.linkedRegion) return 'body'
  return 'forge'
}

function makeBounty(input = {}) {
  const total = Math.max(1, number(input.total, 1))
  const progress = clamp(number(input.progress), 0, total)
  return {
    id: input.id,
    periodKey: input.periodKey,
    kind: input.kind,
    title: text(input.title, 'Görev'),
    body: text(input.body, 'Kısa ve temiz bir hamle yeter.'),
    requirement: text(input.requirement, `${progress}/${total}`),
    progress,
    total,
    done: progress >= total,
    xp: Math.max(0, Math.round(number(input.xp))),
    linkedRegion: input.linkedRegion || '',
    linkedMovement: input.linkedMovement || '',
    linkedZone: input.linkedZone || 'forge',
    tone: input.tone || 'bounty',
    iconKey: input.iconKey || 'bounty',
    detail: text(input.detail, input.body || ''),
  }
}

function healthPressure(state = {}, nextSession = {}) {
  const profile = state.profile || {}
  const summary = state.health?.vitalScores?.summary || state.healthDailySummary || state.healthStatus?.dailySummary || null
  const sleep = number(state.health?.vitalScores?.sleep ?? summary?.sleepScore, null)
  const heart = number(state.health?.vitalScores?.heart ?? summary?.heartScore, null)
  const fatigue = number(profile.fatigue)
  const armor = number(profile.armor, 100)
  const sleepLow = Number.isFinite(sleep) && sleep < 60
  const heartLow = Number.isFinite(heart) && heart < 55
  return {
    active: fatigue >= 60 || armor < 65 || nextSession.tone === 'warn' || nextSession.tone === 'danger' || sleepLow || heartLow,
    fatigue,
    armor,
    sleep,
    heart,
  }
}

function buildMapNodes(bounties = []) {
  const order = { weak_line: 0, unlock_gate: 1, recovery_contract: 2, combo_chain: 3 }
  return bounties
    .filter(bounty => ['weak_line', 'unlock_gate', 'combo_chain', 'recovery_contract'].includes(bounty.kind))
    .sort((left, right) => (order[left.kind] ?? 99) - (order[right.kind] ?? 99))
    .slice(0, 4)
    .map(bounty => ({
      key: `bounty-${bounty.id}`,
      type: 'bountyNode',
      kind: bounty.kind,
      zone: bounty.linkedZone,
      title: bounty.title,
      body: bounty.body,
      reward: `+${bounty.xp} XP`,
      progress: percent(bounty.progress, bounty.total),
      bountyId: bounty.id,
      tone: bounty.tone,
    }))
}

function rewardChips(bounties = []) {
  return bounties
    .filter(bounty => !bounty.done && bounty.xp > 0)
    .slice(0, 4)
    .map(bounty => ({
      key: `bounty-${bounty.id}`,
      label: `+${bounty.xp} XP`,
      tone: bounty.tone || 'bounty',
      detail: `${bounty.title}: ${bounty.requirement}`,
    }))
}

export function flattenBounties(board = {}) {
  return [board.featured, ...(board.daily || []), ...(board.weekly || [])].filter(Boolean)
}

export function buildBountyBoard({
  state = {},
  profile = state.profile || {},
  bodyMap = state.bodyMapState || {},
  nextSession = {},
  semantic = null,
  today = getLocalDateString(),
} = {}) {
  const allWorkouts = (state.workouts || profile.workouts || []).map(workout => normalizeSession(workout))
  const todays = dayWorkouts(allWorkouts, today)
  const week = weekWorkouts(allWorkouts, today)
  const dayKey = normalizeDateString(today)
  const weekPeriod = weekKey(today)
  const quest = bodyMap.dailyQuest || {}
  const area = areaFromBalance(nextSession, bodyMap)
  const unlock = bodyMap.priority?.unlock || (bodyMap.unlockTargets || []).find(item => number(item.progress) >= 45 && number(item.progress) < 100) || null
  const pressure = healthPressure({ ...state, profile }, nextSession)
  const currentSemantic = semantic || {}
  const featured = makeBounty({
    id: 'daily_active',
    periodKey: `day:${dayKey}`,
    kind: 'daily_active',
    title: quest.name || nextSession.primaryGoal?.title || 'Bugünün ana görevi',
    body: quest.desc || nextSession.primaryGoal?.subtitle || nextSession.coachCommand || 'Tek temiz adım bugünü kazandırır.',
    requirement: quest.requirement || 'Aktif görevi kapat',
    progress: todays.some(workout => sessionMatchesQuest(workout, quest)) ? 1 : 0,
    total: 1,
    xp: number(quest.xpReward) || number(String(quest.reward || '').match(/\d+/)?.[0]) || 30,
    linkedRegion: quest.linkedRegion || '',
    linkedMovement: quest.linkedMovement || '',
    linkedZone: zoneForQuest(quest),
    tone: quest.safeMode ? 'recovery' : 'featured',
    iconKey: 'bounty',
    detail: quest.why || nextSession.coachCommand || '',
  })

  const daily = [
    makeBounty({
      id: 'streak_guard',
      periodKey: `day:${dayKey}`,
      kind: 'streak_guard',
      title: 'Seriyi Koru',
      body: 'Bugün en az bir temiz kayıt gir.',
      requirement: '1 kayıt',
      progress: todays.length ? 1 : 0,
      total: 1,
      xp: 20,
      linkedZone: 'forge',
      tone: 'streak',
      iconKey: 'streak',
      detail: 'Seri ritmi tek kayıtla yanmaya devam eder.',
    }),
    makeBounty({
      id: 'movement_patrol',
      periodKey: `day:${dayKey}`,
      kind: 'movement_patrol',
      title: 'Rota Devriyesi',
      body: '20 dk hareket veya 2 km rota tamamla.',
      requirement: '20 dk / 2 km',
      progress: movementProgress(todays),
      total: 20,
      xp: 25,
      linkedMovement: 'flow',
      linkedZone: 'endurance',
      tone: 'movement',
      iconKey: 'bounty',
      detail: 'Yürüyüş, parkur, koşu ya da bisiklet bu kapıyı açar.',
    }),
    makeBounty({
      id: 'recovery_contract',
      periodKey: `day:${dayKey}`,
      kind: 'recovery_contract',
      title: pressure.active ? 'Toparlanma Kontratı' : 'Bakım Kontratı',
      body: pressure.active ? 'Can düşmüşse mobilite, yürüyüş veya toparlanma seç.' : '10 dk bakım bloğu ile bedeni temiz tut.',
      requirement: '1 güvenli seçim',
      progress: recoveryProgress(todays),
      total: 1,
      xp: 30,
      linkedMovement: 'mobility',
      linkedZone: 'recovery',
      tone: 'recovery',
      iconKey: 'shield',
      detail: pressure.active ? 'Güvenli seçim bu turda daha değerli.' : 'Bakım kontratı düşük riskli XP verir.',
    }),
    makeBounty({
      id: 'combo_chain',
      periodKey: `day:${dayKey}`,
      kind: 'combo_chain',
      title: 'Zincir Kombo',
      body: 'Aynı kayıtta iki hat bağla: güç+mobilite, hareket+core gibi.',
      requirement: '2 sinyal',
      progress: comboProgress(todays),
      total: 1,
      xp: 40,
      linkedMovement: 'flow',
      linkedZone: 'parkour',
      tone: 'combo',
      iconKey: 'combo',
      detail: `Bugünkü sinyal çeşidi ${currentSemantic.variety || 0}.`,
    }),
  ]

  const weakTotal = area.key === 'core' || area.region === 'core' ? 8 : 3
  const weekly = [
    makeBounty({
      id: 'weak_line',
      periodKey: weekPeriod,
      kind: 'weak_line',
      title: `${area.label} Hattı`,
      body: 'En geride kalan hattı bu hafta öne al.',
      requirement: weakTotal === 8 ? '8 dk core' : '3 set',
      progress: areaProgress(week, area),
      total: weakTotal,
      xp: 35,
      linkedRegion: area.region,
      linkedZone: area.region === 'core' ? 'body' : 'forge',
      tone: 'bounty',
      iconKey: 'bounty',
      detail: 'Denge açığı kapanınca karakter hattı temizlenir.',
    }),
    makeBounty({
      id: 'unlock_gate',
      periodKey: weekPeriod,
      kind: 'unlock_gate',
      title: unlock?.name ? `${unlock.name} Kapısı` : 'Kilit Kapısı',
      body: unlock?.todayStep || unlock?.missing || 'Yakın kilit için teknik blok ekle.',
      requirement: unlock ? `${Math.round(number(unlock.progress))}% kilit` : '1 teknik blok',
      progress: unlock ? (week.some(workout => (
        sessionMatchesMovement(workout, unlock.linkedMovement)
        || (unlock.linkedRegions || []).some(region => sessionMatchesRegion(workout, region))
      )) ? 1 : 0) : 0,
      total: 1,
      xp: 35,
      linkedRegion: unlock?.linkedRegions?.[0] || 'core',
      linkedMovement: unlock?.linkedMovement || 'mobility',
      linkedZone: 'skill',
      tone: 'unlock',
      iconKey: 'unlock',
      detail: unlock ? `${Math.round(number(unlock.progress))}% açık.` : 'Yeni kilit verisi bekleniyor.',
    }),
    makeBounty({
      id: 'core_seal',
      periodKey: weekPeriod,
      kind: 'core_seal',
      title: 'Gövde Mührü',
      body: 'Direkt core sinyali veya 8 dk gövde bloğu ekle.',
      requirement: '1 core izi',
      progress: coreProgress(week),
      total: 1,
      xp: 25,
      linkedRegion: 'core',
      linkedMovement: 'mobility',
      linkedZone: 'body',
      tone: 'stat',
      iconKey: 'combo',
      detail: 'Gövde kilidi hareket kalitesini korur.',
    }),
  ]

  const all = [featured, ...daily, ...weekly]
  return {
    featured,
    daily,
    weekly,
    mapNodes: buildMapNodes(all),
    rewardChips: rewardChips(all),
  }
}

export function evaluateBountyCompletions({
  beforeState = {},
  session = {},
  afterState = {},
  today = normalizeDateString(session.date) || getLocalDateString(),
} = {}) {
  const beforeBoard = buildBountyBoard({ state: beforeState, today })
  const afterBoard = buildBountyBoard({ state: afterState, today })
  const beforeById = new Map(flattenBounties(beforeBoard).map(bounty => [bounty.id, bounty]))
  const rewards = []

  for (const bounty of flattenBounties(afterBoard)) {
    const before = beforeById.get(bounty.id)
    const wasDone = before?.done === true
    const justDone = bounty.done && !wasDone
    if (!justDone || bounty.kind === 'daily_active' || bounty.xp <= 0) continue
    const period = DAILY_KINDS.has(bounty.kind) ? bounty.periodKey : WEEKLY_KINDS.has(bounty.kind) ? bounty.periodKey : ''
    rewards.push({
      id: `${bounty.id}:${period}`,
      bountyId: bounty.id,
      label: bounty.title,
      xp: bounty.xp,
      tone: bounty.tone,
    })
  }

  let remaining = BOUNTY_XP_CAP
  return rewards
    .map(reward => {
      if (remaining <= 0) return null
      const xp = Math.min(remaining, Math.max(0, number(reward.xp)))
      remaining -= xp
      return { ...reward, xp }
    })
    .filter(Boolean)
}
