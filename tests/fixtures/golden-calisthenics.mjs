import {
  assertBlockKindsInclude,
  assertBlockMixTop,
  assertChainActive,
  assertConfidenceAtLeast,
  assertConfidenceLevel,
  assertHighlightMatches,
  assertMissingChainIncludes,
  assertTagsInclude,
  assertType,
} from '../helpers/golden-assertions.mjs'

export const calisthenicsFixtures = [
  {
    id: 'cali-front-lever-muscle-up-ring-dip',
    input: `Calisthenics
Front lever hold 12 sn x 4 set
Muscle up 4x2
Ring dip 4x6`,
    verify({ parsed }) {
      assertType(parsed, 'Calisthenics')
      assertTagsInclude(parsed, ['pull', 'push', 'core', 'lever', 'calisthenics'])
      assertBlockKindsInclude(parsed, ['strength'])
      assertBlockMixTop(parsed, 'strength')
      assertChainActive(parsed, 'lever skill')
      assertChainActive(parsed, 'dynamic calisthenics')
      assertMissingChainIncludes(parsed, 'vertical push balance')
      assertConfidenceLevel(parsed, 'medium')
    },
  },
  {
    id: 'cali-handstand-practice',
    input: `Handstand practice
25 dk wall handstand
40 sn hold x 5 set`,
    verify({ parsed }) {
      assertType(parsed, 'Calisthenics')
      assertTagsInclude(parsed, ['push', 'balance', 'isometric'])
      assertBlockKindsInclude(parsed, ['skill'])
      assertChainActive(parsed, 'handstand chain')
      assertChainActive(parsed, 'static isometric')
      assertHighlightMatches(parsed, /wall handstand/i)
      assertConfidenceLevel(parsed, 'medium')
    },
  },
  {
    id: 'cali-planche-lean-pseudo-planche-lsit',
    input: `Calisthenics
planche lean 5x12 sn
pseudo planche push up 4x8
l sit hold 20 sn x 4`,
    verify({ parsed }) {
      assertType(parsed, 'Calisthenics')
      assertTagsInclude(parsed, ['push', 'core', 'isometric'])
      assertBlockKindsInclude(parsed, ['strength', 'core'])
      assertChainActive(parsed, 'anti-extension core')
      assertChainActive(parsed, 'lever skill')
      assertMissingChainIncludes(parsed, 'antagonist pull')
      assertConfidenceAtLeast(parsed, 75)
    },
  },
  {
    id: 'cali-emom-muscle-up-handstand-kickup',
    input: `Calisthenics
EMOM 10 dk muscle up 1 tekrar
5 tur handstand kick up`,
    verify({ parsed }) {
      assertType(parsed, 'Calisthenics')
      assertTagsInclude(parsed, ['pull', 'push', 'balance'])
      assertBlockKindsInclude(parsed, ['strength', 'skill'])
      assertChainActive(parsed, 'handstand chain')
      assertChainActive(parsed, 'vertical pull')
      assertMissingChainIncludes(parsed, 'direct trunk chain')
      assertConfidenceLevel(parsed, 'medium')
      assertHighlightMatches(parsed, /EMOM muscle up/i)
    },
  },
]
