import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import test from 'node:test'

test('release readiness script passes current source invariants', () => {
  const output = execFileSync(process.execPath, ['scripts/release-readiness.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })
  assert.match(output, /release readiness ok/)
})
