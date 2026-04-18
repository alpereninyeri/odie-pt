import { classArmorRegen, classFatigueDecay, classXpMult, computeClass } from '../src/data/class-engine.js'
import { buildOdieContext } from '../src/data/odie-context.js'
import { buildFallbackCoachResponse } from '../src/data/odie-fallback.js'
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
  const message = String(error?.message || error || '')
  return (
    /column .* does not exist/i.test(message) ||
    /could not find .* column .* schema cache/i.test(message) ||
    /schema cache/i.test(message) ||
    /PGRST204/i.test(message)
  )
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

const PARSE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    type: { type: 'STRING' },
    duration_min: { type: 'NUMBER' },
    distance_km: { type: 'NUMBER' },
    elevation_m: { type: 'NUMBER' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    exercises: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          sets: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                reps: { type: 'NUMBER', nullable: true },
                weight_kg: { type: 'NUMBER', nullable: true },
                duration_sec: { type: 'NUMBER', nullable: true },
                note: { type: 'STRING' },
              },
            },
          },
        },
      },
    },
    volume_kg: { type: 'NUMBER' },
    total_sets: { type: 'NUMBER' },
    highlight: { type: 'STRING' },
    has_pr: { type: 'BOOLEAN' },
    notes: { type: 'STRING' },
  },
}

const COACH_NOTE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    telegram_msg: { type: 'STRING' },
    coach_note: {
      type: 'OBJECT',
      properties: {
        sections: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              mood: { type: 'STRING' },
              lines: { type: 'ARRAY', items: { type: 'STRING' } },
            },
          },
        },
        warnings: { type: 'ARRAY', items: { type: 'STRING' } },
        quest_hints: { type: 'ARRAY', items: { type: 'STRING' } },
        skill_progress: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              note: { type: 'STRING', nullable: true },
            },
          },
        },
        xp_note: { type: 'STRING' },
      },
    },
  },
}

const STATE_SYNC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    bodyMetrics: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        weightKg: { type: 'NUMBER', nullable: true },
        heightCm: { type: 'NUMBER', nullable: true },
        note: { type: 'STRING', nullable: true },
      },
    },
    stats: { type: 'OBJECT', nullable: true },
    performance: { type: 'OBJECT', nullable: true },
    muscles: { type: 'OBJECT', nullable: true },
    skills: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          status: { type: 'STRING', nullable: true },
          note: { type: 'STRING', nullable: true },
        },
      },
    },
    chains: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          status: { type: 'STRING', nullable: true },
          note: { type: 'STRING', nullable: true },
        },
      },
    },
    goals: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          target: { type: 'STRING', nullable: true },
          deadline: { type: 'STRING', nullable: true },
          progress: { type: 'STRING', nullable: true },
        },
      },
    },
    quest_hints: { type: 'ARRAY', items: { type: 'STRING' } },
    skill_progress: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          note: { type: 'STRING', nullable: true },
          status: { type: 'STRING', nullable: true },
        },
      },
    },
    warnings: { type: 'ARRAY', items: { type: 'STRING' } },
  },
}

