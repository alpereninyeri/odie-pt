/**
 * Skill Engine — performans/workout verisinden skill kilitlerini otomatik açar.
 * Koçun skill_progress ipuçlarını da status'a etki ettirir.
 */

import { normalizeSession } from './rules.js'

function _hasExerciseWithReps(workouts, keywords, minReps) {
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      const name = (ex.name || '').toLowerCase()
      if (!keywords.some(k => name.includes(k))) continue
      for (const s of (ex.sets || [])) {
        if ((s.reps || 0) >= minReps) return true
      }
    }
  }
  return false
}

function _hasExerciseWithWeight(workouts, keywords, minKg) {
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      const name = (ex.name || '').toLowerCase()
      if (!keywords.some(k => name.includes(k))) continue
      for (const s of (ex.sets || [])) {
        const kg = Number(s.weightKg ?? s.weight_kg) || 0
        if (kg >= minKg) return true
      }
    }
  }
  return false
}

function _hasExerciseWithDuration(workouts, keywords, minSec) {
  for (const w of workouts) {
    for (const ex of (w.exercises || [])) {
      const name = (ex.name || '').toLowerCase()
      if (!keywords.some(k => name.includes(k))) continue
      for (const s of (ex.sets || [])) {
        const d = Number(s.durationSec ?? s.duration_sec) || 0
        if (d >= minSec) return true
      }
    }
  }
  return false
}

const UNLOCK_RULES = {
  // STRENGTH TREE
  'Dead Hang Elite':     (ws) => _hasExerciseWithDuration(ws, ['dead hang', 'hang'], 75),
  'Muscle-Up':           (ws) => _hasExerciseWithReps(ws, ['muscle-up', 'muscle up'], 1),
  'Bench Press 65kg':    (ws) => _hasExerciseWithWeight(ws, ['bench'], 65),
  'Muscle-Up ×5 Clean':  (ws) => _hasExerciseWithReps(ws, ['muscle-up', 'muscle up'], 5),

  // ACROBATICS
  'Front Flip':          (ws) => ws.some(w => w.type === 'Akrobasi' || /front flip/i.test(w.highlight || '')),
  'Dive Roll':           (ws) => ws.some(w => /dive roll|roll/i.test(w.highlight || '')),
  'Round Off':           (ws) => ws.some(w => /round off/i.test(w.highlight || '')),
  'Barani':              (ws) => ws.some(w => /barani/i.test(w.highlight || '')),

  // CORE
  'Hollow Body 30sn':    (ws) => _hasExerciseWithDuration(ws, ['hollow'], 30),
  'L-Sit 10sn':          (ws) => _hasExerciseWithDuration(ws, ['l-sit', 'lsit'], 10),
}

const PROG_RULES = {
  'Barani':              (ws) => ws.some(w => /barani/i.test(w.highlight || '')),
  'Hollow Body 30sn':    (ws) => _hasExerciseWithDuration(ws, ['hollow'], 15),
  'Shoulder Flexibility': (ws) => ws.filter(w => w.type === 'Stretching').length >= 3,
}

export function updateSkills(skillsSeed, workouts, coachSkillProgress = []) {
  if (!Array.isArray(skillsSeed)) return skillsSeed
  const normalizedWorkouts = (workouts || []).map(workout => normalizeSession(workout))

  // Koç ipuçlarını skill adına göre map'le
  const coachMap = {}
  for (const cp of (coachSkillProgress || [])) {
    if (cp?.name) coachMap[cp.name.toLowerCase()] = cp.note || ''
  }

  return skillsSeed.map(branch => ({
    ...branch,
    items: branch.items.map(item => {
      let status = item.status
      let desc = item.desc

      // Koç notu varsa desc'e ekle
      const coachNote = coachMap[item.name.toLowerCase()]
      if (coachNote) desc = `${item.desc} · ${coachNote}`

      // Auto-unlock kuralı varsa kontrol et
      const unlockFn = UNLOCK_RULES[item.name]
      if (unlockFn && item.status !== 'done') {
        try {
          if (unlockFn(normalizedWorkouts)) {
            return {
              ...item,
              status: 'done',
              desc,
              val: 'UNLOCKED',
              valColor: 'var(--grn)',
              req: undefined,
            }
          }
        } catch {}
      }

      // Progress kuralı
      const progFn = PROG_RULES[item.name]
      if (progFn && item.status === 'lock') {
        try {
          if (progFn(normalizedWorkouts)) {
            return { ...item, status: 'prog', desc, val: 'IN PROG' }
          }
        } catch {}
      }

      return { ...item, desc }
    }),
  }))
}
