import assert from 'node:assert/strict'

import { parseStructuredWorkoutText } from '../../api/telegram.js'
import { buildFallbackCoachResponse } from '../../src/data/odie-fallback.js'
import { computeSessionStatDelta, normalizeSession } from '../../src/data/rules.js'

const DEFAULT_ODIE_CONTEXT = {
  xp: 150,
  streak: 3,
  odie: {
    recovery: { armor: 100, fatigue: 0, status: 'healthy', warnings: [] },
    loadProfile: { trendSignals: [] },
    focusGaps: [],
    questPressure: [],
    skillPressure: [],
    performance: [],
    stats: {
      weakest: { key: 'con', val: 12 },
      strongest: { key: 'agi', val: 70 },
    },
  },
}

export function runGoldenCase({ id, input, date = '2026-04-20', mockOdieContext = DEFAULT_ODIE_CONTEXT } = {}) {
  if (!id) throw new Error('runGoldenCase: id required')
  const parsed = parseStructuredWorkoutText(input)
  const session = normalizeSession({ date, ...parsed })
  const delta = computeSessionStatDelta(session)
  const fallback = buildFallbackCoachResponse(parsed, mockOdieContext)
  return { id, parsed, session, delta, fallback }
}

export function assertType(parsed, type) {
  assert.equal(parsed.type, type, `type mismatch: expected ${type}, got ${parsed.type}`)
}

export function assertTagsInclude(parsed, tags = []) {
  for (const tag of tags) {
    assert.ok(parsed.tags.includes(tag), `expected tag "${tag}" in tags: ${parsed.tags.join(', ')}`)
  }
}

export function assertTagsExclude(parsed, tags = []) {
  for (const tag of tags) {
    assert.ok(!parsed.tags.includes(tag), `did not expect tag "${tag}"`)
  }
}

export function assertBlockKindsInclude(parsed, kinds = []) {
  const actual = new Set((parsed.blocks || []).map(block => block.kind))
  for (const kind of kinds) {
    assert.ok(actual.has(kind), `expected block kind "${kind}" in: ${[...actual].join(', ')}`)
  }
}

export function assertBlockKindsExactly(parsed, kinds = []) {
  const actual = new Set((parsed.blocks || []).map(block => block.kind))
  assert.deepEqual(actual, new Set(kinds), `block kinds mismatch: got ${[...actual].join(', ')}, expected ${kinds.join(', ')}`)
}

export function assertBlockMixTop(parsed, kind) {
  assert.equal(parsed.block_mix?.[0]?.kind, kind, `expected top block kind ${kind}, got ${parsed.block_mix?.[0]?.kind}`)
}

export function assertConfidenceAtLeast(parsed, score) {
  assert.ok((parsed.confidence?.score ?? 0) >= score, `expected confidence >= ${score}, got ${parsed.confidence?.score}`)
}

export function assertConfidenceLevel(parsed, level) {
  assert.equal(parsed.confidence?.level, level, `expected confidence level ${level}, got ${parsed.confidence?.level}`)
}

export function assertEvidenceMatches(parsed, regex) {
  assert.ok(
    (parsed.evidence || []).some(line => regex.test(line)),
    `no evidence line matched ${regex}`
  )
}

export function assertRiskSignalIncludes(parsed, matcher) {
  const signals = parsed.risk_signals || []
  const pass = typeof matcher === 'string'
    ? signals.some(signal => signal.includes(matcher))
    : signals.some(signal => matcher.test(signal))
  assert.ok(pass, `no risk signal matched ${matcher}. got: ${signals.join(' | ')}`)
}

export function assertMissingChainIncludes(parsed, chain) {
  const missing = parsed.missing_chains || []
  assert.ok(missing.includes(chain), `expected missing chain "${chain}" in: ${missing.join(', ')}`)
}

export function assertChainActive(parsed, chainName) {
  const chains = parsed.chains || []
  const match = chains.some(chain => new RegExp(chainName, 'i').test(chain.name))
  assert.ok(match, `expected chain "${chainName}" active. got: ${chains.map(c => c.name).join(', ')}`)
}

export function assertDeltaInRange({ delta }, key, [min, max]) {
  const value = Number(delta?.[key] || 0)
  assert.ok(value >= min && value <= max, `delta.${key} out of range [${min},${max}]: got ${value}`)
}

export function assertDeltaAtLeast({ delta }, key, min) {
  const value = Number(delta?.[key] || 0)
  assert.ok(value >= min, `expected delta.${key} >= ${min}, got ${value}`)
}

export function assertDurationMin(parsed, minutes) {
  assert.equal(parsed.duration_min, minutes, `expected duration_min ${minutes}, got ${parsed.duration_min}`)
}

export function assertDistanceKm(parsed, km) {
  assert.equal(parsed.distance_km, km, `expected distance_km ${km}, got ${parsed.distance_km}`)
}

export function assertHighlightMatches(parsed, regex) {
  assert.match(parsed.highlight || '', regex)
}

export function assertFallbackContains(fallback, regex, where = 'telegramMsg') {
  const source = where === 'telegramMsg' ? fallback.telegramMsg : JSON.stringify(fallback.coachNote)
  assert.match(source, regex, `fallback.${where} did not match ${regex}`)
}

export function assertContradictionFlagged(parsed) {
  const contradictions = parsed.confidence?.contradictions || []
  assert.ok(contradictions.length > 0, 'expected confidence.contradictions to be non-empty')
}

export function assertCompletedFalse(parsed) {
  const incomplete = (parsed.risk_signals || []).some(signal => /kesildi|incomplete|yarida/i.test(signal))
  assert.ok(incomplete, 'expected incomplete/kesildi risk signal')
}

export function assertWellnessFactCount(parsed, count) {
  const wellness = parsed.wellness_facts || []
  assert.equal(wellness.length, count, `expected ${count} wellness facts, got ${wellness.length}`)
}

export function assertModifierIncludes(parsed, matcher) {
  const modifiers = parsed.modifiers || []
  const pass = typeof matcher === 'string'
    ? modifiers.some(modifier => modifier.id === matcher || modifier.label === matcher)
    : modifiers.some(modifier => matcher.test(`${modifier.id} ${modifier.label} ${modifier.evidence || ''}`))
  assert.ok(pass, `no modifier matched ${matcher}. got: ${modifiers.map(modifier => modifier.id).join(', ')}`)
}

export function assertBodyRegionIncludes(parsed, matcher) {
  const regions = parsed.body_regions || []
  const pass = typeof matcher === 'string'
    ? regions.some(region => region.id === matcher || region.region === matcher)
    : regions.some(region => matcher.test(`${region.id} ${region.region} ${region.evidence || ''}`))
  assert.ok(pass, `no body region matched ${matcher}. got: ${regions.map(region => region.id).join(', ')}`)
}

export function assertDoubleSession(parsed, expected = true) {
  assert.equal(Boolean(parsed.is_double_session), Boolean(expected), `expected is_double_session=${expected}, got ${parsed.is_double_session}`)
}
