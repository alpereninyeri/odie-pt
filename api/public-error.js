const SAFE_CODES = new Set([
  'unauthorized',
  'rate_limited',
  'schema_missing',
  'body_events_missing',
  'validation_failed',
  'upstream_failed',
])

export function publicErrorCode(error, fallback = 'internal_error') {
  const explicit = String(error?.publicCode || error?.code || '').trim()
  if (SAFE_CODES.has(explicit)) return explicit

  const message = String(error?.message || error || '').toLowerCase()
  if (/rate.?limit|429/.test(message)) return 'rate_limited'
  if (/relation .* does not exist|table .* does not exist|schema cache|could not find .* column|pgrst204|42p01/.test(message)) return 'schema_missing'
  if (/timeout|fetch failed|network|econnreset|econnrefused|upstream/.test(message)) return 'upstream_failed'
  if (/unauthorized|forbidden/.test(message)) return 'unauthorized'
  return fallback
}

export function publicErrorStatus(error, fallback = 500) {
  const status = Number(error?.status || error?.statusCode)
  if (Number.isFinite(status) && status >= 400 && status < 600) return status
  if (publicErrorCode(error) === 'schema_missing') return 503
  if (publicErrorCode(error) === 'rate_limited') return 429
  if (publicErrorCode(error) === 'unauthorized') return 401
  return fallback
}

export function sendPublicError(res, error, {
  fallback = 'internal_error',
  status = publicErrorStatus(error, 500),
  extra = {},
} = {}) {
  return res.status(status).json({
    ok: false,
    error: publicErrorCode(error, fallback),
    ...extra,
  })
}
