import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const REQUIRED_VERCEL_ENV_GROUPS = [
  { label: 'Hevy API key', anyOf: ['HEVY_API_KEY'] },
  { label: 'OdiePt app access token', anyOf: ['ODIE_APP_ACCESS_TOKEN'] },
]

export const LEGACY_VERCEL_ENV_WARNINGS = [
  {
    name: 'VITE_SUPABASE_URL',
    message: 'legacy Supabase URL is configured but the direct Hevy dashboard does not need it',
  },
  {
    name: 'VITE_SUPABASE_ANON_KEY',
    message: 'legacy browser anon key is configured but the direct Hevy dashboard does not use it',
  },
  {
    name: 'HEVY_WEBHOOK_SECRET',
    message: 'legacy Hevy webhook secret is configured but the direct dashboard does not deploy a webhook',
  },
  {
    name: 'HEVY_INTERNAL_SECRET',
    message: 'legacy Hevy sync secret is configured but the direct dashboard has no cron sync',
  },
  {
    name: 'TELEGRAM_BOT_TOKEN',
    message: 'legacy Telegram token is configured but the Hevy-only dashboard does not need it',
  },
  {
    name: 'GEMINI_API_KEY',
    message: 'Gemini is no longer used by the product and can be removed from Vercel',
  },
]

export function parseVercelEnvList(stdout = '') {
  const names = new Set()
  for (const line of String(stdout || '').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || /^name\s+value\s+environments/i.test(trimmed)) continue
    const match = trimmed.match(/^([A-Z][A-Z0-9_]+)\s+/)
    if (match?.[1]) names.add(match[1])
  }
  return names
}

export function evaluateVercelEnvContract(namesInput, {
  requiredGroups = REQUIRED_VERCEL_ENV_GROUPS,
  legacyWarnings = LEGACY_VERCEL_ENV_WARNINGS,
} = {}) {
  const names = namesInput instanceof Set ? namesInput : new Set(namesInput || [])
  const missing = requiredGroups
    .filter(group => !(group.anyOf || []).some(name => names.has(name)))
    .map(group => ({
      label: group.label,
      anyOf: group.anyOf,
    }))
  const warnings = legacyWarnings
    .filter(item => names.has(item.name))
    .map(item => item.message)

  return {
    ok: missing.length === 0,
    missing,
    warnings,
    present: [...names].sort(),
  }
}

function sanitizeCliText(text = '') {
  return String(text || '')
    .replace(/token\s+[A-Za-z0-9._-]+/gi, 'token [redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .slice(0, 600)
}

export function readVercelEnvNames({ environment = 'production', cwd = process.cwd() } = {}) {
  const safeEnvironment = String(environment || 'production').replace(/[^A-Za-z0-9_-]/g, '')
  if (!safeEnvironment) throw new Error('invalid Vercel environment name')
  const bin = process.platform === 'win32' ? 'vercel.cmd' : 'vercel'
  const result = spawnSync(bin, ['env', 'ls', safeEnvironment], {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true,
  })
  if (result.error) {
    throw new Error(sanitizeCliText(result.error.message || 'vercel env ls failed'))
  }
  if (result.status !== 0) {
    throw new Error(sanitizeCliText(result.stderr || result.stdout || 'vercel env ls failed'))
  }
  return parseVercelEnvList(result.stdout)
}

export function runVercelEnvContractCheck(options = {}) {
  const names = options.names || readVercelEnvNames(options)
  return evaluateVercelEnvContract(names, options)
}

function printResult(result) {
  if (!result.ok) {
    console.error('vercel env contract failed:')
    for (const item of result.missing) {
      console.error(`- missing ${item.label}: one of ${item.anyOf.join(' / ')}`)
    }
  }
  for (const warning of result.warnings) {
    console.warn(`warning: ${warning}`)
  }
  if (!result.ok) process.exit(1)
  console.log('vercel env contract ok')
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    printResult(runVercelEnvContractCheck())
  } catch (error) {
    console.error(`vercel env contract crashed: ${sanitizeCliText(error?.message || error)}`)
    process.exit(1)
  }
}
