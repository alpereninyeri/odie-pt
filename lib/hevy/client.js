// Hevy public API wrapper.
// Header: api-key (Bearer DEGIL). Spec: https://api.hevyapp.com/docs/

const HEVY_BASE = 'https://api.hevyapp.com'
const MAX_PAGE_SIZE = 10

function hevyHeaders() {
  const key = process.env.HEVY_API_KEY
  if (!key) throw new Error('HEVY_API_KEY env eksik')
  return { 'api-key': key, accept: 'application/json' }
}

async function hevyFetch(path, { retry = 2 } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retry; attempt++) {
    let response
    try {
      response = await fetch(`${HEVY_BASE}${path}`, { headers: hevyHeaders() })
    } catch (error) {
      lastErr = error
      await sleep((attempt + 1) * 750)
      continue
    }
    if (response.status === 429 || response.status >= 500) {
      lastErr = new Error(`Hevy ${response.status} on ${path}`)
      await sleep((attempt + 1) * 1000)
      continue
    }
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`Hevy ${response.status} on ${path}: ${body.slice(0, 300)}`)
    }
    return response.json()
  }
  throw lastErr || new Error(`Hevy fetch failed: ${path}`)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function getWorkout(id) {
  const data = await hevyFetch(`/v1/workouts/${encodeURIComponent(id)}`)
  return data?.workout || data
}

export async function listWorkouts(page = 1, pageSize = MAX_PAGE_SIZE) {
  const size = Math.min(pageSize, MAX_PAGE_SIZE)
  return hevyFetch(`/v1/workouts?page=${page}&pageSize=${size}`)
}

export async function countWorkouts() {
  const data = await hevyFetch('/v1/workouts/count')
  return Number(data?.workout_count ?? data?.count ?? 0)
}

export async function getWorkoutEvents(since, page = 1, pageSize = MAX_PAGE_SIZE) {
  const size = Math.min(pageSize, MAX_PAGE_SIZE)
  const sinceQs = since ? `&since=${encodeURIComponent(since)}` : ''
  return hevyFetch(`/v1/workouts/events?page=${page}&pageSize=${size}${sinceQs}`)
}
