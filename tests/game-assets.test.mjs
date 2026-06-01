import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const manifestPath = resolve(root, 'src/data/game-assets.js')
const manifest = readFileSync(manifestPath, 'utf8')
const manifestDir = dirname(manifestPath)

const requiredAssets = [
  'command-bg-mobile.jpg',
  'command-bg-desktop.jpg',
  'world-map-mobile.jpg',
  'world-map-desktop.jpg',
  'odie-room-mobile.jpg',
  'odie-room-desktop.jpg',
  'panel-parchment.jpg',
  'board-layer-v4.jpg',
  'nav-plate.png',
  'detail-sheet-bg.jpg',
  'quest-board-bg.jpg',
  'nav-command.png',
  'nav-map.png',
  'nav-odie.png',
  'zone-forge.png',
  'zone-parkour.png',
  'zone-recovery.png',
  'zone-endurance.png',
  'zone-skill.png',
  'zone-body.png',
  'reward-streak.png',
  'reward-unlock.png',
  'reward-recovery.png',
  'reward-pr.png',
  'reward-shield.png',
  'reward-bounty.png',
  'badge-level.png',
  'badge-pr.png',
  'badge-streak.png',
  'badge-locked.png',
  'badge-quest.png',
  'badge-bounty.png',
  'info-xp.png',
  'info-body-pressure.png',
  'info-unlock.png',
  'info-stat-rank.png',
  'info-recovery-gate.png',
  'info-pr-gate.png',
  'info-combo-chain.png',
  'odie-idle.png',
  'odie-listening.png',
  'odie-confirm.png',
  'odie-warning.png',
]

function importedAssetPaths() {
  return [...manifest.matchAll(/import\s+\w+\s+from\s+'([^']+)'/g)]
    .map(match => resolve(manifestDir, match[1]))
}

function imageSize(file) {
  const buffer = readFileSync(file)
  if (buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]
      const length = buffer.readUInt16BE(offset + 2)
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
      }
      offset += 2 + length
    }
  }
  throw new Error(`Unsupported image format: ${file}`)
}

test('cozy-v4 asset manifest exposes every required visual layer', () => {
  for (const name of requiredAssets) {
    assert.match(manifest, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.equal(existsSync(resolve(root, 'src/assets/game/cozy-v4', name)), true)
  }
})

test('cozy-v4 generated assets meet dimension and size budgets', () => {
  for (const file of importedAssetPaths()) {
    const { width, height } = imageSize(file)
    const bytes = statSync(file).size
    const name = file.split(/[\\/]/).at(-1)

    if (name.endsWith('-desktop.jpg')) {
      assert.ok(width >= 1280 && height >= 720, `${name} desktop background too small`)
      assert.ok(bytes <= 500_000, `${name} desktop background too heavy`)
    } else if (name.endsWith('-mobile.jpg')) {
      assert.ok(width >= 720 && height >= 1280, `${name} mobile background too small`)
      assert.ok(bytes <= 500_000, `${name} mobile background too heavy`)
    } else if (name.startsWith('odie-') && name.endsWith('.png')) {
      assert.ok(width >= 512 && height >= 512, `${name} ODIE state too small`)
      assert.ok(bytes <= 250_000, `${name} ODIE state too heavy`)
    } else if (/(nav-|zone-|reward-|badge-|info-)/.test(name)) {
      assert.ok(width >= 256 && height >= 256, `${name} icon too small`)
      assert.ok(bytes <= 220_000, `${name} icon too heavy`)
    }
  }
})

test('cozy-v4 active folder has no orphan visual files', () => {
  const imported = new Set(importedAssetPaths().map(file => file.split(/[\\/]/).at(-1)))
  const files = readdirSync(resolve(root, 'src/assets/game/cozy-v4')).filter(name => /\.(png|jpe?g)$/i.test(name))
  assert.deepEqual(files.filter(name => !imported.has(name)).sort(), [])
})
