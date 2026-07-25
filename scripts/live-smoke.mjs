import { pathToFileURL } from 'node:url'

const DEFAULT_BASE_URL = 'https://odie-pt.vercel.app'

function normalizeBaseUrl(value = DEFAULT_BASE_URL) {
  return String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
}

function sample(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 180)
}

async function readText(response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

async function readJson(response) {
  const text = await readText(response)
  try {
    return { data: JSON.parse(text), text }
  } catch {
    return { data: null, text }
  }
}

function pass(name, details = {}) {
  return { ok: true, name, ...details }
}

function fail(name, detail, details = {}) {
  return { ok: false, name, detail, ...details }
}

async function checkHome(baseUrl, fetchImpl) {
  const response = await fetchImpl(`${baseUrl}/`, { redirect: 'manual' })
  const text = await readText(response)
  if (response.status !== 200) return fail('home', `expected 200, got ${response.status}`, { sample: sample(text) })
  if (!/OdiePt|Training Console/i.test(text)) return fail('home', 'home html does not look like OdiePt', { sample: sample(text) })
  return pass('home', { status: response.status })
}

async function checkSnapshot(baseUrl, fetchImpl, token = '') {
  const response = await fetchImpl(`${baseUrl}/api/snapshot?workouts=20`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const { data, text } = await readJson(response)
  if (response.status !== 200 || data?.ok !== true) {
    return fail('snapshot', `expected 200 with live Hevy data, got ${response.status}`, { sample: sample(text) })
  }
  if (!Array.isArray(data?.workouts) || !data?.profile) {
    return fail('snapshot', 'dashboard bundle is incomplete')
  }
  if (!['live-direct', 'stale-cache'].includes(data?.source?.hevy)) {
    return fail('snapshot', `unexpected Hevy source: ${data?.source?.hevy || 'empty'}`)
  }
  if (data.workouts.some(workout => 'rawExternal' in workout || 'notes' in workout)) {
    return fail('snapshot', 'snapshot exposes private/raw workout fields')
  }
  return pass('snapshot', {
    status: response.status,
    workouts: data.workouts.length,
    source: data.source.hevy,
  })
}

export async function runLiveSmoke({
  baseUrl = process.env.ODIEPT_LIVE_URL || DEFAULT_BASE_URL,
  token = process.env.ODIE_APP_ACCESS_TOKEN || '',
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!fetchImpl) throw new Error('fetch is not available')
  const root = normalizeBaseUrl(baseUrl)
  const checks = [
    () => checkHome(root, fetchImpl),
    () => checkSnapshot(root, fetchImpl, token),
  ]

  const results = []
  for (const check of checks) {
    try {
      results.push(await check())
    } catch (error) {
      results.push(fail('unexpected', error?.message || String(error)))
    }
  }
  return {
    ok: results.every(item => item.ok),
    baseUrl: root,
    results,
  }
}

function printResult(result) {
  if (!result.ok) {
    console.error(`live smoke failed for ${result.baseUrl}:`)
    for (const item of result.results.filter(row => !row.ok)) {
      console.error(`- ${item.name}: ${item.detail}`)
    }
    process.exit(1)
  }
  console.log(`live smoke ok for ${result.baseUrl}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runLiveSmoke()
    .then(printResult)
    .catch(error => {
      console.error(`live smoke crashed: ${error?.message || error}`)
      process.exit(1)
    })
}
