const APP_ACCESS_TOKEN_KEY = 'odiept-app-access-token'

function storage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage || null
  } catch {
    return null
  }
}

export function getAppAccessToken() {
  return String(storage()?.getItem(APP_ACCESS_TOKEN_KEY) || '').trim()
}

export function hasAppAccessToken() {
  return Boolean(getAppAccessToken())
}

export function setAppAccessToken(token) {
  const clean = String(token || '').trim()
  if (!clean) return false
  storage()?.setItem(APP_ACCESS_TOKEN_KEY, clean)
  return true
}

export function clearAppAccessToken() {
  storage()?.removeItem(APP_ACCESS_TOKEN_KEY)
}

export function appHeaders(extra = {}) {
  const token = getAppAccessToken()
  return token
    ? { ...extra, Authorization: `Bearer ${token}` }
    : extra
}
