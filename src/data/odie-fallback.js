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

function summarizeBlockKinds(blocks = []) {
  const labels = {
    strength: 'strength',
    locomotion: 'locomotion',
    skill: 'skill',
    explosive: 'explosive',
    core: 'core',
    mobility: 'mobility',
    recovery: 'recovery',
  }

  return [...new Set((blocks || []).map(block => labels[block.kind] || block.kind))].slice(0, 4)
}

function pickEvidenceLines(parsed = {}, limit = 3) {
  return (parsed.evidence || []).slice(0, limit)
}

function focusSentence(parsed = {}) {
  const kinds = summarizeBlockKinds(parsed.blocks)
  if (!kinds.length) return 'Seans sinyali yapisal olarak alindi.'
  return `Okunan ana bloklar: ${kinds.join(' · ')}.`
}

function performanceSentence(parsed = {}, firstPerf = null, context = {}) {
  if ((parsed.volume_kg || 0) > 0) {
    return `${parsed.type} yuku ${parsed.volume_kg || 0}kg hacim ve ${parsed.total_sets || 0} set ile kayda girdi.`
  }
  if ((parsed.distance_km || 0) > 0 || (parsed.duration_min || 0) > 0) {
    return `Bu seans ${parsed.duration_min || 0}dk${parsed.distance_km ? ` · ${parsed.distance_km}km` : ''} uzerinden daha cok hareket yuku sinyali veriyor.`
  }
  if (firstPerf) return `${firstPerf.name}: ${firstPerf.val} · ${firstPerf.trend}.`
  return `Stat paneli guncel: ${buildStatLine(context.stats || {})}.`
}

function coachingSentence(parsed = {}, firstGap = '', weakest = null, strongest = null) {
  const kinds = summarizeBlockKinds(parsed.blocks)
  if (kinds.includes('skill') || kinds.includes('explosive')) {
    return 'Bugun kuvvet hacminden cok teknik, ritim ve landing kontrol hatti on plandaydi.'
  }
  if (kinds.includes('locomotion') && !kinds.includes('strength')) {
    return 'Lokomotion ve kondisyon hatti baskin; dogrudan kuvvet hacmi ikincil kaldi.'
  }
  if (firstGap) return `${firstGap}.`
  if (weakest && strongest) return `${strongest.key?.toUpperCase()} avantaj, ${weakest.key?.toUpperCase()} ise takip edilmesi gereken hat.`
  return 'Build dengesi korunuyor; bir sonraki blokta net bir eksen secmek faydali olur.'
}

export function buildFallbackCoachResponse(parsed, context = {}) {
  const odie = context.odie || {}
  const recovery = odie.recovery || {}
  const loadProfile = odie.loadProfile || {}
  const weakest = odie.stats?.weakest
  const strongest = odie.stats?.strongest
  const firstTrend = loadProfile.trendSignals?.[0]
  const firstGap = odie.focusGaps?.[0]
  const firstQuest = odie.questPressure?.[0]
  const firstSkill = odie.skillPressure?.[0]
  const firstPerf = odie.performance?.[0]
  const warningLine = recovery.warnings?.[0] || firstGap || 'Risk sinyali dusuk; ayni kalitede devam et.'
  const evidenceLines = pickEvidenceLines(parsed)
  const evidenceSummary = evidenceLines.length
    ? `Kanit: ${evidenceLines.join(' | ')}.`
    : 'Kanit satiri sinirli; yorum mevcut blok sinyalleri uzerinden kuruldu.'
  const blockFocus = focusSentence(parsed)

  const telegramParts = [
    `${parsed.type} seansi ${parsed.duration_min || 0}dk${parsed.distance_km ? ` + ${parsed.distance_km}km` : ''} olarak kayda girdi.`,
    blockFocus,
    evidenceLines[0] ? `Ana kanit: ${evidenceLines[0]}.` : null,
    firstTrend ? `${firstTrend}.` : null,
  ].filter(Boolean)

  const sections = [
    {
      title: 'SEANS ANALIZI',
      mood: parsed.has_pr ? 'fire' : 'calm',
      lines: [
        `${parsed.type} seansi ${parsed.duration_min || 0}dk${parsed.distance_km ? ` · ${parsed.distance_km}km` : ''}.`,
        blockFocus,
        evidenceSummary,
      ],
    },
    {
      title: 'PERFORMANS METRIKLERI',
      mood: firstPerf?.trend?.includes('+') || parsed.has_pr ? 'fire' : 'calm',
      lines: [
        performanceSentence(parsed, firstPerf, context),
        firstTrend || 'Son blokta yuk dagilimi stabil gidiyor.',
      ],
    },
    {
      title: 'KOC BAKISI',
      mood: 'calm',
      lines: [
        coachingSentence(parsed, firstGap, weakest, strongest),
        parsed.highlight ? `Seans highlight'i: ${parsed.highlight}.` : (strongest ? `${strongest.key?.toUpperCase()} su an ana avantaj kolonu.` : 'Ana avantaj kolonu yeni datayla netlesecek.'),
      ],
    },
    {
      title: 'UYARILAR',
      mood: recovery.status === 'overloaded' || recovery.status === 'injured' ? 'danger' : 'warn',
      lines: [
        `Recovery: armor ${recovery.armor ?? '-'} / fatigue ${recovery.fatigue ?? '-'} / ${recovery.status || 'healthy'}.`,
        warningLine,
      ],
    },
    {
      title: 'SKILL VE HEDEF',
      mood: 'fire',
      lines: [
        firstSkill ? `${firstSkill.branch}: ${firstSkill.name} · ${firstSkill.status}.` : `${summarizeBlockKinds(parsed.blocks).join(' · ') || 'Skill'} hatti icin yeni sinyal geldi.`,
        firstQuest ? `En yakin quest: ${firstQuest.name} ${firstQuest.progress}/${firstQuest.total}.` : 'Quest board aktif ama baski dusuk.',
      ],
    },
    {
      title: 'SONRAKI ADIM',
      mood: 'calm',
      lines: [
        firstGap ? `${firstGap}. Sonraki blokta bunu kapat.` : 'Sonraki blokta ayni hattin uzerine net bir progression koy.',
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
