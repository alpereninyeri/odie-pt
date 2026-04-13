let _onClose = null

export function initModal() {
  document.getElementById('statModal').addEventListener('click', e => {
    if (e.target === document.getElementById('statModal')) closeModal()
  })
}

export function closeModal() {
  document.getElementById('statModal').classList.remove('open')
  _onClose = null
}

export function openModal(html) {
  document.getElementById('modalContent').innerHTML = html
  document.getElementById('statModal').classList.add('open')
}

// Mini SVG bar chart for performance history
function miniBarChart(data, color) {
  if (!data || !data.length) return ''
  const max = Math.max(...data.map(d => d.val)) || 1
  const W = 220, H = 64, padX = 4
  const count = data.length
  const barW = Math.floor((W - padX * (count - 1)) / count)
  const labelH = 14
  const chartH = H - labelH

  const bars = data.map((d, i) => {
    const bh = Math.max(4, Math.round((d.val / max) * (chartH - 18)))
    const x = i * (barW + padX)
    const y = chartH - bh - 14
    const isLast = i === count - 1
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${bh}"
        fill="${color}" opacity="${isLast ? 1 : 0.35}" rx="2"/>
      <text x="${x + barW / 2}" y="${H - 2}" text-anchor="middle"
        fill="var(--dim)" font-size="8" font-family="'Share Tech Mono',monospace">${d.date}</text>
      <text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle"
        fill="${isLast ? color : 'var(--dim)'}" font-size="8"
        font-family="'Share Tech Mono',monospace">${d.val}</text>
    `
  }).join('')

  return `
    <div class="modal-chart">
      <div class="modal-chart-title">İlerleme Geçmişi</div>
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"
        style="overflow:visible;display:block;margin:0 auto">${bars}</svg>
    </div>`
}

export function openStatModal(stat) {
  const pct = Math.min(100, stat.val)
  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${stat.icon}</span>
      <div class="modal-head-title">${stat.name}</div>
      <button class="modal-close" onclick="window.__closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-stat-big" style="color:${stat.color}">
        ${stat.val}<span style="font-size:20px;color:var(--dim)">/100</span>
      </div>
      ${stat.critical ? `<div style="text-align:center;margin-bottom:8px"><span style="background:var(--red);color:#fff;font-size:9px;padding:3px 10px;font-family:'Share Tech Mono',monospace;letter-spacing:2px">⚠ KRİTİK SEVİYE</span></div>` : ''}
      <div class="modal-desc">${stat.desc}</div>
      <div class="modal-coach">${stat.coach}</div>
      <div class="modal-grid">
        ${stat.detail.map(d => `
          <div class="modal-item">
            <div class="modal-item-label">${d.label}</div>
            <div class="modal-item-val">${d.val}</div>
          </div>`).join('')}
      </div>
      <div class="modal-tip">Koç Notu: Bu stat ${stat.label} skorunun temel bileşenleridir.</div>
    </div>`
  openModal(html)
}

export function openPerfModal(perf) {
  const chart = miniBarChart(perf.history, 'var(--gold)')
  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${perf.icon}</span>
      <div class="modal-head-title">${perf.name}</div>
      <button class="modal-close" onclick="window.__closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div class="modal-stat-big" style="color:var(--gold);font-size:38px;padding-bottom:8px">${perf.val}</div>
      <div class="modal-desc">${perf.note}</div>
      ${chart}
      <div class="modal-grid">
        ${perf.details.map(d => `
          <div class="modal-item">
            <div class="modal-item-label">${d.label}</div>
            <div class="modal-item-val">${d.val}</div>
          </div>`).join('')}
      </div>
      <div class="modal-tip">Koç Analizi: ${perf.tip}</div>
    </div>`
  openModal(html)
}

export function openAvatarModal(p) {
  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${p.avatar}</span>
      <div class="modal-head-title">${p.nick}</div>
      <button class="modal-close" onclick="window.__closeModal()">✕</button>
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:16px 0 12px">
        <div style="font-size:72px;margin-bottom:8px">${p.avatar}</div>
        <div style="font-family:'Cinzel',serif;font-size:18px;color:var(--gold);margin-bottom:4px">${p.class}</div>
        <div style="font-size:12px;color:var(--dim)">${p.subClass} · ${p.rank}</div>
      </div>
      <div class="modal-grid">
        <div class="modal-item"><div class="modal-item-label">Toplam Seans</div><div class="modal-item-val">${p.sessions}</div></div>
        <div class="modal-item"><div class="modal-item-label">Toplam Hacim</div><div class="modal-item-val">${p.totalVolume}</div></div>
        <div class="modal-item"><div class="modal-item-label">Toplam Set</div><div class="modal-item-val">${p.totalSets}</div></div>
        <div class="modal-item"><div class="modal-item-label">Toplam Süre</div><div class="modal-item-val">${p.totalTime}</div></div>
      </div>
      <div class="modal-tip">Core (karın/bel) bölgen alarm veriyor. Bugün antrenmanına ekle.</div>
    </div>`
  openModal(html)
}
