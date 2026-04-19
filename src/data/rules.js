export const ISTANBUL_TIME_ZONE = 'Europe/Istanbul'

export const LEGACY_WORKOUT_TYPES = [
  'Push',
  'Pull',
  'Shoulder',
  'Akrobasi',
  'Parkour',
  'Bacak',
  'Yuruyus',
  'Yürüyüş',
  'Stretching',
  'Custom',
]

export const EXTENDED_WORKOUT_TYPES = [
  ...LEGACY_WORKOUT_TYPES,
  'Bisiklet',
  'Kayak',
  'Tırmanış',
  'Calisthenics',
  'Gym',
  'Koşu',
]

export const CANONICAL_TAGS = [
  'push',
  'pull',
  'legs',
  'core',
  'mobility',
  'parkour',
  'acrobatics',
  'walking',
  'cycling',
  'ski',
  'climbing',
  'gym',
  'calisthenics',
  'explosive',
  'balance',
  'grip',
  'carry',
  'terrain',
  'recovery',
  'endurance',
]

export const SESSION_BLOCK_KINDS = [
  'strength',
  'locomotion',
  'core',
  'mobility',
  'explosive',
  'recovery',
  'skill',
  'mixed',
]

export const PRIMARY_CATEGORIES = ['strength', 'movement', 'endurance', 'recovery', 'mixed']
export const INTENSITY_LEVELS = ['low', 'moderate', 'high']

export const CORE_EXERCISE_KEYWORDS = [
  'hollow',
  'l-sit',
  'lsit',
  'plank',
  'dragon flag',
  'dragon',
  'core',
  'ab wheel',
  'crunch',
  'leg raise',
  'hanging leg raise',
  'hlr',
  'v-up',
  'v up',
  'çakı',
  'caki',
  'anti rotation',
  'anti-rotation',
  'pallof',
  'toes to bar',
]

const HANGING_CORE_KEYWORDS = [
  'hanging leg raise',
  'leg raise',
  'hlr',
  'l-sit',
  'lsit',
  'toes to bar',
]

const BODY_TENSION_KEYWORDS = [
  'hollow',
  'dragon flag',
  'dragon',
  'plank',
  'anti rotation',
  'anti-rotation',
  'pallof',
]

const PUSH_KEYWORDS = [
  'bench',
  'press',
  'push-up',
  'push up',
  'dip',
  'fly',
  'triceps pushdown',
  'tricep extension',
]

const PULL_KEYWORDS = [
  'pull-up',
  'pull up',
  'pullup',
  'row',
  'pulldown',
  'lat',
  'curl',
  'dead hang',
  'muscle-up',
  'muscle up',
]

const LEG_KEYWORDS = [
  'squat',
  'lunge',
  'leg press',
  'calf',
  'hamstring',
  'quad',
  'jump squat',
  'step-up',
  'split squat',
  'deadlift',
]

const MOBILITY_KEYWORDS = [
  'stretch',
  'mobility',
  'bridge',
  'split',
  'hip flexor',
  'shoulder flexibility',
]

const GRIP_KEYWORDS = [
  'dead hang',
  'hang',
  'farmer',
  'grip',
  'towel',
  'fingerboard',
  'climb',
]

const BALANCE_KEYWORDS = [
  'balance',
  'barani',
  'flip',
  'landing',
  'roll',
  'round off',
  'slackline',
  'ski',
  'terrain',
]

const EXPLOSIVE_KEYWORDS = [
  'jump',
  'flip',
  'barani',
  'sprint',
  'bound',
  'plyo',
  'muscle-up',
  'muscle up',
  'parkour',
]

const TYPE_ALIASES = {
  walk: 'Yürüyüş',
  walking: 'Yürüyüş',
  yürüyüş: 'Yürüyüş',
  yuruyus: 'Yürüyüş',
  bike: 'Bisiklet',
  bisiklet: 'Bisiklet',
  cycling: 'Bisiklet',
  ski: 'Kayak',
  kayak: 'Kayak',
  climbing: 'Tırmanış',
  tirmanis: 'Tırmanış',
  tırmanış: 'Tırmanış',
  run: 'Koşu',
  koşu: 'Koşu',
  kosu: 'Koşu',
}

const TYPE_BASE_XP = {
  Push: 100,
  Pull: 100,
  Shoulder: 80,
  Bacak: 105,
  Parkour: 120,
  Akrobasi: 120,
  Yürüyüş: 50,
  Yuruyus: 50,
  Stretching: 60,
  Bisiklet: 95,
  Kayak: 110,
  Tırmanış: 115,
  Calisthenics: 100,
  Gym: 95,
  Koşu: 90,
  Custom: 85,
}

const CATEGORY_BASE_XP = {
  strength: 100,
  movement: 120,
  endurance: 85,
  recovery: 55,
  mixed: 95,
}

