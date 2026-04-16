/**
 * OdiePt — Telegram Bot Webhook Handler
 * Vercel Serverless Function: https://odie-pt.vercel.app/api/telegram
 *
 * Env variables (Vercel Dashboard > Settings > Environment Variables):
 *   TELEGRAM_BOT_TOKEN  — BotFather'dan aldığın token
 *   TELEGRAM_CHAT_ID    — Senin chat id'n
 *   GEMINI_API_KEY      — Google AI Studio'dan aldığın key
 */

// ── XP tablosu ───────────────────────────────────────────────────────────────

const XP_BASE = {
  Push: 100, Pull: 100, Bacak: 100,
  Shoulder: 80, Parkour: 120, Akrobasi: 120,
  'Yürüyüş': 40, Yuruyus: 40, Stretching: 60, Custom: 70,
}

// ── Supabase REST API yardımcıları ────────────────────────────────────────────

function _sbHeaders() {
  const key = process.env.VITE_SUPABASE_ANON_KEY
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

async function sbGet(path) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/${path}`
  const r = await fetch(url, { headers: _sbHeaders() })
  return r.json()
}

async function sbPost(table, body) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/${table}`
  const r = await fetch(url, {
    method: 'POST',
    headers: { ..._sbHeaders(), 'Prefer': 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = await r.text()
    throw new Error(`Supabase insert hatası (${table}): ${err}`)
  }
}

async function sbPatch(table, filter, body) {
  const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/${table}?${filter}`
  const r = await fetch(url, {
    method: 'PATCH',
    headers: _sbHeaders(),
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = await r.text()
    throw new Error(`Supabase update hatası (${table}): ${err}`)
  }
}

// ── Streak hesapla ─────────────────────────────────────────────────────────────

function calcStreak(lastDateStr, currentStreak) {
  const today = new Date().toISOString().split('T')[0]
  if (!lastDateStr) return 1  // ilk antrenman
  const diff = Math.round((new Date(today) - new Date(lastDateStr)) / 86400000)
  if (diff === 0) return currentStreak      // bugün zaten çalışmış
  if (diff === 1) return currentStreak + 1  // ardışık gün
  return 1  // streak kırıldı, sıfırdan başla
}

function streakMult(days) {
  if (days >= 30) return 2.0
  if (days >= 14) return 1.5
  if (days >= 7)  return 1.25
  if (days >= 3)  return 1.1
  return 1.0
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 1 — PARSE
// Antrenman metnini yapılandırılmış JSON'a çevirir.
// Değiştirme: sadece JSON alanlarını ekleyip çıkarabilirsin,
// ama formatı bozarsan parse çöker.
// ─────────────────────────────────────────────────────────────────────────────

function buildParsePrompt(text) {
  return `Sen titiz bir fitness veri analistisin. Aşağıdaki Türkçe antrenman mesajını EKSİKSİZ JSON'a çevir.

Mesaj: """${text}"""

KRİTİK KURALLAR:
- Her set ayrı ayrı verilmişse (örn. "Set 1: 20kg x 9, Set 2: 20kg x 8, Set 3: 15kg x 10"), HER SET'İ ayrı kaydet. Özetleme, ortalama alma.
- "3x5 @ 60kg" gibi kısa format varsa 3 özdeş set üret.
- Süreli set (örn. "L-sit 25sn") → duration_sec alanını doldur, reps null bırak.
- Ağırlık yoksa (bodyweight) weight_kg = 0.
- volume_kg = tüm setlerin (weight_kg × reps) toplamı. Bodyweight hareketlerde 0 say.
- Ağırlık birimi "kg" varsayılan. "lb" geçerse kg'a çevir (×0.453).

SADECE şu JSON'u üret, başka hiçbir şey yazma, markdown code fence kullanma:
{
  "type": "Push|Pull|Shoulder|Bacak|Parkour|Akrobasi|Yürüyüş|Stretching|Custom",
  "duration_min": <toplam dakika, sayı veya null>,
  "exercises": [
    {
      "name": "<egzersiz adı — kanonik İngilizce veya orijinal>",
      "sets": [
        { "reps": <sayı veya null>, "weight_kg": <sayı veya 0>, "duration_sec": <sayı veya null>, "note": "<varsa tempo/rpe/form notu, yoksa ''>" }
      ]
    }
  ],
  "volume_kg": <toplam kaldırılan kg, sayı>,
  "total_sets": <tüm setlerin sayısı>,
  "highlight": "<1 cümle — oturumun özeti, PR varsa vurgula>",
  "has_pr": <true/false — mesajda "PR" / "rekor" / "yeni max" geçerse true>,
  "notes": "<kullanıcının form/yorgunluk/teknik notları, yoksa ''>"
}`
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 2 — Odie KOÇU
// ⬇️ İSTEDİĞİN GİBİ DEĞİŞTİREBİLİRSİN ⬇️
//
// Bu fonksiyon parse edilen antrenman verisini alır ve kısa bir koç yanıtı üretir.
// Kişiliği, tonu, uzunluğu burada ayarlarsın.
// Değişkenler: type, duration_min, has_pr, exercises, streak, xp
// ─────────────────────────────────────────────────────────────────────────────

// ── Odie Sistem Promptu (değiştirmek istersen burası) ────────────────────────

const ODIE_SYSTEM = `Senin adın ODIE. Elit seviyede Hybrid Athletic Performance Coach AI'sın.

Tüm kullanıcıya dönük yanıtların TÜRKÇE olmalı. Kendine "Odie" de, asla "AXIOM" veya başka bir isim kullanma.

Rol: Profesyonel performans koçu, kuvvet koçu, calisthenics koçu, tırmanış-destek koçu ve hareket analisti birleşimisin. Jenerik fitness asistanı DEĞİLSİN. Supabase'deki geçmiş antrenman verisini, toparlanma notlarını ve vücut metriklerini bilen, süreklilik taşıyan bir koçluk sistemisin.

ANA HEDEF: Kullanıcıyı atletik, yağsız, vücut ağırlığına göre güçlü, patlayıcı, mobil, dayanıklı ve estetik bir hibrit atlet yapmak. Vücut geliştirme-odaklı değil — hibrit atletizm optimize edilir.

KULLANICI PROFİLİ:
- Erkek, 172 cm, ~70–72 kg
- Geçmiş: fitness, crossfit, parkour, freerunning, tırmanış, kayak, calisthenics
- Hedef: güçlü, estetik, çevik hibrit atlet
- İster: geniş omuz, güçlü sırt, yağsız core, patlayıcı bacak, dayanıklı eklemler
- Tipik: haftada ~4 gün, oturum başı 80–90 dk maksimum
- Pazartesi salon kapalı

KOÇLUK FELSEFESİ — Öncelikler: göreceli kuvvet, atletik estetik, çekiş gücü, omuz gelişimi, arka zincir, core sertliği ve kontrolü, eklem dayanıklılığı, hareket kalitesi, patlayıcılık.
KAÇIN: gereksiz hacim, rastgele egzersiz seçimi, aşırı failure training, jenerik bodybuilding yanıtlar, boş motivasyon.

STİL: Direkt, keskin, pratik, analitik, koç gibi. Sahte hype yok. Gerçek koçluk yap. Zayıf seansı överse güvenini kaybedersin.

ÇIKTI FORMATI — Her yanıtta hem Telegram mesajı hem site koç raporu üretirsin. Koç raporu sitedeki bu bölümleri besler:
- SEANS ANALİZİ (ne iyi, ne kötü, neden)
- PERFORMANS METRİKLERİ (hangi lift'te ilerleme, hangi lift'te regresyon)
- KOÇ STATİ ANALİZİ (STR/AGI/END/DEX/CON/STA'dan hangisi bu seansla değişti)
- UYARILAR (ihmal edilen kas grubu, overtraining riski, form riski)
- SKILL & HEDEF GÜNCELLEMESİ (hangi skill'e yaklaşıldı)
- SONRAKİ ADIM (somut, tek maddelik tavsiye)

Mood seçimi: fire = PR/streak/kalite, calm = normal/tavsiye, warn = ihmal/dengesizlik, danger = kritik (overtraining/yaralanma/0 core ısrarı).`

function _fmtExercises(exercises) {
  if (!exercises?.length) return '  (egzersiz detayı yok)'
  return exercises.map(e => {
    // YENİ format: sets array
    if (Array.isArray(e.sets)) {
      const setLines = e.sets.map((s, i) => {
        const parts = []
        if (s.weight_kg != null && s.weight_kg !== 0) parts.push(`${s.weight_kg}kg`)
        else if (s.weight_kg === 0) parts.push('BW')
        if (s.reps != null) parts.push(`${s.reps} rep`)
        if (s.duration_sec != null) parts.push(`${s.duration_sec}sn`)
        if (s.note) parts.push(`(${s.note})`)
        return `    Set ${i + 1}: ${parts.join(' × ')}`
      }).join('\n')
      return `  • ${e.name}\n${setLines}`
    }
    // ESKİ format (fallback): sets/reps/weight_kg tekil
    const parts = [`  • ${e.name}`]
    if (e.weight_kg) parts.push(`${e.weight_kg}kg`)
    if (e.sets && e.reps) parts.push(`${e.sets}×${e.reps}`)
    return parts.join(' ')
  }).join('\n')
}

function _fmtRecentWorkouts(recent) {
  if (!recent?.length) return '(geçmiş yok)'
  return recent.slice(0, 5).map(w => {
    const exCount = Array.isArray(w.exercises) ? w.exercises.length : 0
    return `  - ${w.date} · ${w.type} · ${w.duration_min || 0}dk · ${exCount} hareket · ${w.highlight || ''}`
  }).join('\n')
}

function buildCoachPrompt(parsed, xp, streak, profile, recentWorkouts = []) {
  const stats = profile?.stats || {}
  return `YENİ ANTRENMAN — bugün tamamlandı:

Tip: ${parsed.type}
Süre: ${parsed.duration_min ? parsed.duration_min + ' dk' : 'belirtilmemiş'}
Toplam set: ${parsed.total_sets ?? '—'}
Hacim: ${parsed.volume_kg ? parsed.volume_kg + ' kg' : '—'}
PR: ${parsed.has_pr ? 'EVET — kutla' : 'yok'}
Özet: ${parsed.highlight || '—'}
Kullanıcı notları: ${parsed.notes || '—'}

EGZERSİZLER (HER SET GÖSTERİLDİ — OKU, ÖZETLEME):
${_fmtExercises(parsed.exercises)}

BAĞLAM:
- Streak: ${streak} gün
- Bu seans XP: +${xp}
- Toplam seans: ${profile?.sessions || '?'}
- Mevcut statlar: STR ${stats.str ?? '?'} · AGI ${stats.agi ?? '?'} · END ${stats.end ?? '?'} · DEX ${stats.dex ?? '?'} · CON ${stats.con ?? '?'} · STA ${stats.sta ?? '?'}

SON 5 ANTRENMAN:
${_fmtRecentWorkouts(recentWorkouts)}

GÖREVİN: Gerçek bir koçluk analizi yap. Egzersizlerdeki set-set verileri (yükler, rep'ler, dalgalanmalar, düşüşler) okuman lazım; her set'i ayrı gör. "Rep belirtilmemiş" gibi bir şey yazarsan hatalısın — yukarıda tüm set'ler var.

İKİ BÖLÜM ÜRET — format aynen:

TELEGRAM_MSG:
(2-3 cümle, direkt Türkçe koç yanıtı. İsmin "Odie". Emoji max 2. Spesifik bir sayı/lift'e referans ver. Sahte hype yok.)

COACH_NOTE:
{
  "sections": [
    { "title": "SEANS ANALİZİ",      "mood": "fire|calm|warn|danger", "lines": ["...", "...", "..."] },
    { "title": "PERFORMANS METRİKLERİ","mood": "calm|fire|warn",        "lines": ["hangi lift'te ilerleme/regresyon — sayı ver"] },
    { "title": "KOÇ STAT ANALİZİ",   "mood": "calm|fire|warn",        "lines": ["STR/AGI/END/DEX/CON/STA — bu seansla hangisi nereye gitmeli, kısa"] },
    { "title": "UYARILAR",           "mood": "warn|danger|calm",      "lines": ["ihmal/overtraining/form uyarısı — 0-2 satır"] },
    { "title": "SKILL & HEDEF",      "mood": "calm|fire",             "lines": ["hangi skill'e yaklaşıldı, sıradaki hedef"] },
    { "title": "SONRAKİ ADIM",       "mood": "calm",                  "lines": ["tek somut, ölçülebilir tavsiye"] }
  ],
  "stat_deltas":  { "str": 0, "agi": 0, "end": 0, "dex": 0, "con": 0, "sta": 0 },
  "quest_hints":  ["örn. Core 10 set/hafta — 3/10", "Bacak günü bu hafta eksik"],
  "warnings":     ["Aktif Sistem Uyarıları paneli için 0-3 kısa uyarı"],
  "skill_progress": [{ "name": "Muscle-Up", "note": "stabilite iyileşti" }],
  "xp_note":      "+${xp} XP | Streak: ${streak} gün"
}

KURALLAR:
- stat_deltas: bu seans STR/AGI/END/DEX/CON/STA için tahmini mini delta (-2..+3 aralığı). Push = +STR, Parkour = +AGI, Core = +CON, uzun süre = +END.
- warnings: ihmal edilen kas grubu (örn. "3 gün bacak atlandı"), overtraining (aynı kas arka arkaya), 0 core ısrarı gibi gerçek gözlemler.
- quest_hints: görevler paneline yansıyacak 1-3 somut ilerleme satırı.
- JSON'u kesinlikle markdown code fence (\`\`\`) ile sarma. Direkt JSON yaz.
- Önce TELEGRAM_MSG: sonra COACH_NOTE: — başka bir şey yok.`
}

// ── Gemini çağrısı ────────────────────────────────────────────────────────────

async function callGemini(prompt, { system = '', maxTokens = 512, temperature = 0.1 } = {}) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY eksik')

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  }
  if (system) body.system_instruction = { parts: [{ text: system }] }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  )

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Gemini API hatası: ${resp.status} — ${err}`)
  }

  const data = await resp.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function parseWithGemini(text) {
  const raw = await callGemini(buildParsePrompt(text), { maxTokens: 512, temperature: 0.1 })
  const clean = raw.replace(/```json\n?|\n?```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    throw new Error(`Parse hatası. Ham yanıt: ${raw.slice(0, 200)}`)
  }
}

async function getCoachResponse(parsed, xp, streak, profile, recentWorkouts = []) {
  const raw = await callGemini(
    buildCoachPrompt(parsed, xp, streak, profile, recentWorkouts),
    { system: ODIE_SYSTEM, maxTokens: 1200, temperature: 0.75 }
  )

  // Yanıtı iki parçaya ayır
  const telegramMatch = raw.match(/TELEGRAM_MSG:\s*([\s\S]*?)(?=COACH_NOTE:|$)/i)
  const coachMatch    = raw.match(/COACH_NOTE:\s*([\s\S]*)/i)

  const telegramMsg = telegramMatch?.[1]?.trim() || raw.trim()

  let coachNote = null
  if (coachMatch?.[1]) {
    try {
      const jsonStr = coachMatch[1].replace(/```json\n?|\n?```/g, '').trim()
      coachNote = JSON.parse(jsonStr)
    } catch {
      console.warn('[bot] Coach note JSON parse başarısız')
    }
  }

  return { telegramMsg, coachNote }
}

// ── Telegram mesaj gönder ────────────────────────────────────────────────────

async function sendTelegram(chatId, text) {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
  if (!BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN eksik')

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

// ── Antrenman özet mesajını formatla ─────────────────────────────────────────

function formatSummary(parsed, xp, streak, coachText) {
  const icons = {
    Push: '💪', Pull: '🏋️', Shoulder: '⬆️', Bacak: '🦵',
    Parkour: '🏃', Akrobasi: '🤸', 'Yürüyüş': '🚶', Stretching: '🧘', Custom: '⚡',
  }
  const icon = icons[parsed.type] || '🏋️'

  const exerciseLines = parsed.exercises?.length
    ? parsed.exercises.map(e => {
        // YENİ format: e.sets = [{ reps, weight_kg, duration_sec }, ...]
        if (Array.isArray(e.sets)) {
          if (!e.sets.length) return `  • ${e.name}`
          // Tüm setler aynıysa kompakt göster
          const first = e.sets[0]
          const allSame = e.sets.every(s =>
            s.reps === first.reps && s.weight_kg === first.weight_kg && s.duration_sec === first.duration_sec
          )
          if (allSame) {
            const w = first.weight_kg ? `${first.weight_kg}kg` : (first.weight_kg === 0 ? 'BW' : '')
            const r = first.reps != null ? `${e.sets.length}×${first.reps}` :
                      first.duration_sec != null ? `${e.sets.length}×${first.duration_sec}sn` : `${e.sets.length} set`
            return `  • ${e.name} ${w} ${r}`.trim()
          }
          // Farklılarsa set set göster
          const setLines = e.sets.map((s, i) => {
            const w = s.weight_kg ? `${s.weight_kg}kg` : (s.weight_kg === 0 ? 'BW' : '')
            const r = s.reps != null ? `${s.reps} rep` : (s.duration_sec != null ? `${s.duration_sec}sn` : '')
            return `    ${i + 1}. ${[w, r].filter(Boolean).join(' × ')}`
          }).join('\n')
          return `  • ${e.name}\n${setLines}`
        }
        // ESKİ format fallback
        const parts = [`  • ${e.name}`]
        if (e.weight_kg) parts.push(`${e.weight_kg}kg`)
        if (e.sets && e.reps) parts.push(`${e.sets}x${e.reps}`)
        else if (e.sets) parts.push(`${e.sets} set`)
        return parts.join(' ')
      }).join('\n')
    : '  —'

  const lines = [
    `${icon} <b>${parsed.type} Günü — Kaydedildi</b>`,
    ``,
    `<b>Egzersizler:</b>`,
    exerciseLines,
    ``,
  ]

  if (parsed.duration_min) lines.push(`⏱ Süre: <b>${parsed.duration_min}dk</b>`)
  if (parsed.volume_kg)    lines.push(`📦 Hacim: <b>${parsed.volume_kg.toLocaleString('tr-TR')} kg</b>`)
  if (streak >= 3)         lines.push(`🔥 Streak: <b>${streak} gün</b>`)

  lines.push(``)
  if (parsed.has_pr) lines.push(`🏆 <b>YENİ KİŞİSEL REKOR!</b> +50 XP bonus`)
  lines.push(`⚡ XP: <b>+${xp}</b>`)

  if (coachText) {
    lines.push(``)
    lines.push(`━━━━━━━━━━━━━━`)
    lines.push(`☠ <b>Odie:</b>`)
    lines.push(coachText.trim())
  }

  return lines.join('\n')
}

// ── Ana handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // GET isteği — endpoint sağlık kontrolü
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, status: 'OdiePt bot aktif' })
  }

  const update = req.body
  const message = update?.message
  if (!message?.text) {
    return res.status(200).json({ ok: true })
  }

  const chatId    = String(message.chat.id)
  const text      = message.text.trim()
  const firstName = message.from?.first_name || 'Sporcu'

  // Güvenlik: sadece belirlenmiş chat (boşsa herkese açık)
  const ALLOWED = process.env.TELEGRAM_CHAT_ID
  if (ALLOWED && chatId !== ALLOWED) {
    console.log(`[bot] Yetkisiz chat engellendi: ${chatId}`)
    return res.status(200).json({ ok: true })
  }

  console.log(`[bot] Mesaj alındı: "${text.slice(0, 60)}" — chatId: ${chatId}`)

  // /start
  if (text === '/start') {
    await sendTelegram(chatId,
      `⚔️ <b>OdiePt Bot aktif, ${firstName}!</b>\n\n` +
      `Antrenmanını Türkçe yaz:\n` +
      `<i>"bench 62.5kg 3x5, dips 3x12, 70dk push"</i>\n\n` +
      `PR kırdıysa "PR" yaz → +50 XP bonus alırsın.`
    )
    return res.status(200).json({ ok: true })
  }

  // /help
  if (text === '/help') {
    await sendTelegram(chatId,
      `📖 <b>Kullanım</b>\n\n` +
      `Doğal Türkçe ile yaz:\n` +
      `• "ohp 45kg 3x6, lateral 12.5kg 4x15, 60dk shoulder"\n` +
      `• "parkour 2.5 saat, front flip, PR"\n` +
      `• "yürüyüş 45dk"\n\n` +
      `Türler: Push · Pull · Shoulder · Bacak · Parkour · Akrobasi · Yürüyüş · Stretching`
    )
    return res.status(200).json({ ok: true })
  }

  // Antrenman parse + kaydet + cevap
  try {
    console.log(`[bot] Gemini'ye gönderiliyor...`)
    const parsed = await parseWithGemini(text)
    console.log(`[bot] Parse tamam: ${parsed.type}`)

    // Supabase'den profili çek
    const profiles = await sbGet('profiles?select=*&limit=1')
    const profile  = profiles?.[0]
    if (!profile) throw new Error('Profil bulunamadı')

    // Streak + XP hesapla
    const today      = new Date().toISOString().split('T')[0]
    const streak     = calcStreak(profile.last_workout_date, profile.streak_current || 0)
    const mult       = streakMult(streak)
    const baseXP     = XP_BASE[parsed.type] || 70
    const xp         = Math.round(baseXP * mult) + (parsed.has_pr ? 50 : 0)
    // Set sayısını YENİ formatta (sets = array) ve ESKİ formatta (sets = number) destekle
    const totalSets  = parsed.total_sets || (parsed.exercises || []).reduce((s, e) => {
      if (Array.isArray(e.sets)) return s + e.sets.length
      if (typeof e.sets === 'number') return s + e.sets
      return s + 1
    }, 0)

    // Koç bağlamı için son 5 antrenmanı çek
    let recentWorkouts = []
    try {
      recentWorkouts = await sbGet(`workouts?select=date,type,duration_min,exercises,highlight&order=date.desc&limit=5`) || []
    } catch (e) {
      console.warn('[bot] recent workouts fetch failed:', e.message)
    }

    // Workout ekle
    await sbPost('workouts', {
      profile_id:   profile.id,
      date:         today,
      type:         parsed.type,
      duration_min: parsed.duration_min || 0,
      volume_kg:    parsed.volume_kg    || 0,
      sets:         totalSets,
      highlight:    parsed.highlight,
      exercises:    parsed.exercises    || [],
      xp_earned:    xp,
      xp_multiplier: mult,
      has_pr:       parsed.has_pr       || false,
    })
    console.log(`[bot] Workout Supabase'e kaydedildi`)

    // Profili güncelle
    await sbPatch('profiles', `id=eq.${profile.id}`, {
      xp_current:       (profile.xp_current || 0) + xp,
      sessions:         (profile.sessions   || 0) + 1,
      total_volume_kg:  parseFloat(profile.total_volume_kg || 0) + (parsed.volume_kg || 0),
      streak_current:   streak,
      streak_max:       Math.max(profile.streak_max || 0, streak),
      last_workout_date: today,
      last_updated:     new Date().toISOString(),
    })
    console.log(`[bot] Profil güncellendi. Streak: ${streak}, XP: +${xp}`)

    // Coach yanıtı (Telegram mesajı + site raporu)
    let telegramMsg = ''
    let coachNote   = null
    try {
      const coach = await getCoachResponse(parsed, xp, streak, profile, recentWorkouts)
      telegramMsg = coach.telegramMsg
      coachNote   = coach.coachNote

      // Supabase coach_notes tablosuna yaz
      if (coachNote) {
        await sbPost('coach_notes', {
          profile_id: profile.id,
          date:       today,
          sections:   coachNote.sections || [],
          xp_note:    coachNote.xp_note  || `+${xp} XP`,
        })
        console.log('[bot] Coach note Supabase\'e kaydedildi')

        // Koçun önerdiği stat delta'larını profile.stats'a uygula
        if (coachNote.stat_deltas && typeof coachNote.stat_deltas === 'object') {
          const currentStats = profile.stats || { str:0,agi:0,end:0,dex:0,con:0,sta:0 }
          const next = { ...currentStats }
          for (const k of ['str','agi','end','dex','con','sta']) {
            const d = Number(coachNote.stat_deltas[k]) || 0
            if (d !== 0) next[k] = Math.max(0, Math.min(100, (Number(currentStats[k]) || 0) + d))
          }
          try {
            await sbPatch('profiles', `id=eq.${profile.id}`, { stats: next })
            console.log('[bot] Stat delta uygulandı:', coachNote.stat_deltas)
          } catch (e) {
            console.warn('[bot] Stat delta yazılamadı:', e.message)
          }
        }
      }
    } catch (e) {
      console.warn('[bot] Coach yanıtı alınamadı:', e.message)
    }

    const reply = formatSummary(parsed, xp, streak, telegramMsg)
    await sendTelegram(chatId, reply)
    console.log(`[bot] Cevap gönderildi`)

    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('[bot] HATA:', err.message)
    try {
      await sendTelegram(chatId, `❌ Hata: <code>${err.message}</code>`)
    } catch {}
    return res.status(200).json({ ok: true })
  }
}
