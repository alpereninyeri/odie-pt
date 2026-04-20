import {
  deriveBlockKindFromSignals,
  deriveTagsFromSignals,
  deriveTypeFromSignals,
  detectBodyRegions,
  detectModifiers,
  detectOntologySignals,
  detectRiskSignals,
  normalizeOntologyText,
} from './sports-ontology.js'

// ── Time / distance parsers ────────────────────────────────────────────────
export function parseMinutes(text = '') {
  const normalized = normalizeOntologyText(text)
  let minutes = 0

  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:saat|hr|hour)/)
  if (hourMatch) minutes += Math.round(Number(hourMatch[1].replace(',', '.')) * 60)

  const minuteMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:dk|min|dakika)\b/)
  if (minuteMatch) minutes += Math.round(Number(minuteMatch[1].replace(',', '.')))

  return minutes
}

export function parseSecondsHold(text = '') {
  const normalized = normalizeOntologyText(text)
  if (!normalized) return 0

  const secMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:sn|sec|saniye|s)\b/)
  if (secMatch) return Math.round(Number(secMatch[1].replace(',', '.')))

  const colonMatch = normalized.match(/\b(\d{1,2}):([0-5]\d)\b/)
  if (colonMatch) return Number(colonMatch[1]) * 60 + Number(colonMatch[2])

  return 0
}

export function parseDistanceKm(text = '') {
  const raw = String(text || '')

  const kmMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*km\b/i)
  if (kmMatch) return Number(kmMatch[1].replace(',', '.'))

  const mileMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:mil|mi|mile|miles)\b/i)
  if (mileMatch) return Math.round(Number(mileMatch[1].replace(',', '.')) * 1.60934 * 100) / 100

  const meterMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*(?:metre|m)\b(?!in|i\b)/i)
  if (meterMatch) {
    const meters = Number(meterMatch[1].replace(',', '.'))
    if (meters >= 50) return Math.round(meters / 10) / 100
  }

  return 0
}

export function parseDistance(text = '') {
  return parseDistanceKm(text)
}

// ── Set / rep / load parsers ───────────────────────────────────────────────
export function parseSetsXReps(text = '') {
  const normalized = normalizeOntologyText(text)
  if (!normalized) return null

  const numXNum = normalized.match(/\b(\d{1,2})\s*[x×]\s*(\d{1,3})(?:\s*[x×]\s*(\d+(?:[.,]\d+)?))?/)
  if (numXNum) {
    const sets = Number(numXNum[1])
    const reps = Number(numXNum[2])
    const weight = numXNum[3] ? Number(numXNum[3].replace(',', '.')) : null
    if (sets >= 1 && sets <= 30 && reps >= 1 && reps <= 200) {
      return { sets, reps, weight_kg: weight }
    }
  }

  const setRep = normalized.match(/(\d{1,2})\s*set\b.*?(\d{1,3})\s*(?:tekrar|rep|reps)\b/)
  if (setRep) {
    return { sets: Number(setRep[1]), reps: Number(setRep[2]), weight_kg: null }
  }

  return null
}

export function parseRPE(text = '') {
  const normalized = normalizeOntologyText(text)
  if (!normalized) return null

  const rpe = normalized.match(/\brpe\s*(\d+(?:[.,]\d+)?)/) || normalized.match(/@\s*(\d+(?:[.,]\d+)?)/)
  const rir = normalized.match(/\brir\s*(\d+)/)

  const result = {}
  if (rpe) result.rpe = Number(rpe[1].replace(',', '.'))
  if (rir) result.rir = Number(rir[1])
  return Object.keys(result).length ? result : null
}

export function parsePercent1RM(text = '') {
  const normalized = normalizeOntologyText(text)
  const match = normalized.match(/%\s*(\d{1,3})\s*(?:1rm)?/) || normalized.match(/(\d{1,3})\s*%\s*(?:1rm)?/)
  if (!match) return null
  const pct = Number(match[1])
  if (pct < 30 || pct > 100) return null
  return pct / 100
}

export function parseTempo(text = '') {
  const normalized = normalizeOntologyText(text)
  if (!normalized) return null

  const tempoMatch = normalized.match(/\b(\d-\d-\d(?:-\d)?)\b/) || normalized.match(/\btempo\s*(\d{4})\b/)
  if (tempoMatch) return tempoMatch[1]

  if (/\bpaused\b|\bpaused rep\b|\bdurmali\b|\bdur(\b|maca)/.test(normalized)) return 'paused'
  if (/\bslow ecc\w*|slow rep|controlled\b|kontrollu/.test(normalized)) return 'slow'
  if (/\bisometric\b|izometrik|statik tutus/.test(normalized)) return 'isometric'
  if (/\beccentric only\b|negative only|sadece eksantrik/.test(normalized)) return 'eccentric_only'

  return null
}

