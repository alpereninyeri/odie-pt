let _onClose = null

export function initModal() {
  const bg = document.getElementById('statModal')
  bg.addEventListener('click', e => {
    if (e.target === bg) closeModal()
  })
  bg.addEventListener('click', e => {
    if (e.target.closest('[data-close-modal]')) closeModal()
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

function miniBarChart(data, color) {
  if (!data || !data.length) return ''
  const max = Math.max(...data.map(d => d.val)) || 1
  const W = 220
  const H = 64
  const padX = 4
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
      <rect x="${x}" y="${y}" width="${barW}" height="${bh}" fill="${color}" opacity="${isLast ? 1 : 0.35}" rx="2"/>
      <text x="${x + barW / 2}" y="${H - 2}" text-anchor="middle" fill="var(--dim)" font-size="8" font-family="'Share Tech Mono',monospace">${d.date}</text>
      <text x="${x + barW / 2}" y="${y - 3}" text-anchor="middle" fill="${isLast ? color : 'var(--dim)'}" font-size="8" font-family="'Share Tech Mono',monospace">${d.val}</text>
    `
  }).join('')

  return `
    <div class="modal-chart">
      <div class="modal-chart-title">Ilerleme Gecmisi</div>
      <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible;display:block;margin:0 auto">${bars}</svg>
    </div>`
}

function _closeBtn() {
  return `<button class="modal-close" data-close-modal aria-label="Kapat">✕</button>`
}

export function openStatModal(stat) {
  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${stat.icon}</span>
      <div class="modal-head-title">${stat.name}</div>
      ${_closeBtn()}
    </div>
    <div class="modal-body">
      <div class="modal-stat-big" style="color:${stat.color}">
        ${stat.val}<span style="font-size:20px;color:var(--dim)">/100</span>
      </div>
      ${stat.critical ? `<div style="text-align:center;margin-bottom:8px"><span style="background:var(--red);color:#fff;font-size:9px;padding:3px 10px;font-family:'Share Tech Mono',monospace;letter-spacing:2px">KRITIK SEVIYE</span></div>` : ''}
      <div class="modal-desc">${stat.desc}</div>
      <div class="modal-coach">${stat.coach}</div>
      <div class="modal-grid">
        ${(stat.detail || []).map(d => `
          <div class="modal-item">
            <div class="modal-item-label">${d.label}</div>
            <div class="modal-item-val">${d.val}</div>
          </div>`).join('')}
      </div>
      <div class="modal-tip">Koc Notu: Bu stat ${stat.label} skorunun guncel bilesenlerini gosterir.</div>
    </div>`
  openModal(html)
}

export function openPerfModal(perf) {
  const chart = miniBarChart(perf.history, 'var(--gold)')
  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${perf.icon}</span>
      <div class="modal-head-title">${perf.name}</div>
      ${_closeBtn()}
    </div>
    <div class="modal-body">
      <div class="modal-stat-big" style="color:var(--gold);font-size:38px;padding-bottom:8px">${perf.val}</div>
      <div class="modal-desc">${perf.note}</div>
      ${chart}
      <div class="modal-grid">
        ${(perf.details || []).map(d => `
          <div class="modal-item">
            <div class="modal-item-label">${d.label}</div>
            <div class="modal-item-val">${d.val}</div>
          </div>`).join('')}
      </div>
      <div class="modal-tip">Koc Analizi: ${perf.tip}</div>
    </div>`
  openModal(html)
}

export function openEpicVolumeModal(currentKg, tiers) {
  const items = tiers.map(t => {
    const achieved = currentKg >= t.kg
    const pct = Math.min(100, Math.round((currentKg / t.kg) * 100))
    return `
      <div class="epic-tier ${achieved ? 'done' : ''}">
        <div class="epic-tier-icon">${t.icon}</div>
        <div class="epic-tier-body">
          <div class="epic-tier-head">
            <span class="epic-tier-name">${t.name}</span>
            <span class="epic-tier-kg">${t.kg.toLocaleString('tr-TR')} kg</span>
          </div>
          <div class="epic-tier-msg">${t.msg}</div>
          ${!achieved ? `<div class="epic-tier-bar"><div class="epic-tier-fill" style="width:${pct}%"></div></div>` : ''}
        </div>
        <div class="epic-tier-badge">${achieved ? '✓' : '🔒'}</div>
      </div>`
  }).join('')

  const html = `
    <div class="modal-head">
      <span style="font-size:22px">⚖️</span>
      <div class="modal-head-title">EPIC VOLUME RAIDER</div>
      ${_closeBtn()}
    </div>
    <div class="modal-body">
      <div class="epic-total">
        <div class="epic-total-val">${currentKg.toLocaleString('tr-TR')} kg</div>
        <div class="epic-total-lbl">Toplam kaldirilan hacim</div>
      </div>
      <div class="epic-tier-list">${items}</div>
    </div>`
  openModal(html)
}

export function openClassModal(cls) {
  const passive = cls.passive || {}
  const statMult = passive.statMult || {}
  const xpMult = passive.xpMult || {}

  const statItems = Object.entries(statMult)
    .map(([k, v]) => `<div class="modal-item"><div class="modal-item-label">${k.toUpperCase()}</div><div class="modal-item-val">x${v.toFixed(2)}</div></div>`)
    .join('')
  const xpItems = Object.entries(xpMult)
    .map(([k, v]) => `<div class="modal-item"><div class="modal-item-label">${k}</div><div class="modal-item-val">x${v.toFixed(2)}</div></div>`)
    .join('')

  const html = `
    <div class="modal-head">
      <span style="font-size:28px">${cls.icon}</span>
      <div class="modal-head-title">${cls.name}</div>
      ${_closeBtn()}
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:8px 0 16px">
        <div style="font-size:72px;margin-bottom:8px">${cls.icon}</div>
        <div style="font-family:'Cinzel',serif;font-size:18px;color:${cls.color};margin-bottom:4px">${cls.name}</div>
        <div style="font-size:11px;color:var(--dim);letter-spacing:.5px">${cls.subName || ''}</div>
      </div>
      <div class="modal-desc">${cls.desc}</div>
      <div class="modal-coach"><strong>Pasif:</strong> ${cls.buff}</div>
      ${statItems ? `<div style="font-size:10px;opacity:.6;margin:12px 0 6px;letter-spacing:1px">STAT CARPANI</div><div class="modal-grid">${statItems}</div>` : ''}
      ${xpItems ? `<div style="font-size:10px;opacity:.6;margin:12px 0 6px;letter-spacing:1px">XP CARPANI</div><div class="modal-grid">${xpItems}</div>` : ''}
      <div class="modal-tip">Sinif son 10 antrenmana gore dinamik degisir. Desen degistirdikce sinif da degisir.</div>
    </div>`
  openModal(html)
}

export function openAvatarModal(p) {
  const criticalStat = (p.stats || []).find(stat => stat.critical)
  const liveTip = criticalStat
    ? `${criticalStat.label} su an en zayif halka. ${p.currentFocus || 'Siradaki seansi buna gore sec.'}`
    : (p.currentFocus ? `Su an odak: ${p.currentFocus}.` : 'Hybrid denge korunuyor.')

  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${p.avatar}</span>
      <div class="modal-head-title">${p.nick}</div>
      ${_closeBtn()}
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
        <div class="modal-item"><div class="modal-item-label">Toplam Sure</div><div class="modal-item-val">${p.totalTime}</div></div>
      </div>
      <div class="modal-tip">${liveTip}</div>
    </div>`
  openModal(html)
}
