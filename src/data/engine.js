/**
 * Hesaplama motoru — her yeni antrenman sonrası state'i yeniden hesaplar.
 * store.js tarafından çağrılır.
 *
 * Sorumlulukları:
 *  - Toplam metrikler (sessions, volume, sets, minutes)
 *  - Level + XP max
 *  - muscleBalance (hacim dağılımı)
 *  - stats (profile.stats'ı state.stats array'ine enjekte et)
 *  - performance (bench/MU/hang/parkour)
 *  - quests (daily/weekly)
 *  - skills (auto-unlock)
 *  - debuffs (survival + coach warnings)
 */

import { updatePerformance } from './performance-engine.js'
import { updateQuests, appendCoachQuests } from './quest-engine.js'
import { updateSkills } from './skill-engine.js'

// Egzersiz → kas grubu eşleme
const EXERCISE_MUSCLES = {
  'Bench Press':        ['Göğüs', 'Triceps', 'Omuz'],
  'Incline Press':      ['Göğüs', 'Omuz'],
  'Chest Fly':          ['Göğüs'],
  'Dips':               ['Göğüs', 'Triceps'],
  'Push-Up':            ['Göğüs', 'Triceps'],
  'OHP':                ['Omuz', 'Triceps'],
  'Shoulder Press':     ['Omuz', 'Triceps'],
  'Lateral Raise':      ['Omuz'],
  'Arnold Press':       ['Omuz'],
  'Face Pull':          ['Üst Sırt', 'Omuz'],
  'Triceps Pushdown':   ['Triceps'],
  'Tricep Extension':   ['Triceps'],
  'Pull-Up':            ['Lat', 'Biseps', 'Üst Sırt'],
  'Pulldown':           ['Lat', 'Biseps'],
  'Lat Pulldown':       ['Lat', 'Biseps'],
  'Muscle-Up':          ['Lat', 'Biseps', 'Göğüs'],
  'Barbell Row':        ['Üst Sırt', 'Biseps', 'Lat'],
  'Cable Row':          ['Üst Sırt', 'Biseps'],
  'Seated Cable Row':   ['Üst Sırt', 'Biseps'],
  'Seated Row':         ['Üst Sırt', 'Biseps'],
  'Dead Hang':          ['Lat', 'Biseps'],
  'Curl':               ['Biseps'],
  'Hammer Curl':        ['Biseps'],
  'Incline Curl':       ['Biseps'],
  'Seated Incline Curl':['Biseps'],
  'Squat':              ['Bacak (Parkour)', 'Kalf'],
  'Jump Squat':         ['Bacak (Parkour)'],
  'Lunge':              ['Bacak (Parkour)'],
  'Leg Press':          ['Bacak (Parkour)'],
  'Calf Raise':         ['Kalf'],
  'Standing Calf Raise':['Kalf'],
  'Hollow Body':        ['Core'],
  'Hollow Rock':        ['Core'],
  'L-Sit':              ['Core'],
  'Plank':              ['Core'],
  'Dragon Flag':        ['Core'],
  'Ab Wheel':           ['Core'],
  'Leg Raise':          ['Core'],
  'Hanging Leg Raise':  ['Core'],
  'Çakı':               ['Core'],
  'Crunch':             ['Core'],
  'V-Up':               ['Core'],
  'Treadmill':          ['Kardiyo'],
}

/**
 * Ana hesaplama — tüm türetilmiş alanları güncelle.
 */
export function recalculate(state) {
  const workouts = state.workouts || []

  // Toplam metrikler
  const totalSets    = workouts.reduce((s, w) => s + (w.sets || 0), 0)
  const totalVolumeKg = workouts.reduce((s, w) => s + (w.volumeKg || 0), 0)
  const totalMinutes  = workouts.reduce((s, w) => s + (w.durationMin || 0), 0)
  const sessions      = workouts.length

  state.profile.sessions      = sessions
  state.profile.totalSets     = totalSets
  state.profile.totalVolumeKg = totalVolumeKg
  state.profile.totalMinutes  = totalMinutes
  state.profile.totalVolume   = _formatVolume(totalVolumeKg)
  state.profile.totalTime     = _formatTime(totalMinutes)

  // Level + XP max
  const xpPerLevel = 2000
  const levelBase  = 4
  const totalEarned = workouts.reduce((s, w) => s + (w.xpEarned || 0), 0)
  const newLevel = levelBase + Math.floor(totalEarned / xpPerLevel)
  state.profile.level   = Math.max(state.profile.level || levelBase, newLevel)
  state.profile.xp.max  = state.profile.level * xpPerLevel

  // Türetilmiş paneller
  _updateMuscleBalance(state)
  _applyProfileStatsToArray(state)
  _updatePerformance(state)
  _updateQuests(state)
  _updateSkills(state)
  _updateDebuffs(state)
}

// ── Muscle Balance ───────────────────────────────────────────────────────────

