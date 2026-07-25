import { buildDirectHevySnapshot } from '../lib/hevy/dashboard-snapshot.js'
import { createDashboardModel } from '../src/data/dashboard-model.js'

function fail(message) {
  console.error(`hevy direct check failed: ${message}`)
  process.exit(1)
}

if (!process.env.HEVY_API_KEY) fail('HEVY_API_KEY is missing')

try {
  const snapshot = await buildDirectHevySnapshot({ workoutLimit: 120 })
  if (!snapshot.ok) fail('snapshot is not ok')
  if (!snapshot.workouts.length) fail('Hevy returned no workouts')
  if (Object.keys(snapshot.profile?.stats || {}).length !== 6) fail('game stats are incomplete')
  if (snapshot.workouts.some(workout => 'rawExternal' in workout || 'notes' in workout)) {
    fail('private/raw workout fields leaked into the dashboard payload')
  }

  const model = createDashboardModel({
    ...snapshot,
    mode: 'live',
    status: 'ready',
    lastSyncedAt: snapshot.syncState?.last_synced_at,
  })
  if (model.gaps.length !== 4) fail('four weakest muscle regions were not produced')
  if (!model.sessions.length) fail('session list is empty')
  if (model.gaps.every(region => region.load >= 90)) {
    fail('weakest-region calibration is saturated and cannot rank gaps honestly')
  }
  if (new Set(model.gaps.map(region => region.load)).size < 2) {
    fail('weakest-region calibration does not differentiate muscle load')
  }

  console.log(JSON.stringify({
    ok: true,
    source: snapshot.source.hevy,
    fetchedWorkouts: snapshot.workouts.length,
    totalWorkouts: snapshot.syncState.total_workouts,
    latestWorkoutDate: snapshot.workouts[0]?.date || null,
    level: snapshot.profile.level,
    statRanks: model.stats.map(stat => `${stat.short}:${stat.rank}`),
    muscleRegions: model.regions
      .filter(region => region.group === 'muscle')
      .map(region => ({
        id: region.id,
        load: region.load,
        evidenceScore: region.evidenceScore,
        matchedSessions: region.matchedSessions,
        daysSince: region.daysSince,
      })),
    weakestRegions: model.gaps.map(region => ({
      id: region.id,
      load: region.load,
      daysSince: region.daysSince,
    })),
  }, null, 2))
} catch (error) {
  fail(error?.message || String(error))
}