const coachCache = new Map()

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
- Class reason: ${context.odie?.athlete?.classReason || '-'}
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
Stat delta sayma, XP hesaplama veya streak karari verme. Onlari kural motoru zaten hesapliyor.
Yorumlarinda trend, gap ve sonraki adim iliskisini kur; sadece seansi ozetleme.`
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

async function callGeminiWithModel(prompt, {
  system = '',
  maxTokens = 1200,
  temperature = 0.2,
  model = 'gemini-2.5-flash',
  responseMimeType = '',
  responseSchema = null,
} = {}) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY eksik')

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  }
  if (responseMimeType) body.generationConfig.responseMimeType = responseMimeType
  if (responseSchema) body.generationConfig.responseSchema = responseSchema
  if (system) body.system_instruction = { parts: [{ text: system }] }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
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

function buildCoachPromptV2(parsed, context) {
  const odie = context.odie || {}
  const statSpread = odie.stats?.spread || context.stats || {}
  const weakest = odie.stats?.weakest
  const strongest = odie.stats?.strongest
  const recovery = odie.recovery || {}
  const questPressure = (odie.questPressure || [])
    .map(quest => `- ${quest.name}: ${quest.progress}/${quest.total} · ${quest.reward} · ${quest.desc}`)
    .join('\n') || '- aktif baski yok'
  const skillPressure = (odie.skillPressure || [])
    .map(skill => `- ${skill.branch} · ${skill.name} · ${skill.status}${skill.req ? ` · ${skill.req}` : ''}`)
    .join('\n') || '- skill baskisi yok'
  const recentPrs = (odie.recentPrs || [])
    .map(pr => `- ${pr.name}: ${pr.value} · ${pr.date}`)
    .join('\n') || '- son PR sinyali yok'
  const performance = (odie.performance || [])
    .map(item => `- ${item.name}: ${item.val} · ${item.trend} · ${item.note}`)
    .join('\n') || '- performans karti yok'
  const coachMemory = (odie.coachMemory || [])
    .map(item => `- ${item.title}: ${(item.lines || []).join(' ')}`)
    .join('\n') || '- onceki koc hafizasi yok'
  const disciplineMix = Object.entries(odie.disciplineMix || {})
    .map(([key, value]) => `${key}:${value}`)
    .join(' · ') || 'karisik'
  const trendSignals = (odie.loadProfile?.trendSignals || [])
    .map(signal => `- ${signal}`)
    .join('\n') || '- son blok trend sinyali zayif'
  const focusGaps = (odie.focusGaps || [])
    .map(item => `- ${item}`)
    .join('\n') || '- acik gap gorunmuyor'

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
- Statlar: STR ${statSpread.str} · AGI ${statSpread.agi} · END ${statSpread.end} · DEX ${statSpread.dex} · CON ${statSpread.con} · STA ${statSpread.sta}
- En zayif stat: ${weakest?.key || '-'} ${weakest?.val ?? ''}
- En guclu stat: ${strongest?.key || '-'} ${strongest?.val ?? ''}
- Recovery: armor ${recovery.armor ?? '-'} / fatigue ${recovery.fatigue ?? '-'} / status ${recovery.status || '-'}
- Survival XP: x${recovery.xpMultiplier ?? 1}
- Son 7 gun: uyku ${recovery.avgSleep ?? 0}s · su ${recovery.avgWaterL ?? 0}L · adim ${recovery.avgSteps ?? 0}
- Disiplin mix: ${disciplineMix}

Trend sinyalleri:
${trendSignals}

Gap analizi:
${focusGaps}

Son antrenmanlar:
${fmtRecentWorkouts(context.recentWorkouts)}

Son PR'ler:
${recentPrs}

Performans ozeti:
${performance}

Quest baskisi:
${questPressure}

Skill baskisi:
${skillPressure}

Onceki koc hafizasi:
${coachMemory}

Asagidaki JSON disinda hicbir sey yazma:
{
  "telegram_msg": "2-3 cumle, bir sayi veya teknik gozlem icersin.",
  "coach_note": {
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
}

STATE_SYNC icindeki alanlar UI kartlarini guncellemek icin kullanilir.
Guncel peak neyse onu yaz; eski bench, eski core, eski PR gibi stale bilgi verme.
Stat delta sayma, XP hesaplama veya streak karari verme. Onlari kural motoru zaten hesapliyor.`
}

function buildStateSyncPrompt(parsed, context, coachNote) {
  const sections = (coachNote?.sections || [])
    .filter(section => !section?.hidden)
    .map(section => `- ${section.title}: ${(section.lines || []).join(' ')}`)
    .join('\n') || '- not yok'

  return `Asagidaki seans ve koç notundan yalnizca STATE_SYNC JSON'u cikar.
Sayisal karar uydurma, sadece metinden ve baglamdan emin oldugun sync alanlarini doldur.
BMI hesaplama. Kullanici kilo/boy belirttiyse bodyMetrics'e yaz; BMI'yi bos birak.

Seans:
- Tip: ${parsed.type}
- Sure: ${parsed.duration_min || 0}
- Mesafe: ${parsed.distance_km || 0}
- Highlight: ${parsed.highlight || '-'}
- Notlar: ${parsed.notes || '-'}

Baglam:
- Class: ${context.className}
- XP: +${context.xp}
- Streak: ${context.streak}
- Body metrics: kilo ${context.bodyMetrics?.weightKg || '-'} / boy ${context.bodyMetrics?.heightCm || '-'}
- Recovery status: ${context.odie?.recovery?.status || '-'}
- Recovery xp multiplier: ${context.odie?.recovery?.xpMultiplier ?? 1}
- Focus gaps: ${(context.odie?.focusGaps || []).join(' | ') || '-'}

Coach note:
${sections}

Sadece JSON don.`
}

