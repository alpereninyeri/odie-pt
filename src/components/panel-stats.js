import { openStatModal, openPerfModal } from './modal.js'

export function renderStats(p) {
  const statCards = (p.stats || []).map(stat => `
    <div class="stt" style="--c:${stat.color}" data-stat-key="${stat.key}">
      <div class="stt-tap">TAP ▸</div>
      <div class="stt-lbl">${stat.label}</div>
      <div class="stt-val" ${stat.critical ? 'style="color:var(--red);animation:blink 1.5s infinite"' : ''}>${String(stat.val).padStart(2, '0')}</div>
      <div class="stt-name">${stat.name}${stat.critical ? ' ⚠' : ''}</div>
      <div class="sbar"><div class="sbf" style="width:${stat.val}%;--c:${stat.color}"></div></div>
    </div>
  `).join('')

  const perfRows = (p.performance || []).map(perf => {
    const delta = derivePerformanceDelta(perf)
    return `
      <div class="prow" data-perf-key="${perf.key}">
        <div class="pico">${perf.icon}</div>
        <div class="pinfo">
          <div class="pname">${perf.name}</div>
          <div class="pnote">${perf.note}</div>
          ${delta ? `<div class="perf-mini">${delta}</div>` : ''}
        </div>
        <div class="pright">
          <div class="pval" style="color:var(--gold)">${perf.val}</div>
          <div class="ptrend" style="color:${perf.trendColor}">${perf.trend}</div>
        </div>
      </div>
    `
  }).join('')

  const debuffRows = (p.debuffs || []).map(debuff => `
    <div class="dbf" style="--dc:var(--${debuff.level})">
      <div>
        <div class="dbf-name">${debuff.icon} ${debuff.name}</div>
        <div class="dbf-desc">${debuff.desc}</div>
      </div>
    </div>
  `).join('')

  return `
    <div class="sec">Build Intelligence</div>
    ${renderBuildIntel(p)}

    <div class="sec">Ana Statlar â€” Koç Analizi</div>
    <div class="stt-grid">${statCards}</div>

    <div class="sec">Performans Metrikleri</div>
    <div class="perf-command-grid">
      ${renderPerformanceIntel(p)}
    </div>
    ${perfRows}

    <div class="sec" style="margin-top:22px">Aktif Sistem Uyarıları</div>
    ${debuffRows}`
}

function renderBuildIntel(profile) {
  const stats = [...(profile.stats || [])]
  const strongest = [...stats].sort((left, right) => right.val - left.val)[0]
  const weakest = [...stats].sort((left, right) => left.val - right.val)[0]
  const explosive = stats.find(stat => stat.key === 'agi' || stat.key === 'sta')
  const balanceGap = strongest && weakest ? strongest.val - weakest.val : 0

  return `
    <div class="progress-brief-grid">
      <article class="brief-card tone-emerald">
        <span class="brief-kicker">Dominant Stat</span>
        <strong>${strongest?.label || '--'} ${String(strongest?.val || 0).padStart(2, '0')}</strong>
        <p>${strongest?.name || 'Veri yok'} şu an build'in ana taşıyıcı kasası.</p>
      </article>
      <article class="brief-card tone-danger">
        <span class="brief-kicker">Weak Side</span>
        <strong>${weakest?.label || '--'} ${String(weakest?.val || 0).padStart(2, '0')}</strong>
        <p>${weakest?.name || 'Eksik yok'} tarafı kapanırsa zincir daha temiz bağlanacak.</p>
      </article>
      <article class="brief-card tone-neutral">
        <span class="brief-kicker">Balance Gap</span>
        <strong>${balanceGap}</strong>
        <p>${explosive?.name || 'Movement'} tarafı aktif; üst ve alt build farkı ${balanceGap} puan kadar açılmış durumda.</p>
      </article>
    </div>
  `
}

function renderPerformanceIntel(profile) {
  const strongestTrend = [...(profile.performance || [])]
    .map(perf => ({ perf, change: getHistoryChange(perf) }))
    .sort((left, right) => right.change - left.change)[0]

  const stableSkill = (profile.performance || []).find(perf => String(perf.trend || '').toLocaleLowerCase('tr-TR').includes('elite'))
  const movementSkill = (profile.performance || []).find(perf => perf.key === 'flip')

  return [
    {
      kicker: 'Top Climb',
      value: strongestTrend?.perf?.name || 'No metric',
      body: strongestTrend?.change
        ? `Son history farkı +${strongestTrend.change}. Bu kanal şimdilik en net yukarı gidiyor.`
        : 'Yeterli history verisi gelince burada en hızlı yükselen metrik gösterilir.',
      tone: 'gold',
    },
    {
      kicker: 'Anchor Skill',
      value: stableSkill?.name || 'Dead Hang',
      body: stableSkill?.note || 'Grip ve çekiş altyapısı karakterin güvenli ankrajı gibi çalışıyor.',
      tone: 'emerald',
    },
    {
      kicker: 'Movement Signal',
      value: movementSkill?.name || 'Parkour',
      body: movementSkill?.tip || 'Movement satırı parkour, akrobasi ve iniş kontrolü açısından ana risk/ödül bölgesi.',
      tone: 'neutral',
    },
  ].map(card => `
    <article class="brief-card tone-${card.tone}">
      <span class="brief-kicker">${card.kicker}</span>
      <strong>${card.value}</strong>
      <p>${card.body}</p>
    </article>
  `).join('')
}

function derivePerformanceDelta(perf) {
  const change = getHistoryChange(perf)
  if (!change) return ''
  return `Son blok farkı: +${change}`
}

function getHistoryChange(perf) {
  if (!Array.isArray(perf?.history) || perf.history.length < 2) return 0
  const last = Number(perf.history[perf.history.length - 1]?.val) || 0
  const prev = Number(perf.history[perf.history.length - 2]?.val) || 0
  return Math.max(0, Math.round((last - prev) * 10) / 10)
}

export function initStats(p) {
  const panel = document.getElementById('panel-stats')
  if (!panel) return

  panel.removeEventListener('click', panel._statsHandler)
  panel._statsHandler = event => {
    const statEl = event.target.closest('[data-stat-key]')
    if (statEl) {
      const stat = p.stats.find(item => item.key === statEl.dataset.statKey)
      if (stat) openStatModal(stat)
      return
    }

    const perfEl = event.target.closest('[data-perf-key]')
    if (perfEl) {
      const perf = p.performance.find(item => item.key === perfEl.dataset.perfKey)
      if (perf) openPerfModal(perf)
    }
  }

  panel.addEventListener('click', panel._statsHandler)
}
