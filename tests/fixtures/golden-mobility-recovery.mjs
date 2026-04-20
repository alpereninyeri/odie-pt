import {
  assertBlockKindsInclude,
  assertConfidenceLevel,
  assertDurationMin,
  assertHighlightMatches,
  assertRiskSignalIncludes,
  assertTagsInclude,
  assertType,
  assertWellnessFactCount,
} from '../helpers/golden-assertions.mjs'

export const mobilityRecoveryFixtures = [
  {
    id: 'recovery-hip-shoulder-foam-roll',
    input: `Recovery
20 dk hip mobility
10 dk shoulder mobility
foam roller 8 dk`,
    verify({ parsed }) {
      assertType(parsed, 'Stretching')
      assertTagsInclude(parsed, ['recovery', 'mobility'])
      assertBlockKindsInclude(parsed, ['mobility', 'recovery'])
      assertDurationMin(parsed, 38)
      assertHighlightMatches(parsed, /hip mobility/i)
      assertConfidenceLevel(parsed, 'medium')
    },
  },
  {
    id: 'recovery-wellness-walk-sleep-debt',
    input: `Recovery day
uyku 5.5 saat
protein 110 g
3 litre su
20 dk yuruyus`,
    verify({ parsed }) {
      assertType(parsed, 'Yuruyus')
      assertTagsInclude(parsed, ['recovery', 'walking'])
      assertBlockKindsInclude(parsed, ['recovery', 'locomotion'])
      assertWellnessFactCount(parsed, 3)
      assertRiskSignalIncludes(parsed, /uyku borcu/i)
      assertConfidenceLevel(parsed, 'medium')
    },
  },
  {
    id: 'recovery-sauna-stretching-breath',
    input: `Recovery
10 dk sauna
15 dk stretching
8 dk nefes`,
    verify({ parsed }) {
      assertType(parsed, 'Stretching')
      assertTagsInclude(parsed, ['recovery', 'mobility'])
      assertBlockKindsInclude(parsed, ['recovery', 'mobility'])
      assertDurationMin(parsed, 33)
      assertConfidenceLevel(parsed, 'medium')
      assertHighlightMatches(parsed, /stretching/i)
    },
  },
  {
    id: 'recovery-protein-sleep-water-only',
    input: `bugun recovery
uyku 7.5 saat
protein 150 g
2.5 litre su`,
    verify({ parsed }) {
      assertType(parsed, 'Stretching')
      assertWellnessFactCount(parsed, 3)
      assertConfidenceLevel(parsed, 'low')
    },
  },
]