function parseJsonText(raw = '') {
  return JSON.parse(String(raw).replace(/```json\n?|\n?```/g, '').trim())
}

function mergeStateSyncIntoCoachNote(coachNote, stateSync, xp, streak) {
  const safeNote = coachNote || { sections: [] }
  const visibleSections = (safeNote.sections || []).filter(section => !section?.hidden)
  return {
    ...safeNote,
    sections: [
      ...visibleSections,
      {
        title: 'STATE_SYNC',
        hidden: true,
        payload: stateSync || {},
      },
    ],
    warnings: Array.isArray(safeNote.warnings) ? safeNote.warnings : [],
    quest_hints: Array.isArray(safeNote.quest_hints) ? safeNote.quest_hints : [],
    skill_progress: Array.isArray(safeNote.skill_progress) ? safeNote.skill_progress : [],
    xp_note: safeNote.xp_note || `+${xp} XP | Streak ${streak}`,
  }
}

function clampBodyMetricsPatch(current, incoming) {
  if (!incoming || typeof incoming !== 'object') return null
  const currentWeight = Number(current?.weightKg) || 0
  const nextWeight = Number(incoming.weightKg)
  const nextHeight = Number(incoming.heightCm)
  const patch = {}

  if (Number.isFinite(nextWeight) && nextWeight > 0) {
    if (!currentWeight || Math.abs(nextWeight - currentWeight) <= 3) {
      patch.weightKg = Math.round(nextWeight * 10) / 10
    } else {
      console.warn('[bot] dropped bodyMetrics.weightKg delta > 3kg:', currentWeight, '->', nextWeight)
    }
  }

  if (Number.isFinite(nextHeight) && nextHeight > 0 && nextHeight <= 260) {
    patch.heightCm = Math.round(nextHeight)
  }

  if (incoming.note) patch.note = String(incoming.note).trim()
  return Object.keys(patch).length ? patch : null
}

function normalizeLooseText(value = '') {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .trim()
}

function parseMinutesFromText(text = '') {
  const raw = String(text || '')
  const normalized = normalizeLooseText(raw).replace(/dakika/g, 'dk').replace(/minute/g, 'min')
  let minutes = 0

  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:saat|hr|hour)/)
  if (hourMatch) minutes += Math.round(Number(hourMatch[1].replace(',', '.')) * 60)

  const minuteMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:dk|min)\b/)
  if (minuteMatch) minutes += Math.round(Number(minuteMatch[1].replace(',', '.')))

  const secondMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:sn|sec|saniye)\b/)
  if (!minutes && secondMatch) minutes += Math.round(Number(secondMatch[1].replace(',', '.')) / 60)

  return minutes
}

function parseDurationSecondsFromText(text = '') {
  const raw = String(text || '')
  const normalized = normalizeLooseText(raw).replace(/dakika/g, 'dk').replace(/minute/g, 'min')
  let seconds = 0

  const hourMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:saat|hr|hour)/)
  if (hourMatch) seconds += Math.round(Number(hourMatch[1].replace(',', '.')) * 3600)

  const minuteMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:dk|min)\b/)
  if (minuteMatch) seconds += Math.round(Number(minuteMatch[1].replace(',', '.')) * 60)

  const secondMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:sn|sec|saniye)\b/)
  if (secondMatch) seconds += Math.round(Number(secondMatch[1].replace(',', '.')))

  return seconds || null
}

function parseDistanceKmFromText(text = '') {
  const match = String(text || '').match(/(\d+(?:[.,]\d+)?)\s*km\b/i)
  return match ? Number(match[1].replace(',', '.')) : 0
}

