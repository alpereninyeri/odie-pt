import assert from 'node:assert/strict'
import test from 'node:test'

import { buildWorldMapModel } from '../src/data/world-map-engine.js'

test('world map model exposes six game zones and active quest node', () => {
  const model = buildWorldMapModel({
    bodyMap: {
      dailyQuest: { id: 'q1', name: 'Gövde Kilidi', desc: '8 dk core', reward: '+35 XP', linkedUnlock: 'Hollow 45' },
      priority: {
        region: { id: 'core', label: 'Core', risk: 64, trend: 'ihmal' },
        movement: { id: 'landing', label: 'İniş', progress: 52, todayStep: '3 düşük iniş' },
        unlock: { name: 'Hollow 45', progress: 66, todayStep: '3 hollow' },
      },
      movementLines: [{ id: 'landing', label: 'İniş', progress: 52, todayStep: '3 düşük iniş' }],
      unlockTargets: [{ name: 'Hollow 45', progress: 66, todayStep: '3 hollow' }],
      regions: [{ id: 'core', label: 'Core', risk: 64, trend: 'ihmal' }],
    },
    missionLoop: { rewardChips: [{ label: '+155 XP' }], mapProgress: [{ progress: 66 }] },
    bountyBoard: {
      mapNodes: [{
        key: 'bounty-combo_chain',
        zone: 'parkour',
        title: 'Zincir Kombo',
        body: 'Iki sinyal bagla.',
        reward: '+40 XP',
        progress: 50,
        tone: 'combo',
      }],
    },
    nextSession: { readiness: { score: 72 } },
    zones: [],
  })

  assert.equal(model.zones.length, 6)
  assert.ok(model.nodes.some(node => node.type === 'activeQuestNode'))
  assert.ok(model.nodes.some(node => node.type === 'bountyNode' && node.title === 'Zincir Kombo'))
  assert.ok(model.nodes.some(node => node.type === 'unlockGateNode'))
  assert.ok(model.zones.some(zone => zone.key === 'skill' && zone.progress === 66))
})
