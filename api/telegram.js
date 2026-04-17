import { classArmorRegen, classFatigueDecay, classXpMult, computeClass } from '../src/data/class-engine.js'
import { detectPRs } from '../src/data/pr-detector.js'
import {
  applyStatDelta,
  computeSessionStatDelta,
  computeSessionXp,
  computeStreakInfo,
  getLocalDateString,
  normalizeDateString,
  normalizeSession,
} from '../src/data/rules.js'
import { applySurvival } from '../src/data/survival-engine.js'

function sbHeaders() {
  const key = process.env.VITE_SUPABASE_ANON_KEY
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

const LEGACY_DB_TYPES = new Set(['Push', 'Pull', 'Shoulder', 'Parkour', 'Akrobasi', 'Bacak', 'Yürüyüş', 'Stretching', 'Custom'])

async function sbGet(path) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    headers: sbHeaders(),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

async function sbPost(table, body) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

async function sbPatch(table, filter, body) {
  const response = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
}

function isMissingColumnError(error) {
  return /column .* does not exist/i.test(error?.message || '')
}

function normalizeLegacyType(type = 'Custom') {
  if (type === 'Yuruyus') return 'Yürüyüş'
  if (LEGACY_DB_TYPES.has(type)) return type
  return 'Custom'
}

function legacyWorkoutHighlight(workout) {
  const legacyType = normalizeLegacyType(workout.type)
  if (legacyType === workout.type) return workout.highlight || ''
  return `[${workout.type}] ${workout.highlight || ''}`.trim()
}

function toLegacyWorkoutPayload(workout) {
  return {
    profile_id: workout.profile_id,
    date: workout.date,
    type: normalizeLegacyType(workout.type),
    duration_min: workout.duration_min,
    volume_kg: workout.volume_kg,
    sets: workout.sets,
    highlight: legacyWorkoutHighlight(workout),
    exercises: workout.exercises,
    xp_earned: workout.xp_earned,
    xp_multiplier: workout.xp_multiplier,
    has_pr: workout.has_pr,
  }
}

function toLegacyProfilePatch(patch) {
  return {
    class: patch.class,
    sub_class: patch.sub_class,
    level: patch.level,
    xp_current: patch.xp_current,
    xp_max: patch.xp_max,
    sessions: patch.sessions,
    total_volume_kg: patch.total_volume_kg,
    total_sets: patch.total_sets,
    total_minutes: patch.total_minutes,
    stats: patch.stats,
    streak_current: patch.streak_current,
    streak_max: patch.streak_max,
    last_workout_date: patch.last_workout_date,
    last_updated: patch.last_updated,
  }
}

async function resolveProfile() {
  const explicitId = process.env.ODIEPT_PROFILE_ID
  if (explicitId) {
    const rows = await sbGet(`profiles?select=*&id=eq.${explicitId}&limit=1`)
    return rows?.[0] || null
  }

  const rows = await sbGet('profiles?select=*&order=last_updated.desc&limit=1')
  return rows?.[0] || null
}

function buildParsePrompt(text) {
  return `Turkce antrenman mesajini yalnizca JSON olarak parse et.

Mesaj: """${text}"""

Kurallar:
- Her set ayri set olarak yazilsin.
- 3x5 60kg gibi formatta 3 ayni set uret.
- Sure tabanli hareketlerde duration_sec kullan.
- Bodyweight hareketlerde weight_kg = 0.
- volume_kg tum setlerin weight_kg * reps toplamidir.
- distance_km ve elevation_m metinde varsa ayikla.
- tags alanina sadece somut sinyaller ekle: push, pull, legs, core, mobility, parkour, acrobatics, walking, cycling, ski, climbing, gym, calisthenics, explosive, balance, grip, carry, terrain, recovery, endurance

Sadece su JSON:
{
  "type": "Push|Pull|Shoulder|Bacak|Parkour|Akrobasi|Yuruyus|Stretching|Bisiklet|Kayak|Tirmanis|Calisthenics|Gym|Kosu|Custom",
  "duration_min": 0,
  "distance_km": 0,
  "elevation_m": 0,
  "tags": [],
  "exercises": [
    {
      "name": "",
      "sets": [
        { "reps": null, "weight_kg": 0, "duration_sec": null, "note": "" }
      ]
    }
  ],
  "volume_kg": 0,
  "total_sets": 0,
  "highlight": "",
  "has_pr": false,
  "notes": ""
}`
}

const ODIE_SYSTEM = `Sen ODIE'sin. Tum yanitlar Turkce olmali.
Gercek koç gibi net, kisa ve spesifik konus.
Yapay hype yapma. Bu uygulama hybrid atlet icin: parkour, kayak, bisiklet, gym, calisthenics, yuruyus, tirmanis.
Senin gorevin seansi yorumlamak; final XP, stat ve streak hesaplari kural motorundan gelir.
COACH_NOTE icinde yalnizca kisa, scan edilebilir satirlar uret.
Tum yorumlari guncel veriye bagla; stale seed bilgi uretme.`

function fmtExercises(exercises) {
  if (!exercises?.length) return '  - detay yok'
  return exercises.map(exercise => {
    const sets = (exercise.sets || []).map((set, index) => {
      const parts = []
      if (set.weight_kg != null) parts.push(set.weight_kg === 0 ? 'BW' : `${set.weight_kg}kg`)
      if (set.reps != null) parts.push(`${set.reps} rep`)
      if (set.duration_sec != null) parts.push(`${set.duration_sec}sn`)
      if (set.note) parts.push(`(${set.note})`)
      return `    ${index + 1}. ${parts.filter(Boolean).join(' x ')}`
    }).join('\n')
    return `  - ${exercise.name}\n${sets}`
  }).join('\n')
}

function fmtRecentWorkouts(workouts) {
  if (!workouts?.length) return '- gecmis workout yok'
  return workouts.slice(0, 5).map(workout => (
    `- ${workout.date} · ${workout.type} · ${workout.durationMin || 0}dk · ${workout.highlight || ''}`
  )).join('\n')
}

function buildCoachPrompt(parsed, context) {
  return `Yeni seans:
- Tip: ${parsed.type}
- Sure: ${parsed.duration_min || 0} dk
- Mesafe: ${parsed.distance_km || 0} km
- Yukselti: ${parsed.elevation_m || 0} m
- Toplam set: ${parsed.total_sets || 0}
- Hacim: ${parsed.volume_kg || 0} kg
- PR: ${parsed.has_pr ? 'evet' : 'hayir'}
- Highlight: ${parsed.highlight || '-'}
- Notlar: ${parsed.notes || '-'}

Egzersizler:
${fmtExercises(parsed.exercises)}

Baglam:
- Streak: ${context.streak} gun
- XP: +${context.xp}
- Class: ${context.className}
- Statlar: STR ${context.stats.str} · AGI ${context.stats.agi} · END ${context.stats.end} · DEX ${context.stats.dex} · CON ${context.stats.con} · STA ${context.stats.sta}

Son antrenmanlar:
${fmtRecentWorkouts(context.recentWorkouts)}

Asagidaki formatta cevap ver:

TELEGRAM_MSG:
2-3 cumle, bir sayi veya teknik gozlem icersin.

COACH_NOTE:
{
  "sections": [
    { "title": "SEANS ANALIZI", "mood": "fire|calm|warn|danger", "lines": ["", ""] },
    { "title": "PERFORMANS METRIKLERI", "mood": "fire|calm|warn", "lines": [""] },
    { "title": "KOC BAKISI", "mood": "fire|calm|warn", "lines": [""] },
    { "title": "UYARILAR", "mood": "warn|danger|calm", "lines": [""] },
    { "title": "SKILL VE HEDEF", "mood": "fire|calm", "lines": [""] },
    { "title": "SONRAKI ADIM", "mood": "calm", "lines": [""] },
    {
      "title": "STATE_SYNC",
      "hidden": true,
      "payload": {
        "stats": {
          "str": { "desc": "", "coach": "", "detail": ["", "", "", ""] },
          "agi": { "desc": "", "coach": "", "detail": ["", "", "", ""] },
          "end": { "desc": "", "coach": "", "detail": ["", "", "", ""] },
          "dex": { "desc": "", "coach": "", "detail": ["", "", "", ""] },
          "con": { "desc": "", "coach": "", "detail": ["", "", "", ""] },
          "sta": { "desc": "", "coach": "", "detail": ["", "", "", ""] }
        },
        "performance": {
          "bench": { "note": "", "tip": "", "details": ["", "", "", ""] },
          "mu": { "note": "", "tip": "", "details": ["", "", "", ""] },
          "hang": { "note": "", "tip": "", "details": ["", "", "", ""] },
          "flip": { "note": "", "tip": "", "details": ["", "", "", ""] }
        },
        "muscles": {
          "omuz": { "detail": "", "tip": "", "tag": "" },
          "gogus": { "detail": "", "tip": "", "tag": "" },
          "arms": { "detail": "", "tip": "", "tag": "" },
          "back": { "detail": "", "tip": "", "tag": "" },
          "legs": { "detail": "", "tip": "", "tag": "" },
          "core": { "detail": "", "tip": "", "tag": "" }
        }
      }
    }
  ],
  "warnings": [""],
  "quest_hints": [""],
  "skill_progress": [{ "name": "", "note": "" }],
  "xp_note": "+${context.xp} XP | Streak ${context.streak}"
}

STATE_SYNC icindeki alanlar UI kartlarini guncellemek icin kullanilir.
Guncel peak neyse onu yaz; eski bench, eski core, eski PR gibi stale bilgi verme.
Stat delta sayma, XP hesaplama veya streak karari verme. Onlari kural motoru zaten hesapliyor.`
}

async function callGemini(prompt, { system = '', maxTokens = 1200, temperature = 0.2 } = {}) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY eksik')

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  }

  if (system) body.system_instruction = { parts: [{ text: system }] }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  )

  if (!response.ok) throw new Error(await response.text())
  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function parseWithGemini(text) {
  const raw = await callGemini(buildParsePrompt(text), { maxTokens: 1600, temperature: 0.1 })
  const clean = raw.replace(/```json\n?|\n?```/g, '').trim()
  const parsed = JSON.parse(clean)

  parsed.total_sets = Array.isArray(parsed.exercises)
    ? parsed.exercises.reduce((sum, exercise) => sum + ((exercise.sets || []).length || 0), 0)
    : 0
  parsed.volume_kg = Array.isArray(parsed.exercises)
    ? Math.round(parsed.exercises.reduce((sum, exercise) => (
      sum + (exercise.sets || []).reduce((acc, set) => acc + ((Number(set.weight_kg) || 0) * (Number(set.reps) || 0)), 0)
    ), 0))
    : 0

  return parsed
}

