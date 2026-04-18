function getWebApp() {
  return window.Telegram?.WebApp || null
}

export function isTelegramMiniAppAvailable() {
  return Boolean(getWebApp())
}

function applyTelegramTheme(webApp) {
  const root = document.documentElement
  const params = webApp?.themeParams || {}
  root.classList.toggle('is-tg-miniapp', Boolean(webApp))

  const map = {
    '--tg-bg': params.bg_color,
    '--tg-text': params.text_color,
    '--tg-hint': params.hint_color,
    '--tg-link': params.link_color,
    '--tg-button': params.button_color,
    '--tg-button-text': params.button_text_color,
  }

  Object.entries(map).forEach(([key, value]) => {
    if (value) root.style.setProperty(key, value)
  })
}

export function initTelegramMiniApp() {
  const webApp = getWebApp()
  if (!webApp) return null

  try {
    webApp.ready()
    webApp.expand()
    webApp.disableVerticalSwipes?.()
    webApp.setHeaderColor?.('#05070b')
    webApp.setBackgroundColor?.('#05070b')
    applyTelegramTheme(webApp)
    webApp.onEvent?.('themeChanged', () => applyTelegramTheme(webApp))
    webApp.onEvent?.('viewportChanged', () => {
      const stableHeight = Number(webApp.viewportStableHeight || webApp.viewportHeight || 0)
      if (stableHeight > 0) {
        document.documentElement.style.setProperty('--tg-stable-vh', `${stableHeight}px`)
      }
    })
    webApp.BackButton?.hide?.()
    document.documentElement.classList.add('telegram-webapp')
  } catch (error) {
    console.warn('[telegram-webapp] init failed:', error)
  }

  return webApp
}

export function sendMiniWorkoutText(text = '') {
  const webApp = getWebApp()
  const payload = String(text || '').trim()
  if (!webApp || !payload) return false

  try {
    webApp.sendData(JSON.stringify({
      type: 'workout_text',
      text: payload,
      sentAt: new Date().toISOString(),
    }))
    return true
  } catch (error) {
    console.warn('[telegram-webapp] sendData failed:', error)
    return false
  }
}

export function triggerMiniHaptic(kind = 'impact') {
  const webApp = getWebApp()
  try {
    if (kind === 'success') {
      webApp?.HapticFeedback?.notificationOccurred?.('success')
      return
    }
    webApp?.HapticFeedback?.impactOccurred?.('light')
  } catch {}
}