function inferTypeFromText(text = '') {
  const normalized = normalizeLooseText(text)
  if (!normalized) return 'Custom'
  if (normalized.includes('push')) return 'Push'
  if (normalized.includes('pull')) return 'Pull'
  if (normalized.includes('shoulder')) return 'Shoulder'
  if (normalized.includes('bacak') || normalized.includes('leg day')) return 'Bacak'
  if (normalized.includes('parkour')) return 'Parkour'
  if (normalized.includes('akrobasi') || normalized.includes('acro')) return 'Akrobasi'
  if (normalized.includes('yuruyus') || normalized.includes('yurume') || normalized.includes('walk')) return 'Yuruyus'
  if (normalized.includes('stretch') || normalized.includes('esneme') || normalized.includes('mobility')) return 'Stretching'
  if (normalized.includes('bisiklet') || normalized.includes('cycling') || normalized.includes('bike')) return 'Bisiklet'
  if (normalized.includes('kayak') || normalized.includes('ski')) return 'Kayak'
  if (normalized.includes('tirman') || normalized.includes('climb')) return 'Tirmanis'
  if (normalized.includes('kosu') || normalized.includes('run')) return 'Kosu'
  if (normalized.includes('calisthenics')) return 'Calisthenics'
  if (normalized.includes('gym')) return 'Gym'
  return 'Custom'
}

function inferExerciseTags(name = '', fallbackType = 'Custom') {
  const normalized = normalizeLooseText(name)
  const tags = new Set()
  if (fallbackType === 'Push') tags.add('push')
  if (fallbackType === 'Pull') tags.add('pull')
  if (fallbackType === 'Bacak') tags.add('legs')
  if (fallbackType === 'Parkour') tags.add('parkour')

  if (/(bench|press|dip|triceps|lateral raise|shoulder press)/.test(normalized)) tags.add('push')
  if (/(pull|row|curl|dead hang|lat)/.test(normalized)) tags.add('pull')
  if (/(leg raise|plank|hollow|ab wheel|core|caki|cak[ıi])/.test(normalized)) tags.add('core')
  if (/(calf|squat|lunge|leg|box jump|jump)/.test(normalized)) tags.add('legs')
  if (/(stretch|esneme|mobility)/.test(normalized)) tags.add('mobility')
  if (/(walk|yuruy|kosu|run|treadmill)/.test(normalized)) tags.add('walking')
  if (/(sauna|recovery)/.test(normalized)) tags.add('recovery')
  if (/(jump|explosive)/.test(normalized)) tags.add('explosive')

  return [...tags]
}

function parseStructuredSetLine(line = '') {
  const raw = String(line || '').trim()
  const payload = raw.replace(/^set\s*\d+\s*:\s*/i, '').trim()
  if (!payload) return null

  const weightMatch = payload.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i)
  const repsMatch = payload.match(/x\s*(\d+)\b/i) || payload.match(/(\d+)\s*(?:tekrar|rep)\b/i)
  const durationSec = parseDurationSecondsFromText(payload)
  const distanceKm = parseDistanceKmFromText(payload)
  const noteMatch = payload.match(/\(([^)]+)\)/)

  const noteParts = []
  if (distanceKm) noteParts.push(`${distanceKm} km`)
  if (noteMatch?.[1]) noteParts.push(noteMatch[1].trim())

  return {
    reps: repsMatch ? Number(repsMatch[1]) : null,
    weight_kg: weightMatch ? Number(weightMatch[1].replace(',', '.')) : 0,
    duration_sec: durationSec,
    note: noteParts.join(' | '),
    distanceKm,
  }
}

function parseInlineExerciseLine(line = '', fallbackType = 'Custom') {
  const raw = String(line || '').trim()
  if (!raw || /^set\s*\d+/i.test(raw) || /^(cumartesi|pazar|pazartesi|sali|salı|carsamba|çarşamba|persembe|cuma)/i.test(normalizeLooseText(raw))) {
    return null
  }

  const durationSec = parseDurationSecondsFromText(raw)
  const distanceKm = parseDistanceKmFromText(raw)
  if (!durationSec && !distanceKm) return null

  let name = raw
    .replace(/(\d+(?:[.,]\d+)?)\s*km\b/ig, '')
    .replace(/(\d+(?:[.,]\d+)?)\s*(?:saat|hr|hour|dk|min|sn|sec|saniye)\b/ig, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!name || /^\d/.test(name)) {
    const inferredType = inferTypeFromText(raw)
    if (inferredType === 'Yuruyus') name = 'Yuruyus'
    else if (inferredType === 'Kosu') name = 'Kosu'
    else if (inferredType === 'Stretching') name = 'Esneme'
    else if (inferredType === 'Bisiklet') name = 'Bisiklet'
    else name = fallbackType === 'Custom' ? 'Accessory' : fallbackType
  }

  return {
    name,
    sets: [{
      reps: null,
      weight_kg: 0,
      duration_sec: durationSec,
      note: raw,
    }],
    distanceKm,
    tags: inferExerciseTags(name, fallbackType),
  }
}

