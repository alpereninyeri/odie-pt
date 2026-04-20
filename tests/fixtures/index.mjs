import { calisthenicsFixtures } from './golden-calisthenics.mjs'
import { edgeCaseFixtures } from './golden-edge-cases.mjs'
import { enduranceFixtures } from './golden-endurance.mjs'
import { hybridFixtures } from './golden-hybrid.mjs'
import { languageVariantFixtures } from './golden-language-variants.mjs'
import { mobilityRecoveryFixtures } from './golden-mobility-recovery.mjs'
import { parkourAcroFixtures } from './golden-parkour-acro.mjs'
import { strengthFixtures } from './golden-strength.mjs'

export const goldenFixtures = [
  ...strengthFixtures,
  ...enduranceFixtures,
  ...parkourAcroFixtures,
  ...calisthenicsFixtures,
  ...mobilityRecoveryFixtures,
  ...hybridFixtures,
  ...edgeCaseFixtures,
  ...languageVariantFixtures,
]
