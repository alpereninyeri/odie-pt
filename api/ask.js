import { buildOdieContext } from '../src/data/odie-context.js'
import { detectPRs } from '../src/data/pr-detector.js'
import { computeClass } from '../src/data/class-engine.js'
import { normalizeDateString, normalizeSession } from '../src/data/rules.js'
import {
  normalizeAthleteMemoryRow,
  normalizeBodyMetricsHistoryRow,
  normalizeMemoryFeedbackRow,
  normalizeWorkoutBlockRow,
  normalizeWorkoutFactRow,
} from '../src/data/memory-engine.js'

const ODIE_SYSTEM = `Sen ODIE'sin. Bu sporcunun salondaki kisisel kocu — yaninda durup goruyorsun, asistan veya yorumcu degilsin. Cevaplarin Turkce, gunluk konusma dili.

KIMLIK:
- Direkt komut veren koc tonu. Emir kipi: "yarin sunu yap", "bugun core kapat", "65kg'a 2.5kg ekleme bu hafta".
- Birinci sahis aktif: "yapacagiz", "kapatiyoruz", "keseriz" — "size onerim" gibi formal asistan dili yok.
- Yillardir bu sporcuyu taniyan biri gibi konus: tarih, ritim ve kisisel duzeni biliyorsun.

KESINLIKLE YASAK FRAZLAR (cevap iceriginde gecmesin):
- "Not aldim", "not aliyorum", "kayda gectim"
- "Okuduugum kadariyla", "gorduugum", "izledigim"
- "Yorumum", "tavsiyem", "onerim su"
- "Akiyor", "biriktirdi", "yedirdim"
- "Mukemmel", "harika", "muhtesem", "bravo", "supper", "cool", "wow"
- "Kendine guven", "vazgecme", "her gun ileri", "asla pes etme"
- "Block_mix", "parse confidence", "primary category", "ana eksen", "chain load", "spread"
- Yuzde dump: "ana akis strength %85" gibi data raporu

DUSUNME SIRASI:
1. GOZLEM — bagdaki spesifik sayiya dayali: "son 14 gunde core 3 set, onceki donemde 12'ydi."
2. SEBEP — kisa hipotez: "bench gunu uzayinca core sona kaliyor."
3. EMIR — net ve tek: "yarin core ile bashlat, 8dk yeter."

ZAMAN REFLEKSI:
- "Bu hafta..." yerine "gecen aya gore", "Subat'taki bench gununde de", "3 ay once benzerdin" tarzi karsilastirma kullan.
- Tek seansi degil, trend ve ritmi dile getir.

ZORUNLU:
- Her cumle ya bir sayi (kg, set, sn, dk, gun, %) ya bir spesifik hareket icerir — bos cumle yok.
- Cevap 3-4 cumle. Sonuncu cumle daima TEK net aksiyon: "yarin Push'a 3 set face pull ekle".
- Sayilari cumleye yedir: "65kg x3 dun dogru hizda kalkti, 67.5'a 2 hafta var" — liste/dump degil.
- Sporcu memory_feedback'te seni duzelttiyse ayni hatayi tekrarlama.
- Kanit zayifsa: "Net X yok, ama Y'den hareketle..." de. Veri uydurma.
- Risk uyarisi sade: "armor 30, agir seans bugun risk" — tehdit veya buyuk harf yok.`

const ASK_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    answer: { type: 'STRING' },
    evidence: { type: 'ARRAY', items: { type: 'STRING' } },
    next_steps: { type: 'ARRAY', items: { type: 'STRING' } },
    memory_note: { type: 'STRING' },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
  },
}

