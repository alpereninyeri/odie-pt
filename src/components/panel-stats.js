import { openPerfModal, openStatModal } from './modal.js'

function gradeClass(value = '') {
  const raw = String(value || '').toUpperCase()
  if (raw.startsWith('A')) return 'grade-elite'
  if (raw.startsWith('B')) return 'grade-rare'
  if (raw.startsWith('C')) return 'grade-steady'
  if (raw.startsWith('D')) return 'grade-low'
  if (raw.startsWith('F')) return 'grade-crit'
  return 'grade-neutral'
}

function statStatus(stat) {
  if (stat.critical) return 'FOCUS'
  if ((Number(stat.val) || 0) >= 80) return 'STRONG'
  if ((Number(stat.val) || 0) >= 60) return 'STABLE'
  return 'BUILD'
}

function renderStatCard(stat) {
  return `
    <button class="stat-card-v6 ${stat.critical ? 'critical' : ''}" data-stat-key="${stat.key}" aria-label="${stat.name} detayini ac">
      <div class="stat-card-v6-top">
        <span class="stat-card-v6-icon">${stat.icon}</span>
        <span class="stat-card-v6-key">${stat.label}</span>
        <strong>${Math.round(Number(stat.val) || 0)}</strong>
      </div>
      <div class="stat-card-v6-name">${stat.name}</div>
      <div class="stat-card-v6-meta">
        <span class="stat-card-v6-status">${statStatus(stat)}</span>
        ${(stat.detail || []).slice(0, 2).map(item => `<span class="grade-pill ${gradeClass(item.val)}">${item.val}</span>`).join('')}
      </div>
    </button>
  `
}

function renderSparkline(history = []) {
  if (!Array.isArray(history) || !history.length) return '<div class="forge-empty">history yok</div>'
  const width = 180
  const height = 48
  const max = Math.max(...history.map(item => Number(item.val) || 0), 1)
  const min = Math.min(...history.map(item => Number(item.val) || 0), 0)
  const span = Math.max(1, max - min)
  const step = history.length > 1 ? width / (history.length - 1) : width / 2
  const points = history.map((item, index) => {
    const x = Math.round(index * step)
    const y = Math.round(height - (((Number(item.val) || 0) - min) / span) * (height - 8) - 4)
    return `${x},${y}`
  }).join(' ')

  return `
    <svg viewBox="0 0 ${width} ${height}" class="forge-sparkline" aria-hidden="true">
      <polyline points="${points}" class="forge-sparkline-line" />
      ${history.map((item, index) => {
        const x = Math.round(index * step)
        const y = Math.round(height - (((Number(item.val) || 0) - min) / span) * (height - 8) - 4)
        return `<circle cx="${x}" cy="${y}" r="${index === history.length - 1 ? 3.5 : 2.5}" class="forge-sparkline-dot ${index === history.length - 1 ? 'latest' : ''}" />`
      }).join('')}
    </svg>
  `
}

function renderForgeCard(perf) {
  const nextTarget = perf.details?.find(detail => /sonraki|hedef|next/i.test(detail.label || ''))?.val || 'locked'
  return `
    <button class="forge-card" data-perf-key="${perf.key}" aria-label="${perf.name} detayini ac">
      <div class="forge-head">
        <div>
          <span class="forge-icon">${perf.icon}</span>
          <strong>${perf.name}</strong>
        </div>
        <span class="forge-trend" style="color:${perf.trendColor || 'var(--gold)'}">${perf.trend}</span>
      </div>
      <div class="forge-card-value">${perf.val}</div>
      <p>${perf.note}</p>
      ${renderSparkline(perf.history)}
      <div class="forge-card-foot">
        <span class="mini-label">Next</span>
        <strong>${nextTarget}</strong>
      </div>
    </button>
  `
}

function renderPerfCompact(perf) {
  return `
    <button class="perf-compact-card" data-perf-key="${perf.key}" aria-label="${perf.name} detayini ac">
      <div class="perf-compact-top">
        <span>${perf.icon}</span>
        <strong>${perf.name}</strong>
      </div>
      <div class="perf-compact-value">${perf.val}</div>
      <small>${perf.trend}</small>
    </button>
  `
}

function renderChainBalance(semantic = {}) {
  const chains = [
    { label: 'Upper', value: semantic.chains?.upperStrength || 0, hint: 'push + pull' },
    { label: 'Lower', value: semantic.chains?.lowerPower || 0, hint: 'legs + explosive' },
    { label: 'Trunk', value: semantic.chains?.trunkControl || 0, hint: 'core + carry' },
    { label: 'Aerial', value: semantic.chains?.aerialControl || 0, hint: 'acro + balance' },
    { label: 'Grip', value: semantic.chains?.gripControl || 0, hint: 'hang + climb' },
    { label: 'Mobility', value: semantic.chains?.mobilityBase || 0, hint: 'range + recovery' },
  ]

  return `
    <div class="chain-balance-grid">
      ${chains.map(chain => `
        <div class="chain-balance-card tone-${chain.value <= 1 ? 'low' : chain.value >= 3 ? 'high' : 'mid'}">
          <strong>${chain.label}</strong>
          <span>${chain.value}</span>
          <small>${chain.hint}</small>
        </div>
      `).join('')}
    </div>
  `
}

function renderAchievements(achievements = []) {
  const visible = achievements.filter(item => item.unlocked).slice(0, 4)
  const lockedCount = Math.max(0, achievements.length - visible.length)
  return `
    <div class="achievement-grid-v6">
      ${visible.map(item => `
        <div class="achievement-card-v6 ${item.unlocked ? 'unlocked' : 'locked'}">
          <div class="achievement-card-v6-icon">${item.icon}</div>
          <strong>${item.name}</strong>
          <p>${item.desc}</p>
          <small>${item.unlocked ? item.date : item.req}</small>
        </div>
      `).join('')}
      ${lockedCount ? `<div class="achievement-card-v6 locked achievement-more-card"><strong>+${lockedCount}</strong><p>Daha fazla achievement Stats detayinda bekliyor.</p></div>` : ''}
    </div>
  `
}

export function renderStats(profile, semantic = {}) {
  return `
    <div class="sec">Character Stats</div>
    <div class="stat-grid-v6">
      ${(profile.stats || []).map(renderStatCard).join('')}
    </div>

    <div class="sec">Performance</div>
    <div class="perf-compact-grid">
      ${(profile.performance || []).slice(0, 4).map(renderPerfCompact).join('')}
    </div>

    <div class="stats-lower-grid">
      <div>
        <div class="sec">Chain Balance</div>
        ${renderChainBalance(semantic)}
      </div>
      <div>
        <div class="sec">Achievements</div>
        ${renderAchievements(profile.achievements || [])}
      </div>
    </div>
  `
}

export function initStats(profile) {
  const panel = document.getElementById('panel-stats')
  if (!panel) return
  panel.removeEventListener('click', panel._statsHandler)
  panel._statsHandler = event => {
    const statEl = event.target.closest('[data-stat-key]')
    if (statEl) {
      const stat = profile.stats.find(item => item.key === statEl.dataset.statKey)
      if (stat) openStatModal(stat)
      return
    }
    const perfEl = event.target.closest('[data-perf-key]')
    if (perfEl) {
      const perf = profile.performance.find(item => item.key === perfEl.dataset.perfKey)
      if (perf) openPerfModal(perf)
    }
  }
  panel.addEventListener('click', panel._statsHandler)
}
