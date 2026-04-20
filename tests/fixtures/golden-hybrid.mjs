import {
  assertBlockKindsInclude,
  assertConfidenceLevel,
  assertDistanceKm,
  assertDoubleSession,
  assertDurationMin,
  assertHighlightMatches,
  assertMissingChainIncludes,
  assertTagsInclude,
  assertType,
} from '../helpers/golden-assertions.mjs'

export const hybridFixtures = [
  {
    id: 'hybrid-push-core-kalf-locomotion-recovery',
    input: `Push - Core - Kalf
Toplam sure 2 saat

Yurume
Set 1: 1.7 km - 25min 0s (yokus yukari)

Kosu Bandi
Set 1: 0.8 km - 9min 0s (11 incline interval)

Esneme
4min 0s

Bench Press (Bar)
Set 1: 65 kg x 8
Set 2: 70 kg x 5
Set 3: 60 kg x 6

Sauna 10 Dk`,
    verify({ parsed }) {
      assertType(parsed, 'Push')
      assertTagsInclude(parsed, ['walking', 'push', 'recovery'])
      assertBlockKindsInclude(parsed, ['strength', 'locomotion', 'mobility', 'recovery'])
      assertDistanceKm(parsed, 2.5)
      assertDurationMin(parsed, 120)
      assertHighlightMatches(parsed, /70kg x 5/i)
    },
  },
  {
    id: 'hybrid-pull-plus-run-finisher',
    input: `Pull + run
Deadlift 5x3 140 kg
2 km kosu 12 dk`,
    verify({ parsed }) {
      assertType(parsed, 'Pull')
      assertTagsInclude(parsed, ['pull', 'walking', 'posterior'])
      assertBlockKindsInclude(parsed, ['strength', 'locomotion'])
      assertDistanceKm(parsed, 2)
      assertDurationMin(parsed, 12)
      assertMissingChainIncludes(parsed, 'unilateral pattern')
      assertConfidenceLevel(parsed, 'high')
    },
  },
  {
    id: 'hybrid-double-session-walk-and-push',
    input: `sabah 4 km yuruyus
aksam 45 dk push antrenmani`,
    verify({ parsed }) {
      assertType(parsed, 'Yuruyus')
      assertTagsInclude(parsed, ['walking', 'push'])
      assertBlockKindsInclude(parsed, ['locomotion', 'strength'])
      assertDoubleSession(parsed, true)
      assertDistanceKm(parsed, 4)
      assertDurationMin(parsed, 45)
      assertConfidenceLevel(parsed, 'medium')
    },
  },
  {
    id: 'hybrid-parkour-plus-cooldown-mobility',
    input: `Parkour
35 dk vault flow
15 dk cooldown mobility`,
    verify({ parsed }) {
      assertType(parsed, 'Parkour')
      assertTagsInclude(parsed, ['parkour', 'mobility'])
      assertBlockKindsInclude(parsed, ['skill', 'mobility'])
      assertHighlightMatches(parsed, /vault flow/i)
      assertConfidenceLevel(parsed, 'high')
    },
  },
]
