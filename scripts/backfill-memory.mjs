import { createClient } from '@supabase/supabase-js'
import { loadEnv } from 'vite'

import { extractAtomicWorkoutFacts } from '../src/data/atomic-fact-parser.js'
import { computeClass } from '../src/data/class-engine.js'
import {
  buildAthleteMemoryCandidates,
  buildBodyMetricsHistoryEntry,
  buildWorkoutBlockRows,
  buildWorkoutFactRows,
} from '../src/data/memory-engine.js'
import { normalizeSession } from '../src/data/rules.js'

const env = loadEnv('production', process.cwd(), '')
const url = env.VITE_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase env. Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY.')
  process.exit(1)
}

const supabase = createClient(url, key)

function normalizeWorkoutRow(row = {}) {
  return normalizeSession({
    id: row.id,
    date: row.date,
    type: row.type,
    durationMin: row.durationMin ?? row.duration_min,
    volumeKg: row.volumeKg ?? row.volume_kg,
    sets: row.sets,
    highlight: row.highlight,
    exercises: row.exercises || [],
    hasPr: row.hasPr ?? row.has_pr,
    notes: row.notes || '',
    source: row.source || 'telegram',
    createdAt: row.createdAt || row.created_at || row.started_at,
    elevationM: row.elevationM ?? row.elevation_m,
    distanceKm: row.distanceKm ?? row.distance_km,
    tags: row.tags || [],
    primaryCategory: row.primaryCategory ?? row.primary_category,
    intensity: row.intensity,
    blocks: row.blocks || [],
    statDelta: row.stat_delta || {},
    confidence: row.confidence || null,
    evidence: row.evidence || [],
    facts: row.facts || [],
  }, { source: row.source || 'telegram' })
}

function buildTextDescriptor(session = {}) {
  const parts = []
  if (session.highlight) parts.push(session.highlight)
  if (session.notes) parts.push(session.notes)
  for (const exercise of session.exercises || []) {
    parts.push(exercise.name)
  }
  return parts.filter(Boolean).join('\n')
}

function buildBackfillFacts(session = {}) {
  if (Array.isArray(session.facts) && session.facts.length) {
    return {
      facts: session.facts,
      evidence: session.evidence || [],
      blockMix: session.blockMix || [],
      confidence: session.confidence || { score: 70, level: 'medium', reasons: ['stored facts reused'] },
    }
  }

  const textDescriptor = buildTextDescriptor(session)
  if (textDescriptor.trim()) {
    const parsed = extractAtomicWorkoutFacts(textDescriptor)
    return {
      facts: parsed.facts || [],
      evidence: parsed.evidence || [],
      blockMix: parsed.blockMix || session.blockMix || [],
      confidence: parsed.confidence || { score: 55, level: 'medium', reasons: ['descriptor-only backfill'] },
    }
  }

  const pseudoFacts = (session.blocks || []).map(block => ({
    kind: 'activity',
    raw: block.label || block.kind,
    label: block.label || block.kind,
    durationMin: Number(block.durationMin) || 0,
    distanceKm: Number(block.distanceKm) || 0,
    blockKind: block.kind || 'mixed',
    signals: [],
    tags: block.tags || [],
  }))

  return {
    facts: pseudoFacts,
    evidence: pseudoFacts.map(item => item.raw),
    blockMix: session.blockMix || [],
    confidence: { score: 45, level: 'low', reasons: ['blocks-only backfill'] },
  }
}

