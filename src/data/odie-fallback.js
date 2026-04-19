function buildStatLine(stats = {}) {
  return `STR ${stats.str ?? 0} · AGI ${stats.agi ?? 0} · END ${stats.end ?? 0} · DEX ${stats.dex ?? 0} · CON ${stats.con ?? 0} · STA ${stats.sta ?? 0}`
}

function emptyStateSync() {
  return {
    title: 'STATE_SYNC',
    hidden: true,
    payload: {
      stats: {
        str: { desc: '', coach: '', detail: ['', '', '', ''] },
        agi: { desc: '', coach: '', detail: ['', '', '', ''] },
        end: { desc: '', coach: '', detail: ['', '', '', ''] },
        dex: { desc: '', coach: '', detail: ['', '', '', ''] },
        con: { desc: '', coach: '', detail: ['', '', '', ''] },
        sta: { desc: '', coach: '', detail: ['', '', '', ''] },
      },
      performance: {
        bench: { note: '', tip: '', details: ['', '', '', ''] },
        mu: { note: '', tip: '', details: ['', '', '', ''] },
        hang: { note: '', tip: '', details: ['', '', '', ''] },
        flip: { note: '', tip: '', details: ['', '', '', ''] },
      },
      muscles: {
        omuz: { detail: '', tip: '', tag: '' },
        gogus: { detail: '', tip: '', tag: '' },
        arms: { detail: '', tip: '', tag: '' },
        back: { detail: '', tip: '', tag: '' },
        legs: { detail: '', tip: '', tag: '' },
        core: { detail: '', tip: '', tag: '' },
      },
    },
  }
}

function topBlockMix(blockMix = []) {
  return (blockMix || []).slice(0, 3)
}

function mainAxisSentence(parsed = {}) {
  const leading = topBlockMix(parsed.block_mix || [])
  if (!leading.length) return `${parsed.type} seansi yapisal olarak kayda girdi.`
  return `Ana eksen ${leading.map(item => `${item.kind} ${item.percent}%`).join(' · ')}.`
}

function evidenceSentence(parsed = {}) {
  const evidence = (parsed.evidence || []).slice(0, 3)
  if (!evidence.length) return 'Kanit sinyali sinirli; yorum blok uzerinden kuruldu.'
  return `Ana kanit: ${evidence.join(' | ')}.`
}

function chainSentence(parsed = {}) {
  const chains = (parsed.chains || []).slice(0, 3)
  if (!chains.length) return 'Yuklenen zincir net degil.'
  return chains.map(chain => `${chain.name}${chain.reason ? ` · ${chain.reason}` : ''}`).join(' | ')
}

function missingSentence(parsed = {}, firstGap = '') {
  const missing = parsed.missing_chains || []
  if (missing.length) return `Eksik halka: ${missing[0]}.`
  if (firstGap) return `Eksik halka: ${firstGap}.`
  return 'Eksik halka net degil; sonraki blokta progression sec.'
}

function riskSentence(parsed = {}, recovery = {}) {
  const risk = (parsed.risk_signals || [])[0]
  if (risk) return `Risk: ${risk}.`
  return `Recovery: armor ${recovery.armor ?? '-'} / fatigue ${recovery.fatigue ?? '-'} / ${recovery.status || 'healthy'}.`
}

function performanceSentence(parsed = {}, firstPerf = null, context = {}) {
  if ((parsed.volume_kg || 0) > 0) {
    return `${parsed.type} ${parsed.total_sets || 0} set ve ${parsed.volume_kg || 0}kg hacimle kayda girdi.`
  }
  if ((parsed.distance_km || 0) > 0 || (parsed.duration_min || 0) > 0) {
    return `${parsed.duration_min || 0}dk${parsed.distance_km ? ` · ${parsed.distance_km}km` : ''} uzerinden hareket yuku okundu.`
  }
  if (firstPerf) return `${firstPerf.name}: ${firstPerf.val} · ${firstPerf.trend}.`
  return `Stat paneli guncel: ${buildStatLine(context.stats || {})}.`
}

function confidenceSentence(parsed = {}) {
  const confidence = parsed.confidence || null
  if (!confidence) return 'Parse confidence: unknown.'
  return `Parse confidence: ${confidence.level}${confidence.score != null ? ` (${confidence.score}/100)` : ''}.`
}

export function buildFallbackCoachResponse(parsed, context = {}) {
  const odie = context.odie || {}
  const recovery = odie.recovery || {}
  const loadProfile = odie.loadProfile || {}
  const firstTrend = loadProfile.trendSignals?.[0]
  const firstGap = odie.focusGaps?.[0]
  const firstQuest = odie.questPressure?.[0]
  const firstSkill = odie.skillPressure?.[0]
  const firstPerf = odie.performance?.[0]
  const warningLine = recovery.warnings?.[0] || firstGap || 'Risk sinyali dusuk; ayni kalitede devam et.'

  const telegramParts = [
    `${parsed.type} seansi ${parsed.duration_min || 0}dk${parsed.distance_km ? ` + ${parsed.distance_km}km` : ''} olarak kayda girdi.`,
    mainAxisSentence(parsed),
    evidenceSentence(parsed),
    missingSentence(parsed, firstGap),
  ].filter(Boolean)

  const sections = [
    {
      title: 'ANA EKSEN',
      mood: parsed.has_pr ? 'fire' : 'calm',
      lines: [
        mainAxisSentence(parsed),
        performanceSentence(parsed, firstPerf, context),
      ],
    },
    {
      title: 'KANIT',
      mood: 'calm',
      lines: [
        evidenceSentence(parsed),
        confidenceSentence(parsed),
      ],
    },
    {
      title: 'YUKLENEN ZINCIRLER',
      mood: 'fire',
      lines: [
        chainSentence(parsed),
        firstTrend || 'Uzun donem trend sinyali zayif.',
      ],
    },
    {
      title: 'EKSIK HALKA',
      mood: 'warn',
      lines: [
        missingSentence(parsed, firstGap),
      ],
    },
    {
      title: 'RISK VE RECOVERY',
      mood: recovery.status === 'overloaded' || recovery.status === 'injured' ? 'danger' : 'warn',
      lines: [
        riskSentence(parsed, recovery),
        warningLine,
      ],
    },
    {
      title: 'SONRAKI ODAK',
      mood: 'calm',
      lines: [
        firstSkill ? `${firstSkill.branch}: ${firstSkill.name} · ${firstSkill.status}.` : 'Sonraki blokta eksik halkayi kapatan net bir teknik odak sec.',
        firstQuest ? `En yakin quest: ${firstQuest.name} ${firstQuest.progress}/${firstQuest.total}.` : 'Quest board baskisi dusuk.',
      ],
    },
    emptyStateSync(),
  ]

  return {
    telegramMsg: telegramParts.join(' '),
    coachNote: {
      sections,
      warnings: [warningLine].filter(Boolean),
      quest_hints: firstQuest ? [`${firstQuest.name} - ${firstQuest.progress}/${firstQuest.total}`] : [],
      skill_progress: firstSkill ? [{ name: firstSkill.name, note: `${firstSkill.branch} hattinda baski suruyor.` }] : [],
      xp_note: `+${context.xp || 0} XP | Streak ${context.streak || 0}`,
    },
  }
}