export function parseStructuredWorkoutText(text = '') {
  const rawLines = String(text || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const headerLine = rawLines.find(line => !/^(cumartesi|pazar|pazartesi|sali|salı|carsamba|çarşamba|persembe|cuma)/i.test(normalizeLooseText(line))) || ''
  const type = inferTypeFromText(headerLine || rawLines[0] || '')
  const tags = new Set(inferExerciseTags(headerLine, type))
  const exercises = []
  const notes = []
  let durationMin = 0
  let distanceKm = 0
  let highlight = ''
  let hasExplicitDuration = false
  let currentExercise = null

  for (const line of rawLines) {
    const normalized = normalizeLooseText(line)

    if (!normalized || /^guncel kilo\b/.test(normalized) || /^kilom\b/.test(normalized) || /^boyum\b/.test(normalized)) continue
    if (/^(cumartesi|pazar|pazartesi|sali|salı|carsamba|çarşamba|persembe|cuma)/i.test(normalized)) continue

    if (/^toplam sure\b|^toplam sure:|^toplam süre\b|^toplam süre:/i.test(normalized)) {
      durationMin = parseMinutesFromText(line)
      hasExplicitDuration = durationMin > 0
      continue
    }

    const setMatch = line.match(/^set\s*\d+\s*:/i)
    if (setMatch && currentExercise) {
      const parsedSet = parseStructuredSetLine(line)
      if (parsedSet) {
        currentExercise.sets.push({
          reps: parsedSet.reps,
          weight_kg: parsedSet.weight_kg,
          duration_sec: parsedSet.duration_sec,
          note: parsedSet.note,
        })
        distanceKm += parsedSet.distanceKm || 0
      }
      continue
    }

    const looksLikeBareTimedSet = currentExercise
      && !/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(line.replace(/(?:min|dk|sn|sec|km|saat|hr|hour|\d|[.,\-()])/gi, ''))
      && (parseDurationSecondsFromText(line) || parseDistanceKmFromText(line))
    if (looksLikeBareTimedSet) {
      currentExercise.sets.push({
        reps: null,
        weight_kg: 0,
        duration_sec: parseDurationSecondsFromText(line),
        note: line,
      })
      distanceKm += parseDistanceKmFromText(line) || 0
      continue
    }

    const inlineExercise = parseInlineExerciseLine(line, type)
    if (inlineExercise && !/^toplam /.test(normalized)) {
      exercises.push({ name: inlineExercise.name, sets: [...inlineExercise.sets] })
      currentExercise = exercises[exercises.length - 1]
      if (!hasExplicitDuration) {
        durationMin += inlineExercise.sets.reduce((sum, set) => sum + Math.round((Number(set.duration_sec) || 0) / 60), 0)
      }
      distanceKm += inlineExercise.distanceKm || 0
      for (const tag of inlineExercise.tags || []) tags.add(tag)
      continue
    }

    if (/^(set|not|note)\b/i.test(normalized)) {
      notes.push(line)
      continue
    }

    currentExercise = { name: line, sets: [] }
    exercises.push(currentExercise)
    for (const tag of inferExerciseTags(line, type)) tags.add(tag)
  }

  const cleanedExercises = exercises.filter(exercise => exercise.name && exercise.sets.length)
  const totalSets = cleanedExercises.reduce((sum, exercise) => sum + exercise.sets.length, 0)
  const volumeKg = Math.round(cleanedExercises.reduce((sum, exercise) => (
    sum + exercise.sets.reduce((acc, set) => acc + ((Number(set.weight_kg) || 0) * (Number(set.reps) || 0)), 0)
  ), 0))

  let bestHighlight = null
  for (const exercise of cleanedExercises) {
    const topSet = exercise.sets.reduce((best, set) => {
      const weight = Number(set.weight_kg) || 0
      const reps = Number(set.reps) || 0
      const duration = Number(set.duration_sec) || 0
      const score = (weight * 1000) + (reps * 10) + Math.round(duration / 60)
      if (!best || score > best.score) {
        return {
          score,
          text: reps
            ? `${exercise.name} ${weight ? `${weight}kg x ${reps}` : `${reps} tekrar`}`
            : exercise.name,
        }
      }
      return best
    }, null)
    if (topSet?.text && (!bestHighlight || topSet.score > bestHighlight.score)) {
      bestHighlight = topSet
    }
  }
  if (bestHighlight?.score > 0) {
    highlight = bestHighlight.text
  } else if (cleanedExercises[0]?.name) {
    highlight = cleanedExercises[0].name
  }

  return {
    type,
    duration_min: durationMin,
    distance_km: Math.round(distanceKm * 100) / 100,
    elevation_m: 0,
    tags: [...tags],
    exercises: cleanedExercises,
    volume_kg: volumeKg,
    total_sets: totalSets,
    highlight,
    has_pr: /\bpr\b|personal record|rekor/i.test(text),
    notes: notes.join(' | '),
  }
}

function mergeParsedWorkout(heuristic, parsed) {
  const next = { ...(parsed || {}) }

  if ((Number(heuristic?.total_sets) || 0) > (Number(parsed?.total_sets) || 0)) {
    next.exercises = heuristic.exercises
    next.total_sets = heuristic.total_sets
    next.volume_kg = heuristic.volume_kg
  }

  if ((Number(heuristic?.duration_min) || 0) > (Number(parsed?.duration_min) || 0)) {
    next.duration_min = heuristic.duration_min
  }

  if ((Number(heuristic?.distance_km) || 0) > (Number(parsed?.distance_km) || 0)) {
    next.distance_km = heuristic.distance_km
  }

  if (!parsed?.type || parsed.type === 'Custom') next.type = heuristic?.type || parsed?.type || 'Custom'
  if (!parsed?.highlight && heuristic?.highlight) next.highlight = heuristic.highlight
  next.tags = [...new Set([...(parsed?.tags || []), ...(heuristic?.tags || [])])]
  next.has_pr = Boolean(parsed?.has_pr || heuristic?.has_pr)
  next.notes = [parsed?.notes, heuristic?.notes].filter(Boolean).join(' | ')

  return next
}

async function parseWithGemini(text) {
  const heuristic = parseStructuredWorkoutText(text)

  try {
    const raw = await callGeminiWithModel(buildParsePrompt(text), {
      maxTokens: 1600,
      temperature: 0.1,
      model: process.env.GEMINI_PARSE_MODEL || 'gemini-2.5-flash-lite',
      responseMimeType: 'application/json',
      responseSchema: PARSE_RESPONSE_SCHEMA,
    })
    const parsed = parseJsonText(raw)

    parsed.total_sets = Array.isArray(parsed.exercises)
      ? parsed.exercises.reduce((sum, exercise) => sum + ((exercise.sets || []).length || 0), 0)
      : 0
    parsed.volume_kg = Array.isArray(parsed.exercises)
      ? Math.round(parsed.exercises.reduce((sum, exercise) => (
        sum + (exercise.sets || []).reduce((acc, set) => acc + ((Number(set.weight_kg) || 0) * (Number(set.reps) || 0)), 0)
      ), 0))
      : 0

    return mergeParsedWorkout(heuristic, parsed)
  } catch (error) {
    console.warn('[bot] Gemini parse failed, using structured fallback:', error?.message || error)
    return heuristic
  }
}

async function getCoachResponse(parsed, context) {
  const cacheKey = JSON.stringify({
    parsed,
    streak: context.streak,
    xp: context.xp,
    className: context.className,
    recovery: context.odie?.recovery,
  })
  const cached = coachCache.get(cacheKey)
  if (cached && (Date.now() - cached.at) < 300000) return cached.value

  const raw = await callGeminiWithModel(buildCoachPromptV2(parsed, context), {
    system: ODIE_SYSTEM,
    maxTokens: 2000,
    temperature: 0.72,
    model: process.env.GEMINI_COACH_MODEL || 'gemini-2.5-flash',
    responseMimeType: 'application/json',
    responseSchema: COACH_NOTE_SCHEMA,
  })
  const parsedResponse = parseJsonText(raw)
  const draftCoachNote = parsedResponse?.coach_note || null

  const syncRaw = await callGeminiWithModel(buildStateSyncPrompt(parsed, context, draftCoachNote), {
    system: `${ODIE_SYSTEM}\nYalnizca structured state sync cikar. Abartma ve emin olmadigin alani bos birak.`,
    maxTokens: 1200,
    temperature: 0.15,
    model: process.env.GEMINI_SYNC_MODEL || process.env.GEMINI_COACH_MODEL || 'gemini-2.5-flash',
    responseMimeType: 'application/json',
    responseSchema: STATE_SYNC_SCHEMA,
  })
  const stateSync = parseJsonText(syncRaw)
  const coachNote = mergeStateSyncIntoCoachNote(draftCoachNote, stateSync, context.xp, context.streak)

  const value = {
    telegramMsg: String(parsedResponse?.telegram_msg || '').trim(),
    coachNote,
    stateSync,
  }
  coachCache.set(cacheKey, { at: Date.now(), value })
  return value
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

function normalizeDailyLogRow(row = {}) {
  return {
    date: row.date,
    waterMl: Number(row.waterMl ?? row.water_ml) || 0,
    sleepHours: Number(row.sleepHours ?? row.sleep_hours) || 0,
    steps: Number(row.steps) || 0,
    mood: Number(row.mood) || 0,
  }
}

function normalizeCoachNoteRow(row = null) {
  if (!row) return null
  return {
    ...row,
    sections: Array.isArray(row.sections) ? row.sections : [],
    warnings: Array.isArray(row.warnings) ? row.warnings : [],
    quest_hints: Array.isArray(row.quest_hints) ? row.quest_hints : [],
    skill_progress: Array.isArray(row.skill_progress) ? row.skill_progress : [],
  }
}

export function extractDirectBodyMetrics(text = '') {
  const normalized = String(text || '').toLocaleLowerCase('tr-TR')
  const weightMatch = normalized.match(/(?:kilom|kilo|weight)\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/)
  const heightMatch = normalized.match(/(?:boyum|boy|height)\s*(?:=|:)?\s*(\d+(?:[.,]\d+)?)/)
  const patch = {}

  if (weightMatch) patch.weightKg = Math.round(Number(weightMatch[1].replace(',', '.')) * 10) / 10
  if (heightMatch) patch.heightCm = Math.round(Number(heightMatch[1].replace(',', '.')))

  return Object.keys(patch).length ? patch : null
}

export function isBodyMetricsOnlyMessage(text = '') {
  const normalized = String(text || '').toLocaleLowerCase('tr-TR')
  const hasBodyMetrics = Boolean(extractDirectBodyMetrics(text))
  if (!hasBodyMetrics) return false

  const workoutSignals = [
    'set ',
    'set1',
    'set 1',
    'toplam sure',
    'toplam süre',
    'bench',
    'press',
    'raise',
    'dip',
    'extension',
    'leg raise',
    'box jump',
    'yurume',
    'yürüme',
    'kosu',
    'koşu',
    'sauna',
    'km',
    'dk',
    'tekrar',
    'x ',
    'push',
    'pull',
    'core',
    'kalf',
  ]

  return !workoutSignals.some(signal => normalized.includes(signal))
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
    const directBodyMetrics = extractDirectBodyMetrics(text)
    if (directBodyMetrics && isBodyMetricsOnlyMessage(text)) {
      const profile = await resolveProfile()
      if (!profile) throw new Error('Profil bulunamadi')

      const nextBodyMetrics = {
        ...(profile.body_metrics || {}),
        ...directBodyMetrics,
        updated_at: new Date().toISOString(),
      }

      try {
        await sbPatch('profiles', `id=eq.${profile.id}`, { body_metrics: nextBodyMetrics, last_updated: new Date().toISOString() })
      } catch (error) {
        if (!isMissingColumnError(error)) throw error
      }

      const bits = []
      if (nextBodyMetrics.weightKg) bits.push(`Kilo ${nextBodyMetrics.weightKg}kg`)
      if (nextBodyMetrics.heightCm) bits.push(`Boy ${nextBodyMetrics.heightCm}cm`)
      await sendTelegram(chatId, `<b>Vital signs guncellendi</b>\n${bits.join(' | ')}`)
      return res.status(200).json({ ok: true, bodyMetrics: nextBodyMetrics })
    }

    const parsed = await parseWithGemini(text)
    const today = getLocalDateString()
    const profile = await resolveProfile()
    if (!profile) throw new Error('Profil bulunamadi')

    const [workoutRows, dailyLogRows, coachRows] = await Promise.all([
      sbGet(`workouts?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=60`),
      sbGet(`daily_logs?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=14`),
      sbGet(`coach_notes?select=*&profile_id=eq.${profile.id}&order=date.desc,created_at.desc&limit=1`),
    ])
    const workouts = (workoutRows || []).map(row => normalizeWorkoutRow(row))
    const dailyLogs = (dailyLogRows || []).map(row => normalizeDailyLogRow(row))
    const latestCoachNote = normalizeCoachNoteRow((coachRows || [])[0] || null)
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
    let stateSync = null
    let odie = null
    try {
      odie = buildOdieContext({
        profile,
        workouts,
        dailyLogs,
        prs: currentPrs,
        coachNote: latestCoachNote,
        nextStats,
        nextClass,
        session,
        streak: streak.current,
        xpEarned: xpInfo.xpEarned,
        survival,
      })
      const coach = await getCoachResponse(parsedForCoach, {
        xp: xpInfo.xpEarned,
        streak: streak.current,
        className: nextClass.name,
        stats: nextStats,
        recentWorkouts: workouts,
        bodyMetrics: profile.body_metrics || {},
        odie,
      })
      telegramMsg = coach.telegramMsg
      coachNote = coach.coachNote
      stateSync = coach.stateSync || null
    } catch (error) {
      console.warn('[bot] coach generation failed:', error.message)
      const fallback = buildFallbackCoachResponse(parsedForCoach, {
        xp: xpInfo.xpEarned,
        streak: streak.current,
        className: nextClass.name,
        stats: nextStats,
        recentWorkouts: workouts,
        bodyMetrics: profile.body_metrics || {},
        odie: odie || buildOdieContext({
          profile,
          workouts,
          dailyLogs,
          prs: currentPrs,
          coachNote: latestCoachNote,
          nextStats,
          nextClass,
          session,
          streak: streak.current,
          xpEarned: xpInfo.xpEarned,
          survival,
        }),
      })
      telegramMsg = fallback.telegramMsg
      coachNote = fallback.coachNote
      stateSync = fallback.coachNote?.sections?.find(section => section?.hidden && section?.payload)?.payload || null
    }

    const nextBodyMetrics = clampBodyMetricsPatch(
      profile.body_metrics || {},
      directBodyMetrics || stateSync?.bodyMetrics,
    )

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
      body_metrics: nextBodyMetrics
        ? {
          ...(profile.body_metrics || {}),
          ...nextBodyMetrics,
          updated_at: new Date().toISOString(),
        }
        : (profile.body_metrics || null),
      last_updated: new Date().toISOString(),
    }

    try {
      await sbPatch('profiles', `id=eq.${profile.id}`, profilePatch)
    } catch (error) {
      if (!isMissingColumnError(error)) throw error
      await sbPatch('profiles', `id=eq.${profile.id}`, toLegacyProfilePatch(profilePatch))
    }

    if (coachNote) {
      const coachPayload = {
        profile_id: profile.id,
        workout_id: workoutId,
        date: today,
        sections: coachNote.sections || [],
        xp_note: coachNote.xp_note || `+${xpInfo.xpEarned} XP`,
        warnings: coachNote.warnings || stateSync?.warnings || survival.warnings || [],
        quest_hints: coachNote.quest_hints?.length ? coachNote.quest_hints : (stateSync?.quest_hints || []),
        skill_progress: coachNote.skill_progress?.length ? coachNote.skill_progress : (stateSync?.skill_progress || []),
      }
      try {
        await sbPost('coach_notes', coachPayload)
      } catch (error) {
        if (!isMissingColumnError(error)) throw error
        await sbPost('coach_notes', {
          profile_id: profile.id,
          workout_id: workoutId,
          date: today,
          sections: coachPayload.sections,
          xp_note: coachPayload.xp_note,
        })
      }
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
