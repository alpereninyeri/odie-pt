/**
 * Telegram Webhook Kurulum Scripti
 * Kullanım: node scripts/setup-webhook.js
 *
 * Önce .env dosyasını doldur veya env variable'ları export et:
 *   TELEGRAM_BOT_TOKEN=...
 *   VERCEL_URL=https://odie-pt.vercel.app  (veya kendi URL'in)
 */

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN
const VERCEL_URL = process.env.VERCEL_URL || 'https://odie-pt.vercel.app'

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN env variable eksik!')
  console.error('   set TELEGRAM_BOT_TOKEN=<tokenın>')
  process.exit(1)
}

const WEBHOOK_URL = `${VERCEL_URL}/api/telegram`

async function run() {
  console.log(`\n🔧 Webhook ayarlanıyor...\n   URL: ${WEBHOOK_URL}\n`)

  // Önce mevcut webhook'u kontrol et
  const infoResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`)
  const info = await infoResp.json()
  console.log('📡 Mevcut webhook:', info.result?.url || '(boş)')

  // Yeni webhook set et
  const setResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: WEBHOOK_URL,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  })
  const result = await setResp.json()

  if (result.ok) {
    console.log('✅ Webhook başarıyla ayarlandı!\n')
    console.log('📌 Test için Telegram botuna /start yaz.\n')
  } else {
    console.error('❌ Webhook ayarlanamadı:', result.description)
  }

  // Bot bilgisini al
  const meResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
  const me = await meResp.json()
  if (me.ok) {
    console.log(`🤖 Bot: @${me.result.username} (${me.result.first_name})`)
  }

  // Chat ID'ni bulmak için
  console.log('\n💡 Chat ID\'ni bulmak için:')
  console.log('   1. Botuna bir mesaj yaz')
  console.log(`   2. Şu URL\'i aç: https://api.telegram.org/bot${BOT_TOKEN}/getUpdates`)
  console.log('   3. "chat":{"id": <BURASI_SENIN_ID\'IN>} kısmını bul')
  console.log('   4. Bu ID\'yi Vercel\'de TELEGRAM_CHAT_ID env variable olarak ekle\n')
}

run().catch(console.error)
