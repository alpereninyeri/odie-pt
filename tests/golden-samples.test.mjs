import test from 'node:test'
import assert from 'node:assert/strict'

import { parseStructuredWorkoutText } from '../api/telegram.js'
import { buildFallbackCoachResponse } from '../src/data/odie-fallback.js'
import { computeSessionStatDelta, normalizeSession } from '../src/data/rules.js'

test('golden sample: outdoor walk + parkour drill becomes block-first parkour session', () => {
  const text = `
19 nisan 2026
6.7 km ritimli doga yuruyusu
1 saat parkour vault antrenmani
(kong vault, box jump ve precision jump)
`

  const parsed = parseStructuredWorkoutText(text)
  const session = normalizeSession({ date: '2026-04-19', ...parsed })
  const delta = computeSessionStatDelta(session)

  assert.equal(parsed.type, 'Parkour')
  assert.ok(parsed.tags.includes('parkour'))
  assert.ok(parsed.tags.includes('walking'))
  assert.ok(parsed.tags.includes('terrain'))
  assert.ok(parsed.tags.includes('explosive'))
  assert.deepEqual(new Set(parsed.blocks.map(block => block.kind)), new Set(['locomotion', 'skill', 'explosive']))
  assert.ok(parsed.evidence.some(line => /6\.7 km/i.test(line)))
  assert.ok(parsed.evidence.some(line => /parkour vault/i.test(line)))
  assert.equal(session.primaryCategory, 'movement')
  assert.equal(delta.str, 0)
  assert.ok(delta.agi >= 2)
  assert.ok(delta.dex >= 2)
  assert.ok(delta.end >= 1)
})

test('golden sample: hybrid push gym session keeps strength but preserves locomotion and recovery blocks', () => {
  const text = `
Push - Core - Kalf
Toplam sure 2 saat

Yurume
Set 1: 1.7 km - 25min 0s (yokus yukari)

Kosu Bandi
Set 1: 0.8 km - 9min 0s (11 incline interval)

Esneme
4min 0s

Bench Press (Bar)
Set 1: 65 kg x 8
Set 2: 70 kg x 5
Set 3: 60 kg x 6

Sauna 10 Dk
`

  const parsed = parseStructuredWorkoutText(text)
  const kinds = new Set(parsed.blocks.map(block => block.kind))

  assert.equal(parsed.type, 'Push')
  assert.equal(parsed.duration_min, 120)
  assert.equal(parsed.distance_km, 2.5)
  assert.ok(kinds.has('strength'))
  assert.ok(kinds.has('locomotion'))
  assert.ok(kinds.has('mobility'))
  assert.ok(kinds.has('recovery'))
  assert.match(parsed.highlight, /70kg x 5/i)
})

test('golden sample: acrobatics + mobility session keeps skill and mobility semantics', () => {
  const text = `
Akrobasi flow
45 dk round off ve barani drill
15 dk omuz mobility
bridge hold
`

  const parsed = parseStructuredWorkoutText(text)
  const session = normalizeSession({ date: '2026-04-20', ...parsed })
  const kinds = new Set(session.blocks.map(block => block.kind))

  assert.equal(parsed.type, 'Akrobasi')
  assert.ok(parsed.tags.includes('acrobatics'))
  assert.ok(parsed.tags.includes('mobility'))
  assert.ok(kinds.has('skill'))
  assert.ok(kinds.has('mobility'))
})

test('golden sample: fallback ODIE output cites evidence instead of generic strongest-stat talk', () => {
  const parsed = parseStructuredWorkoutText(`
19 nisan 2026
6.7 km ritimli doga yuruyusu
1 saat parkour vault antrenmani
(kong vault, box jump ve precision jump)
`)

  const fallback = buildFallbackCoachResponse(parsed, {
    xp: 168,
    streak: 4,
    odie: {
      recovery: { armor: 100, fatigue: 0, status: 'healthy', warnings: [] },
      loadProfile: { trendSignals: ['Outdoor hacmi +6.7km'] },
      focusGaps: ['Direkt core zinciri son 10 seansta eksik'],
      questPressure: [],
      skillPressure: [],
      performance: [],
      stats: {
        weakest: { key: 'con', val: 12 },
        strongest: { key: 'agi', val: 83 },
      },
    },
  })

  assert.match(fallback.telegramMsg, /ana bloklar/i)
  assert.match(fallback.telegramMsg, /ana kanit/i)
  assert.doesNotMatch(fallback.telegramMsg, /En guclu kolon/i)
  assert.match(fallback.coachNote.sections[0].lines[1], /Okunan ana bloklar/i)
  assert.match(fallback.coachNote.sections[0].lines[2], /Kanit:/i)
})
