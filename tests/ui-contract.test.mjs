import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles/cozy-reforge.css', import.meta.url), 'utf8')
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const healthStatusApi = readFileSync(new URL('../api/health-status.js', import.meta.url), 'utf8')
const missionLoop = readFileSync(new URL('../src/data/mission-loop.js', import.meta.url), 'utf8')

test('route tab renders Mission HUD instead of legacy route screen', () => {
  assert.match(main, /default: return renderMissionRouteScreen\(model\)/)
  assert.match(main, /function renderMissionRouteScreen/)
  assert.match(css, /\.mission-hud/)
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
})

test('visible technical trust language is filtered from HUD warnings', () => {
  assert.match(main, /confidence\|evidence\|source/)
  assert.match(main, /kanit\|kanıt\|guven\|güven/)
})
