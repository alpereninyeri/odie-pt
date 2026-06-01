import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildBountyBoard,
  evaluateBountyCompletions,
  flattenBounties,
} from '../src/data/bounty-board.js'

const today = '2026-06-01'

function baseBodyMap() {
  return {
    dailyQuest: {
      id: 'daily-core',
      name: 'Core line',
      desc: 'Close the core line.',
      linkedRegion: 'core',
      xpReward: 35,
    },
    priority: {
      region: { id: 'core', label: 'Core', risk: 70 },
      unlock: {
        name: 'Hollow Hold',
        progress: 66,
        linkedRegions: ['core'],
        todayStep: 'Hollow body block',
      },
    },
    movementLines: [{ id: 'flow', label: 'Flow', progress: 42, todayStep: 'Move cleanly' }],
    unlockTargets: [{ name: 'Hollow Hold', progress: 66, linkedRegions: ['core'] }],
  }
}

function coreComboSession(extra = {}) {
  return {
    type: 'Parkour',
    date: today,
    durationMin: 25,
    distanceKm: 2.2,
    notes: 'flow mobility hollow core',
    exercises: [{ name: 'Hollow Body', sets: [{ durationSec: 30 }] }],
    ...extra,
  }
}

test('bounty board exposes the eight V1 archetypes', () => {
  const board = buildBountyBoard({
    state: { workouts: [], profile: { fatigue: 72 } },
    bodyMap: baseBodyMap(),
    nextSession: { tone: 'warn', primaryGoal: { title: 'Main route' } },
    semantic: { variety: 2 },
    today,
  })

  const kinds = flattenBounties(board).map(bounty => bounty.kind).sort()
  assert.deepEqual(kinds, [
    'combo_chain',
    'core_seal',
    'daily_active',
    'movement_patrol',
    'recovery_contract',
    'streak_guard',
    'unlock_gate',
    'weak_line',
  ].sort())
  assert.equal(board.featured.kind, 'daily_active')
  assert.equal(board.daily.length, 4)
  assert.equal(board.weekly.length, 3)
  assert.ok(board.mapNodes.length >= 3)
  assert.ok(board.rewardChips.every(chip => chip.label.includes('XP')))
})

test('bounty completion only pays newly crossed non-active bounties', () => {
  const beforeState = { workouts: [], profile: {}, bodyMapState: baseBodyMap() }
  const session = coreComboSession()
  const afterState = { workouts: [session], profile: {}, bodyMapState: baseBodyMap() }

  const rewards = evaluateBountyCompletions({ beforeState, afterState, session, today })
  const rewardIds = rewards.map(reward => reward.bountyId)

  assert.ok(rewardIds.includes('streak_guard'))
  assert.ok(rewardIds.includes('movement_patrol'))
  assert.ok(rewardIds.includes('combo_chain'))
  assert.equal(rewardIds.includes('daily_active'), false)
  assert.ok(rewards.reduce((sum, reward) => sum + reward.xp, 0) <= 120)
})

test('bounty completion does not pay without a progress crossing', () => {
  const session = coreComboSession()
  const beforeState = { workouts: [session], profile: {}, bodyMapState: baseBodyMap() }
  const afterState = { workouts: [session], profile: {}, bodyMapState: baseBodyMap() }

  const rewards = evaluateBountyCompletions({ beforeState, afterState, session, today })
  assert.deepEqual(rewards, [])
})

test('recovery, unlock, weak-line and combo examples close on real logs', () => {
  const sessions = [
    coreComboSession(),
    { type: 'Mobility', date: today, durationMin: 12, notes: 'stretch recovery walk' },
  ]
  const board = buildBountyBoard({
    state: { workouts: sessions, profile: { fatigue: 70 }, bodyMapState: baseBodyMap() },
    today,
  })
  const byKind = new Map(flattenBounties(board).map(bounty => [bounty.kind, bounty]))

  assert.equal(byKind.get('recovery_contract')?.done, true)
  assert.equal(byKind.get('unlock_gate')?.done, true)
  assert.equal(byKind.get('weak_line')?.done, true)
  assert.equal(byKind.get('combo_chain')?.done, true)
})
