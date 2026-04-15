import { openStatModal, openPerfModal } from './modal.js'

export function renderStats(p) {
  const statCards = p.stats.map(s => `
    <div class="stt" style="--c:${s.color}" data-stat-key="${s.key}">
      <div class="stt-tap">TAP ▸</div>
      <div class="stt-lbl">${s.label}</div>
      <div class="stt-val" ${s.critical ? 'style="color:var(--red);animation:blink 1.5s infinite"' : ''}>${String(s.val).padStart(2, '0')}</div>
      <div class="stt-name">${s.name}${s.critical ? ' ⚠️' : ''}</div>
      <div class="sbar"><div class="sbf" style="width:${s.val}%;--c:${s.color}"></div></div>
    </div>`).join('')

  const perfRows = p.performance.map(perf => `
    <div class="prow" data-perf-key="${perf.key}">
      <div class="pico">${perf.icon}</div>
      <div class="pinfo">
        <div class="pname">${perf.name}</div>
        <div class="pnote">${perf.note}</div>
      </div>
      <div class="pright">
        <div class="pval" style="color:var(--gold)">${perf.val}</div>
        <div class="ptrend" style="color:${perf.trendColor}">${perf.trend}</div>
      </div>
    </div>`).join('')

  const debuffRows = p.debuffs.map(d => `
    <div class="dbf" style="--dc:var(--${d.level})">
      <div>
        <div class="dbf-name">${d.icon} ${d.name}</div>
        <div class="dbf-desc">${d.desc}</div>
      </div>
    </div>`).join('')

  return `
    <div class="sec">Ana Statlar — Koç Analizi</div>
    <div class="stt-grid">${statCards}</div>

    <div class="sec">Performans Metrikleri</div>
    ${perfRows}

    <div class="sec" style="margin-top:22px">Aktif Sistem Uyarıları</div>
    ${debuffRows}`
}

export function initStats(p) {
  const panel = document.getElementById('panel-stats')
  if (!panel) return
  // Her render'da temiz listener: önce eski handler'ı kaldır, yenisini ekle
  panel.removeEventListener('click', panel._statsHandler)
  panel._statsHandler = e => {
    const statEl = e.target.closest('[data-stat-key]')
    if (statEl) {
      const stat = p.stats.find(s => s.key === statEl.dataset.statKey)
      if (stat) openStatModal(stat)
      return
    }
    const perfEl = e.target.closest('[data-perf-key]')
    if (perfEl) {
      const perf = p.performance.find(pr => pr.key === perfEl.dataset.perfKey)
      if (perf) openPerfModal(perf)
    }
  }
  panel.addEventListener('click', panel._statsHandler)
}