function sbHeaders() {
  const key = process.env.VITE_SUPABASE_ANON_KEY
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

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

function isMissingColumnError(error) {
  const message = String(error?.message || error || '')
  return (
    /column .* does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /table .* does not exist/i.test(message) ||
    /could not find .* column .* schema cache/i.test(message) ||
    /schema cache/i.test(message) ||
    /PGRST204/i.test(message)
  )
}

async function sbGetSafe(path, fallback = []) {
  try {
    return await sbGet(path)
  } catch (error) {
    if (isMissingColumnError(error)) return fallback
    throw error
  }
}

async function resolveProfile() {
  const explicitId = process.env.ODIEPT_PROFILE_ID
  if (explicitId) {
    const explicitRows = await sbGet(`profiles?select=*&id=eq.${explicitId}&limit=1`)
    return explicitRows?.[0] || null
  }

  const rows = await sbGet('profiles?select=*&order=last_updated.desc&limit=1')
  return rows?.[0] || null
}

async function callGeminiWithModel(prompt, {
  system = '',
  maxTokens = 1200,
  temperature = 0.3,
  model = 'gemini-2.5-pro',
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

function parseJsonText(raw = '') {
  try {
    const cleaned = String(raw || '').trim().replace(/^```json\s*|\s*```$/g, '')
    return JSON.parse(cleaned)
  } catch {
    return null
  }
}

function normalizeWorkoutRow(row = {}) {
  return normalizeSession({
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
    source: row.source || 'manual',
    createdAt: row.created_at,
    tags: row.tags || [],
    primaryCategory: row.primary_category,
    intensity: row.intensity,
    distanceKm: row.distance_km,
    elevationM: row.elevation_m,
    blocks: row.blocks || [],
  }, { source: row.source || 'manual' })
}

function normalizeDailyLogRow(row = {}) {
  return {
    date: row.date,
    waterMl: Number(row.water_ml ?? row.waterMl) || 0,
    sleepHours: Number(row.sleep_hours ?? row.sleepHours) || 0,
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

function normalizeQuestionRow(row = {}) {
  return {
    id: row.id || null,
    question: String(row.question || '').trim(),
    answer: String(row.answer || '').trim(),
    responseJson: row.response_json || {},
    tags: Array.isArray(row.tags) ? row.tags : [],
    model: row.model || '',
    source: row.source || 'web',
    createdAt: row.created_at || null,
  }
}

function buildCurrentPrs(workouts = []) {
  const ordered = [...workouts].sort((left, right) => normalizeDateString(left.date).localeCompare(normalizeDateString(right.date)))
  let prs = {}
  for (const workout of ordered) {
    prs = detectPRs(workout, prs).updatedPrs
  }
  return prs
}

function summarizeRecentQuestions(items = []) {
  return items
    .slice(0, 5)
    .map(item => `- Soru: ${item.question}\n  Cevap izi: ${item.answer}`)
    .join('\n') || '- soru hafizasi yok'
}

function summarizeRecentPrs(prs = []) {
  return prs
    .slice(0, 5)
    .map(item => `- ${item.name}: ${item.value} (${item.date})`)
    .join('\n') || '- son PR sinyali yok'
}

function summarizeRecentWorkouts(items = []) {
  return items
    .slice(0, 6)
    .map(item => `- ${item.date} · ${item.type} · ${item.durationMin || 0}dk · ${item.highlight || '-'}`)
    .join('\n') || '- son workout kaydi yok'
}

function buildAskPrompt(question, context) {
  const odie = context.odie || {}
  const spread = odie.stats?.spread || context.profile.stats || {}
  const weakest = odie.stats?.weakest
  const strongest = odie.stats?.strongest
  const recovery = odie.recovery || {}
  const questPressure = (odie.questPressure || [])
    .slice(0, 4)
    .map(item => `- ${item.name}: ${item.progress}/${item.total} · ${item.reward}`)
    .join('\n') || '- aktif quest baskisi yok'
  const skillPressure = (odie.skillPressure || [])
    .slice(0, 4)
    .map(item => `- ${item.branch} · ${item.name} · ${item.status}`)
    .join('\n') || '- skill baskisi yok'
  const focusGaps = (odie.focusGaps || [])
    .map(item => `- ${item}`)
    .join('\n') || '- bariz gap yok'
  const trendSignals = (odie.loadProfile?.trendSignals || [])
    .map(item => `- ${item}`)
    .join('\n') || '- trend sinyali zayif'
  const historicalEcho = (odie.historicalEcho?.summarySentences || [])
    .map(item => `- ${item}`)
    .join('\n') || '- karsilastirmali gecmis verisi yok'
  const last30Prs = (odie.historicalEcho?.recentPrs || [])
    .map(pr => `- ${pr.name} ${pr.weightKg ? `${pr.weightKg}kg×${pr.reps || 1}` : pr.reps ? `${pr.reps} rep` : `${pr.durationSec}sn`} (${pr.date})`)
    .join('\n') || '- son 30 gunde PR yok'
  const athleteMemory = (odie.athleteMemory || [])
    .map(item => `- [${item.scope}] ${item.summary}`)
    .join('\n') || '- athlete memory yok'
  const feedbackMemory = (odie.correctiveMemory?.latest || [])
    .map(item => `- ${item.feedbackType}: ${item.note || 'geri bildirim'}`)
    .join('\n') || '- corrective memory yok'
  const questionMemory = summarizeRecentQuestions(context.questionHistory)
  const recentPrs = summarizeRecentPrs(odie.recentPrs || [])
  const recentWorkouts = summarizeRecentWorkouts(odie.recentWorkouts || [])

  return `Kullanici sorusu:
${question}

Atlet profili:
- Class: ${context.className}
- Sub-Class: ${context.subClass}
- Rank: ${context.profile.rank || '-'}
- Level: ${context.profile.level || 1}
- Sessions: ${context.profile.sessions || 0}
- Stats: STR ${spread.str ?? '-'} · AGI ${spread.agi ?? '-'} · END ${spread.end ?? '-'} · DEX ${spread.dex ?? '-'} · CON ${spread.con ?? '-'} · STA ${spread.sta ?? '-'}
- En zayif stat: ${weakest?.key || '-'} ${weakest?.val ?? ''}
- En guclu stat: ${strongest?.key || '-'} ${strongest?.val ?? ''}
- Recovery: armor ${recovery.armor ?? '-'} · fatigue ${recovery.fatigue ?? '-'} · status ${recovery.status || '-'}

Son workout izi:
${recentWorkouts}

Son PR izi:
${recentPrs}

Trend sinyali (son 14 gun vs onceki 14):
${trendSignals}

Karsilastirmali gecmis (son 30 gun, onceki 30, 1 yil once ayni hafta):
${historicalEcho}

Son 30 gunde guncellenen PR'lar:
${last30Prs}

Focus gap:
${focusGaps}

Quest baskisi:
${questPressure}

Skill baskisi:
${skillPressure}

Athlete memory:
${athleteMemory}

Corrective memory:
${feedbackMemory}

Soru hafizasi:
${questionMemory}

JSON disinda bir sey donme. Tum tonlama kurallari sistem promptunda; burada sadece sema:

- title: sorunun ozune deger, kisa ("Core Olcumune Bakis" gibi). "Yorumum" veya "Notum" yazma.
- answer: 3-4 cumle. Sirasi: gozlem (sayili) -> sebep -> EMIR. Son cumle her zaman tek net aksiyon: "yarin Push'a 3 set face pull ekle" gibi. "Not aldim", "okudum", "yorumum", "akiyor" yasak.
- evidence: yalnizca bagdaki kanitlardan 2-4 madde. Uydurma.
- next_steps: 2-3 madde, her biri tek emir (set/sn/kg/gun seviyesinde), oncelik sirali.
- memory_note: varsa kalici kaygi/hedef/tercih ozetini tek satir.
- tags: en fazla 4 kisa etiket.`
}

function buildFallbackAnswer(question, context) {
  const weakest = context.odie?.stats?.weakest
  const gaps = context.odie?.focusGaps || []
  return {
    title: 'Temkinli Okuma',
    answer: `${question} icin tum baglam mevcut degil ama su anki tablo ${weakest?.key || 'denge'} tarafinda baski oldugunu gosteriyor. Cevabi recovery ve son yuk sinyallerine yaslayarak verdim; kesin olmayan yerde agresif yonlendirme yapmadim.`,
    evidence: [
      ...(gaps.slice(0, 2)),
      ...(context.odie?.loadProfile?.trendSignals || []).slice(0, 2),
    ].slice(0, 4),
    next_steps: [
      'Bir sonraki seansta yuk ve sureyi net logla.',
      'Recovery verisini uyku ve su ile tamamla.',
      'Core veya bacak eksigi varsa kisa ama direkt blok ekle.',
    ],
    memoryNote: weakest?.key ? `${String(weakest.key).toUpperCase()} hatti soru tarafinda da tekrar ediyor.` : '',
    tags: ['ask', 'fallback'],
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const profile = await resolveProfile()
      if (!profile) return res.status(200).json({ ok: true, items: [] })

      const rows = await sbGetSafe(`odie_questions?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=12`, [])
      const items = (rows || []).map(row => normalizeQuestionRow(row))
      return res.status(200).json({ ok: true, items })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    const question = String(req.body?.question || '').trim()
    if (!question) {
      return res.status(400).json({ ok: false, error: 'Soru bos olamaz' })
    }

    const profile = await resolveProfile()
    if (!profile) {
      return res.status(404).json({ ok: false, error: 'Profil bulunamadi' })
    }

    const [workoutRows, dailyLogRows, coachRows, athleteMemoryRows, memoryFeedbackRows, bodyMetricsHistoryRows, workoutBlockRows, workoutFactRows, questionRows] = await Promise.all([
      sbGet(`workouts?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=60`),
      sbGet(`daily_logs?select=*&profile_id=eq.${profile.id}&order=date.desc&limit=14`),
      sbGetSafe(`coach_notes?select=*&profile_id=eq.${profile.id}&order=date.desc,created_at.desc&limit=1`, []),
      sbGetSafe(`athlete_memory?select=*&profile_id=eq.${profile.id}&active=eq.true&order=last_used_at.desc,created_at.desc&limit=24`, []),
      sbGetSafe(`memory_feedback?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=24`, []),
      sbGetSafe(`body_metrics_history?select=*&profile_id=eq.${profile.id}&order=date.desc,created_at.desc&limit=30`, []),
      sbGetSafe(`workout_blocks?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=320`, []),
      sbGetSafe(`workout_facts?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=320`, []),
      sbGetSafe(`odie_questions?select=*&profile_id=eq.${profile.id}&order=created_at.desc&limit=8`, []),
    ])

    const workouts = (workoutRows || []).map(row => normalizeWorkoutRow(row))
    const dailyLogs = (dailyLogRows || []).map(row => normalizeDailyLogRow(row))
    const latestCoachNote = normalizeCoachNoteRow((coachRows || [])[0] || null)
    const athleteMemory = (athleteMemoryRows || []).map(row => normalizeAthleteMemoryRow(row))
    const memoryFeedback = (memoryFeedbackRows || []).map(row => normalizeMemoryFeedbackRow(row))
    const bodyMetricsHistory = (bodyMetricsHistoryRows || []).map(row => normalizeBodyMetricsHistoryRow(row))
    const workoutBlocks = (workoutBlockRows || []).map(row => normalizeWorkoutBlockRow(row))
    const workoutFacts = (workoutFactRows || []).map(row => normalizeWorkoutFactRow(row))
    const questionHistory = (questionRows || []).map(row => normalizeQuestionRow(row))
    const currentClass = computeClass(workouts)
    const currentPrs = buildCurrentPrs(workouts)

    const odie = buildOdieContext({
      profile,
      workouts,
      dailyLogs,
      athleteMemory,
      memoryFeedback,
      bodyMetricsHistory,
      workoutBlocks,
      workoutFacts,
      prs: currentPrs,
      coachNote: latestCoachNote,
      nextStats: profile.stats || {},
      nextClass: currentClass,
      streak: Number(profile.streak_current) || 0,
      xpEarned: 0,
      survival: {
        armor: Number(profile.armor_current) || 100,
        fatigue: Number(profile.fatigue_current) || 0,
        status: profile.survival_status || 'healthy',
        warnings: Array.isArray(latestCoachNote?.warnings) ? latestCoachNote.warnings : [],
      },
    })

    let parsed = null
    const model = process.env.GEMINI_ASK_MODEL || process.env.GEMINI_MODEL || process.env.GEMINI_COACH_MODEL || 'gemini-2.5-pro'
    try {
      const raw = await callGeminiWithModel(buildAskPrompt(question, {
        questionHistory,
        odie,
        profile,
        className: currentClass?.name || profile.class,
        subClass: currentClass?.subName || profile.sub_class || profile.subClass,
      }), {
        system: ODIE_SYSTEM,
        maxTokens: 1800,
        temperature: 0.45,
        model,
        responseMimeType: 'application/json',
        responseSchema: ASK_RESPONSE_SCHEMA,
      })
      parsed = parseJsonText(raw)
    } catch (error) {
      console.warn('[ask] Gemini failed:', error?.message || error)
    }

    const structured = parsed || buildFallbackAnswer(question, { odie })
    const itemPayload = {
      profile_id: profile.id,
      source: 'web',
      question,
      answer: String(structured.answer || '').trim(),
      response_json: {
        title: structured.title || 'ODIE cevabi',
        answer: structured.answer || '',
        evidence: Array.isArray(structured.evidence) ? structured.evidence : [],
        nextSteps: Array.isArray(structured.next_steps)
          ? structured.next_steps
          : Array.isArray(structured.nextSteps)
            ? structured.nextSteps
            : [],
        memoryNote: structured.memory_note || structured.memoryNote || '',
      },
      tags: Array.isArray(structured.tags) ? structured.tags.slice(0, 4) : [],
      model,
    }

    let saved = null
    try {
      const rows = await sbPost('odie_questions', itemPayload)
      saved = normalizeQuestionRow(rows?.[0] || itemPayload)
    } catch (error) {
      if (!isMissingColumnError(error)) throw error
      saved = normalizeQuestionRow({
        ...itemPayload,
        id: `tmp-${Date.now()}`,
        created_at: new Date().toISOString(),
      })
    }

    return res.status(200).json({ ok: true, item: saved })
  } catch (error) {
    console.error('[ask] error:', error)
    return res.status(500).json({ ok: false, error: error.message || 'Ask route failed' })
  }
}
