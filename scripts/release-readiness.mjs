import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function fail(message) {
  failures.push(message)
}

function read(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function listFiles(dir) {
  const abs = path.join(root, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs).flatMap(name => {
    const rel = path.join(dir, name)
    const full = path.join(root, rel)
    if (statSync(full).isDirectory()) return listFiles(rel)
    return rel
  })
}

const requiredFiles = [
  '.vercelignore',
  'api/snapshot.js',
  'lib/hevy/dashboard-snapshot.js',
  'src/data/dashboard-model.js',
  'src/data/dashboard-store.js',
  'scripts/db-contract-check.mjs',
  'scripts/vercel-env-contract-check.mjs',
  'scripts/live-smoke.mjs',
]

for (const file of requiredFiles) {
  if (!existsSync(path.join(root, file))) fail(`missing required file: ${file}`)
}

const readme = read('README.md')
const packageJson = read('package.json')
const vercelIgnore = read('.vercelignore')
if (!packageJson.includes('"db:contract:check"')) fail('package.json missing db:contract:check script')
if (!packageJson.includes('"vercel:env:check"')) fail('package.json missing vercel:env:check script')
if (!packageJson.includes('"live:smoke"')) fail('package.json missing live:smoke script')
if (!readme.includes('Hevy-only')) fail('README must document the Hevy-only product scope')
if (!readme.includes('Durum')) fail('README must document the three-screen dashboard')
for (const requiredIgnore of [
  'api/coach.js',
  'api/ask.js',
  'api/hevy-sync.js',
  'api/hevy-webhook.js',
  'src/data/store.js',
  'src/data/supabase-client.js',
  'src/data/telegram-webapp.js',
  'src/assets/game/*',
  '!src/assets/game/cozy-v4/avatar-athlete.png',
  'tests/',
]) {
  if (!vercelIgnore.includes(requiredIgnore)) {
    fail(`.vercelignore missing production payload rule: ${requiredIgnore}`)
  }
}

const ignoredProductionFiles = new Set([
  'api/app-auth.js',
  'api/ask.js',
  'api/body-events.js',
  'api/coach.js',
  'api/health-import.js',
  'api/health-status.js',
  'api/hevy-backfill.js',
  'api/hevy-sync.js',
  'api/hevy-webhook.js',
  'api/intake.js',
  'api/next-session.js',
  'api/public-error.js',
  'api/rate-limit.js',
  'api/telegram.js',
  'lib/hevy/ingest-events.js',
  'lib/hevy/persist.js',
  'src/data/store.js',
  'src/data/supabase-client.js',
  'src/data/telegram-webapp.js',
])

const prodFiles = [
  ...listFiles('src'),
  ...listFiles('api'),
  ...listFiles('lib'),
].filter(file => {
  if (!/\.(js|mjs|ts|tsx|css|html|md)$/.test(file)) return false
  const normalized = file.replace(/\\/g, '/')
  if (normalized.startsWith('src/components/')) return false
  if (normalized.startsWith('lib/odie-intake/')) return false
  return !ignoredProductionFiles.has(normalized)
})

const forbiddenSecrets = [
  /VITE_SUPABASE_ANON_KEY/,
  /SUPABASE_ANON_KEY/,
  /VITE_ODIE_APP_ACCESS_TOKEN/,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
]

for (const file of prodFiles) {
  const text = read(file)
  for (const pattern of forbiddenSecrets) {
    if (pattern.test(text)) fail(`${file} contains forbidden secret/client-token pattern ${pattern}`)
  }
  if (/return\s+res\.status\([^)]*\)\.json\(\{\s*ok:\s*false,[^}]*error:\s*(String\(error|error\.message|error\?\.message)/s.test(text)) {
    fail(`${file} appears to return a raw error message`)
  }
}

const snapshotApi = read('api/snapshot.js')
if (/SUPABASE|sbGet|hevy_sync_state/.test(snapshotApi)) {
  fail('api/snapshot.js must read directly from Hevy without Supabase')
}
if (!snapshotApi.includes('buildDirectHevySnapshot')) {
  fail('api/snapshot.js must use the direct Hevy snapshot builder')
}
if (!snapshotApi.includes('private, no-store')) {
  fail('api/snapshot.js must disable shared/browser response caching')
}
if (/authorizeAppRequest|appAuthConfigured|ODIE_APP_ACCESS_TOKEN/.test(snapshotApi)) {
  fail('api/snapshot.js must be public read-only without a dashboard password wall')
}
if (/public,\s*s-maxage/.test(snapshotApi)) {
  fail('api/snapshot.js must not publish athlete data through shared CDN caching')
}

const vercelConfig = read('vercel.json')
if (/hevy-sync|crons/.test(vercelConfig)) {
  fail('vercel.json must not deploy the retired Supabase Hevy cron')
}

const main = read('src/main.js')
for (const removedSurface of ['/api/ask', '/api/intake', 'renderSignalScreen', 'panel-coach']) {
  if (main.includes(removedSurface)) fail(`active dashboard still references removed surface: ${removedSurface}`)
}

if (existsSync(path.join(root, 'dist'))) {
  for (const file of listFiles('dist').filter(item => /\.(js|css|html)$/.test(item))) {
    const text = read(file)
    for (const pattern of forbiddenSecrets) {
      if (pattern.test(text)) fail(`${file} contains forbidden built secret/client-token pattern ${pattern}`)
    }
  }
}

if (failures.length) {
  console.error('release readiness failed:')
  for (const item of failures) console.error(`- ${item}`)
  process.exit(1)
}

console.log('release readiness ok')
