import {
  assertBlockKindsInclude,
  assertBlockMixTop,
  assertChainActive,
  assertConfidenceAtLeast,
  assertConfidenceLevel,
  assertDistanceKm,
  assertDurationMin,
  assertHighlightMatches,
  assertMissingChainIncludes,
  assertRiskSignalIncludes,
  assertTagsInclude,
  assertType,
} from '../helpers/golden-assertions.mjs'

export const strengthFixtures = [
  {
    id: 'strength-weighted-pull-and-row',
    input: `Pull gunu
Weighted pull up 5x3 +20 kg
Barbell row 4x8 70 kg
Dead hang 90 sn`,
    verify({ parsed }) {
      assertType(parsed, 'Pull')
      assertTagsInclude(parsed, ['pull', 'weighted-calisthenics', 'horizontal-pull'])
      assertBlockKindsInclude(parsed, ['strength'])
      assertBlockMixTop(parsed, 'strength')
      assertChainActive(parsed, 'vertical pull')
      assertChainActive(parsed, 'horizontal pull')
      assertConfidenceAtLeast(parsed, 85)
      assertConfidenceLevel(parsed, 'high')
      assertHighlightMatches(parsed, /dead hang/i)
      assertMissingChainIncludes(parsed, 'antagonist push')
    },
  },
  {
    id: 'strength-push-bench-incline-dip',
    input: `Push
Bench press 5x5 80 kg
Incline dumbbell press 3x10 30 kg
Triceps dip 3x12`,
    verify({ parsed }) {
      assertType(parsed, 'Push')
      assertTagsInclude(parsed, ['push', 'horizontal-push', 'gym'])
      assertBlockKindsInclude(parsed, ['strength'])
      assertChainActive(parsed, 'horizontal push')
      assertMissingChainIncludes(parsed, 'antagonist pull')
      assertConfidenceAtLeast(parsed, 90)
      assertRiskSignalIncludes(parsed, /posterior chain/i)
    },
  },
  {
    id: 'strength-bacak-unilateral-posterior-calf',
    input: `Bacak
Bulgarian split squat 3x10 20 kg
Romanian deadlift 4x8 80 kg
Calf raise 4x15 40 kg`,
    verify({ parsed }) {
      assertType(parsed, 'Bacak')
      assertTagsInclude(parsed, ['legs', 'posterior', 'unilateral'])
      assertBlockKindsInclude(parsed, ['strength'])
      assertChainActive(parsed, 'posterior chain')
      assertChainActive(parsed, 'quad dominant')
      assertChainActive(parsed, 'calf focus')
      assertMissingChainIncludes(parsed, 'glute activation')
      assertConfidenceAtLeast(parsed, 85)
      assertHighlightMatches(parsed, /Bulgarian split squat/i)
    },
  },
  {
    id: 'strength-strongman-carry-and-sled',
    input: `Strongman
farmers walk 40 m 4 tur 32 kg
sled push 6 tur`,
    verify({ parsed }) {
      assertType(parsed, 'Custom')
      assertTagsInclude(parsed, ['carry', 'grip', 'core'])
      assertBlockKindsInclude(parsed, ['locomotion', 'strength'])
      assertChainActive(parsed, 'trunk tension')
      assertChainActive(parsed, 'grip endurance')
      assertConfidenceLevel(parsed, 'medium')
      assertHighlightMatches(parsed, /farmers walk/i)
    },
  },
]
