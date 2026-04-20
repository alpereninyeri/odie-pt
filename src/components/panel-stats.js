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

function polarPoint(index, total, radius, centerX, centerY) {
  const angle = ((Math.PI * 2) / total) * index - Math.PI / 2
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  }
}

function renderStatHex(stats = []) {
  const size = 236
  const center = size / 2
  const outer = 86
  const inner = 58
  const polygon = stats.map((stat, index) => {
    const point = polarPoint(index, stats.length, Math.max(24, (outer * (Number(stat.val) || 0)) / 100), center, center)
    return `${point.x},${point.y}`
  }).join(' ')

  const rings = [1, 0.75, 0.5, 0.25]
    .map(scale => {
      const points = stats.map((_, index) => {
        const point = polarPoint(index, stats.length, outer * scale, center, center)
        return `${point.x},${point.y}`
      }).join(' ')
      return `<polygon points="${points}" class="stat-radar-ring" />`
    }).join('')

  const spokes = stats.map((_, index) => {
    const point = polarPoint(index, stats.length, outer, center, center)
    return `<line x1="${center}" y1="${center}" x2="${point.x}" y2="${point.y}" class="stat-radar-spoke" />`
  }).join('')

  const labels = stats.map((stat, index) => {
    const point = polarPoint(index, stats.length, outer + 22, center, center)
    return `
      <g class="stat-radar-label ${stat.critical ? 'critical' : ''}">
        <circle cx="${point.x}" cy="${point.y}" r="17" />
        <text x="${point.x}" y="${point.y + 4}" text-anchor="middle">${stat.label}</text>
      </g>
    `
  }).join('')

  const nodes = stats.map((stat, index) => {
    const point = polarPoint(index, stats.length, Math.max(24, (outer * (Number(stat.val) || 0)) / 100), center, center)
    return `<circle cx="${point.x}" cy="${point.y}" r="${stat.critical ? 6 : 5}" class="stat-radar-node ${stat.critical ? 'critical' : ''}" />`
  }).join('')

  const critical = stats.find(stat => stat.critical)

  return `
    <div class="stat-hex-shell">
      <div class="stat-radar-frame">
        <svg viewBox="0 0 ${size} ${size}" class="stat-radar-svg" aria-hidden="true">
          ${rings}
          ${spokes}
          <polygon points="${polygon}" class="stat-radar-shape" />
          ${nodes}
          ${labels}
        </svg>
        <div class="stat-radar-core">
          <span class="mini-label">Stat Radar</span>
          <strong>${critical ? critical.label : 'SYNC'}</strong>
          <small>${critical ? 'focus needed' : 'balance stable'}</small>
        </div>
      </div>
    </div>
  `
}

function renderStatCard(stat) {
  return `
    <button class="stat-codex-card ${stat.critical ? 'critical' : ''}" style="--stat-color:${stat.color}" data-stat-key="${stat.key}" aria-label="${stat.name} detayini ac">
      <div class="stat-codex-top">
        <span class="stat-codex-icon">${stat.icon}</span>
        <span class="stat-codex-key">${stat.label}</span>
        <strong>${String(stat.val).padStart(2, '0')}</strong>
      </div>
      <div class="stat-codex-name">${stat.name}</div>
      <div class="grade-row">
        ${(stat.detail || []).slice(0, 4).map(item => `<span class="grade-pill ${gradeClass(item.val)}">${item.val}</span>`).join('')}
      </div>
    </button>
  `
}

function renderSparkline(history = []) {
  if (!Array.isArray(history) || !history.length) return '<div class="forge-empty">history yok</div>'
  const width = 180
  const height = 52
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
  const nextTarget = perf.details?.find(detail => /sonraki|hedef/i.test(detail.label || ''))?.val || 'locked'
  return `
    <button class="forge-card" data-perf-key="${perf.key}" aria-label="${perf.name} detayini ac">
      <div class="forge-card-head">
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
        <span class="mini-label">Next Target</span>
        <strong>${nextTarget}</strong>
      </div>
    </button>
  `
}

function renderChainSeals(semantic = {}) {
  const chains = [
    { label: 'Upper', value: semantic.chains?.upperStrength || 0, hint: 'push + pull' },
    { label: 'Lower', value: semantic.chains?.lowerPower || 0, hint: 'legs + explosive' },
    { label: 'Trunk', value: semantic.chains?.trunkControl || 0, hint: 'core + carry' },
    { label: 'Aerial', value: semantic.chains?.aerialControl || 0, hint: 'acro + balance' },
    { label: 'Grip', value: semantic.chains?.gripControl || 0, hint: 'hang + climb' },
    { label: 'Mobility', value: semantic.chains?.mobilityBase || 0, hint: 'range + recovery' },
  ]

  return `
    <div class="chain-seal-grid">
      ${chains.map(chain => `
        <div class="chain-seal-card seal-${chain.value <= 1 ? 'low' : chain.value <= 2 ? 'mid' : 'high'}">
          <div class="chain-seal-emblem">${chain.value <= 1 ? 'BROKEN' : chain.value >= 3 ? 'SEALED' : 'THIN'}</div>
          <strong>${chain.label}</strong>
          <span>${chain.value}</span>
          <small>${chain.hint}</small>
        </div>
      `).join('')}
    </div>
  `
}

function renderWeakNotices(debuffs = []) {
  const items = debuffs.length
    ? debuffs
    : [{ icon: '·', name: 'Zayif halka yok', desc: 'Aktif kritik uyarı yok. Sonraki ilerlemeyi quest ve build track belirliyor.' }]

  return `
    <div class="weak-notice-list">
      ${items.map(item => `
        <div class="weak-notice-card">
          <span>${item.icon}</span>
          <div>
            <strong>${item.name}</strong>
            <p>${item.desc}</p>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

function renderFeatVault(achievements = []) {
  return `
    <div class="feat-vault-grid">
      ${(achievements || []).map(item => `
        <div class="feat-card ${item.unlocked ? 'unlocked' : 'locked'}">
          <div class="feat-icon">${item.icon}</div>
          <strong>${item.name}</strong>
          <p>${item.desc}</p>
          <small>${item.unlocked ? item.date : item.req}</small>
        </div>
      `).join('')}
    </div>
  `
}

export function renderStats(profile, semantic = {}) {
  return `
    <div class="sec">Stat Radar</div>
    <div class="stats-codex-shell">
      ${renderStatHex(profile.stats || [])}
      <div class="stat-codex-grid">
        ${(profile.stats || []).map(renderStatCard).join('')}
      </div>
    </div>

    <div class="sec">Performance</div>
    <div class="forge-grid">
      ${(profile.performance || []).map(renderForgeCard).join('')}
    </div>

    <div class="sec">Chain Balance</div>
    ${renderChainSeals(semantic)}

    <div class="sec">Weak Links</div>
    ${renderWeakNotices(profile.debuffs || [])}

    <div class="sec">Achievements</div>
    ${renderFeatVault(profile.achievements || [])}
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
