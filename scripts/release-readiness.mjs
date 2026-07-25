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
  'api/snapshot.js',
  'api/hevy-sync.js',
  'api/hevy-webhook.js',
  'api/rate-limit.js',
  'api/public-error.js',
  'src/data/app-access.js',
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
if (!packageJson.includes('"db:contract:check"')) fail('package.json missing db:contract:check script')
if (!packageJson.includes('"vercel:env:check"')) fail('package.json missing vercel:env:check script')
if (!packageJson.includes('"live:smoke"')) fail('package.json missing live:smoke script')
if (!readme.includes('Hevy-only')) fail('README must document the Hevy-only product scope')
if (!readme.includes('Durum')) fail('README must document the three-screen dashboard')

const prodFiles = [
  ...listFiles('src'),
  ...listFiles('api'),
  ...listFiles('lib'),
  ...listFiles('scripts'),
].filter(file => {
  if (!/\.(js|mjs|ts|tsx|css|html|md)$/.test(file)) return false
  const normalized = file.replace(/\\/g, '/')
  return ![
    'scripts/release-readiness.mjs',
    'scripts/vercel-env-contract-check.mjs',
  ].includes(normalized)
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

const supabaseClient = read('src/data/supabase-client.js')
if (/from\s+['"]@supabase\/supabase-js['"]/.test(supabaseClient) || /createClient\s*\(/.test(supabaseClient)) {
  fail('browser Supabase client still imports or creates a direct Supabase client')
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
