const REGION_LABELS = {
  chest: 'Gogus',
  shoulder: 'Omuz',
  triceps: 'Triceps',
  biceps: 'Biceps',
  forearm: 'Grip',
  wrist: 'Bilek',
  lat: 'Kanat',
  'upper-back': 'Ust Sirt',
  core: 'Core',
  hips: 'Kalca',
  quads: 'On Bacak',
  hamstrings: 'Arka Zincir',
  calves: 'Kalf',
  knees: 'Diz',
  ankles: 'Ayak Bilegi',
  'lower-back': 'Bel',
}

const REGION_STAT = {
  chest: 'KUV',
  shoulder: 'BEC',
  triceps: 'KUV',
  biceps: 'KUV',
  forearm: 'BEC',
  wrist: 'BEC',
  lat: 'KUV',
  'upper-back': 'GOV',
  core: 'GOV',
  hips: 'CEV',
  quads: 'DAY',
  hamstrings: 'DAY',
  calves: 'STM',
  knees: 'DAY',
  ankles: 'CEV',
  'lower-back': 'GOV',
}

const XP_LABELS = {
  base: 'Ana XP',
  movement: 'Hareket',
  gap: 'Hat kapandi',
  unlock: 'Kilit izi',
  quest: 'Gorev',
  guard: 'Kalkan',
  sleep: 'Onarim',
  heart: 'Stabil',
  safe: 'Guvenli secim',
  recovery: 'Toparlanma',
  form: 'Form',
}

const TECHNICAL_WORDS = /\b(confidence|evidence|source|schema|migration|endpoint)\b|kanit|kanÄ±t|guven|gÃ¼ven/i

function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function number(value, fallback = 0) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function text(value = '', fallback = '') {
  const clean = String(value || '').replace(/\s+/g, ' ').trim()
  return clean || fallback
}

function safeLabel(value = '', fallback = 'Not') {
  const clean = text(value, fallback)
  return TECHNICAL_WORDS.test(clean) ? fallback : clean
}

function formatNumber(value = 0) {
  return Math.round(number(value)).toLocaleString('tr-TR')
}

