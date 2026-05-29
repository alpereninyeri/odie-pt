import assert from 'node:assert/strict'
import test from 'node:test'

import { buildMissionLoop, buildRewardRecap, snapshotMissionState } from '../src/data/mission-loop.js'

test('mission loop turns quest and xp preview into game reward chips', () => {
  const loop = buildMissionLoop({
    profile: {
      level: 7,
      xp: { current: 840, max: 2000 },
      streak: { current: 5 },
    },
    stats: [{ label: 'KUV', value: 72, rank: 'A' }],
    nextSession: {
      readiness: { score: 76 },
      primaryGoal: { title: 'Ana blok' },
    },
    bodyMap: {
      dailyQuest: {
        name: 'Core Hattini Yak',
        desc: '8 dk hollow/plank odak',
        linkedRegion: 'core',
        linkedUnlock: 'Hollow 45',
        xpReward: 35,
      },
      xpPreview: {
        total: 155,
        text: '+80 Ana Hamle / +35 Görev',
        parts: [
          { key: 'base', label: 'Ana Hamle', value: 80 },
          { key: 'quest', label: 'Ara Görev', value: 35 },
        ],
      },
      priority: {
        unlock: { name: 'Hollow 45', progress: 66, todayStep: '3 x hollow' },
      },
      movementLines: [
        { id: 'landing', label: 'Inis', progress: 52, todayStep: '3 dusuk inis' },
      ],
    },
  })

  assert.equal(loop.title, 'Görev Döngüsü')
  assert.equal(loop.levelLine, 'Seviye 7 / 840 XP')
  assert.ok(loop.rewardChips.some(chip => chip.label === '+155 XP'))
  assert.ok(loop.rewardChips.some(chip => chip.label === 'GOV etkisi'))
  assert.ok(loop.rewardChips.some(chip => chip.label === 'Seri x5'))
  assert.ok(loop.mapProgress.some(item => item.label === 'Hollow 45' && item.progress === 66))
})

test('reward recap summarizes xp, quest, level and streak changes', () => {
  const beforeState = snapshotMissionState({
    profile: { level: 2, streak: { current: 3 } },
    badges: [{ id: 'a', locked: true }],
  })
  const afterState = snapshotMissionState({
    profile: { level: 3, streak: { current: 4 } },
    badges: [{ id: 'a', locked: false, earnedAt: '2026-05-29' }],
  })
  const recap = buildRewardRecap({
    beforeState,
    afterState,
    workout: {
      xpEarned: 180,
      xpBreakdown: [{ key: 'quest', value: 35 }],
      statDelta: { str: 3, con: 1 },
    },
  })

  assert.equal(recap.title, 'Seviye Atladı')
  assert.equal(recap.questClosed, true)
  assert.deepEqual(recap.chips.slice(0, 5), ['+180 XP', 'Seviye 3', 'Görev kapandı', 'Seri 4', '1 rozet'])
  assert.ok(recap.chips.includes('STR +3'))
})
