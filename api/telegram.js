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

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 1 — PARSE
// Antrenman metnini yapılandırılmış JSON'a çevirir.
// Değiştirme: sadece JSON alanlarını ekleyip çıkarabilirsin,
// ama formatı bozarsan parse çöker.
// ─────────────────────────────────────────────────────────────────────────────

function buildParsePrompt(text) {
  return `Sen bir fitness veri analistissin. Aşağıdaki Türkçe antrenman mesajını JSON'a çevir.

Mesaj: "${text}"

Sadece bu JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "type": "Push|Pull|Shoulder|Bacak|Parkour|Akrobasi|Yürüyüş|Stretching|Custom",
  "duration_min": <sayı veya null>,
  "exercises": [
    { "name": "<egzersiz adı>", "sets": <sayı veya null>, "reps": <sayı veya null>, "weight_kg": <sayı veya null> }
  ],
  "volume_kg": <toplam hacim kg, hesaplanabiliyorsa, değilse null>,
  "highlight": "<1 cümle özet>",
  "has_pr": <true/false — "PR" veya "kişisel rekor" geçiyorsa true>
}`
}

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT 2 — AXIOM KOÇU
// ⬇️ İSTEDİĞİN GİBİ DEĞİŞTİREBİLİRSİN ⬇️
//
// Bu fonksiyon parse edilen antrenman verisini alır ve kısa bir koç yanıtı üretir.
// Kişiliği, tonu, uzunluğu burada ayarlarsın.
// Değişkenler: type, duration_min, has_pr, exercises, streak, xp
// ─────────────────────────────────────────────────────────────────────────────

function buildCoachPrompt(parsed, xp, streak) {
  const exerciseList = parsed.exercises?.length
    ? parsed.exercises.map(e => `${e.name}${e.weight_kg ? ` ${e.weight_kg}kg` : ''} ${e.sets ? `${e.sets}x${e.reps || '?'}` : ''}`).join(', ')
    : 'egzersiz detayı yok'

  return `Sen AXIOM'sun — bir fitness RPG'sinin sert, espirili ama motive edici koçu.
Kullanıcı adı SenUzulme27. Calisthenic + parkour sporcusu. Güçlü yanları: Dead Hang, Bench 65kg, Muscle-Up, Front Flip.
Zayıf yanı: Core (ihmal ediyor, uyar), Bacak (neredeyse hiç yapmıyor).

Kullanıcı bugün şu antrenmanı yaptı:
- Tür: ${parsed.type}
- Süre: ${parsed.duration_min ? parsed.duration_min + ' dk' : 'belirtilmemiş'}
- Egzersizler: ${exerciseList}
- PR kırdı mı: ${parsed.has_pr ? 'EVET' : 'Hayır'}
- Özet: ${parsed.highlight}
- Streak: ${streak} gün üst üste
- Bu antrenmandan kazandığı XP: +${xp}

Şimdi AXIOM olarak 2-3 cümle yaz:
- Sert ama motivasyonlu, kısalt uzatma
- PR kırdıysa onu kutla
- Streak 7+'ysa özellikle vurgula
- Core veya Bacak çalışılmadıysa bir sonraki için hafifçe uyar
- Emoji kullan ama abartma (max 3)
- Türkçe yaz, karakter ol

Sadece koç yanıtını yaz, başka bir şey yazma.`
}

// ── Gemini çağrısı ────────────────────────────────────────────────────────────

async function callGemini(prompt, maxTokens = 512, temperature = 0.1) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY eksik')

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    }
  )

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Gemini API hatası: ${resp.status} — ${err}`)
  }

  const data = await resp.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function parseWithGemini(text) {
  const raw = await callGemini(buildParsePrompt(text), 512, 0.1)
  const clean = raw.replace(/```json\n?|\n?```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    throw new Error(`Parse hatası. Ham yanıt: ${raw.slice(0, 200)}`)
  }
}

async function getCoachReply(parsed, xp, streak) {
  // temperature 0.8 → daha yaratıcı ve farklı yanıtlar
  return await callGemini(buildCoachPrompt(parsed, xp, streak), 200, 0.8)
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
    lines.push(`☠ <b>AXIOM:</b>`)
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

  // Antrenman parse + cevap
  try {
    console.log(`[bot] Gemini'ye gönderiliyor...`)
    const parsed = await parseWithGemini(text)
    console.log(`[bot] Parse tamam: ${parsed.type}`)

    const baseXP = XP_BASE[parsed.type] || 70
    const xp     = baseXP + (parsed.has_pr ? 50 : 0)
    const streak = 4  // TODO: Supabase'den gerçek streak

    let coachText = ''
    try {
      coachText = await getCoachReply(parsed, xp, streak)
      console.log(`[bot] Coach yanıtı alındı`)
    } catch (e) {
      console.warn('[bot] Coach yanıtı alınamadı:', e.message)
    }

    const reply = formatSummary(parsed, xp, streak, coachText)
    await sendTelegram(chatId, reply)
    console.log(`[bot] Cevap gönderildi. XP: +${xp}`)

    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('[bot] HATA:', err.message)
    try {
      await sendTelegram(chatId, `❌ Hata: <code>${err.message}</code>`)
    } catch {}
    return res.status(200).json({ ok: true })
  }
}
