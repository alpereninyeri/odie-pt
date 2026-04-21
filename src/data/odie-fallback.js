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
  if (!leading.length) return `${parsed.type} seansi temel haliyle kayda girdi.`
  return `Seansin ana akisi ${leading.map(item => `${item.kind} ${item.percent}%`).join(' · ')}.`
}

function evidenceSentence(parsed = {}) {
  const evidence = (parsed.evidence || []).slice(0, 3)
  if (!evidence.length) return 'Metin kisa oldugu icin yorum genel seans akisina gore kuruldu.'
  return `Okunan ana ipuclari: ${evidence.join(' | ')}.`
}

function chainSentence(parsed = {}) {
  const chains = (parsed.chains || []).slice(0, 3)
  if (!chains.length) return 'Baskin calisma hatti net secilemedi.'
  return chains.map(chain => `${chain.name}${chain.reason ? ` · ${chain.reason}` : ''}`).join(' | ')
}

function missingSentence(parsed = {}, firstGap = '') {
  const missing = parsed.missing_chains || []
  if (missing.length) return `Acik taraf: ${missing[0]}.`
  if (firstGap) return `Acik taraf: ${firstGap}.`
  return 'Acik taraf net degil; sonraki blokta tek bir eksige yuklenmek daha iyi olur.'
}

function riskSentence(parsed = {}, recovery = {}) {
  const risk = (parsed.risk_signals || [])[0]
  if (risk) return `Dikkat edilmesi gereken nokta: ${risk}.`
  return `Toparlanma durumu armor ${recovery.armor ?? '-'} / fatigue ${recovery.fatigue ?? '-'} / ${recovery.status || 'healthy'}.`
}

function performanceSentence(parsed = {}, firstPerf = null, context = {}) {
  if ((parsed.volume_kg || 0) > 0) {
    return `${parsed.type} ${parsed.total_sets || 0} set ve ${parsed.volume_kg || 0}kg hacimle kayda girdi.`
  }
  if ((parsed.distance_km || 0) > 0 || (parsed.duration_min || 0) > 0) {
    return `${parsed.duration_min || 0}dk${parsed.distance_km ? ` · ${parsed.distance_km}km` : ''} hareket yuku okundu.`
  }
  if (firstPerf) return `${firstPerf.name}: ${firstPerf.val} · ${firstPerf.trend}.`
  return `Stat paneli guncel: ${buildStatLine(context.stats || {})}.`
}

function claritySentence(parsed = {}) {
  const confidence = parsed.confidence || null
  if (!confidence) return 'Okuma netligi sinirli.'
  return `Okuma netligi ${confidence.level}${confidence.score != null ? ` (${confidence.score}/100)` : ''}.`
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
        claritySentence(parsed),
      ],
    },
    {
      title: 'RISK VE DENGE',
      mood: recovery.status === 'overloaded' || recovery.status === 'injured' ? 'danger' : 'warn',
      lines: [
        riskSentence(parsed, recovery),
        missingSentence(parsed, firstGap),
        firstTrend || 'Yuk trendi su an stabil.',
      ],
    },
    {
      title: 'SONRAKI ODAK',
      mood: 'calm',
      lines: [
        firstSkill ? `${firstSkill.branch}: ${firstSkill.name} · ${firstSkill.status}.` : 'Sonraki blokta tek bir eksik alani kapatan net bir odak sec.',
        firstQuest ? `En yakin hedef: ${firstQuest.name} ${firstQuest.progress}/${firstQuest.total}.` : 'Yakinda baski yaratan bir hedef yok.',
        chainSentence(parsed),
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
