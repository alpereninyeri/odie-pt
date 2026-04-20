import {
  assertBlockKindsInclude,
  assertBodyRegionIncludes,
  assertConfidenceLevel,
  assertHighlightMatches,
  assertModifierIncludes,
  assertTagsInclude,
  assertType,
} from '../helpers/golden-assertions.mjs'

export const languageVariantFixtures = [
  {
    id: 'lang-english-leg-day',
    input: `Leg day
Bulgarian split squat 3x10 20 kg
Romanian deadlift 4x8 80 kg`,
    verify({ parsed }) {
      assertType(parsed, 'Bacak')
      assertTagsInclude(parsed, ['legs', 'posterior', 'unilateral'])
      assertBlockKindsInclude(parsed, ['strength'])
      assertConfidenceLevel(parsed, 'medium')
      assertHighlightMatches(parsed, /Bulgarian split squat/i)
    },
  },
  {
    id: 'lang-turkish-diacritics-outdoor-parkour',
    input: `Parkour
35 dk doğa yürüyüşü ısınma
20 dk precision jump`,
    verify({ parsed }) {
      assertType(parsed, 'Parkour')
      assertTagsInclude(parsed, ['parkour', 'walking', 'explosive'])
      assertBlockKindsInclude(parsed, ['locomotion', 'explosive'])
      assertConfidenceLevel(parsed, 'high')
    },
  },
  {
    id: 'lang-english-weighted-chin-up',
    input: `Pull
weighted chin up 4x4 +15 kg
chest supported row 3x12`,
    verify({ parsed }) {
      assertType(parsed, 'Pull')
      assertTagsInclude(parsed, ['pull', 'weighted-calisthenics'])
      assertBlockKindsInclude(parsed, ['strength'])
      assertConfidenceLevel(parsed, 'medium')
    },
  },
  {
    id: 'lang-turkish-tempo-and-shoulder-pain',
    input: `Kosu
6 km tempo kosu
sag omuz agrisi hafif`,
    verify({ parsed }) {
      assertType(parsed, 'Kosu')
      assertModifierIncludes(parsed, /tempo/i)
      assertBodyRegionIncludes(parsed, 'shoulder')
      assertConfidenceLevel(parsed, 'medium')
    },
  },
]
