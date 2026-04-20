import test from 'node:test'

import { goldenFixtures } from './fixtures/index.mjs'
import { runGoldenCase } from './helpers/golden-assertions.mjs'

for (const fixture of goldenFixtures) {
  test(`golden fixture: ${fixture.id}`, () => {
    const result = runGoldenCase(fixture)
    fixture.verify(result)
  })
}
