import { computeClass } from './class-engine.js'

const DEFAULT_LOOKBACK = 10

export const CLASS_TRACK_FAMILIES = Object.freeze({
  golge_akrobat: Object.freeze([
    'Gölgede Isınan',
    'Çevik Gölge',
    'Gölge Akrobat',
    'Gece Ustası',
  ]),
  gok_kartali: Object.freeze([
    'Kartal İzi',
    'Yükselen Kanat',
    'Gök Kartalı',
    'Fırtına Kartalı',
  ]),
  duvar_orucu: Object.freeze([
    'Duvar Çırağı',
    'Hat Dokuyucu',
    'Duvar Örücü',
    'Şehir Dokuyucusu',
  ]),
  vinc_gezgini: Object.freeze([
    'Rota İzi',
    'Yüksek Adım',
    'Vinç Gezgini',
    'Çatı Hakimi',
  ]),
  ayi_pencesi: Object.freeze([
    'Ayı İzi',
    'Ayı Tırnağı',
    'Ayı Pençesi',
    'Demir Pençe',
  ]),
  celik_omurga: Object.freeze([
    'Demir İskelet',
    'Taşıyıcı Omurga',
    'Çelik Omurga',
    'Titan Omurga',
  ]),
  cekirdek_alevi: Object.freeze([
    'Kor Çekirdek',
    'Yanan Merkez',
    'Çekirdek Alevi',
    'Gövde Volkanı',
  ]),
  ruzgar_kosucusu: Object.freeze([
    'Rüzgar İzi',
    'Hızlanan Adım',
    'Rüzgar Koşucusu',
    'Fırtına Koşucusu',
  ]),
  mermer_heykel: Object.freeze([
    'Ham Taş',
    'Yontulan Form',
    'Mermer Heykel',
    'Canlı Mermer',
  ]),
  golge_gezgini: Object.freeze([
    'Gece İzi',
    'Sessiz Adım',
    'Gölge Gezgini',
    'Gece Avcısı',
  ]),
  merakli_ruh: Object.freeze([
    'Merak Kıvılcımı',
    'Yol Toplayıcı',
    'Meraklı Ruh',
    'Bin Yol Gezgini',
  ]),
})

const APPRENTICE_TITLES = Object.freeze([
  'Uyanan İz',
  'Yol Arayan',
  'Çırak',
  'İlk Form',
])

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function workoutTimestamp(workout = {}) {
  const value = workout.startedAt || workout.createdAt || workout.date
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function newestFirst(workouts = []) {
  return (Array.isArray(workouts) ? workouts : [])
    .map((workout, index) => ({ workout, index }))
    .sort((left, right) => (
      workoutTimestamp(right.workout) - workoutTimestamp(left.workout)
      || left.index - right.index
    ))
    .map(item => item.workout)
}

function affinityFromClass(classState = {}) {
  if (classState.id === 'cirak' || classState.evolving) {
    return Math.round(clamp(24 + (clamp(classState.progress, 0, 1) * 28), 24, 52))
  }

  const score = Math.max(0, Number(classState.matchScore) || 0)
  const runnerUpScore = Math.max(0, Number(classState.runnerUp?.score) || 0)
  const scoreCurve = 44 + (43 * (1 - Math.exp(-score / 5)))
  const marginBoost = clamp((score - runnerUpScore) * 2, -4, 6)
  return Math.round(clamp(scoreCurve + marginBoost, 35, 96))
}

function stageIndexForAffinity(affinity, evolving = false) {
  if (evolving) {
    if (affinity >= 50) return 2
    if (affinity >= 40) return 1
    return 0
  }
  if (affinity >= 82) return 3
  if (affinity >= 68) return 2
  if (affinity >= 56) return 1
  return 0
}

function smallDelta(currentClass, previousClass, currentAffinity, previousAffinity) {
  if (!previousClass || previousClass.evolving) return 0
  if (currentClass.id !== previousClass.id) return 0

  const affinityDiff = currentAffinity - previousAffinity
  let delta = Math.round(affinityDiff / 2)
  const scoreDiff = (Number(currentClass.matchScore) || 0) - (Number(previousClass.matchScore) || 0)

  if (delta === 0 && Math.abs(scoreDiff) >= 0.03) delta = Math.sign(scoreDiff)
  return Math.round(clamp(delta, -3, 3))
}

export function buildClassTrack(workouts = [], { currentClass = null } = {}) {
  const ordered = newestFirst(workouts)
  const resolvedCurrent = currentClass || computeClass(ordered)
  const lookback = Math.max(1, Number(resolvedCurrent.lookback) || DEFAULT_LOOKBACK)
  const previousWindow = ordered.slice(1, lookback + 1)
  const previousClass = previousWindow.length >= lookback
    ? computeClass(previousWindow)
    : null

  const affinity = affinityFromClass(resolvedCurrent)
  const previousAffinity = previousClass ? affinityFromClass(previousClass) : affinity
  const delta = smallDelta(resolvedCurrent, previousClass, affinity, previousAffinity)
  const familyTitles = CLASS_TRACK_FAMILIES[resolvedCurrent.id] || APPRENTICE_TITLES
  const stageIndex = stageIndexForAffinity(affinity, Boolean(resolvedCurrent.evolving))
  const displayTitle = familyTitles[stageIndex] || resolvedCurrent.name || 'Çırak'

  return {
    familyId: resolvedCurrent.id || 'cirak',
    familyName: resolvedCurrent.name || 'Çırak',
    displayTitle,
    stage: ['seed', 'rising', 'formed', 'apex'][stageIndex],
    stageIndex: stageIndex + 1,
    stageCount: familyTitles.length,
    affinity,
    previousAffinity,
    delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'steady',
    lookback,
    runnerUp: resolvedCurrent.runnerUp
      ? {
          id: resolvedCurrent.runnerUp.id,
          name: resolvedCurrent.runnerUp.name,
        }
      : null,
  }
}

export const classTrackInternals = {
  affinityFromClass,
  newestFirst,
  smallDelta,
  stageIndexForAffinity,
}
