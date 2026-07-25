const buckets = new Map()

function clientKey(req = {}) {
  const headers = req.headers || {}
  const forwarded = String(headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '').split(',')[0].trim()
  const realIp = String(headers['x-real-ip'] || headers['X-Real-IP'] || '').trim()
  const auth = String(headers.authorization || headers.Authorization || headers['x-odie-token'] || '').slice(0, 32)
  const secret = String(headers['x-hevy-secret'] || headers['x-telegram-bot-api-secret-token'] || '').slice(0, 32)
  return forwarded || realIp || auth || secret || 'anonymous'
}

function prune(now) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function consumeRateLimit(req, {
  id = 'route',
  limit = 60,
  windowMs = 60_000,
} = {}) {
  const now = Date.now()
  prune(now)
  const key = `${id}:${clientKey(req)}`
  const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs }
  if (bucket.resetAt <= now) {
    bucket.count = 0
    bucket.resetAt = now + windowMs
  }
  bucket.count += 1
  buckets.set(key, bucket)
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
  return {
    ok: bucket.count <= limit,
    retryAfter,
    remaining: Math.max(0, limit - bucket.count),
  }
}

export function rateLimitResponse(res, result) {
  res.setHeader?.('Retry-After', String(result.retryAfter || 60))
  return res.status(429).json({ ok: false, error: 'rate_limited' })
}
