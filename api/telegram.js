/**
 * OdiePt — Telegram Bot Webhook Handler
 * Vercel Serverless Function: https://odie-pt.vercel.app/api/telegram
 *
 * Akış:
 *   Telegram mesaj → Gemini Flash (parse) → XP hesapla → Telegram'a cevap
 *
 * Env variables (Vercel Dashboard > Settings > Environment Variables):
 *   TELEGRAM_BOT_TOKEN  — BotFather'dan aldığın token
 *   TELEGRAM_CHAT_ID    — Senin chat id'n (güvenlik için, bot sadece sana cevap verir)
 *   GEMINI_API_KEY      — Google AI Studio'dan aldığın key
 */

// ── Sabitler ─────────────────────────────────────────────────────────────────

const XP_BASE = {
  Push: 100, Pull: 100, Bacak: 100,
  Shoulder: 80, Parkour: 120, Akrobasi: 120,
  'Yürüyüş': 40, Yuruyus: 40, Stretching: 60, Custom: 70,
}

// ── Gemini ile antrenmanı parse et ───────────────────────────────────────────

async function parseWithGemini(text) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY eksik')

  const prompt = `Sen bir fitness veri analistissin. Aşağıdaki Türkçe antrenman mesajını JSON'a çevir.

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

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
      }),
    }
  )

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Gemini API hatası: ${resp.status} — ${err}`)
  }

  const data = await resp.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
  const clean = raw.replace(/```json\n?|\n?```/g, '').trim()

  try {
    return JSON.parse(clean)
  } catch {
    throw new Error(`Gemini JSON parse hatası. Ham yanıt: ${raw.slice(0, 200)}`)
  }
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

// ── Reply formatla ───────────────────────────────────────────────────────────

function formatReply(parsed) {
  const baseXP = XP_BASE[parsed.type] || 70
  const prBonus = parsed.has_pr ? 50 : 0
  const totalXP = baseXP + prBonus

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

  lines.push(``)
  if (parsed.has_pr) lines.push(`🏆 <b>YENİ KİŞİSEL REKOR!</b> +${prBonus} XP bonus`)
  lines.push(`⚡ XP kazanıldı: <b>+${totalXP}</b>`)
  lines.push(``)
  lines.push(`💬 <i>${parsed.highlight}</i>`)

  return lines.filter(l => l !== undefined).join('\n')
}

// ── Ana handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // Telegram her zaman 200 bekler, aksi halde mesajı tekrar gönderir
  res.status(200).json({ ok: true })

  if (req.method !== 'POST') return

  const update = req.body
  const message = update?.message
  if (!message?.text) return

  const chatId    = String(message.chat.id)
  const text      = message.text.trim()
  const firstName = message.from?.first_name || 'Sporcu'

  // Güvenlik: sadece belirlenmiş chat'e cevap ver
  const ALLOWED = process.env.TELEGRAM_CHAT_ID
  if (ALLOWED && chatId !== ALLOWED) {
    console.log(`[bot] Yetkisiz chat: ${chatId}`)
    return
  }

  // /start komutu
  if (text === '/start') {
    await sendTelegram(chatId,
      `⚔️ <b>OdiePt Bot aktif, ${firstName}!</b>\n\n` +
      `Antrenmanını Türkçe yaz, ben JSON'a çevirip XP hesaplarım:\n\n` +
      `<i>"bench press 62.5kg 3x5, dips 3x12, 70dk push"</i>\n\n` +
      `💡 "PR" ya da "kişisel rekor" yazarsan +50 XP bonus alırsın.`
    )
    return
  }

  // /help komutu
  if (text === '/help') {
    await sendTelegram(chatId,
      `📖 <b>Kullanım</b>\n\n` +
      `Sadece antrenmanını doğal Türkçe ile yaz:\n\n` +
      `• "ohp 45kg 3x6, lateral raise 12.5kg 4x15, 60dk shoulder"\n` +
      `• "parkour 2.5 saat, front flip deneme, PR attım"\n` +
      `• "yürüyüş 45dk, 6km"\n\n` +
      `<b>Antrenman türleri:</b> Push, Pull, Shoulder, Bacak, Parkour, Akrobasi, Yürüyüş, Stretching, Custom`
    )
    return
  }

  // Antrenman parse + cevap
  try {
    console.log(`[bot] Parse ediliyor: "${text.slice(0, 80)}"`)
    const parsed = await parseWithGemini(text)
    const reply  = formatReply(parsed)
    await sendTelegram(chatId, reply)
    console.log(`[bot] Cevap gönderildi. Type: ${parsed.type}, XP: ${XP_BASE[parsed.type] || 70}`)
  } catch (err) {
    console.error('[bot] Hata:', err.message)
    await sendTelegram(chatId,
      `❌ Bir hata oluştu:\n<code>${err.message}</code>\n\nTekrar dene.`
    )
  }
}
