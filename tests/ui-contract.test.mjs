import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/styles/cozy-reforge.css', import.meta.url), 'utf8')
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('route tab renders Mission HUD instead of legacy route screen', () => {
  assert.match(main, /default: return renderMissionRouteScreen\(model\)/)
  assert.match(main, /function renderMissionRouteScreen/)
  assert.match(css, /\.mission-hud/)
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

test('visible technical trust language is filtered from HUD warnings', () => {
  assert.match(main, /confidence\|evidence\|source/)
  assert.match(main, /kanit\|kanıt\|guven\|güven/)
})