async function getCoachResponse(parsed, context) {
  const raw = await callGemini(
    buildCoachPrompt(parsed, context),
    { system: ODIE_SYSTEM, maxTokens: 1400, temperature: 0.72 },
  )

  const telegramMatch = raw.match(/TELEGRAM_MSG:\s*([\s\S]*?)(?=COACH_NOTE:|$)/i)
  const coachMatch = raw.match(/COACH_NOTE:\s*([\s\S]*)/i)

  let coachNote = null
  if (coachMatch?.[1]) {
    coachNote = JSON.parse(coachMatch[1].replace(/```json\n?|\n?```/g, '').trim())
  }

  return {
    telegramMsg: telegramMatch?.[1]?.trim() || raw.trim(),
    coachNote,
  }
}

async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN eksik')

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

function normalizeWorkoutRow(row) {
  const normalized = normalizeSession({
    id: row.id,
    date: row.date,
    type: row.type,
    durationMin: row.duration_min,
    volumeKg: row.volume_kg,
    sets: row.sets,
    highlight: row.highlight,
    exercises: row.exercises || [],
    hasPr: row.has_pr,
    notes: row.notes || '',
    source: row.source || 'telegram',
    createdAt: row.created_at,
    tags: row.tags || [],
    primaryCategory: row.primary_category,
    intensity: row.intensity,
    distanceKm: row.distance_km,
    elevationM: row.elevation_m,
  }, { source: row.source || 'telegram' })

  return {
    ...normalized,
    xpEarned: Number(row.xp_earned) || 0,
    xpMultiplier: Number(row.xp_multiplier) || 1,
  }
}

