export function configuredAppToken() {
  return process.env.ODIE_APP_ACCESS_TOKEN || ''
}

export function appAuthConfigured() {
  return Boolean(configuredAppToken())
}

function bearerToken(req = {}) {
  const header = String(req.headers?.authorization || req.headers?.Authorization || '')
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return ''
}

export function providedAppToken(req = {}) {
  return bearerToken(req) ||
    String(req.headers?.['x-odie-token'] || req.headers?.['X-Odie-Token'] || '') ||
    String(req.query?.token || req.query?.secret || '')
}

export function authorizeAppRequest(req = {}) {
  const expected = configuredAppToken()
  if (!expected) return { ok: true, configured: false }
  return {
    ok: providedAppToken(req) === expected,
    configured: true,
  }
}

export function requireAppAccess(req, res) {
  const auth = authorizeAppRequest(req)
  if (auth.ok) return true
  res.status(401).json({ ok: false, error: 'unauthorized' })
  return false
}
