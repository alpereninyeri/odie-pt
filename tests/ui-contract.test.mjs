import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles/cozy-reforge.css', import.meta.url), 'utf8')
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const healthStatusApi = readFileSync(new URL('../api/health-status.js', import.meta.url), 'utf8')
const missionLoop = readFileSync(new URL('../src/data/mission-loop.js', import.meta.url), 'utf8')
const gameAssets = readFileSync(new URL('../src/data/game-assets.js', import.meta.url), 'utf8')

test('route tab renders Komuta mission surface instead of legacy route screen', () => {
  assert.match(main, /default: return renderMissionRouteScreen\(model\)/)
  assert.match(main, /function renderMissionRouteScreen/)
  assert.match(css, /\.mission-hud/)
  assert.doesNotMatch(main, /label: 'Defter'/)
  assert.match(main, /label: 'Komuta'/)
  assert.match(main, /data-tab="signal"/)
})

test('route tab includes real progress infographics', () => {
  assert.match(main, /function buildProgressSnapshot/)
  assert.match(main, /function renderProgressCard/)
  assert.match(main, /Eski -> Simdi|eski -> simdi/)
  assert.match(main, /function renderMapProgress/)
  assert.match(css, /\.progress-card/)
  assert.match(css, /\.era-compare/)
  assert.match(css, /\.progress-sparkline/)
  assert.match(css, /\.map-progress/)
})

test('mission loop helper feeds reward chips and recap without data contract changes', () => {
  assert.match(main, /buildMissionLoop/)
  assert.match(main, /renderMissionQuest\(loop, model\)/)
  assert.match(main, /buildRewardRecap/)
  assert.match(main, /reward-recap/)
  assert.match(missionLoop, /export function buildMissionLoop/)
  assert.match(missionLoop, /export function buildRewardRecap/)
  assert.match(missionLoop, /rewardChips/)
})

test('world map and infographic selectors are present', () => {
  assert.match(main, /buildWorldMapModel/)
  assert.match(main, /world-map-board/)
  assert.match(main, /world-node/)
  assert.match(main, /active-quest-node/)
  assert.match(main, /function renderXpBreakdown/)
  assert.match(main, /function renderBodyPressure/)
  assert.match(main, /function renderUnlockLadder/)
  assert.match(css, /\.world-map-board/)
  assert.match(css, /\.world-node/)
  assert.match(css, /\.xp-breakdown/)
})

test('active visual layers use cozy-v4 raster assets instead of legacy emoji/v3 layers', () => {
  assert.doesNotMatch(main, /cozy-v3/)
  assert.doesNotMatch(css, /cozy-v3/)
  assert.match(main, /GAME_ASSETS/)
  assert.match(gameAssets, /command-bg-desktop\.jpg/)
  assert.match(gameAssets, /odie-room-desktop\.jpg/)
  assert.match(gameAssets, /nav-command\.png/)
  assert.match(main, /<span class="n-ico" aria-hidden="true"><img/)
  assert.doesNotMatch(main, /\\u\{1F3AF\}|\\u\{1F9ED\}|\\u\{1F436\}/)
  assert.doesNotMatch(main, /zone\.icon/)
  assert.match(main, /ASSETS\.zone\[zone\.key\]/)
})

test('asset-backed interactive surfaces expose detail affordances', () => {
  assert.match(main, /class="reward-chip/)
  assert.match(main, /detailAttrs\(chip\.label/)
  assert.match(main, /class="world-node/)
  assert.match(main, /detailAttrs\(zone\.name/)
  assert.match(main, /class="stat-stone/)
  assert.match(main, /detailAttrs\(`\$\{axis\.short\}/)
  assert.match(main, /class="badge/)
  assert.match(main, /detailAttrs\(a\.name/)
  assert.match(main, /class="xp-track"/)
  assert.match(main, /detailAttrs\('XP yolu'/)
})

test('health status has a public Apple disabled state', () => {
  assert.match(healthStatusApi, /appleStatus/)
  assert.match(healthStatusApi, /apple_disabled/)
})

test('manual workout form preserves exercise payload contract', () => {
  assert.match(main, /name="exerciseName"/)
  assert.match(main, /function parseExerciseRows/)
  assert.match(main, /volumeKg/)
  assert.match(main, /Gym kaydi icin en az bir egzersiz/)
})

test('tap-to-detail and zoom access are enabled', () => {
  assert.match(main, /data-detail-title/)
  assert.match(main, /function renderDetailSheet/)
  assert.doesNotMatch(index, /maximum-scale|user-scalable=no/)
})

test('legacy theme layers stay out of the active app', () => {
  assert.doesNotMatch(main, /riftline\.css|odie-ui\.css|cozy-rpg\/mobile\.css/)
  assert.doesNotMatch(css, /riftline|odie-ui|cozy-rpg/)
  assert.doesNotMatch(gameAssets, /cozy-v3/)
})

test('visible technical trust language is filtered from HUD warnings', () => {
  assert.match(main, /confidence\|evidence\|source/)
  assert.match(main, /kanit\\w\*/)
  assert.match(main, /guven\\w\*/)
  assert.match(main, /kaynak\\w\*/)
  assert.match(main, /api/)
  assert.match(main, /payload/)
})
