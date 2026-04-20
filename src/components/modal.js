let _onClose = null

export function initModal() {
  const bg = document.getElementById('statModal')
  bg.addEventListener('click', event => {
    if (event.target === bg) closeModal()
  })
  bg.addEventListener('click', event => {
    if (event.target.closest('[data-close-modal]')) closeModal()
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
  const max = Math.max(...data.map(point => point.val)) || 1
  const width = 220
  const height = 64
  const padX = 4
  const count = data.length
  const barWidth = Math.floor((width - padX * (count - 1)) / count)
  const labelHeight = 14
  const chartHeight = height - labelHeight

  const bars = data.map((point, index) => {
    const barHeight = Math.max(4, Math.round((point.val / max) * (chartHeight - 18)))
    const x = index * (barWidth + padX)
    const y = chartHeight - barHeight - 14
    const isLast = index === count - 1
    return `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" opacity="${isLast ? 1 : 0.35}" rx="2"/>
      <text x="${x + barWidth / 2}" y="${height - 2}" text-anchor="middle" fill="var(--dim)" font-size="8" font-family="'JetBrains Mono', monospace">${point.date}</text>
      <text x="${x + barWidth / 2}" y="${y - 3}" text-anchor="middle" fill="${isLast ? color : 'var(--dim)'}" font-size="8" font-family="'JetBrains Mono', monospace">${point.val}</text>
    `
  }).join('')

  return `
    <div class="modal-chart">
      <div class="modal-chart-title">Trend Kaydi</div>
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible;display:block;margin:0 auto">${bars}</svg>
    </div>
  `
}

function closeButton() {
  return '<button class="modal-close" data-close-modal aria-label="Kapat">x</button>'
}

function gradePillClass(value = '') {
  const raw = String(value || '').toUpperCase()
  if (raw.startsWith('A')) return 'grade-elite'
  if (raw.startsWith('B')) return 'grade-rare'
  if (raw.startsWith('C')) return 'grade-steady'
  if (raw.startsWith('D')) return 'grade-low'
  if (raw.startsWith('F')) return 'grade-crit'
  return 'grade-neutral'
}

export function openStatModal(stat) {
  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${stat.icon}</span>
      <div class="modal-head-title">${stat.name} Codex</div>
      ${closeButton()}
    </div>
    <div class="modal-body">
      <div class="modal-stat-big" style="color:${stat.color}">
        ${stat.val}<span style="font-size:20px;color:var(--dim)">/100</span>
      </div>
      ${stat.critical ? '<div style="text-align:center;margin-bottom:8px"><span class="grade-pill grade-crit">CRITICAL</span></div>' : ''}
      <div class="modal-desc">${stat.desc}</div>
      <div class="modal-coach">${stat.coach}</div>
      <div class="modal-grid">
        ${(stat.detail || []).map(detail => `
          <div class="modal-item">
            <div class="modal-item-label">${detail.label}</div>
            <div class="modal-item-val"><span class="grade-pill ${gradePillClass(detail.val)}">${detail.val}</span></div>
          </div>
        `).join('')}
      </div>
      <div class="modal-tip">Field note: Bu stat ${stat.label} skorunun guncel bilesenlerini gosterir.</div>
    </div>`
  openModal(html)
}

export function openPerfModal(perf) {
  const chart = miniBarChart(perf.history, 'var(--gold)')
  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${perf.icon}</span>
      <div class="modal-head-title">${perf.name} Forge</div>
      ${closeButton()}
    </div>
    <div class="modal-body">
      <div class="modal-stat-big" style="color:var(--gold);font-size:38px;padding-bottom:8px">${perf.val}</div>
      <div class="modal-desc">${perf.note}</div>
      ${chart}
      <div class="modal-grid">
        ${(perf.details || []).map(detail => `
          <div class="modal-item">
            <div class="modal-item-label">${detail.label}</div>
            <div class="modal-item-val">${detail.val}</div>
          </div>
        `).join('')}
      </div>
      <div class="modal-tip">Forge note: ${perf.tip}</div>
    </div>`
  openModal(html)
}

export function openEpicVolumeModal(currentKg, tiers) {
  const items = tiers.map(tier => {
    const achieved = currentKg >= tier.kg
    const pct = Math.min(100, Math.round((currentKg / tier.kg) * 100))
    return `
      <div class="epic-tier ${achieved ? 'done' : ''}">
        <div class="epic-tier-icon">${tier.icon}</div>
        <div class="epic-tier-body">
          <div class="epic-tier-head">
            <span class="epic-tier-name">${tier.name}</span>
            <span class="epic-tier-kg">${tier.kg.toLocaleString('tr-TR')} kg</span>
          </div>
          <div class="epic-tier-msg">${tier.msg}</div>
          ${!achieved ? `<div class="epic-tier-bar"><div class="epic-tier-fill" style="width:${pct}%"></div></div>` : ''}
        </div>
        <div class="epic-tier-badge">${achieved ? 'OK' : 'LOCK'}</div>
      </div>`
  }).join('')

  const html = `
    <div class="modal-head">
      <span style="font-size:22px">VOL</span>
      <div class="modal-head-title">Epic Volume Ledger</div>
      ${closeButton()}
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
  const signals = Array.isArray(cls.signals) ? cls.signals.slice(0, 3) : []

  const statItems = Object.entries(statMult)
    .map(([key, value]) => `<div class="modal-item"><div class="modal-item-label">${key.toUpperCase()}</div><div class="modal-item-val">x${value.toFixed(2)}</div></div>`)
    .join('')
  const xpItems = Object.entries(xpMult)
    .map(([key, value]) => `<div class="modal-item"><div class="modal-item-label">${key}</div><div class="modal-item-val">x${value.toFixed(2)}</div></div>`)
    .join('')

  const html = `
    <div class="modal-head">
      <span style="font-size:28px">${cls.icon}</span>
      <div class="modal-head-title">${cls.name}</div>
      ${closeButton()}
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:8px 0 16px">
        <div style="font-size:72px;margin-bottom:8px">${cls.icon}</div>
        <div style="font-family:'Cinzel',serif;font-size:18px;color:${cls.color};margin-bottom:4px">${cls.name}</div>
        <div style="font-size:11px;color:var(--dim);letter-spacing:.5px">${cls.subName || ''}</div>
      </div>
      <div class="modal-desc">${cls.desc}</div>
      <div class="modal-coach"><strong>Buff:</strong> ${cls.buff}</div>
      ${cls.reason ? `<div class="modal-coach"><strong>Neden bu yol:</strong> ${cls.reason}</div>` : ''}
      ${signals.length ? `<div style="font-size:10px;opacity:.7;margin:12px 0 6px;letter-spacing:1px">CLASS SIGNALS</div><div class="modal-grid">${signals.map(signal => `<div class="modal-item"><div class="modal-item-label">Signal</div><div class="modal-item-val">${signal}</div></div>`).join('')}</div>` : ''}
      ${statItems ? `<div style="font-size:10px;opacity:.7;margin:12px 0 6px;letter-spacing:1px">STAT CARPANI</div><div class="modal-grid">${statItems}</div>` : ''}
      ${xpItems ? `<div style="font-size:10px;opacity:.7;margin:12px 0 6px;letter-spacing:1px">XP CARPANI</div><div class="modal-grid">${xpItems}</div>` : ''}
      <div class="modal-tip">Sinif son 10 antrenman desenine gore dinamik degisir.</div>
    </div>`
  openModal(html)
}

export function openArchetypeModal({ classObj, profile, semantic, criticalStat }) {
  const signals = Array.isArray(classObj?.signals) ? classObj.signals.slice(0, 4) : []
  const chains = semantic?.chains || {}
  const chainEntries = Object.entries(chains).slice(0, 4)

  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${classObj?.icon || profile.avatar}</span>
      <div class="modal-head-title">${classObj?.name || profile.class}</div>
      ${closeButton()}
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:10px 0 14px">
        <div style="font-size:60px;margin-bottom:6px">${classObj?.icon || profile.avatar}</div>
        <div style="font-family:'Cinzel',serif;font-size:17px;color:var(--mmo-gold-2, var(--gold));margin-bottom:4px">${classObj?.name || profile.class}</div>
        <div style="font-size:11px;color:var(--mmo-ink-dim, var(--dim));letter-spacing:.8px">${profile.subClass || ''} · ${profile.rank || ''}</div>
      </div>
      ${classObj?.desc ? `<div class="modal-desc">${classObj.desc}</div>` : ''}
      ${classObj?.buff ? `<div class="modal-coach"><strong>Buff:</strong> ${classObj.buff}</div>` : ''}
      ${classObj?.reason ? `<div class="modal-coach"><strong>Neden bu yol:</strong> ${classObj.reason}</div>` : ''}
      ${criticalStat ? `<div class="modal-coach" style="border-color:rgba(208,74,64,.45)"><strong>Kritik Nokta:</strong> ${criticalStat.label} ${criticalStat.val}/100 — ${criticalStat.name}</div>` : ''}
      ${signals.length ? `<div class="modal-section-label">CLASS SIGNALS</div><div class="modal-grid">${signals.map(signal => `<div class="modal-item"><div class="modal-item-label">Signal</div><div class="modal-item-val">${signal}</div></div>`).join('')}</div>` : ''}
      ${chainEntries.length ? `<div class="modal-section-label">CHAIN LOAD</div><div class="modal-grid">${chainEntries.map(([key, val]) => `<div class="modal-item"><div class="modal-item-label">${key}</div><div class="modal-item-val">${val}</div></div>`).join('')}</div>` : ''}
      <div class="modal-tip">Sınıfın son 10 antrenman deseninden okunur; yeni blok biçimi girdikçe otomatik değişir.</div>
    </div>`
  openModal(html)
}

export function openFocusModal({ focus, classObj, criticalStats, semantic, profile }) {
  const critList = (criticalStats || []).slice(0, 3)
  const recoveryDisc = Math.round(Number(semantic?.recoveryDiscipline || 0) * 100)
  const variety = Number(semantic?.variety || 0)
  const signals = Array.isArray(classObj?.signals) ? classObj.signals.slice(0, 3) : []

  const html = `
    <div class="modal-head">
      <span style="font-size:22px">◈</span>
      <div class="modal-head-title">Current Focus</div>
      ${closeButton()}
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:6px 0 14px">
        <div style="font-family:'Cinzel Decorative',serif;font-size:22px;color:var(--mmo-gold-2, var(--gold));letter-spacing:.5px">${focus || 'Hybrid denge'}</div>
        <div style="font-size:11px;color:var(--mmo-ink-dim, var(--dim));margin-top:4px;letter-spacing:.8px">aktif odak — son 14 gün verisinden</div>
      </div>
      ${critList.length ? `
        <div class="modal-section-label">ZAYIF HALKA</div>
        <div class="modal-grid">
          ${critList.map(stat => `
            <div class="modal-item" style="border-color:rgba(208,74,64,.45)">
              <div class="modal-item-label">${stat.label}</div>
              <div class="modal-item-val" style="color:var(--mmo-blood, var(--red))">${stat.val}/100</div>
            </div>
          `).join('')}
        </div>
      ` : '<div class="modal-coach">Şu an kritik stat yok — dengen yerinde.</div>'}
      ${classObj?.reason ? `<div class="modal-coach"><strong>Neden bu odak:</strong> ${classObj.reason}</div>` : ''}
      ${signals.length ? `<div class="modal-section-label">AKTİF SİNYAL</div><div class="modal-grid">${signals.map(signal => `<div class="modal-item"><div class="modal-item-label">Signal</div><div class="modal-item-val">${signal}</div></div>`).join('')}</div>` : ''}
      <div class="modal-section-label">DURUM</div>
      <div class="modal-grid">
        <div class="modal-item"><div class="modal-item-label">Recovery</div><div class="modal-item-val">${recoveryDisc}%</div></div>
        <div class="modal-item"><div class="modal-item-label">Variety</div><div class="modal-item-val">${variety}</div></div>
        <div class="modal-item"><div class="modal-item-label">Streak</div><div class="modal-item-val">${profile?.streak?.current ?? 0}</div></div>
        <div class="modal-item"><div class="modal-item-label">Sessions</div><div class="modal-item-val">${profile?.sessions ?? 0}</div></div>
      </div>
      <div class="modal-tip">Focus, kritik stat + seans deseni + sınıf sinyalinin bileşimidir. Bir sonraki seçimin bunu nasıl iter öngörüsü ODIE'dedir.</div>
    </div>`
  openModal(html)
}

export function openUnlockModal({ nextUnlock, skills, profile }) {
  if (!nextUnlock) {
    openModal(`
      <div class="modal-head">
        <span style="font-size:22px">✦</span>
        <div class="modal-head-title">Next Unlock</div>
        ${closeButton()}
      </div>
      <div class="modal-body">
        <div class="modal-coach">Bütün yakın kilitler açık — yeni skill dalları ODIE üzerinden tetiklenecek.</div>
      </div>`)
    return
  }

  const branch = String(nextUnlock.branch || '').replace(/[^\w\s-]/g, '').trim()
  const status = nextUnlock.status || 'locked'
  const statusLabel = status === 'prog' ? 'AKTİF BASKI' : status === 'done' ? 'AÇIK' : 'KİLİTLİ'
  const statusColor = status === 'prog' ? 'var(--mmo-gold-2, var(--gold))' : status === 'done' ? 'var(--mmo-emerald, var(--grn))' : 'var(--mmo-ink-dim, var(--dim))'
  const siblings = (skills || [])
    .find(item => (item.items || []).some(node => node.name === nextUnlock.name))
    ?.items?.filter(item => item.name !== nextUnlock.name)
    ?.slice(0, 3) || []

  const html = `
    <div class="modal-head">
      <span style="font-size:22px">✦</span>
      <div class="modal-head-title">${nextUnlock.name}</div>
      ${closeButton()}
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:6px 0 12px">
        <div style="font-family:'Cinzel Decorative',serif;font-size:22px;color:var(--mmo-gold-2, var(--gold));letter-spacing:.5px">${nextUnlock.name}</div>
        ${branch ? `<div style="font-size:11px;color:var(--mmo-ink-dim, var(--dim));margin-top:4px;letter-spacing:.8px">${branch}</div>` : ''}
        <div style="margin-top:8px"><span class="grade-pill" style="color:${statusColor};border-color:${statusColor}">${statusLabel}</span></div>
      </div>
      ${nextUnlock.desc ? `<div class="modal-desc">${nextUnlock.desc}</div>` : ''}
      ${nextUnlock.req ? `<div class="modal-coach"><strong>Gereksinim:</strong> ${nextUnlock.req}</div>` : ''}
      ${siblings.length ? `
        <div class="modal-section-label">AYNI DAL</div>
        <div class="modal-grid">
          ${siblings.map(node => `
            <div class="modal-item">
              <div class="modal-item-label">${node.status === 'done' ? 'AÇIK' : node.status === 'prog' ? 'AKTİF' : 'KİLİT'}</div>
              <div class="modal-item-val">${node.name}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="modal-tip">Next Unlock, skill ağacındaki en yakın ilerleme nodu. Koşulu karşıladığında otomatik açılır.</div>
    </div>`
  openModal(html)
}

export function openAvatarModal(profile) {
  const criticalStat = (profile.stats || []).find(stat => stat.critical)
  const liveTip = criticalStat
    ? `${criticalStat.label} su an en zayif halka. ${profile.currentFocus || 'Siradaki seansi buna gore sec.'}`
    : (profile.currentFocus ? `Su an odak: ${profile.currentFocus}.` : 'Hybrid denge korunuyor.')

  const html = `
    <div class="modal-head">
      <span style="font-size:22px">${profile.avatar}</span>
      <div class="modal-head-title">${profile.nick}</div>
      ${closeButton()}
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:16px 0 12px">
        <div style="font-size:72px;margin-bottom:8px">${profile.avatar}</div>
        <div style="font-family:'Cinzel',serif;font-size:18px;color:var(--gold);margin-bottom:4px">${profile.class}</div>
        <div style="font-size:12px;color:var(--dim)">${profile.subClass} · ${profile.rank}</div>
      </div>
      <div class="modal-grid">
        <div class="modal-item"><div class="modal-item-label">Toplam Seans</div><div class="modal-item-val">${profile.sessions}</div></div>
        <div class="modal-item"><div class="modal-item-label">Toplam Hacim</div><div class="modal-item-val">${profile.totalVolume}</div></div>
        <div class="modal-item"><div class="modal-item-label">Toplam Set</div><div class="modal-item-val">${profile.totalSets}</div></div>
        <div class="modal-item"><div class="modal-item-label">Toplam Sure</div><div class="modal-item-val">${profile.totalTime}</div></div>
      </div>
      <div class="modal-tip">${liveTip}</div>
    </div>`
  openModal(html)
}