function xpFromReward(value = '') {
  const match = String(value || '').match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

function regionLabel(id = '') {
  return REGION_LABELS[id] || text(id, 'Ana hat')
}

function statForRegion(id = '') {
  return REGION_STAT[id] || 'STAT'
}

function nearUnlockTarget(bodyMap = {}) {
  const priority = bodyMap.priority?.unlock || null
  if (priority && number(priority.progress) > 0 && number(priority.progress) < 100) return priority
  const targets = Array.isArray(bodyMap.unlockTargets) ? bodyMap.unlockTargets : []
  return targets
    .filter(item => number(item.progress) > 0 && number(item.progress) < 100)
    .sort((left, right) => number(right.progress) - number(left.progress))[0] || null
}

function buildRewardChips({ quest = {}, xpPreview = {}, profile = {}, bodyMap = {}, readiness = {} }) {
  const unlock = nearUnlockTarget(bodyMap)
  const linkedRegion = quest.linkedRegion || bodyMap.priority?.region?.id || ''
  const totalXp = number(xpPreview.total) || number(quest.xpReward) || xpFromReward(quest.reward)
  const streak = profile.streak || {}
  const streakCount = number(streak.current)
  const chips = []

  if (totalXp > 0) {
    const xpDetail = normalizeXpParts(xpPreview)
      .map(part => `+${formatNumber(part.value)} ${part.label}`)
      .join(' / ')
    chips.push({
      key: 'xp',
      label: `+${formatNumber(totalXp)} XP`,
      tone: 'xp',
      detail: xpDetail || quest.reward || 'Bu hamle bugunun odul havuzunu acar.',
    })
  }

  chips.push({
    key: 'stat',
    label: `${statForRegion(linkedRegion)} etkisi`,
    tone: 'stat',
    detail: `${regionLabel(linkedRegion)} hattina dokunur; karakter statlari yeni kayitla guncellenir.`,
  })

  chips.push({
    key: 'streak',
    label: streakCount >= 3 ? `Seri x${streakCount}` : 'Seri koru',
    tone: 'streak',
    detail: streakCount >= 3
      ? `${streakCount} gunluk seri korunuyor. Bugunku kayit ritmi dusurmez.`
      : 'Bugunku kayit seri ritmini baslatir veya korur.',
  })

  if (unlock) {
    chips.push({
      key: 'unlock',
      label: `${Math.round(clamp(unlock.progress))}% kilit`,
      tone: 'unlock',
      detail: `${safeLabel(unlock.name, 'Kilit')} yaklasiyor. ${safeLabel(unlock.todayStep || unlock.missing, 'Kisa teknik blok yeterli.')}`,
    })
  } else if (number(readiness.score) >= 65) {
    chips.push({
      key: 'ready',
      label: 'Tempo acik',
      tone: 'ready',
      detail: `Enerji ${Math.round(clamp(readiness.score))}. Ana hamle icin pencere temiz.`,
    })
  }

  return chips.slice(0, 4)
}

function normalizeMapProgress(bodyMap = {}) {
  const lines = Array.isArray(bodyMap.movementLines) ? bodyMap.movementLines : []
  const unlock = nearUnlockTarget(bodyMap)
  const movement = lines
    .map(line => ({
      key: line.id || line.label,
      label: safeLabel(line.label || line.id, 'Hat'),
      progress: clamp(line.progress ?? line.score),
      detail: safeLabel(line.todayStep || 'Bir temiz mini blok ilerletir.', 'Bir temiz mini blok ilerletir.'),
      tone: line.tone || 'build',
    }))
    .sort((left, right) => right.progress - left.progress)
    .slice(0, 3)

  if (unlock) {
    movement.unshift({
      key: `unlock-${unlock.name}`,
      label: safeLabel(unlock.name, 'Kilit'),
      progress: clamp(unlock.progress),
      detail: safeLabel(unlock.todayStep || unlock.missing, 'Kilit yaklasiyor.'),
      tone: 'unlock',
    })
  }

  return movement.slice(0, 4)
}

function normalizeXpParts(xpPreview = {}) {
  const parts = Array.isArray(xpPreview.parts) ? xpPreview.parts : []
  return parts
    .filter(part => number(part.value) > 0)
    .map(part => ({
      key: part.key || safeLabel(part.label, 'xp'),
      label: XP_LABELS[part.key] || safeLabel(part.label, 'XP'),
      value: number(part.value),
    }))
}

export function buildMissionLoop({
  profile = {},
  bodyMap = {},
  nextSession = {},
  stats = [],
} = {}) {
  const quest = bodyMap.dailyQuest || {}
  const goal = nextSession.primaryGoal || {}
  const xpPreview = bodyMap.xpPreview || {}
  const readiness = nextSession.readiness || {}
  const unlock = nearUnlockTarget(bodyMap)
  const linkedRegion = quest.linkedRegion || bodyMap.priority?.region?.id || ''
  const xp = profile.xp || {}

  return {
    title: 'Mission Loop',
    eyebrow: 'Gorev -> odul -> kayit',
    levelLine: `LVL ${profile.level || 1} / ${formatNumber(xp.current || 0)} XP`,
    xpPct: clamp((number(xp.current) / Math.max(1, number(xp.max, 1))) * 100),
    questTitle: safeLabel(quest.name || quest.title || goal.title, 'Bugunun ana hamlesi'),
    questBody: safeLabel(quest.desc || goal.subtitle || nextSession.coachCommand, 'Tek temiz adim bugunu kazandirir.'),
    questWhy: safeLabel(quest.why || goal.reason || nextSession.coachCommand, 'Bugunku rota son kayit ritmine gore secildi.'),
    ctaLabel: 'Deftere yaz',
    regionLabel: regionLabel(linkedRegion),
    statImpact: statForRegion(linkedRegion),
    rewardChips: buildRewardChips({ quest, xpPreview, profile, bodyMap, readiness }),
    xpParts: normalizeXpParts(xpPreview),
    mapProgress: normalizeMapProgress(bodyMap),
    unlock: unlock
      ? {
          name: safeLabel(unlock.name, 'Kilit'),
          progress: clamp(unlock.progress),
          detail: safeLabel(unlock.todayStep || unlock.missing, 'Kilit yaklasiyor.'),
        }
      : null,
    topStats: [...(stats || [])]
      .sort((left, right) => number(right.value) - number(left.value))
      .slice(0, 3)
      .map(stat => ({
        label: safeLabel(stat.label || stat.short || stat.key, 'Stat'),
        rank: stat.rank || '',
        value: clamp(stat.value),
      })),
  }
}

export function snapshotMissionState(state = {}) {
  return JSON.parse(JSON.stringify({
    profile: state.profile || {},
    badges: state.badges || [],
    achievements: state.achievements || [],
  }))
}

function unlockedIds(state = {}) {
  const ids = new Set()
  for (const badge of state.badges || []) {
    if (badge && (badge.earnedAt || badge.unlocked || badge.locked === false)) ids.add(`badge:${badge.id || badge.name}`)
  }
  for (const achievement of state.achievements || []) {
    if (achievement && achievement.unlocked) ids.add(`ach:${achievement.id || achievement.name}`)
  }
  return ids
}

function statChangeChips(delta = {}) {
  return Object.entries(delta || {})
    .filter(([, value]) => number(value) !== 0)
    .sort((left, right) => Math.abs(number(right[1])) - Math.abs(number(left[1])))
    .slice(0, 2)
    .map(([key, value]) => `${String(key).toUpperCase()} ${number(value) > 0 ? '+' : ''}${formatNumber(value)}`)
}

export function buildRewardRecap({ workout = {}, beforeState = {}, afterState = {} } = {}) {
  const beforeProfile = beforeState.profile || {}
  const afterProfile = afterState.profile || {}
  const xpEarned = number(workout.xpEarned)
  const beforeLevel = number(beforeProfile.level, 1)
  const afterLevel = number(afterProfile.level, beforeLevel)
  const beforeStreak = number(beforeProfile.streak?.current)
  const afterStreak = number(afterProfile.streak?.current, beforeStreak)
  const questClosed = (workout.xpBreakdown || []).some(part => part.key === 'quest' && number(part.value) > 0)
  const beforeUnlocked = unlockedIds(beforeState)
  const afterUnlocked = unlockedIds(afterState)
  const newUnlocks = [...afterUnlocked].filter(id => !beforeUnlocked.has(id))
  const statChips = statChangeChips(workout.statDelta)
  const chips = []

  if (xpEarned > 0) chips.push(`+${formatNumber(xpEarned)} XP`)
  if (afterLevel > beforeLevel) chips.push(`LVL ${afterLevel}`)
  if (questClosed) chips.push('Gorev kapandi')
  if (afterStreak > beforeStreak) chips.push(`Seri ${afterStreak}`)
  if (newUnlocks.length) chips.push(`${newUnlocks.length} rozet`)
  chips.push(...statChips)

  return {
    id: `recap-${Date.now()}`,
    title: afterLevel > beforeLevel ? 'Seviye Atladi' : 'Odul Alindi',
    body: questClosed
      ? 'Kayit gorev dongusunu kapatti. XP, seri ve statlar yeni hale gecti.'
      : 'Kayit deftere girdi. XP ve karakter ritmi guncellendi.',
    chips: chips.slice(0, 6),
    levelUp: afterLevel > beforeLevel,
    questClosed,
  }
}