function _updateMuscleBalance(state) {
  // Seed/tarihsel değerler (profile.js'ten) — bunların üzerine delta bin
  const baseBalance = {
    'Omuz':             198.5,
    'Göğüs':            169.5,
    'Triceps':          163.5,
    'Biseps':           156,
    'Üst Sırt':         128.5,
    'Lat':              108.5,
    'Bacak (Parkour)':   45,
    'Kalf':              36,
    'Core':               0,
    'Kardiyo':            0,
  }

  // Yeni eklenen antrenmanlar (hem local 'w...' hem Supabase UUID).
  // Seed muscleBalance'ı oluşturan mock workouts'ları ÇIKAR (id w44-w53).
  const SEED_IDS = new Set(['w44','w45','w46','w47','w48','w49','w50','w51','w52','w53'])
  const delta = {}
  workouts_loop:
  for (const w of state.workouts) {
    if (SEED_IDS.has(String(w.id))) continue workouts_loop
    for (const ex of (w.exercises || [])) {
      const muscles = _findMuscles(ex.name)
      if (!muscles.length) continue
      const exSets = Array.isArray(ex.sets) ? ex.sets.length : (typeof ex.sets === 'number' ? ex.sets : 1)
      for (const m of muscles) delta[m] = (delta[m] || 0) + exSets
    }
  }

  if (state.muscleBalance) {
    state.muscleBalance = state.muscleBalance.map(m => ({
      ...m,
      sets: Math.round(((baseBalance[m.label] ?? m.sets) + (delta[m.label] || 0)) * 10) / 10,
    }))
  }
}

function _findMuscles(exerciseName) {
  if (!exerciseName) return []
  const lower = exerciseName.toLowerCase()
  // Anahtar kelimeler uzun → kısa sırayla eşleştir (Seated Cable Row > Cable Row > Row)
  const keys = Object.keys(EXERCISE_MUSCLES).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    if (lower.includes(key.toLowerCase())) return EXERCISE_MUSCLES[key]
  }
  // Fallback
  if (/squat|lunge|leg|kalf/.test(lower)) return ['Bacak (Parkour)']
  if (/core|ab|hollow|plank|çakı/.test(lower)) return ['Core']
  if (/treadmill|cardio|kardiyo/.test(lower)) return ['Kardiyo']
  return []
}

// ── Stats: profile.stats (object) → state.stats (array) ────────────────────

function _applyProfileStatsToArray(state) {
  const ps = state.profile?.stats
  if (!ps || !Array.isArray(state.stats)) return
  state.stats = state.stats.map(s => {
    const val = Number(ps[s.key])
    if (isFinite(val)) {
      return { ...s, val: Math.max(0, Math.min(100, val)) }
    }
    return s
  })
}

// ── Performans ───────────────────────────────────────────────────────────────

function _updatePerformance(state) {
  if (!Array.isArray(state.performance)) return
  state.performance = updatePerformance(state.performance, state.workouts || [])
}

// ── Quests ───────────────────────────────────────────────────────────────────

function _updateQuests(state) {
  if (!state.quests) return
  const updated = updateQuests(state.quests, state.workouts || [])
  state.quests = appendCoachQuests(updated, state.coachQuestHints || [])
}

// ── Skills ───────────────────────────────────────────────────────────────────

function _updateSkills(state) {
  if (!Array.isArray(state.skills)) return
  state.skills = updateSkills(state.skills, state.workouts || [], state.coachSkillProgress || [])
}

// ── Debuffs: survival + coach warnings → stats panelinde gösterilen uyarılar ─

function _updateDebuffs(state) {
  const existing = Array.isArray(state.debuffs) ? state.debuffs : []
  const coachWarnings = Array.isArray(state.profile?.survivalWarnings) ? state.profile.survivalWarnings : []
  const coachNoteWarnings = Array.isArray(state.coachNote?.warnings) ? state.coachNote.warnings : []

  // Dedup — aynı uyarı birden fazla kaynakta olabilir
  const seen = new Set()
  const dynamic = []
  for (const w of [...coachWarnings, ...coachNoteWarnings]) {
    if (!w) continue
    const text = String(w).trim()
    if (!text) continue
    const key = text.toLowerCase().replace(/\s+/g, ' ')
    if (seen.has(key)) continue
    seen.add(key)
    const level = /🚨|⛔|danger|kritik|yaralan/i.test(text) ? 'red'
                : /🛑|🔴|critical/i.test(text) ? 'red'
                : /⚠️|🟡|tendon|warn/i.test(text) ? 'org'
                : /🧠|🔵|cns/i.test(text) ? 'blu'
                : 'org'
    const icon = text.match(/^([\p{Emoji}\u2600-\u27BF])/u)?.[1] || '⚠️'
    dynamic.push({
      level,
      icon,
      name: _shortTitle(text),
      desc: text,
      dynamic: true,
    })
  }

  // Dinamikleri başa koy, seed debuff'ları ekle (ama dinamikle isim çakışanı atla)
  const staticSeed = existing.filter(d => !d.dynamic && d.name && !seen.has(String(d.name).toLowerCase().trim()))
  state.debuffs = [...dynamic, ...staticSeed]
}

function _shortTitle(text) {
  // Emoji'yi at, ilk cümleyi uppercase yap
  const clean = text.replace(/^[\p{Emoji}\u2600-\u27BF\s]+/u, '').trim()
  const first = clean.split(/[.—–\-:]/)[0].trim()
  return first.length > 40 ? first.slice(0, 40).toUpperCase() + '…' : first.toUpperCase()
}

// ── Format yardımcıları ──────────────────────────────────────────────────────

function _formatVolume(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg >= 10000 ? 0 : 1)}k kg`
  return `${Math.round(kg)} kg`
}

function _formatTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}h ${m}min`
}