function buildCurrentPrs(workouts) {
  const ordered = [...workouts].sort((left, right) => normalizeDateString(left.date).localeCompare(normalizeDateString(right.date)))
  let prs = {}
  for (const workout of ordered) prs = detectPRs(workout, prs).updatedPrs
  return prs
}

function computeLevelState(totalXp, max = 2000) {
  const level = Math.floor(totalXp / max) + 1
  return {
    level,
    xpCurrent: totalXp - ((level - 1) * max),
    xpMax: max,
  }
}

function toSupabaseExercises(exercises) {
  return (exercises || []).map(exercise => ({
    name: exercise.name,
    sets: (exercise.sets || []).map(set => ({
      reps: set.reps,
      weight_kg: set.weightKg,
      duration_sec: set.durationSec,
      note: set.note || '',
    })),
  }))
}

function formatSummary(session, xp, streak, coachText) {
  const lines = [
    `<b>${session.type} seansi kaydedildi</b>`,
    '',
    `Sure: <b>${session.durationMin || 0}dk</b>`,
    session.distanceKm ? `Mesafe: <b>${session.distanceKm} km</b>` : null,
    session.volumeKg ? `Hacim: <b>${session.volumeKg.toLocaleString('tr-TR')} kg</b>` : null,
    `Streak: <b>${streak} gun</b>`,
    `XP: <b>+${xp}</b>`,
    session.hasPr ? `PR: <b>Yeni sinyal var</b>` : null,
    '',
    coachText ? `<b>Odie:</b>\n${coachText}` : null,
  ]

  return lines.filter(Boolean).join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, status: 'OdiePt bot aktif' })
  }

  const update = req.body
  const message = update?.message
  if (!message?.text) return res.status(200).json({ ok: true })

  const chatId = String(message.chat.id)
  const text = message.text.trim()
  const firstName = message.from?.first_name || 'sporcu'
  const allowedChatId = process.env.TELEGRAM_CHAT_ID

  if (allowedChatId && chatId !== allowedChatId) return res.status(200).json({ ok: true })

  if (text === '/start') {
    await sendTelegram(chatId, `OdiePt aktif, ${firstName}.\nAntrenmani Turkce yazman yeterli.`)
    return res.status(200).json({ ok: true })
  }

  if (text === '/help') {
    await sendTelegram(chatId, 'Ornek: "push 70dk, bench 62.5kg 3x5, dips 3x10" veya "parkour 2 saat, landing drill, 5km yuruyus"')
    return res.status(200).json({ ok: true })
  }

  try {
    const parsed = await parseWithGemini(text)
    const today = getLocalDateString()
    const profile = await resolveProfile()
    if (!profile) throw new Error('Profil bulunamadi')

    const workoutRows = await sbGet(`workouts?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=60`)
    const workouts = (workoutRows || []).map(row => normalizeWorkoutRow(row))
    const currentPrs = buildCurrentPrs(workouts)

    const draftSession = normalizeSession({
      date: today,
      type: parsed.type,
      durationMin: parsed.duration_min,
      distanceKm: parsed.distance_km,
      elevationM: parsed.elevation_m,
      tags: parsed.tags || [],
      exercises: parsed.exercises || [],
      volumeKg: parsed.volume_kg,
      sets: parsed.total_sets,
      highlight: parsed.highlight || '',
      hasPr: parsed.has_pr,
      notes: parsed.notes || '',
      source: 'telegram',
      createdAt: new Date().toISOString(),
    }, { source: 'telegram' })

    const prDetection = detectPRs(draftSession, currentPrs)
    const session = {
      ...draftSession,
      hasPr: draftSession.hasPr || prDetection.hasPr,
    }

    const currentClass = computeClass(workouts)
    const survival = applySurvival({
      armor: Number(profile.armor_current) || 100,
      fatigue: Number(profile.fatigue_current) || 0,
      consecutiveHeavy: Number(profile.consecutive_heavy) || 0,
      injuryUntil: profile.injury_until || null,
    }, session, {
      armorRegen: classArmorRegen(currentClass),
      fatigueDecay: classFatigueDecay(currentClass),
    })

    const streak = computeStreakInfo(workouts, today)
    const xpInfo = computeSessionXp(session, {
      streakDays: streak.current,
      classMultiplier: classXpMult(currentClass, session.type),
      survivalMultiplier: survival.xpMultiplier,
      prBonusMultiplier: currentClass?.passive?.prBonus || 1,
      doubleSession: workouts.some(workout => normalizeDateString(workout.date) === today),
    })
    const statDelta = computeSessionStatDelta(session)
    const nextStats = applyStatDelta(profile.stats || {}, statDelta)

    const existingTotalXp = Number(profile.xp_total)
      || (((Number(profile.level) || 1) - 1) * (Number(profile.xp_max) || 2000) + (Number(profile.xp_current) || 0))
    const nextTotalXp = existingTotalXp + xpInfo.xpEarned
    const levelState = computeLevelState(nextTotalXp, Number(profile.xp_max) || 2000)
    const nextWorkouts = [session, ...workouts]
    const nextClass = computeClass(nextWorkouts)

    const parsedForCoach = {
      ...parsed,
      type: session.type,
      duration_min: session.durationMin,
      distance_km: session.distanceKm,
      elevation_m: session.elevationM,
      exercises: toSupabaseExercises(session.exercises),
      volume_kg: session.volumeKg,
      total_sets: session.sets,
      highlight: session.highlight,
      has_pr: session.hasPr,
      notes: session.notes,
    }

    let telegramMsg = ''
    let coachNote = null
    try {
      const coach = await getCoachResponse(parsedForCoach, {
        xp: xpInfo.xpEarned,
        streak: streak.current,
        className: nextClass.name,
        stats: nextStats,
        recentWorkouts: workouts,
      })
      telegramMsg = coach.telegramMsg
      coachNote = coach.coachNote
    } catch (error) {
      console.warn('[bot] coach generation failed:', error.message)
    }

    const workoutPayload = {
      profile_id: profile.id,
      date: session.date,
      type: session.type,
      duration_min: session.durationMin,
      volume_kg: session.volumeKg,
      sets: session.sets,
      highlight: session.highlight,
      exercises: toSupabaseExercises(session.exercises),
      xp_earned: xpInfo.xpEarned,
      xp_multiplier: xpInfo.streakMult,
      has_pr: session.hasPr,
      notes: session.notes,
      primary_category: session.primaryCategory,
      tags: session.tags,
      intensity: session.intensity,
      source: session.source,
      distance_km: session.distanceKm,
      elevation_m: session.elevationM,
      class_mult: classXpMult(currentClass, session.type),
      survival_status: survival.status,
      stat_delta: statDelta,
      created_at: session.createdAt,
    }

    let insertedRows
    try {
      insertedRows = await sbPost('workouts', workoutPayload)
    } catch (error) {
      if (!isMissingColumnError(error)) throw error
      insertedRows = await sbPost('workouts', toLegacyWorkoutPayload(workoutPayload))
    }

    const workoutId = insertedRows?.[0]?.id || null

    const profilePatch = {
      xp_current: levelState.xpCurrent,
      xp_max: levelState.xpMax,
      xp_total: nextTotalXp,
      level: levelState.level,
      sessions: (Number(profile.sessions) || 0) + 1,
      total_volume_kg: (Number(profile.total_volume_kg) || 0) + (session.volumeKg || 0),
      total_sets: (Number(profile.total_sets) || 0) + (session.sets || 0),
      total_minutes: (Number(profile.total_minutes) || 0) + (session.durationMin || 0),
      total_km: (Number(profile.total_km) || 0) + (session.distanceKm || 0),
      stats: nextStats,
      streak_current: streak.current,
      streak_max: Math.max(Number(profile.streak_max) || 0, streak.max),
      last_workout_date: today,
      armor_current: survival.armor,
      fatigue_current: survival.fatigue,
      consecutive_heavy: survival.consecutiveHeavy,
      injury_until: survival.injuryUntil,
      survival_status: survival.status,
      class_id: nextClass.id,
      class: nextClass.name,
      sub_class: nextClass.subName,
      last_updated: new Date().toISOString(),
    }

    try {
      await sbPatch('profiles', `id=eq.${profile.id}`, profilePatch)
    } catch (error) {
      if (!isMissingColumnError(error)) throw error
      await sbPatch('profiles', `id=eq.${profile.id}`, toLegacyProfilePatch(profilePatch))
    }

    if (coachNote) {
      await sbPost('coach_notes', {
        profile_id: profile.id,
        workout_id: workoutId,
        date: today,
        sections: coachNote.sections || [],
        xp_note: coachNote.xp_note || `+${xpInfo.xpEarned} XP`,
        warnings: coachNote.warnings || survival.warnings || [],
        quest_hints: coachNote.quest_hints || [],
        skill_progress: coachNote.skill_progress || [],
      })
    }

    const reply = formatSummary(session, xpInfo.xpEarned, streak.current, telegramMsg)
    await sendTelegram(chatId, reply)
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[bot] error:', error.message)
    try {
      await sendTelegram(chatId, `Hata: <code>${error.message}</code>`)
    } catch {}
    return res.status(200).json({ ok: true })
  }
}
