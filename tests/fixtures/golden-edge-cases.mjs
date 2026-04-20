import {
  assertBodyRegionIncludes,
  assertCompletedFalse,
  assertConfidenceLevel,
  assertContradictionFlagged,
  assertHighlightMatches,
  assertRiskSignalIncludes,
  assertType,
} from '../helpers/golden-assertions.mjs'

export const edgeCaseFixtures = [
  {
    id: 'edge-incomplete-push-with-shoulder-pain',
    input: `Push
Bench press denedim ama yarida kestim
omuz agrisi vardi`,
    verify({ parsed }) {
      assertType(parsed, 'Push')
      assertCompletedFalse(parsed)
      assertBodyRegionIncludes(parsed, 'shoulder')
      assertConfidenceLevel(parsed, 'low')
      assertHighlightMatches(parsed, /Push/i)
    },
  },
  {
    id: 'edge-generic-session-stays-low-confidence',
    input: `bugun biraz antrenman yaptim ama net degildi`,
    verify({ parsed }) {
      assertType(parsed, 'Custom')
      assertConfidenceLevel(parsed, 'low')
    },
  },
  {
    id: 'edge-pr-mention-low-load-contradiction',
    input: `Push
yeni PR denemesi
lateral raise 5 kg x 10`,
    verify({ parsed }) {
      assertType(parsed, 'Push')
      assertContradictionFlagged(parsed)
      assertConfidenceLevel(parsed, 'low')
    },
  },
  {
    id: 'edge-long-session-needs-fuel-report',
    input: `Bisiklet
105 dk ride
38 km zone 2`,
    verify({ parsed }) {
      assertType(parsed, 'Bisiklet')
      assertRiskSignalIncludes(parsed, /nutrition/i)
      assertRiskSignalIncludes(parsed, /hidrasyon/i)
      assertConfidenceLevel(parsed, 'medium')
    },
  },
]