export function parseLoad(text = '') {
  const normalized = normalizeOntologyText(text)
  if (!normalized) return null

  const lbsMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:lbs|lb|pound|paunt)\b/)
  if (lbsMatch) {
    return {
      weight_kg: Math.round(Number(lbsMatch[1].replace(',', '.')) * 0.45359 * 10) / 10,
      is_bodyweight: false,
      added_weight_kg: 0,
    }
  }

  const bwPlus = normalized.match(/\bbw\s*\+\s*(\d+(?:[.,]\d+)?)\s*kg\b/)
  if (bwPlus) {
    return {
      weight_kg: Number(bwPlus[1].replace(',', '.')),
      is_bodyweight: true,
      added_weight_kg: Number(bwPlus[1].replace(',', '.')),
    }
  }

  const plusKg = normalized.match(/\+\s*(\d+(?:[.,]\d+)?)\s*kg\b/)
  if (plusKg) {
    return {
      weight_kg: Number(plusKg[1].replace(',', '.')),
      is_bodyweight: true,
      added_weight_kg: Number(plusKg[1].replace(',', '.')),
    }
  }

  if (/\bbw\b|\bbodyweight\b|vucut agirligi|\bvag\b/.test(normalized)) {
    return { weight_kg: 0, is_bodyweight: true, added_weight_kg: 0 }
  }

  const kgMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*kg\b/)
  if (kgMatch) {
    return {
      weight_kg: Number(kgMatch[1].replace(',', '.')),
      is_bodyweight: false,
      added_weight_kg: 0,
    }
  }

  return null
}

// ── Pace / heart rate / zone ───────────────────────────────────────────────
export function parsePace(text = '') {
  const normalized = normalizeOntologyText(text)
  if (!normalized) return null

  const perKm = normalized.match(/(\d{1,2}):([0-5]\d)\s*\/\s*km/) || normalized.match(/(\d{1,2}):([0-5]\d)\s*pace/)
  if (perKm) return Number(perKm[1]) * 60 + Number(perKm[2])

  const perMile = normalized.match(/(\d{1,2}):([0-5]\d)\s*\/\s*mi/) || normalized.match(/(\d{1,2}):([0-5]\d)\s*\/\s*mile/)
  if (perMile) {
    const sec = Number(perMile[1]) * 60 + Number(perMile[2])
    return Math.round(sec / 1.60934)
  }

  const minPerKm = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:dk|min|dakika)\s*\/?\s*km/)
  if (minPerKm) return Math.round(Number(minPerKm[1].replace(',', '.')) * 60)

  return null
}

export function parseHR(text = '') {
  const normalized = normalizeOntologyText(text)
  const match = normalized.match(/(\d{2,3})\s*bpm\b/)
    || normalized.match(/\bnabiz\s*(\d{2,3})\b/)
    || normalized.match(/\bhr\s*(\d{2,3})\b/)
    || normalized.match(/\bkalp(?:\s*atisi)?\s*(\d{2,3})\b/)
  if (!match) return null
  const bpm = Number(match[1])
  if (bpm < 40 || bpm > 230) return null
  return bpm
}

export function parseHRZone(text = '') {
  const normalized = normalizeOntologyText(text)
  const match = normalized.match(/\bzone\s*(\d)\b/) || normalized.match(/\bz\s*(\d)\b/)
  if (!match) return null
  const zone = Number(match[1])
  if (zone < 1 || zone > 5) return null
  return zone
}

export function parseTimeOfDay(text = '') {
  const normalized = normalizeOntologyText(text)
  if (/\bsabah\b|morning|\bam\b/.test(normalized)) return 'morning'
  if (/\boglen\b|\boglende\b|\bnoon\b|\bogle\b/.test(normalized)) return 'noon'
  if (/\baksam\b|evening|\bpm\b/.test(normalized)) return 'evening'
  if (/\bgece\b|\bnight\b/.test(normalized)) return 'night'
  return null
}

// ── Section / rest / wellness ──────────────────────────────────────────────
export function detectSection(line = '') {
  const normalized = normalizeOntologyText(line)
  if (/^(isinma|warmup|warm up|warm-up)\b/.test(normalized)) return 'warmup'
  if (/^(cooldown|cool down|cool-down|soguma|sogutma)\b/.test(normalized)) return 'cooldown'
  if (/^(ana set|main set|main lift|ana lift)\b/.test(normalized)) return 'main'
  if (/^(accessory|aksesuar|secondary)\b/.test(normalized)) return 'accessory'
  if (/^(finisher|bitirici)\b/.test(normalized)) return 'finisher'
  return null
}

export function detectDoubleSession(text = '') {
  const normalized = normalizeOntologyText(text)
  const hasMorning = /\bsabah\b|morning session|1\.\s*seans/.test(normalized)
  const hasEvening = /\baksam\b|evening session|2\.\s*seans/.test(normalized)
  return hasMorning && hasEvening
}

export function parseRestPeriod(text = '') {
  const normalized = normalizeOntologyText(text)
  if (!/\brest\b|dinlenme/.test(normalized)) return null

  const sec = normalized.match(/rest\s*(?:pause)?\s*(\d+)\s*s\b/) || normalized.match(/(\d+)\s*sn\s*dinlenme/) || normalized.match(/dinlenme[: ]+(\d+)\s*sn/)
  if (sec) return Number(sec[1])

  const min = normalized.match(/rest\s*(\d+)\s*(?:dk|min)/) || normalized.match(/(\d+)\s*(?:dk|min)\s*dinlenme/) || normalized.match(/dinlenme[: ]+(\d+)\s*(?:dk|min)/)
  if (min) return Number(min[1]) * 60

  return null
}

export function parseSleepHours(text = '') {
  const normalized = normalizeOntologyText(text)
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:saat|h|hr|hour)\s*(?:uyku|uyudum|sleep|slept)/)
    || normalized.match(/(?:uyku|sleep)[: ]+(\d+(?:[.,]\d+)?)\s*(?:saat|h|hr)/)
    || normalized.match(/slept\s*(\d+(?:[.,]\d+)?)\s*h\b/)
  if (!match) return null
  return Number(match[1].replace(',', '.'))
}

