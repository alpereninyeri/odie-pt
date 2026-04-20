import {
  assertBlockKindsInclude,
  assertBlockMixTop,
  assertChainActive,
  assertConfidenceLevel,
  assertDistanceKm,
  assertDurationMin,
  assertHighlightMatches,
  assertModifierIncludes,
  assertRiskSignalIncludes,
  assertTagsInclude,
  assertType,
} from '../helpers/golden-assertions.mjs'

export const enduranceFixtures = [
  {
    id: 'endurance-tempo-run-zone3',
    input: `Kosu
8 km tempo run
42 dk
zone 3`,
    verify({ parsed }) {
      assertType(parsed, 'Kosu')
      assertTagsInclude(parsed, ['endurance', 'glycolytic', 'legs'])
      assertBlockKindsInclude(parsed, ['locomotion'])
      assertBlockMixTop(parsed, 'locomotion')
      assertChainActive(parsed, 'aerobic power')
      assertModifierIncludes?.(parsed, /tempo/i)
      assertConfidenceLevel(parsed, 'high')
      assertDistanceKm(parsed, 8)
      assertDurationMin(parsed, 42)
      assertHighlightMatches(parsed, /tempo run/i)
    },
  },
  {
    id: 'endurance-cycling-zone2-long',
    input: `Bisiklet
32 km ride
95 dk zone 2`,
    verify({ parsed }) {
      assertType(parsed, 'Bisiklet')
      assertTagsInclude(parsed, ['cycling', 'aerobic', 'endurance'])
      assertBlockKindsInclude(parsed, ['locomotion'])
      assertDistanceKm(parsed, 32)
      assertDurationMin(parsed, 95)
      assertRiskSignalIncludes(parsed, /hidrasyon/i)
      assertHighlightMatches(parsed, /zone 2/i)
    },
  },
  {
    id: 'endurance-ski-carving-drill',
    input: `Kayak
70 dk carving drill
6 km kayak`,
    verify({ parsed }) {
      assertType(parsed, 'Kayak')
      assertTagsInclude(parsed, ['ski', 'balance', 'endurance'])
      assertBlockKindsInclude(parsed, ['locomotion', 'mixed'])
      assertChainActive(parsed, 'spatial control')
      assertDistanceKm(parsed, 6)
      assertDurationMin(parsed, 70)
      assertConfidenceLevel(parsed, 'medium')
    },
  },
  {
    id: 'endurance-uphill-walk-plus-mobility',
    input: `sabah outdoor hike
4 km yokus yukari yuruyus
aksam 20 dk mobility`,
    verify({ parsed }) {
      assertType(parsed, 'Yuruyus')
      assertTagsInclude(parsed, ['walking', 'mobility', 'terrain'])
      assertBlockKindsInclude(parsed, ['locomotion', 'mobility'])
      assertDistanceKm(parsed, 4)
      assertDurationMin(parsed, 20)
      assertRiskSignalIncludes(parsed, /posterior chain/i)
      assertConfidenceLevel(parsed, 'high')
    },
  },
]
