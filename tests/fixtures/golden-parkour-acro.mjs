import {
  assertBlockKindsInclude,
  assertBlockMixTop,
  assertChainActive,
  assertConfidenceAtLeast,
  assertDeltaAtLeast,
  assertDistanceKm,
  assertEvidenceMatches,
  assertFallbackContains,
  assertHighlightMatches,
  assertMissingChainIncludes,
  assertRiskSignalIncludes,
  assertTagsInclude,
  assertType,
} from '../helpers/golden-assertions.mjs'

export const parkourAcroFixtures = [
  {
    id: 'parkour-outdoor-walk-vault-drill',
    input: `19 nisan 2026
6.7 km ritimli doga yuruyusu
1 saat parkour vault antrenmani
(kong vault, box jump ve precision jump)`,
    date: '2026-04-19',
    verify(result) {
      const { parsed, delta, fallback } = result
      assertType(parsed, 'Parkour')
      assertTagsInclude(parsed, ['parkour', 'walking', 'terrain', 'explosive'])
      assertBlockKindsInclude(parsed, ['locomotion', 'skill', 'explosive'])
      assertBlockMixTop(parsed, 'skill')
      assertDistanceKm(parsed, 6.7)
      assertEvidenceMatches(parsed, /6\.7 km/i)
      assertChainActive(parsed, 'vault chain')
      assertChainActive(parsed, 'reactive legs')
      assertMissingChainIncludes(parsed, 'direct trunk chain')
      assertDeltaAtLeast(result, 'agi', 2)
      assertRiskSignalIncludes(parsed, /landing/i)
      assertConfidenceAtLeast(parsed, 70)
      assertFallbackContains(fallback, /ANA EKSEN/i, 'coachNote')
    },
  },
  {
    id: 'parkour-tic-tac-wall-run-cat-leap',
    input: `Parkour flow
40 dk tic tac ve wall run line
(cat leap, underbar ve stick landing)`,
    verify({ parsed }) {
      assertType(parsed, 'Parkour')
      assertTagsInclude(parsed, ['parkour', 'balance', 'explosive'])
      assertBlockKindsInclude(parsed, ['skill'])
      assertChainActive(parsed, 'vault chain')
      assertChainActive(parsed, 'landing chain')
      assertRiskSignalIncludes(parsed, /landing/i)
      assertHighlightMatches(parsed, /tic tac/i)
    },
  },
  {
    id: 'acro-flow-barani-roundoff-plus-mobility',
    input: `Akrobasi flow
45 dk round off ve barani drill
15 dk omuz mobility
bridge hold`,
    verify({ parsed }) {
      assertType(parsed, 'Akrobasi')
      assertTagsInclude(parsed, ['acrobatics', 'mobility'])
      assertBlockKindsInclude(parsed, ['skill', 'mobility'])
      assertChainActive(parsed, 'spatial control')
      assertConfidenceAtLeast(parsed, 55)
      assertHighlightMatches(parsed, /round off/i)
    },
  },
  {
    id: 'parkour-precision-drop-quadrupedal',
    input: `Parkour
30 dk precision jump ve drop landing
15 dk quadrupedal crawl flow`,
    verify({ parsed }) {
      assertType(parsed, 'Parkour')
      assertTagsInclude(parsed, ['parkour', 'explosive'])
      assertBlockKindsInclude(parsed, ['explosive', 'skill'])
      assertChainActive(parsed, 'landing chain')
      assertChainActive(parsed, 'trunk tension')
      assertRiskSignalIncludes(parsed, /landing/i)
      assertHighlightMatches(parsed, /precision jump/i)
    },
  },
]