export function parseProteinGrams(text = '') {
  const normalized = normalizeOntologyText(text)
  const match = normalized.match(/(\d+)\s*(?:g|gr|gram)\s*protein/)
    || normalized.match(/protein\s*(\d+)\s*(?:g|gr|gram)/)
  if (!match) return null
  return Number(match[1])
}

export function parseHydrationLiters(text = '') {
  const normalized = normalizeOntologyText(text)
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:litre|lt|l)\s*(?:su|water)/)
    || normalized.match(/(?:su|water)\s*(\d+(?:[.,]\d+)?)\s*(?:litre|lt|l)/)
  if (!match) return null
  return Number(match[1].replace(',', '.'))
}

export function parseRoundCount(text = '') {
  const normalized = normalizeOntologyText(text)
  const match = normalized.match(/(\d+)\s*(?:round|tur|roundlu|rounds)/)
  if (!match) return null
  return Number(match[1])
}

export function parseEMOMSpec(text = '') {
  const normalized = normalizeOntologyText(text)
  const match = normalized.match(/emom\s*(\d+)\s*(?:dk|min)?/)
  if (!match) return null
  return { minutes: Number(match[1]) }
}

export function parseAMRAPSpec(text = '') {
  const normalized = normalizeOntologyText(text)
  const match = normalized.match(/amrap\s*(\d+)\s*(?:dk|min)?/)
  if (!match) return null
  return { minutes: Number(match[1]) }
}