const DISTANCE_RATES = {
  Yürüyüş: 5,
  Yuruyus: 5,
  Parkour: 6,
  Bisiklet: 18,
  Kayak: 12,
  Koşu: 9,
}

function _number(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

function _uniq(arr) {
  return [...new Set(arr.filter(Boolean))]
}

export function normalizeText(value = '') {
  return String(value)
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
}

function _hasKeyword(text, keywords) {
  return keywords.some(keyword => {
    const normalized = normalizeText(keyword)
    if (!normalized) return false
    if (normalized.includes(' ')) return text.includes(normalized)
    return new RegExp(`(^|[^a-z0-9])${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(text)
  })
}

function _countSetsFromRaw(exercises = []) {
  return exercises.reduce((sum, ex) => sum + (Array.isArray(ex.sets) ? ex.sets.length : (Number(ex.sets) || 0)), 0)
}

function _sumSetSeconds(sets = []) {
  return (sets || []).reduce((sum, set) => sum + (_number(set?.durationSec ?? set?.duration_sec)), 0)
}

function _sumSetLoad(sets = []) {
  return (sets || []).reduce((sum, set) => sum + ((_number(set?.weightKg ?? set?.weight_kg)) * (_number(set?.reps))), 0)
}

function _firstNonEmpty(values = []) {
  return values.find(Boolean) || ''
}

export function getLocalDateString(date = new Date(), timeZone = ISTANBUL_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

export function normalizeDateString(value, fallback = getLocalDateString()) {
  if (!value) return fallback
  const asText = String(value).trim()
  const match = asText.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  const parsed = new Date(asText)
  return Number.isNaN(parsed.getTime()) ? fallback : getLocalDateString(parsed)
}

export function formatMonthShort(dateStr) {
  const normalized = normalizeDateString(dateStr, '')
  if (!normalized) return ''
  const months = ['Ock', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
  const [, month, day] = normalized.match(/^\d{4}-(\d{2})-(\d{2})$/) || []
  if (!month || !day) return normalized
  return `${Number(day)} ${months[Number(month) - 1]}`
}

export function normalizeType(rawType = 'Custom') {
  const trimmed = String(rawType || 'Custom').trim()
  if (!trimmed) return 'Custom'
  const alias = TYPE_ALIASES[normalizeText(trimmed)]
  return alias || trimmed
}

export function normalizeTag(rawTag = '') {
  const normalized = normalizeText(rawTag)
  const map = {
    yürüyüş: 'walking',
    yuruyus: 'walking',
    walk: 'walking',
    bike: 'cycling',
    bisiklet: 'cycling',
    cycling: 'cycling',
    ski: 'ski',
    kayak: 'ski',
    tirmanis: 'climbing',
    climbing: 'climbing',
    tırmanış: 'climbing',
    movement: 'parkour',
    acrobatics: 'acrobatics',
    akrobasi: 'acrobatics',
    strength: 'gym',
  }
  return CANONICAL_TAGS.includes(normalized) ? normalized : (map[normalized] || normalized)
}

export function normalizeExercises(exercises = []) {
  if (!Array.isArray(exercises)) return []
  return exercises
    .map(exercise => {
      if (!exercise) return null
      let sets = exercise.sets
      if (typeof sets === 'number') {
        const reps = Number(exercise.reps) || 0
        const weightKg = Number(exercise.weightKg ?? exercise.weight_kg) || 0
        const durationSec = Number(exercise.durationSec ?? exercise.duration_sec) || 0
        sets = Array.from({ length: sets }, () => ({
          reps: reps || null,
          weightKg: weightKg || null,
          durationSec: durationSec || null,
          note: exercise.note || '',
        }))
      }
      if (!Array.isArray(sets)) sets = []
      return {
        name: String(exercise.name || '').trim(),
        sets: sets.map(set => ({
          reps: set?.reps != null ? Number(set.reps) : null,
          weightKg: set?.weightKg != null || set?.weight_kg != null ? Number(set.weightKg ?? set.weight_kg) : null,
          durationSec: set?.durationSec != null || set?.duration_sec != null ? Number(set.durationSec ?? set.duration_sec) : null,
          note: String(set?.note || '').trim(),
        })),
      }
    })
    .filter(Boolean)
}

export function normalizeBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return []
  return blocks
    .map(block => {
      if (!block) return null
      const kind = String(block.kind || 'mixed').trim()
      if (!SESSION_BLOCK_KINDS.includes(kind)) return null
      return {
        kind,
        label: String(block.label || kind).trim() || kind,
        tags: _uniq((block.tags || []).map(normalizeTag)).filter(tag => CANONICAL_TAGS.includes(tag)),
        sets: Number(block.sets) || 0,
        reps: block.reps != null ? Number(block.reps) : null,
        volumeKg: Number(block.volumeKg ?? block.volume_kg) || 0,
        durationMin: Number(block.durationMin ?? block.duration_min) || 0,
        distanceKm: Number(block.distanceKm ?? block.distance_km) || 0,
        source: String(block.source || 'session').trim() || 'session',
      }
    })
    .filter(Boolean)
}

function mergeBlocks(...collections) {
  const merged = []

  const upsert = (incoming) => {
    if (!incoming) return
    const normalized = normalizeBlocks([incoming])[0]
    if (!normalized) return

    const key = `${normalized.kind}:${normalizeText(normalized.label)}`
    const existing = merged.find(block => `${block.kind}:${normalizeText(block.label)}` === key)
    if (!existing) {
      merged.push({ ...normalized })
      return
    }

    existing.tags = _uniq([...(existing.tags || []), ...(normalized.tags || [])])
    existing.sets = Math.max(Number(existing.sets) || 0, Number(normalized.sets) || 0)
    existing.reps = Math.max(Number(existing.reps) || 0, Number(normalized.reps) || 0) || null
    existing.volumeKg = Math.max(Number(existing.volumeKg) || 0, Number(normalized.volumeKg) || 0)
    existing.durationMin = Math.max(Number(existing.durationMin) || 0, Number(normalized.durationMin) || 0)
    existing.distanceKm = Math.max(Number(existing.distanceKm) || 0, Number(normalized.distanceKm) || 0)
    existing.source = existing.source === 'session' ? existing.source : normalized.source
  }

  for (const collection of collections) {
    for (const block of (collection || [])) upsert(block)
  }

  return merged.map((block, index) => ({ ...block, id: block.id || `${block.kind}-${index}` }))
}

function inferBlockKind({ name = '', tags = [], type = 'Custom', sets = [] } = {}) {
  const normalizedName = normalizeText(name)
  const tagSet = new Set(tags || [])

  if (_hasKeyword(normalizedName, CORE_EXERCISE_KEYWORDS) || tagSet.has('core')) return 'core'
  if (_hasKeyword(normalizedName, MOBILITY_KEYWORDS) || tagSet.has('mobility')) return 'mobility'
  if (_hasKeyword(normalizedName, EXPLOSIVE_KEYWORDS) || tagSet.has('explosive')) return 'explosive'
  if (_hasKeyword(normalizedName, BALANCE_KEYWORDS) || tagSet.has('acrobatics') || tagSet.has('parkour')) return 'skill'
  if (_hasKeyword(normalizedName, ['walk', 'yuruy', 'koşu', 'kosu', 'run', 'bike', 'bisiklet', 'treadmill', 'kayak']) || tagSet.has('walking') || tagSet.has('cycling') || tagSet.has('ski') || tagSet.has('endurance')) {
    return 'locomotion'
  }
  if (_hasKeyword(normalizedName, ['sauna', 'recovery', 'cooldown']) || tagSet.has('recovery')) return 'recovery'
  if (_hasKeyword(normalizedName, [...PUSH_KEYWORDS, ...PULL_KEYWORDS, ...LEG_KEYWORDS]) || tagSet.has('push') || tagSet.has('pull') || tagSet.has('legs') || tagSet.has('gym') || tagSet.has('calisthenics')) {
    return 'strength'
  }
  if (type === 'Stretching') return 'mobility'
  if (type === 'Parkour' || type === 'Akrobasi' || type === 'Tırmanış') return 'skill'
  if (type === 'Yürüyüş' || type === 'Yuruyus' || type === 'Bisiklet' || type === 'Kayak' || type === 'Koşu') return 'locomotion'
  if (sets.length && (_sumSetLoad(sets) > 0 || _countSetsFromRaw([{ sets }]) >= 2)) return 'strength'
  return 'mixed'
}

function buildExerciseBlock(exercise = {}, session = {}) {
  const sets = normalizeExercises([exercise])[0]?.sets || []
  const type = normalizeType(session.type)
  const explicitMatch = normalizeBlocks(session.blocks || [])
    .find(block => normalizeText(block.label) === normalizeText(exercise.name))

  if (explicitMatch) {
    return {
      kind: explicitMatch.kind,
      label: String(exercise.name || explicitMatch.label).trim() || explicitMatch.label,
      tags: explicitMatch.tags || [],
      sets: Math.max(explicitMatch.sets || 0, sets.length),
      reps: sets.reduce((sum, set) => sum + (_number(set.reps)), 0) || explicitMatch.reps || null,
      volumeKg: Math.max(Math.round(_sumSetLoad(sets)), explicitMatch.volumeKg || 0),
      durationMin: Math.max(Math.round(_sumSetSeconds(sets) / 60) || 0, explicitMatch.durationMin || 0),
      distanceKm: explicitMatch.distanceKm || 0,
      source: explicitMatch.source || 'exercise',
    }
  }

  const blockTags = inferTags({
    ...session,
    type,
    exercises: [{ name: exercise.name, sets }],
    tags: [],
    highlight: '',
    notes: '',
    blocks: [],
  })
  const kind = inferBlockKind({
    name: exercise.name,
    tags: blockTags,
    type,
    sets,
  })
  return {
    kind,
    label: String(exercise.name || kind).trim() || kind,
    tags: blockTags.filter(tag => CANONICAL_TAGS.includes(tag)).slice(0, 6),
    sets: sets.length,
    reps: sets.reduce((sum, set) => sum + (_number(set.reps)), 0) || null,
    volumeKg: Math.round(_sumSetLoad(sets)),
    durationMin: Math.round(_sumSetSeconds(sets) / 60) || 0,
    distanceKm: 0,
    source: 'exercise',
  }
}

function buildFallbackBlocks(normalized = {}) {
  const tagSet = new Set(normalized.tags || [])
  const blocks = []

  const locomotionBlock = (tagSet.has('walking') || tagSet.has('cycling') || tagSet.has('ski') || normalized.primaryCategory === 'endurance')
    ? {
      kind: 'locomotion',
      label: normalized.type,
      tags: normalized.tags.filter(tag => ['walking', 'cycling', 'ski', 'endurance', 'terrain'].includes(tag)),
      sets: 0,
      reps: null,
      volumeKg: 0,
      durationMin: normalized.durationMin || 0,
      distanceKm: normalized.distanceKm || 0,
      source: 'session',
    }
    : null
  if (locomotionBlock) blocks.push(locomotionBlock)

  if (tagSet.has('push') || tagSet.has('pull') || tagSet.has('gym') || tagSet.has('calisthenics') || normalized.primaryCategory === 'strength') {
    blocks.push({
      kind: 'strength',
      label: normalized.type,
      tags: normalized.tags.filter(tag => ['push', 'pull', 'gym', 'calisthenics'].includes(tag)),
      sets: normalized.sets || 0,
      reps: null,
      volumeKg: normalized.volumeKg || 0,
      durationMin: normalized.durationMin || 0,
      distanceKm: 0,
      source: 'session',
    })
  }

  if (tagSet.has('core')) {
    blocks.push({
      kind: 'core',
      label: 'Core Block',
      tags: normalized.tags.filter(tag => ['core', 'carry', 'terrain'].includes(tag)),
      sets: 0,
      reps: null,
      volumeKg: 0,
      durationMin: 0,
      distanceKm: 0,
      source: 'session',
    })
  }

  if (tagSet.has('mobility') || normalized.primaryCategory === 'recovery') {
    blocks.push({
      kind: 'mobility',
      label: normalized.type === 'Stretching' ? 'Mobility' : normalized.type,
      tags: normalized.tags.filter(tag => ['mobility', 'recovery'].includes(tag)),
      sets: 0,
      reps: null,
      volumeKg: 0,
      durationMin: normalized.primaryCategory === 'recovery' ? (normalized.durationMin || 0) : 0,
      distanceKm: 0,
      source: 'session',
    })
  }

  if (tagSet.has('explosive') || tagSet.has('parkour') || tagSet.has('acrobatics')) {
    blocks.push({
      kind: tagSet.has('explosive') ? 'explosive' : 'skill',
      label: _firstNonEmpty([normalized.highlight, normalized.type, 'Movement Block']),
      tags: normalized.tags.filter(tag => ['explosive', 'parkour', 'acrobatics', 'balance'].includes(tag)),
      sets: 0,
      reps: null,
      volumeKg: 0,
      durationMin: 0,
      distanceKm: 0,
      source: 'session',
    })
  }

  return blocks
}

export function deriveSessionBlocks(session = {}) {
  const normalized = {
    ...session,
    type: normalizeType(session.type),
    tags: session.tags || inferTags(session),
    distanceKm: Number(session.distanceKm ?? session.distance_km) || 0,
    durationMin: Number(session.durationMin ?? session.duration_min) || 0,
    volumeKg: Number(session.volumeKg ?? session.volume_kg) || 0,
    sets: Number(session.sets) || _countSetsFromRaw(session.exercises || []),
    exercises: normalizeExercises(session.exercises || []),
    highlight: session.highlight || '',
    notes: session.notes || '',
  }
  const explicitBlocks = normalizeBlocks(session.blocks || [])

  const exerciseBlocks = normalized.exercises.map(exercise => buildExerciseBlock(exercise, normalized))
    .filter(block => block.label && SESSION_BLOCK_KINDS.includes(block.kind))

  const fallbackBlocks = buildFallbackBlocks(normalized)
  const occupiedKinds = new Set([...explicitBlocks, ...exerciseBlocks].map(block => block.kind))
  const filteredFallbackBlocks = explicitBlocks.length
    ? fallbackBlocks.filter(block => !occupiedKinds.has(block.kind))
    : fallbackBlocks

  return mergeBlocks(explicitBlocks, exerciseBlocks, filteredFallbackBlocks)
}

export function countAllSets(sessionOrExercises) {
  const exercises = Array.isArray(sessionOrExercises)
    ? sessionOrExercises
    : normalizeExercises(sessionOrExercises?.exercises || [])
  return exercises.reduce((sum, ex) => sum + ex.sets.length, 0)
}

function _sessionTextParts(input) {
  return [
    input.type,
    input.highlight,
    input.notes,
    ...(input.blocks || []).map(block => `${block.kind} ${block.label} ${(block.tags || []).join(' ')}`),
    ...(input.evidence || []),
    ...(input.facts || []).map(fact => `${fact.label || ''} ${fact.raw || ''}`.trim()),
    ...(input.exercises || []).map(ex => ex.name),
    ...(input.tags || []),
  ]
}

function _addTypeTags(tags, type) {
  switch (type) {
    case 'Push':
      tags.push('push', 'gym')
      break
    case 'Pull':
      tags.push('pull', 'gym')
      break
    case 'Shoulder':
      tags.push('push', 'gym')
      break
    case 'Bacak':
      tags.push('legs', 'gym')
      break
    case 'Parkour':
      tags.push('parkour', 'legs', 'explosive', 'balance', 'endurance')
      break
    case 'Akrobasi':
      tags.push('acrobatics', 'balance', 'explosive')
      break
    case 'Yürüyüş':
    case 'Yuruyus':
      tags.push('walking', 'endurance', 'recovery')
      break
    case 'Stretching':
      tags.push('mobility', 'recovery')
      break
    case 'Bisiklet':
      tags.push('cycling', 'legs', 'endurance')
      break
    case 'Kayak':
      tags.push('ski', 'legs', 'balance', 'endurance')
      break
    case 'Tırmanış':
      tags.push('climbing', 'pull', 'grip')
      break
    case 'Calisthenics':
      tags.push('calisthenics')
      break
    case 'Gym':
      tags.push('gym')
      break
    case 'Koşu':
      tags.push('legs', 'endurance')
      break
  }
}

export function inferTags(input = {}) {
  const exercises = normalizeExercises(input.exercises || [])
  const blocks = normalizeBlocks(input.blocks || [])
  const tags = [
    ...(input.tags || []).map(normalizeTag),
    ...blocks.flatMap(block => block.tags || []),
  ]
  const type = normalizeType(input.type)
  const text = normalizeText(_sessionTextParts({ ...input, exercises, blocks }).join(' '))

  _addTypeTags(tags, type)

  if (_hasKeyword(text, PUSH_KEYWORDS)) tags.push('push', 'gym')
  if (_hasKeyword(text, PULL_KEYWORDS)) tags.push('pull')
  if (_hasKeyword(text, LEG_KEYWORDS)) tags.push('legs', 'gym')
  if (_hasKeyword(text, CORE_EXERCISE_KEYWORDS)) tags.push('core')
  if (_hasKeyword(text, MOBILITY_KEYWORDS)) tags.push('mobility', 'recovery')
  if (_hasKeyword(text, GRIP_KEYWORDS)) tags.push('grip')
  if (_hasKeyword(text, BALANCE_KEYWORDS)) tags.push('balance')
  if (_hasKeyword(text, EXPLOSIVE_KEYWORDS)) tags.push('explosive')
  if (text.includes('parkour')) tags.push('parkour')
  if (_hasKeyword(text, ['acro', 'akro', 'flip', 'barani', 'round off', 'front flip'])) tags.push('acrobatics')
  if (_hasKeyword(text, ['bike', 'cycling', 'bisiklet'])) tags.push('cycling', 'legs', 'endurance')
  if (_hasKeyword(text, ['ski', 'kayak'])) tags.push('ski', 'legs', 'balance', 'endurance')
  if (_hasKeyword(text, ['climb', 'tırman', 'tirman', 'boulder'])) tags.push('climbing', 'pull', 'grip')
  if (_hasKeyword(text, ['carry', 'sandbag', 'farmers', 'farmer'])) tags.push('carry')
  if (_hasKeyword(text, ['terrain', 'trail', 'stairs', 'hill', 'uphill', 'zemin'])) tags.push('terrain')
  if (_hasKeyword(text, ['walk', 'walking', 'yuruyus', 'yürüyüş'])) tags.push('walking', 'endurance')
  if (_hasKeyword(text, ['run', 'kosu', 'koşu', 'jog'])) tags.push('legs', 'endurance')
  if (_hasKeyword(text, ['recovery', 'deload', 'flush'])) tags.push('recovery')

  if (tags.includes('pull') && !tags.includes('gym') && type === 'Calisthenics') {
    tags.push('calisthenics')
  }
  if ((tags.includes('push') || tags.includes('pull')) && type === 'Calisthenics') {
    tags.push('calisthenics')
  }

  return _uniq(tags.filter(tag => CANONICAL_TAGS.includes(tag)))
}

export function inferPrimaryCategory(input = {}) {
  const type = normalizeType(input.type)
  const tags = new Set(input.tags || inferTags(input))
  const blocks = normalizeBlocks(input.blocks || [])

  if (blocks.length) {
    const scores = { strength: 0, movement: 0, endurance: 0, recovery: 0 }

    for (const block of blocks) {
      const weight = 1
        + ((Number(block.sets) || 0) / 6)
        + ((Number(block.durationMin) || 0) / 35)
        + ((Number(block.distanceKm) || 0) / 2.5)
        + ((Number(block.volumeKg) || 0) / 2500)

      switch (block.kind) {
        case 'strength':
          scores.strength += weight * 1.3
          break
        case 'core':
          scores.strength += weight * 0.7
          scores.movement += weight * 0.2
          break
        case 'locomotion':
          scores.endurance += weight * 1.4
          break
        case 'skill':
          scores.movement += weight * 1.35
          break
        case 'explosive':
          scores.movement += weight * 1.2
          scores.endurance += weight * 0.15
          break
        case 'mobility':
        case 'recovery':
          scores.recovery += weight * 1.35
          break
        default:
          scores.strength += weight * 0.25
          scores.movement += weight * 0.25
          scores.endurance += weight * 0.25
          break
      }
    }

    const ranked = Object.entries(scores).sort((left, right) => right[1] - left[1])
    const [winnerKey, winnerScore] = ranked[0] || []
    const runnerUpScore = ranked[1]?.[1] || 0
    if (winnerScore > 0) {
      if (runnerUpScore > 0 && Math.abs(winnerScore - runnerUpScore) < 0.85) return 'mixed'
      return winnerKey
    }
  }

  if (type === 'Stretching') return 'recovery'
  if (type === 'Yürüyüş' || type === 'Yuruyus' || type === 'Bisiklet' || type === 'Kayak' || type === 'Koşu') return 'endurance'
  if (type === 'Parkour' || type === 'Akrobasi' || type === 'Tırmanış') return 'movement'
  if (type === 'Push' || type === 'Pull' || type === 'Shoulder' || type === 'Bacak' || type === 'Calisthenics' || type === 'Gym') return 'strength'

  const hasStrength = ['push', 'pull', 'gym', 'calisthenics', 'legs'].some(tag => tags.has(tag))
  const hasMovement = ['parkour', 'acrobatics', 'climbing', 'explosive', 'balance'].some(tag => tags.has(tag))
  const hasEndurance = ['walking', 'cycling', 'ski', 'endurance'].some(tag => tags.has(tag))
  const isRecovery = tags.has('recovery') || tags.has('mobility')

  if (isRecovery && !hasStrength && !hasMovement) return 'recovery'
  if (hasMovement && !hasStrength && !hasEndurance) return 'movement'
  if (hasEndurance && !hasStrength && !hasMovement) return 'endurance'
  if (hasStrength && !hasMovement && !hasEndurance) return 'strength'
  return 'mixed'
}

export function inferIntensity(input = {}) {
  if (INTENSITY_LEVELS.includes(input.intensity)) return input.intensity
  const durationMin = Number(input.durationMin ?? input.duration_min) || 0
  const volumeKg = Number(input.volumeKg ?? input.volume_kg) || 0
  const sets = Number(input.sets) || countAllSets(input)
  const type = normalizeType(input.type)
  const primaryCategory = input.primaryCategory || inferPrimaryCategory(input)

  if (primaryCategory === 'recovery') return 'low'
  if (input.hasPr || volumeKg >= 4500 || durationMin >= 120 || sets >= 22) return 'high'
  if (type === 'Parkour' && durationMin >= 90) return 'high'
  if (primaryCategory === 'endurance' && durationMin >= 95) return 'high'
  if (durationMin >= 55 || volumeKg >= 2500 || sets >= 12) return 'moderate'
  return 'low'
}

export function estimateDistanceKm(input = {}) {
  const explicit = Number(input.distanceKm ?? input.distance_km)
  if (explicit > 0) return explicit
  const type = normalizeType(input.type)
  const durationMin = Number(input.durationMin ?? input.duration_min) || 0
  const rate = DISTANCE_RATES[type] || 0
  if (!rate || !durationMin) return 0
  return Math.round((durationMin / 60) * rate * 10) / 10
}

export function normalizeSession(session = {}, { source = 'manual', now = new Date() } = {}) {
  const exercises = normalizeExercises(session.exercises || [])
  const type = normalizeType(session.type)
  const date = normalizeDateString(session.date, getLocalDateString(now))
  const startedAt = session.startedAt || session.started_at || session.createdAt || session.created_at || now.toISOString()
  const normalized = {
    ...session,
    type,
    date,
    source: session.source || source,
    startedAt,
    createdAt: session.createdAt || session.created_at || now.toISOString(),
    durationMin: Number(session.durationMin ?? session.duration_min) || 0,
    volumeKg: Number(session.volumeKg ?? session.volume_kg) || 0,
    highlight: String(session.highlight || '').trim(),
    notes: String(session.notes || '').trim(),
    hasPr: Boolean(session.hasPr ?? session.has_pr),
    exercises,
    evidence: Array.isArray(session.evidence) ? session.evidence.map(item => String(item || '').trim()).filter(Boolean) : [],
    facts: Array.isArray(session.facts) ? session.facts : [],
    sets: Number(session.sets) || _countSetsFromRaw(exercises),
    distanceKm: Number(session.distanceKm ?? session.distance_km) || 0,
    elevationM: Number(session.elevationM ?? session.elevation_m) || 0,
  }

  const estimatedDistanceKm = estimateDistanceKm(normalized)
  const blocks = deriveSessionBlocks({ ...normalized, distanceKm: estimatedDistanceKm, tags: session.tags || [], blocks: session.blocks || [] })
  const tags = inferTags({ ...normalized, tags: session.tags || [], blocks })
  const primaryCategory = inferPrimaryCategory({ ...normalized, tags, blocks })
  const intensity = inferIntensity({ ...normalized, tags, primaryCategory })
  const distanceKm = estimateDistanceKm({ ...normalized, tags })

  return {
    ...normalized,
    tags,
    primaryCategory,
    intensity,
    distanceKm,
    blocks,
  }
}

export function isCoreExercise(name = '') {
  const normalized = normalizeText(name)
  return _hasKeyword(normalized, CORE_EXERCISE_KEYWORDS)
}

export function countCoreSets(session = {}) {
  const exercises = normalizeExercises(session.exercises || [])
  return exercises.reduce((sum, ex) => sum + (isCoreExercise(ex.name) ? ex.sets.length : 0), 0)
}

export function hasDirectCoreStimulus(session = {}) {
  return countCoreSets(session) > 0
}

function _hasMatchingExercise(session, keywords) {
  const exercises = normalizeExercises(session.exercises || [])
  return exercises.some(ex => _hasKeyword(normalizeText(ex.name), keywords))
}

export function hasAdvancedCoreStimulus(session = {}) {
  return _hasMatchingExercise(session, HANGING_CORE_KEYWORDS) || _hasMatchingExercise(session, BODY_TENSION_KEYWORDS)
}

export function hasLegFocus(session = {}) {
  const normalized = normalizeSession(session)
  return normalized.tags.includes('legs') || normalized.type === 'Bacak' || normalized.primaryCategory === 'endurance'
}

export function computeSessionStatDelta(session = {}) {
  const normalized = normalizeSession(session)
  const tags = new Set(normalized.tags)
  const blocks = normalizeBlocks(normalized.blocks || [])
  const delta = { str: 0, agi: 0, end: 0, dex: 0, con: 0, sta: 0 }

  if (blocks.length) {
    for (const block of blocks) {
      const blockTags = new Set(block.tags || [])
      switch (block.kind) {
        case 'strength':
          delta.str += 1.8
          if (blockTags.has('legs')) delta.sta += 0.8
          break
        case 'locomotion':
          delta.end += 2
          delta.sta += 2
          if (blockTags.has('terrain') || blockTags.has('balance')) delta.dex += 1
          break
        case 'skill':
          delta.agi += 2
          delta.dex += 2
          delta.sta += 1
          break
        case 'explosive':
          delta.agi += 1
          delta.dex += 1
          delta.sta += 1
          break
        case 'core':
          delta.con += 2
          break
      }
    }
  } else {
    switch (normalized.primaryCategory) {
      case 'strength':
        delta.str += 2
        if (tags.has('legs')) delta.sta += 1
        break
      case 'movement':
        delta.agi += 2
        delta.dex += 2
        delta.sta += 1
        if (normalized.durationMin >= 90) delta.end += 1
        break
      case 'endurance':
        delta.end += 2
        delta.sta += 2
        if (tags.has('balance') || tags.has('terrain')) delta.dex += 1
        break
      case 'mixed':
        delta.str += 1
        delta.agi += 1
        delta.dex += 1
        delta.sta += 1
        break
    }
  }

  const hasCoreBlock = blocks.some(block => block.kind === 'core')
  const hasSkillBlock = blocks.some(block => block.kind === 'skill')
  const hasExplosiveBlock = blocks.some(block => block.kind === 'explosive')

  if (!hasCoreBlock && hasDirectCoreStimulus(normalized)) {
    delta.con += 2
  }
  if (hasAdvancedCoreStimulus(normalized)) {
    delta.con += 1
  } else if (!hasDirectCoreStimulus(normalized) && (tags.has('carry') || tags.has('terrain'))) {
    delta.con += 1
  }

  if (normalized.type === 'Parkour' && hasExplosiveBlock && !hasSkillBlock) {
    delta.agi = Math.max(delta.agi, 2)
    delta.dex = Math.max(delta.dex, 2)
    delta.sta = Math.max(delta.sta, 1)
  }

  if (tags.has('grip') && (normalized.primaryCategory === 'movement' || normalized.primaryCategory === 'strength')) {
    delta.dex += 1
  }

  Object.keys(delta).forEach(key => {
    delta[key] = Math.max(0, Math.min(3, delta[key]))
  })
  return delta
}

export function applyStatDelta(currentStats = {}, delta = {}) {
  const next = {}
  for (const key of ['str', 'agi', 'end', 'dex', 'con', 'sta']) {
    const current = Number(currentStats[key]) || 0
    const change = Number(delta[key]) || 0
    next[key] = Math.max(0, Math.min(100, Math.round((current + change) * 10) / 10))
  }
  return next
}

export function streakMultiplier(days = 0) {
  if (days >= 30) return 2.0
  if (days >= 14) return 1.5
  if (days >= 7) return 1.25
  if (days >= 3) return 1.1
  return 1.0
}

export function streakLabel(days = 0) {
  if (days >= 30) return 'Efsane'
  if (days >= 14) return 'Durdurulamaz'
  if (days >= 7) return 'Yanıyor'
  if (days >= 3) return 'Ateşlendi'
  return ''
}

function _dayDiff(dateA, dateB) {
  const a = new Date(`${normalizeDateString(dateA)}T00:00:00`)
  const b = new Date(`${normalizeDateString(dateB)}T00:00:00`)
  return Math.round((b - a) / 86400000)
}

function _dateList(workoutsOrDates = []) {
  return _uniq(
    workoutsOrDates.map(item => (typeof item === 'string' ? normalizeDateString(item) : normalizeDateString(item.date))).filter(Boolean)
  ).sort((a, b) => a.localeCompare(b))
}

export function computeStreakInfo(workoutsOrDates = [], newDate) {
  const dates = _dateList([...workoutsOrDates, newDate])
  if (!dates.length) {
    return { current: 0, max: 0, lastWorkoutDate: normalizeDateString(newDate), multiplier: 1, label: '' }
  }

  let current = 1
  for (let index = dates.length - 2; index >= 0; index -= 1) {
    if (_dayDiff(dates[index], dates[index + 1]) <= 1) current += 1
    else break
  }

  let max = 1
  let running = 1
  for (let index = 1; index < dates.length; index += 1) {
    if (_dayDiff(dates[index - 1], dates[index]) <= 1) running += 1
    else running = 1
    if (running > max) max = running
  }

  return {
    current,
    max,
    lastWorkoutDate: normalizeDateString(newDate),
    multiplier: streakMultiplier(current),
    label: streakLabel(current),
  }
}

export function checkStreakHealth(streak, today = getLocalDateString()) {
  if (!streak?.lastWorkoutDate) return streak
  const gap = _dayDiff(streak.lastWorkoutDate, today)
  if (gap > 1) {
    return { ...streak, current: 0, multiplier: 1, label: '' }
  }
  return streak
}

export function isDoubleSession(workouts = [], date) {
  return workouts.filter(workout => normalizeDateString(workout.date) === normalizeDateString(date)).length >= 1
}

export function computeSessionXp(session = {}, context = {}) {
  const normalized = normalizeSession(session)
  const streakDays = Number(context.streakDays) || 0
  const classMultiplier = Number(context.classMultiplier) || 1
  const survivalMultiplier = Number(context.survivalMultiplier) || 1
  const prBonusMultiplier = Number(context.prBonusMultiplier) || 1
  const doubleSession = Boolean(context.doubleSession)
  const baseXp = TYPE_BASE_XP[normalized.type] || CATEGORY_BASE_XP[normalized.primaryCategory] || TYPE_BASE_XP.Custom
  const base = Math.round(baseXp * streakMultiplier(streakDays) * classMultiplier * survivalMultiplier)

  let bonus = 0
  if (survivalMultiplier > 0) {
    if (normalized.hasPr) bonus += Math.round(50 * prBonusMultiplier)
    if (hasDirectCoreStimulus(normalized)) bonus += 20
    if (doubleSession) bonus += 30
  }

  return {
    baseXp,
    streakMult: streakMultiplier(streakDays),
    xpEarned: Math.max(0, base + bonus),
  }
}

export function summarizeWorkoutTags(session = {}) {
  const normalized = normalizeSession(session)
  return normalized.tags.slice(0, 5).map(tag => tag.toUpperCase())
}

export function isMovementSession(session = {}) {
  return normalizeSession(session).primaryCategory === 'movement'
}
