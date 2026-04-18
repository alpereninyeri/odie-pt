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

  const telegramParts = [
    `${parsed.type} seansi ${parsed.duration_min || 0}dk olarak kayda girdi.`,
    strongest ? `En guclu kolon ${strongest.key?.toUpperCase()} ${strongest.val};` : null,
    weakest ? `zayif halka ${weakest.key?.toUpperCase()} ${weakest.val}.` : null,
    firstTrend ? firstTrend + '.' : null,
  ].filter(Boolean)

  const sections = [
    {
      title: 'SEANS ANALIZI',
      mood: parsed.has_pr ? 'fire' : 'calm',
      lines: [
        `${parsed.type} seansi ${parsed.duration_min || 0}dk · ${parsed.total_sets || 0} set · ${parsed.volume_kg || 0}kg hacim.`,
        parsed.highlight ? `Ana sinyal: ${parsed.highlight}.` : 'Ana sinyal: Seans kaydi temiz alindi.',
      ],
    },
    {
      title: 'PERFORMANS METRIKLERI',
      mood: firstPerf?.trend?.includes('+') || parsed.has_pr ? 'fire' : 'calm',
      lines: [
        firstPerf ? `${firstPerf.name}: ${firstPerf.val} · ${firstPerf.trend}.` : `Stat paneli guncel: ${buildStatLine(context.stats || {})}.`,
        firstTrend || 'Son blokta yuk dagilimi stabil gidiyor.',
      ],
    },
    {
      title: 'KOC BAKISI',
      mood: 'calm',
      lines: [
        weakest ? `${weakest.key?.toUpperCase()} hattini desteklersen build daha dengeli acilir.` : 'Build dengesi korunuyor.',
        strongest ? `${strongest.key?.toUpperCase()} su an ana avantaj kolonu.` : 'Ana avantaj kolonu yeni datayla netlesecek.',
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
        firstSkill ? `${firstSkill.branch}: ${firstSkill.name} · ${firstSkill.status}.` : 'Skill hatti icin yeni sinyal geldi; bir sonraki seans kilit acabilir.',
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