// ── Internal helpers ───────────────────────────────────────────────────────
function cleanupLabel(line = '') {
  return String(line || '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(\d+(?:[.,]\d+)?)\s*km\b/ig, ' ')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:saat|hr|hour|dk|min|dakika|sn|sec|saniye)\b/ig, ' ')
    .replace(/[-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitDrillLine(line = '') {
  const raw = String(line || '').trim()
  if (!raw.startsWith('(') && !raw.endsWith(')')) return []

  return raw
    .replace(/[()]/g, '')
    .split(/,| ve /i)
    .map(item => item.trim())
    .filter(Boolean)
}

function summarizeLabelFromSignals(signals = []) {
  const ranked = signals
    .slice()
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0))
  return ranked[0]?.label || ''
}

function detectCompleted(text = '') {
  const normalized = normalizeOntologyText(text)
  if (/\byapamadim\b|pas gectim|yarida kaldi|kestim|isinamadim|vazgectim|devam edemedim|antrenmani kestim/.test(normalized)) {
    return false
  }
  return true
}

function buildFact(raw, kind = 'activity') {
  const signals = detectOntologySignals(raw)
  const modifiers = detectModifiers(raw)
  const bodyRegions = detectBodyRegions(raw)
  const riskMarkers = detectRiskSignals(raw)
  const durationMin = parseMinutes(raw)
  const distanceKm = parseDistanceKm(raw)
  const holdSec = parseSecondsHold(raw)
  const setsReps = parseSetsXReps(raw)
  const rpe = parseRPE(raw)
  const tempo = parseTempo(raw)
  const load = parseLoad(raw)
  const pace = parsePace(raw)
  const hr = parseHR(raw)
  const zone = parseHRZone(raw)
  const restSec = parseRestPeriod(raw)
  const completed = detectCompleted(raw)
  const section = detectSection(raw)
  const label = cleanupLabel(raw) || summarizeLabelFromSignals(signals) || 'Session Signal'

  return {
    kind,
    raw: String(raw || '').trim(),
    label,
    durationMin,
    distanceKm,
    holdSec,
    sets: setsReps?.sets || 0,
    reps: setsReps?.reps || null,
    weightKg: load?.weight_kg ?? setsReps?.weight_kg ?? 0,
    isBodyweight: load?.is_bodyweight || false,
    addedWeightKg: load?.added_weight_kg || 0,
    rpe: rpe?.rpe || null,
    rir: rpe?.rir || null,
    tempo,
    paceSecPerKm: pace,
    hrBpm: hr,
    hrZone: zone,
    restSec,
    section,
    completed,
    signals,
    modifiers,
    bodyRegions,
    riskMarkers,
    tags: deriveTagsFromSignals(signals),
    blockKind: deriveBlockKindFromSignals(signals, distanceKm ? 'locomotion' : 'mixed'),
  }
}

function factToExercise(fact) {
  return {
    name: fact.label,
    sets: [{
      reps: fact.reps,
      weight_kg: fact.weightKg || 0,
      duration_sec: fact.durationMin ? fact.durationMin * 60 : (fact.holdSec || null),
      note: fact.raw,
    }],
  }
}

function factToBlock(fact) {
  return {
    kind: fact.blockKind,
    label: fact.label,
    tags: fact.tags,
    sets: fact.sets || (fact.kind === 'drill' ? 1 : 0),
    reps: fact.reps,
    volumeKg: (Number(fact.weightKg) || 0) * (Number(fact.reps) || 0) * (Number(fact.sets) || 1),
    durationMin: fact.durationMin || 0,
    distanceKm: fact.distanceKm || 0,
    section: fact.section || null,
    completed: fact.completed !== false,
    source: 'fact',
  }
}

function factWeightScore(fact = {}) {
  const signalScore = (fact.signals || []).reduce((sum, signal) => sum + Number(signal.score || 0), 0)
  const durationScore = Math.min(5, (Number(fact.durationMin) || 0) / 20)
  const distanceScore = Math.min(5, (Number(fact.distanceKm) || 0) * 0.8)
  const drillBonus = fact.kind === 'drill' ? 1.2 : 0
  const sectionPenalty = fact.section === 'warmup' || fact.section === 'cooldown' ? -1 : 0
  return Math.max(1, signalScore + durationScore + distanceScore + drillBonus + sectionPenalty)
}

function buildBlockMix(facts = []) {
  const totals = facts.reduce((acc, fact) => {
    const kind = fact.blockKind || 'mixed'
    acc[kind] = (acc[kind] || 0) + factWeightScore(fact)
    return acc
  }, {})

  const totalWeight = Object.values(totals).reduce((sum, value) => sum + Number(value || 0), 0)
  return Object.entries(totals)
    .sort((left, right) => right[1] - left[1])
    .map(([kind, weight]) => ({
      kind,
      weight: Math.round(weight * 10) / 10,
      percent: totalWeight ? Math.round((weight / totalWeight) * 100) : 0,
    }))
}

// ── Chain inference ────────────────────────────────────────────────────────
function collectSignalIds(facts) {
  return new Set(facts.flatMap(fact => (fact.signals || []).map(signal => signal.id)))
}

const CHAIN_RULES = [
  { name: 'vault chain', test: ({ ids, regex, tagSet }) => regex.vault.test(regex.text) || tagSet.has('parkour') || ids.has('vault') || ids.has('underbar') || ids.has('cat_leap') || ids.has('climb_up_pk') || ids.has('tic_tac') || ids.has('wall_run'), reason: 'vault/parkour drill kaniti var' },
  { name: 'landing chain', test: ({ ids, regex, tagSet }) => regex.landing.test(regex.text) || tagSet.has('terrain') || ids.has('landing') || ids.has('drop'), reason: 'precision/terrain inis sinyali var' },
  { name: 'reactive legs', test: ({ ids, regex, tagSet }) => regex.reactive.test(regex.text) || tagSet.has('explosive') || ids.has('box_jump') || ids.has('precision') || ids.has('tic_tac') || ids.has('wall_run'), reason: 'explosive lower-chain sinyali var' },
  { name: 'spatial control', test: ({ regex, tagSet }) => regex.spatial.test(regex.text) || tagSet.has('balance'), reason: 'denge ve rota okuma sinyali var' },
  { name: 'trunk tension', test: ({ ids, regex, tagSet }) => regex.trunk.test(regex.text) || tagSet.has('core') || ids.has('hollow_body') || ids.has('plank') || ids.has('dragon_flag') || ids.has('lsit') || ids.has('hanging_leg_raise') || ids.has('ab_wheel'), reason: 'direkt trunk sinyali var' },
  { name: 'posterior chain', test: ({ ids }) => ['deadlift', 'romanian_deadlift', 'sumo_deadlift', 'stiff_leg_dl', 'rdl', 'hip_thrust', 'glute_bridge', 'single_leg_bridge', 'kettlebell_swing', 'good_morning', 'back_extension', 'reverse_hyper', 'nordic_curl', 'ghd_situp'].some(id => ids.has(id)), reason: 'hinge/posterior aktif' },
  { name: 'anterior chain', test: ({ ids }) => ['bench_press', 'incline_bench', 'decline_bench', 'close_grip_bench', 'paused_bench', 'dumbbell_bench', 'push_up', 'archer_pushup', 'diamond_pushup', 'planche', 'planche_lean', 'tuck_planche', 'pseudo_planche_pushup', 'hspu', 'wall_hspu', 'pike_pushup', 'dip', 'weighted_dip'].some(id => ids.has(id)), reason: 'anterior pushing aktif' },
  { name: 'vertical pull', test: ({ ids }) => ['pull_up', 'chin_up', 'weighted_pull', 'archer_pull', 'typewriter_pull', 'oac', 'muscle_up', 'lat_pulldown'].some(id => ids.has(id)), reason: 'vertical pull aktif' },
  { name: 'horizontal pull', test: ({ ids }) => ['inverted_row', 'ring_row', 'barbell_row', 't_bar_row', 'cable_row', 'seal_row', 'chest_supported_row', 'meadows_row', 'db_row', 'kroc_row', 'face_pull'].some(id => ids.has(id)), reason: 'horizontal pull aktif' },
  { name: 'vertical push', test: ({ ids }) => ['ohp', 'push_press', 'jerk', 'behind_neck_press', 'seated_press', 'z_press', 'arnold_press', 'landmine_press', 'hspu', 'wall_hspu', 'deficit_hspu', 'pike_pushup', 'handstand', 'press_to_handstand'].some(id => ids.has(id)), reason: 'vertical push aktif' },
  { name: 'horizontal push', test: ({ ids }) => ['bench_press', 'incline_bench', 'decline_bench', 'close_grip_bench', 'dumbbell_bench', 'push_up', 'archer_pushup', 'diamond_pushup', 'dip', 'weighted_dip'].some(id => ids.has(id)), reason: 'horizontal push aktif' },
  { name: 'quad dominant', test: ({ ids }) => ['back_squat', 'front_squat', 'overhead_squat', 'goblet_squat', 'hack_squat', 'leg_press', 'leg_extension', 'sissy_squat', 'pause_squat', 'tempo_squat', 'bulgarian_squat', 'lunge'].some(id => ids.has(id)), reason: 'quad dominant aktif' },
  { name: 'hamstring dominant', test: ({ ids }) => ['leg_curl', 'romanian_deadlift', 'stiff_leg_dl', 'nordic_curl', 'single_leg_dl', 'good_morning', 'ghd_situp'].some(id => ids.has(id)), reason: 'hamstring dominant aktif' },
  { name: 'glute focus', test: ({ ids }) => ['hip_thrust', 'glute_bridge', 'single_leg_bridge', 'kettlebell_swing'].some(id => ids.has(id)), reason: 'glut aktif' },
  { name: 'calf focus', test: ({ ids }) => ['standing_calf', 'seated_calf', 'donkey_calf', 'tibialis_raise'].some(id => ids.has(id)), reason: 'kalf aktif' },
  { name: 'unilateral legs', test: ({ ids }) => ['pistol_squat', 'assisted_pistol', 'shrimp_squat', 'bulgarian_squat', 'lunge', 'single_leg_dl', 'single_leg_bridge', 'step_up', 'cossack_squat'].some(id => ids.has(id)), reason: 'tek bacak balansi aktif' },
  { name: 'unilateral upper', test: ({ ids }) => ['oap', 'oac', 'archer_pull', 'archer_pushup', 'db_row'].some(id => ids.has(id)), reason: 'tek kol aktif' },
  { name: 'anti-extension core', test: ({ ids }) => ['hollow_body', 'plank', 'rkc_plank', 'ab_wheel', 'hanging_leg_raise', 'toes_to_bar', 'dead_bug', 'dragon_flag', 'tuck_dragon', 'single_leg_df', 'lsit', 'hanging_lsit'].some(id => ids.has(id)), reason: 'anti-ekstansiyon core aktif' },
  { name: 'anti-rotation core', test: ({ ids }) => ['pallof_press', 'side_plank', 'copenhagen_plank', 'bird_dog'].some(id => ids.has(id)), reason: 'anti-rotasyon core aktif' },
  { name: 'posterior core', test: ({ ids }) => ['arch_hold', 'back_extension', 'reverse_hyper'].some(id => ids.has(id)), reason: 'posterior core aktif' },
  { name: 'grip endurance', test: ({ ids, regex }) => regex.grip.test(regex.text) || ['false_grip', 'farmer_carry', 'suitcase_carry'].some(id => ids.has(id)), reason: 'grip dayaniklilik aktif' },
  { name: 'scapular health', test: ({ ids, regex }) => regex.scapular.test(regex.text) || ['face_pull', 'band_pull_apart'].some(id => ids.has(id)), reason: 'skapula sagligi aktif' },
  { name: 'lever skill', test: ({ ids }) => ['front_lever', 'front_lever_tuck', 'front_lever_adv_tuck', 'front_lever_straddle', 'front_lever_half_lay', 'front_lever_raises', 'back_lever', 'back_lever_progressions', 'human_flag', 'dragon_press', 'planche', 'tuck_planche', 'adv_tuck_planche', 'straddle_planche'].some(id => ids.has(id)), reason: 'lever skill aktif' },
  { name: 'handstand chain', test: ({ ids }) => ['handstand', 'wall_handstand', 'freestand_hs', 'handstand_walk', 'press_to_handstand', 'tuck_press', 'hspu', 'wall_hspu', 'deficit_hspu', 'pike_pushup'].some(id => ids.has(id)), reason: 'handstand chain aktif' },
  { name: 'weighted calisthenics', test: ({ ids }) => ['weighted_pull', 'weighted_dip'].some(id => ids.has(id)), reason: 'agirlikli kalistenik aktif' },
  { name: 'static isometric', test: ({ ids, regex }) => regex.iso.test(regex.text) || ['lsit', 'hanging_lsit', 'planche_lean', 'front_lever', 'back_lever', 'hollow_body', 'plank', 'arch_hold', 'human_flag'].some(id => ids.has(id)), reason: 'izometrik tutus aktif' },
  { name: 'dynamic calisthenics', test: ({ ids }) => ['muscle_up', 'ring_muscle_up', 'clap_pushup'].some(id => ids.has(id)), reason: 'dinamik kalistenik aktif' },
  { name: 'aerobic base', test: ({ ids, regex }) => regex.aerobic.test(regex.text) || ids.has('zone2'), reason: 'aerobik baz aktif' },
  { name: 'aerobic power', test: ({ ids }) => ids.has('threshold'), reason: 'aerobik guc aktif' },
  { name: 'lactic glycolytic', test: ({ ids }) => ['hiit', 'emom', 'amrap', 'crossfit_metcon'].some(id => ids.has(id)), reason: 'laktik (glikolitik) sistem aktif' },
  { name: 'alactic explosive', test: ({ ids }) => ['sprint', 'snatch', 'power_snatch', 'clean', 'power_clean', 'clean_and_jerk', 'box_jump'].some(id => ids.has(id)), reason: 'alaktik (ATP-PC) sistem aktif' },
  { name: 'mobility post-load', test: ({ ids, sectionFlags }) => ids.has('mobility') && sectionFlags.hasStrength, reason: 'yuke mobility eklendi' },
]

function buildChainSignals(facts = [], tags = []) {
  const text = normalizeOntologyText(facts.map(fact => fact.raw || fact.label || '').join(' '))
  const ids = collectSignalIds(facts)
  const tagSet = new Set(tags || [])
  const sectionFlags = {
    hasStrength: facts.some(fact => fact.blockKind === 'strength'),
    hasMobility: facts.some(fact => fact.blockKind === 'mobility'),
    hasLocomotion: facts.some(fact => fact.blockKind === 'locomotion'),
    hasSkill: facts.some(fact => fact.blockKind === 'skill'),
    hasExplosive: facts.some(fact => fact.blockKind === 'explosive'),
  }

  const regex = {
    text,
    vault: /(vault|underbar|cat leap|climb up|tic tac|wall run)/,
    landing: /(precision|landing|drop|stick landing)/,
    reactive: /(box jump|precision jump|stride|tic tac|wall run)/,
    spatial: /(flow|balance|precision|trail|terrain)/,
    trunk: /(core|hollow|plank|underbar|quadrupedal|crawl)/,
    grip: /(dead hang|fingerboard|hangboard|grip|pinch|crusher|gripper)/,
    scapular: /(scapular|kurek|prone y|prone t|external rotation|internal rotation|cuff)/,
    iso: /(isometric|izometrik|hold|tutus)/,
    aerobic: /(zone 2|z2|easy pace|aerobic base|steady state|ss cardio)/,
  }

  const ctx = { ids, tagSet, regex, sectionFlags }
  const detected = []
  for (const rule of CHAIN_RULES) {
    if (rule.test(ctx)) detected.push({ name: rule.name, status: 'active', reason: rule.reason })
  }

  return [...new Map(detected.map(chain => [chain.name, chain])).values()]
}

function buildMissingChains(facts = [], tags = [], chainList = []) {
  const ids = collectSignalIds(facts)
  const tagSet = new Set(tags || [])
  const chainNames = new Set(chainList.map(chain => chain.name))
  const missing = []

  if (!chainNames.has('trunk tension')
      && !chainNames.has('anti-extension core')
      && !chainNames.has('anti-rotation core')
      && (tagSet.has('parkour') || tagSet.has('explosive'))) {
    missing.push('direct trunk chain')
  }

  const hasPush = chainNames.has('horizontal push') || chainNames.has('vertical push') || chainNames.has('anterior chain')
  const hasPull = chainNames.has('horizontal pull') || chainNames.has('vertical pull')
  if (hasPush && !hasPull) missing.push('antagonist pull')
  if (hasPull && !hasPush) missing.push('antagonist push')

  if (chainNames.has('quad dominant') && !chainNames.has('posterior chain') && !chainNames.has('hamstring dominant')) {
    missing.push('posterior chain')
  }

  if (chainNames.has('horizontal push') && !chainNames.has('vertical push')) missing.push('vertical push balance')
  if (chainNames.has('horizontal pull') && !chainNames.has('vertical pull')) missing.push('vertical pull balance')

  const hasUnilateral = chainNames.has('unilateral legs') || chainNames.has('unilateral upper')
  const hasBilateralLower = chainNames.has('quad dominant') || chainNames.has('posterior chain')
  if (hasBilateralLower && !hasUnilateral) missing.push('unilateral pattern')

  const hasOverheadPress = ['ohp', 'push_press', 'jerk', 'behind_neck_press', 'z_press', 'arnold_press', 'hspu', 'press_to_handstand'].some(id => ids.has(id))
  if (hasOverheadPress && !chainNames.has('scapular health') && !chainNames.has('rotator cuff health')) {
    missing.push('rotator cuff health')
  }

  const hasHeavyPush = chainNames.has('horizontal push') || chainNames.has('vertical push')
  if (hasHeavyPush && !chainNames.has('scapular health')) missing.push('scapular health')

  if (chainNames.has('quad dominant') && !chainNames.has('glute focus')) missing.push('glute activation')

  if (chainNames.has('alactic explosive') && !chainNames.has('aerobic base')) missing.push('aerobic base')

  if (chainNames.has('posterior chain') || chainNames.has('quad dominant') || chainNames.has('anterior chain')) {
    if (!chainNames.has('mobility post-load') && !tagSet.has('mobility')) missing.push('mobility after load')
  }

  return [...new Set(missing)]
}

// ── Risk inference ─────────────────────────────────────────────────────────
function buildRiskSignals(facts = [], tags = [], wellnessFacts = []) {
  const text = normalizeOntologyText(facts.concat(wellnessFacts).map(fact => fact.raw || fact.label || '').join(' '))
  const ids = collectSignalIds(facts)
  const tagSet = new Set(tags || [])
  const risks = []

  if (/downhill|yokus asagi/.test(text)) risks.push('eccentric downhill load var')
  if (/uphill|yokus yukari|incline/.test(text)) risks.push('calf ve posterior chain yuklenmesi var')
  if ((tagSet.has('terrain') || tagSet.has('parkour')) && tagSet.has('walking')) risks.push('ankle stiffness takibi gerekli olabilir')
  if (/(precision|landing|drop|stick landing)/.test(text) || tagSet.has('terrain')) risks.push('landing load birikti')

  for (const fact of facts) {
    for (const marker of fact.riskMarkers || []) {
      if (marker.severity === 'high') {
        if (marker.id === 'pain_signal') risks.push(`agri raporlandi: ${fact.raw}`)
        if (marker.id === 'injury_signal') risks.push(`sakatlik raporlandi: ${fact.raw}`)
      }
      if (marker.severity === 'medium') {
        if (marker.id === 'fatigue_signal') risks.push('yorgunluk raporlandi')
        if (marker.id === 'mental_block') risks.push('mental blokaj raporlandi')
        if (marker.id === 'incomplete_signal') risks.push('seans yarida kesildi')
      }
    }
  }

  const pushChainCount = ['bench_press', 'incline_bench', 'ohp', 'push_press', 'dip', 'weighted_dip', 'hspu', 'pike_pushup'].filter(id => ids.has(id)).length
  if (pushChainCount >= 3) risks.push('omuz overuse riski (3+ pushing pattern aynı seans)')

  const hasHandstandLoad = ids.has('handstand') || ids.has('hspu') || ids.has('wall_hspu')
  const hasVaultLanding = ids.has('vault') || ids.has('landing') || ids.has('drop')
  if (hasHandstandLoad && hasVaultLanding) risks.push('bilek yuklenmesi yuksek')

  const hasHeavyHinge = ['deadlift', 'sumo_deadlift', 'romanian_deadlift', 'rack_pull', 'block_pull'].some(id => ids.has(id))
  const hasHeavySquat = ['back_squat', 'front_squat', 'overhead_squat'].some(id => ids.has(id))
  if (hasHeavyHinge && hasHeavySquat && !tagSet.has('core')) risks.push('alt sirt yuklenmesi yuksek (core eksik)')

  let sleepHours = null
  let proteinG = null
  let hydrationL = null
  for (const wf of wellnessFacts) {
    if (wf.sleepHours != null) sleepHours = wf.sleepHours
    if (wf.proteinGrams != null) proteinG = wf.proteinGrams
    if (wf.hydrationLiters != null) hydrationL = wf.hydrationLiters
  }
  if (sleepHours != null && sleepHours < 6) risks.push(`uyku borcu (${sleepHours} saat)`)

  const totalDuration = facts.reduce((sum, f) => sum + (f.durationMin || 0), 0)
  if (totalDuration > 90 && proteinG == null) risks.push('uzun seans + nutrition raporu yok')
  if (totalDuration > 90 && hydrationL == null) risks.push('uzun seans + hidrasyon raporu yok')

  const prAttempt = facts.some(f => (f.riskMarkers || []).some(m => m.id === 'pr_attempt'))
  const fatigueReported = facts.some(f => (f.riskMarkers || []).some(m => m.id === 'fatigue_signal'))
  if (prAttempt && fatigueReported) risks.push('PR denemesi yorgun durumda — risk yuksek')

  const calfChain = ids.has('sprint') || /uphill|yokus yukari|sprint/.test(text)
  if (calfChain && (ids.has('box_jump') || ids.has('precision'))) risks.push('kalf strain riski (sprint+jump kombo)')

  return [...new Set(risks)]
}

// ── Confidence ─────────────────────────────────────────────────────────────
function detectContradictions(facts = [], rawText = '') {
  const text = normalizeOntologyText(rawText)
  const contradictions = []
  const prMention = /\bpr\b|personal record|kisisel rekor|yeni rekor/.test(text)
  const lowLoad = facts.some(fact => (fact.weightKg || 0) > 0 && (fact.weightKg || 0) < 10)
  if (prMention && lowLoad) contradictions.push('PR mention + dusuk yuk celiskisi')
  if (/0\s*kg/.test(text) && prMention) contradictions.push('0kg PR celiskisi')
  return contradictions
}

function buildConfidence(facts = [], { explicitDurationMin = 0, rawText = '', wellnessFacts = [] } = {}) {
  const evidenceCount = facts.length
  const signalCount = facts.reduce((sum, fact) => sum + ((fact.signals || []).length || 0), 0)
  const hasDistance = facts.some(fact => Number(fact.distanceKm) > 0)
  const hasDuration = explicitDurationMin > 0 || facts.some(fact => Number(fact.durationMin) > 0)
  const drillFacts = facts.filter(fact => fact.kind === 'drill').length
  const quantitativeFacts = facts.filter(fact => fact.sets > 0 || fact.weightKg > 0 || fact.reps).length
  const modifierAttachments = facts.filter(fact => (fact.modifiers || []).length > 0).length
  const prAttempt = facts.some(fact => (fact.riskMarkers || []).some(m => m.id === 'pr_attempt'))
  const negativeOnly = facts.length > 0 && facts.every(fact => fact.completed === false)
  const noQuantitative = quantitativeFacts === 0 && !hasDistance && !hasDuration
  const contradictions = detectContradictions(facts, rawText)
  const normalizedText = normalizeOntologyText(rawText)
  const genericityFlag = /^(spor yaptim|biraz spor|antrenman yaptim)\b/.test(normalizedText) && evidenceCount === 0

  const baseScore = (signalCount * 8)
    + (evidenceCount * 6)
    + (hasDistance ? 14 : 0)
    + (hasDuration ? 14 : 0)
    + (drillFacts * 6)
    + (quantitativeFacts * 4)
    + (wellnessFacts.length * 2)
    + (prAttempt && (quantitativeFacts > 0 || hasDistance || hasDuration) ? 8 : 0)
    + (modifierAttachments * 2)

  const penalty = (contradictions.length * 10)
    + (genericityFlag ? 15 : 0)
    + (negativeOnly ? 8 : 0)
    + (noQuantitative ? 6 : 0)

  const confidenceScore = Math.max(0, Math.min(100, Math.round(baseScore - penalty)))
  const level = confidenceScore >= 70 ? 'high' : confidenceScore >= 45 ? 'medium' : 'low'

  const reasons = []
  if (hasDistance) reasons.push('mesafe sinyali net')
  if (hasDuration) reasons.push('sure sinyali net')
  if (drillFacts) reasons.push(`drill kaniti ${drillFacts} adet`)
  if (!signalCount) reasons.push('serbest metin yorumu agirlikli')

  const boosts = []
  if (quantitativeFacts) boosts.push(`set/rep/yuk kaydi ${quantitativeFacts} adet`)
  if (modifierAttachments) boosts.push(`modifier eslesmesi ${modifierAttachments} adet`)
  if (prAttempt && (quantitativeFacts > 0 || hasDistance || hasDuration)) boosts.push('PR denemesi kanitla destekli')

  const gaps = []
  if (!quantitativeFacts) gaps.push('set/rep/yuk yok')
  if (!hasDuration) gaps.push('sure yok')
  if (!hasDistance && !facts.some(f => f.blockKind === 'strength')) gaps.push('mesafe yok')

  return {
    score: confidenceScore,
    level,
    reasons,
    contradictions,
    boosts,
    gaps,
  }
}

// ── Wellness extraction ────────────────────────────────────────────────────
function buildWellnessFact(line) {
  const sleepHours = parseSleepHours(line)
  const proteinGrams = parseProteinGrams(line)
  const hydrationLiters = parseHydrationLiters(line)
  if (sleepHours == null && proteinGrams == null && hydrationLiters == null) return null
  return {
    raw: String(line || '').trim(),
    sleepHours,
    proteinGrams,
    hydrationLiters,
  }
}

function isWellnessLine(normalized) {
  return /\d+\s*(?:saat|h|hr|hour)\s*(?:uyku|uyudum|sleep|slept)/.test(normalized)
    || /(?:uyku|sleep)[: ]+\d+/.test(normalized)
    || /\d+\s*(?:g|gr|gram)\s*protein/.test(normalized)
    || /protein\s*\d+\s*(?:g|gr|gram)/.test(normalized)
    || /\d+(?:[.,]\d+)?\s*(?:litre|lt|l)\s*(?:su|water)/.test(normalized)
    || /(?:su|water)\s*\d+(?:[.,]\d+)?\s*(?:litre|lt|l)/.test(normalized)
}

// ── Main entry ─────────────────────────────────────────────────────────────
export function extractAtomicWorkoutFacts(text = '') {
  const rawLines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const facts = []
  const wellnessFacts = []
  let explicitDurationMin = 0
  let currentSection = null
  const isDoubleSession = detectDoubleSession(text)

  for (const line of rawLines) {
    const normalized = normalizeOntologyText(line)
    if (!normalized) continue
    if (/^guncel kilo\b|^kilom\b|^boyum\b/.test(normalized)) continue
    if (/^(pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar)\b/.test(normalized)) continue
    if (/^set\s*\d+\s*:/i.test(normalized)) continue
    if (/^\d{1,2}\s+(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/.test(normalized) || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(normalized)) continue

    if (/^toplam sure\b|^toplam s?ure:/i.test(normalized)) {
      explicitDurationMin = parseMinutes(line)
      continue
    }

    const sectionTag = detectSection(line)
    if (sectionTag && !detectOntologySignals(line).length) {
      currentSection = sectionTag
      continue
    }

    if (isWellnessLine(normalized)) {
      const wellness = buildWellnessFact(line)
      if (wellness) wellnessFacts.push(wellness)
      continue
    }

    const drillItems = splitDrillLine(line)
    if (drillItems.length) {
      for (const item of drillItems) {
        const fact = buildFact(item, 'drill')
        if (currentSection && !fact.section) fact.section = currentSection
        if (fact.signals.length) facts.push(fact)
      }
      continue
    }

    const fact = buildFact(line, 'activity')
    if (currentSection && !fact.section) fact.section = currentSection
    if (fact.durationMin && !fact.signals.length && !fact.distanceKm) {
      const normalizedLabel = normalizeOntologyText(fact.label)
      if (/^(?:\d+|[\d.]+s|0s)$/.test(normalizedLabel) || normalizedLabel.length <= 2) continue
    }
    if (fact.signals.length || fact.distanceKm || fact.durationMin || fact.holdSec || fact.sets || fact.weightKg) facts.push(fact)
  }

  const allSignals = facts.flatMap(fact => fact.signals || [])
  const tags = deriveTagsFromSignals(allSignals)
  const type = deriveTypeFromSignals(allSignals, 'Custom')
  const blocks = facts.map(factToBlock)
  const exercises = facts.map(factToExercise)
  const durationMin = explicitDurationMin || facts.reduce((sum, fact) => sum + (fact.durationMin || 0), 0)
  const distanceKm = Math.round(facts.reduce((sum, fact) => sum + (fact.distanceKm || 0), 0) * 100) / 100
  const evidence = facts.map(fact => fact.raw)
  const highlight = facts
    .slice()
    .sort((left, right) => Number(right.durationMin || 0) - Number(left.durationMin || 0) || Number(right.distanceKm || 0) - Number(left.distanceKm || 0))
    .map(fact => fact.label)[0] || ''
  const blockMix = buildBlockMix(facts)
  const chains = buildChainSignals(facts, tags)
  const missingChains = buildMissingChains(facts, tags, chains)
  const riskSignals = buildRiskSignals(facts, tags, wellnessFacts)
  const confidence = buildConfidence(facts, { explicitDurationMin, rawText: text, wellnessFacts })
  const completed = facts.length === 0 ? true : facts.some(fact => fact.completed !== false)
  const allModifiers = facts.flatMap(fact => fact.modifiers || [])
  const allBodyRegions = facts.flatMap(fact => fact.bodyRegions || [])

  return {
    facts,
    evidence,
    blocks,
    blockMix,
    exercises,
    type,
    tags,
    durationMin,
    distanceKm,
    highlight,
    totalSets: facts.filter(fact => fact.kind === 'drill' || fact.sets > 0).length,
    confidence,
    chains,
    missingChains,
    riskSignals,
    wellnessFacts,
    modifiers: allModifiers,
    bodyRegions: allBodyRegions,
    completed,
    isDoubleSession,
  }
}