async function run() {
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .order('last_updated', { ascending: false })

  if (profileError) throw profileError
  if (!profiles?.length) {
    console.log('No profiles found.')
    return
  }

  for (const profile of profiles) {
    const profileId = profile.id
    console.log(`\n[profile] ${profile.nick || profileId}`)

    const [
      workoutResp,
      blockResp,
      factResp,
      bodyHistoryResp,
    ] = await Promise.all([
      supabase.from('workouts').select('*').eq('profile_id', profileId).order('date', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('workout_blocks').select('workout_id').eq('profile_id', profileId),
      supabase.from('workout_facts').select('workout_id').eq('profile_id', profileId),
      supabase.from('body_metrics_history').select('id').eq('profile_id', profileId),
    ])

    if (workoutResp.error) throw workoutResp.error
    if (blockResp.error && !/relation .* does not exist/i.test(String(blockResp.error.message || ''))) throw blockResp.error
    if (factResp.error && !/relation .* does not exist/i.test(String(factResp.error.message || ''))) throw factResp.error
    if (bodyHistoryResp.error && !/relation .* does not exist/i.test(String(bodyHistoryResp.error.message || ''))) throw bodyHistoryResp.error

    const workouts = (workoutResp.data || []).map(row => normalizeWorkoutRow(row))
    const existingBlockIds = new Set((blockResp.data || []).map(row => String(row.workout_id)))
    const existingFactIds = new Set((factResp.data || []).map(row => String(row.workout_id)))
    const hasBodyHistory = (bodyHistoryResp.data || []).length > 0
    const currentClass = computeClass(workouts)
    const profileStats = profile.stats || {}

    let insertedBlocks = 0
    let insertedFacts = 0
    let upsertedMemory = 0

    for (const workout of workouts) {
      const payload = buildBackfillFacts(workout)
      const blockRows = existingBlockIds.has(String(workout.id))
        ? []
        : buildWorkoutBlockRows(profileId, workout.id, workout.blocks || [], workout.blockMix || payload.blockMix)
      const factRows = existingFactIds.has(String(workout.id))
        ? []
        : buildWorkoutFactRows(profileId, workout.id, payload.facts || [], payload.confidence)

      if (blockRows.length) {
        const { error } = await supabase.from('workout_blocks').insert(blockRows)
        if (error) throw error
        insertedBlocks += blockRows.length
      }

      if (factRows.length) {
        const { error } = await supabase.from('workout_facts').insert(factRows)
        if (error) throw error
        insertedFacts += factRows.length
      }

      const memoryRows = buildAthleteMemoryCandidates({
        profileId,
        session: {
          ...workout,
          facts: payload.facts,
          evidence: payload.evidence,
          confidence: payload.confidence,
          blockMix: workout.blockMix || payload.blockMix,
        },
        nextStats: profileStats,
        nextClass: currentClass,
        survival: { status: profile.survival_status || 'healthy', warnings: [] },
      }).map(row => ({
        ...row,
        value_jsonb: {
          ...(row.value_jsonb || {}),
          workoutId: workout.id,
          sessionDate: workout.date,
        },
      }))

      if (memoryRows.length) {
        const { error } = await supabase
          .from('athlete_memory')
          .upsert(memoryRows, { onConflict: 'profile_id,scope,key' })
        if (error) throw error
        upsertedMemory += memoryRows.length
      }
    }

    if (!hasBodyHistory && profile.body_metrics) {
      const historyEntry = buildBodyMetricsHistoryEntry(profileId, profile.body_metrics, {
        date: profile.last_workout_date || profile.last_updated || new Date().toISOString(),
        source: 'backfill',
        note: 'backfilled from profiles.body_metrics snapshot',
      })
      if (historyEntry) {
        const { error } = await supabase.from('body_metrics_history').insert(historyEntry)
        if (error) throw error
      }
    }

    console.log(`  workouts: ${workouts.length}`)
    console.log(`  inserted workout_blocks: ${insertedBlocks}`)
    console.log(`  inserted workout_facts: ${insertedFacts}`)
    console.log(`  upserted athlete_memory rows: ${upsertedMemory}`)
    console.log(`  body history existed: ${hasBodyHistory ? 'yes' : 'no -> snapshot inserted if available'}`)
  }
}

run().catch(error => {
  console.error('[backfill-memory] failed:', error.message || error)
  process.exit(1)
})
