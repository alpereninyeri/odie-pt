export const ONTOLOGY_CONCEPTS = [
  { id: 'push', label: 'Push Strength', patterns: ['push', 'bench', 'press', 'dip', 'incline press', 'shoulder press'], tags: ['push', 'gym'], blockKind: 'strength', typeHint: 'Push', score: 4 },
  { id: 'pull', label: 'Pull Strength', patterns: ['pull', 'row', 'curl', 'pulldown', 'lat', 'dead hang'], tags: ['pull', 'gym'], blockKind: 'strength', typeHint: 'Pull', score: 4 },
  { id: 'legs_strength', label: 'Leg Strength', patterns: ['squat', 'lunge', 'leg press', 'calf raise', 'split squat'], tags: ['legs', 'gym'], blockKind: 'strength', typeHint: 'Bacak', score: 4 },
  { id: 'walking', label: 'Outdoor Walk', patterns: ['yuruyus', 'yurume', 'walk', 'hike', 'trek', 'doga yuruyusu', 'trail walk'], tags: ['walking', 'endurance'], blockKind: 'locomotion', typeHint: 'Yuruyus', score: 4 },
  { id: 'running', label: 'Run', patterns: ['kosu', 'run', 'jog', 'interval'], tags: ['legs', 'endurance'], blockKind: 'locomotion', typeHint: 'Kosu', score: 4 },
  { id: 'cycling', label: 'Bike', patterns: ['bisiklet', 'cycling', 'bike'], tags: ['cycling', 'legs', 'endurance'], blockKind: 'locomotion', typeHint: 'Bisiklet', score: 4 },
  { id: 'ski', label: 'Ski', patterns: ['kayak', 'ski'], tags: ['ski', 'legs', 'balance', 'endurance'], blockKind: 'locomotion', typeHint: 'Kayak', score: 4 },
  { id: 'climb', label: 'Climb', patterns: ['tirman', 'climb', 'boulder', 'fingerboard'], tags: ['climbing', 'pull', 'grip'], blockKind: 'skill', typeHint: 'Tirmanis', score: 5 },
  { id: 'parkour', label: 'Parkour Drill', patterns: ['parkour', 'vault antrenmani', 'vault drill'], tags: ['parkour', 'legs', 'balance'], blockKind: 'skill', typeHint: 'Parkour', score: 6 },
  { id: 'vault', label: 'Vault', patterns: ['kong vault', 'speed vault', 'lazy vault', 'dash vault', 'vault'], tags: ['parkour', 'balance', 'explosive'], blockKind: 'skill', typeHint: 'Parkour', score: 5 },
  { id: 'precision', label: 'Precision Jump', patterns: ['precision jump', 'precision'], tags: ['parkour', 'balance', 'explosive', 'legs'], blockKind: 'explosive', typeHint: 'Parkour', score: 5 },
  { id: 'box_jump', label: 'Box Jump', patterns: ['box jump', 'broad jump', 'jump drill'], tags: ['explosive', 'legs'], blockKind: 'explosive', typeHint: 'Parkour', score: 4 },
  { id: 'acro', label: 'Acrobatics', patterns: ['akrobasi', 'acrobatics', 'flip', 'barani', 'round off', 'roundoff'], tags: ['acrobatics', 'balance', 'explosive'], blockKind: 'skill', typeHint: 'Akrobasi', score: 5 },
  { id: 'core', label: 'Core', patterns: ['core', 'plank', 'hollow', 'leg raise', 'hanging leg raise', 'dragon flag', 'caki', 'toes to bar'], tags: ['core'], blockKind: 'core', typeHint: 'Custom', score: 4 },
  { id: 'mobility', label: 'Mobility', patterns: ['mobility', 'esneme', 'stretch', 'bridge', 'split', 'hip flexor'], tags: ['mobility', 'recovery'], blockKind: 'mobility', typeHint: 'Stretching', score: 4 },
  { id: 'recovery', label: 'Recovery', patterns: ['sauna', 'recovery', 'cooldown', 'flush'], tags: ['recovery'], blockKind: 'recovery', typeHint: 'Stretching', score: 3 },
  { id: 'terrain', label: 'Terrain', patterns: ['doga', 'trail', 'orman', 'zemin', 'uphill', 'yokus', 'stairs', 'hill'], tags: ['terrain'], blockKind: 'locomotion', typeHint: 'Custom', score: 2 },
  { id: 'carry', label: 'Carry', patterns: ['carry', 'farmer', 'sandbag'], tags: ['carry', 'grip'], blockKind: 'strength', typeHint: 'Custom', score: 3 },
]

const BLOCK_CATEGORY_MAP = {
  strength: 'strength',
  locomotion: 'endurance',
  core: 'strength',
  mobility: 'recovery',
  recovery: 'recovery',
  explosive: 'movement',
  skill: 'movement',
  mixed: 'mixed',
}

export function normalizeOntologyText(value = '') {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
}

function includesPattern(text, pattern) {
  return text.includes(normalizeOntologyText(pattern))
}

export function detectOntologySignals(input = '') {
  const text = normalizeOntologyText(input)
  if (!text) return []

  return ONTOLOGY_CONCEPTS
    .filter(concept => concept.patterns.some(pattern => includesPattern(text, pattern)))
    .map(concept => ({
      id: concept.id,
      label: concept.label,
      tags: [...concept.tags],
      blockKind: concept.blockKind,
      typeHint: concept.typeHint,
      score: concept.score,
      evidence: String(input || '').trim(),
    }))
}

export function summarizeSignals(signals = []) {
  const seen = new Set()
  return signals
    .filter(signal => {
      if (!signal?.id || seen.has(signal.id)) return false
      seen.add(signal.id)
      return true
    })
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
}

export function deriveTagsFromSignals(signals = []) {
  return [...new Set(summarizeSignals(signals).flatMap(signal => signal.tags || []))]
}

export function deriveTypeFromSignals(signals = [], fallback = 'Custom') {
  const scores = summarizeSignals(signals).reduce((acc, signal) => {
    const key = signal.typeHint || 'Custom'
    acc[key] = (acc[key] || 0) + Number(signal.score || 0)
    return acc
  }, {})

  const ranked = Object.entries(scores)
    .sort((left, right) => right[1] - left[1])
    .map(([type]) => type)

  return ranked[0] || fallback || 'Custom'
}

export function deriveBlockKindFromSignals(signals = [], fallback = 'mixed') {
  const ranked = summarizeSignals(signals)
  return ranked[0]?.blockKind || fallback
}

export function primaryCategoryFromBlockKind(kind = 'mixed') {
  return BLOCK_CATEGORY_MAP[kind] || 'mixed'
}

