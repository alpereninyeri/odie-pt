import { LIKERT_RESPONSE_LABELS, STAT_CALIBRATION_QUESTIONS, normalizeStatCalibration } from '../data/stat-scale.js'

let _onClose = null

function avatarMark(profile = {}) {
  const nick = String(profile.nick || 'OD')
  return nick.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || 'OD'
}

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

function openDetailModal({ icon, title, body, iconSize = 22 }) {
  openModal(`
    <div class="modal-head">
      <span style="font-size:${iconSize}px">${icon}</span>
      <div class="modal-head-title">${title}</div>
      ${closeButton()}
    </div>
    <div class="modal-body">
      ${body}
    </div>
  `)
}

function renderModalItem({ label, value, itemStyle = '', valueStyle = '', pillClass = '' }) {
  const itemAttr = itemStyle ? ` style="${itemStyle}"` : ''
  const valueAttr = valueStyle ? ` style="${valueStyle}"` : ''
  const valueMarkup = pillClass
    ? `<div class="modal-item-val"><span class="${pillClass}"${valueAttr}>${value}</span></div>`
    : `<div class="modal-item-val"${valueAttr}>${value}</div>`

  return `
    <div class="modal-item"${itemAttr}>
      <div class="modal-item-label">${label}</div>
      ${valueMarkup}
    </div>
  `
}

function renderModalGrid(items = []) {
  if (!items.length) return ''
  return `
    <div class="modal-grid">
      ${items.map(renderModalItem).join('')}
    </div>
  `
}

function renderModalSection(title, body) {
  if (!body) return ''
  return `
    <div class="modal-section-label">${title}</div>
    ${body}
  `
}

function renderSignalGrid(signals = []) {
  if (!signals.length) return ''
  return renderModalGrid(signals.map(signal => ({
    label: 'Iz',
    value: signal,
  })))
}

function renderEntryGrid(entries = [], { labelFormatter, valueFormatter } = {}) {
  if (!entries.length) return ''
  return renderModalGrid(entries.map(([key, value]) => ({
    label: labelFormatter ? labelFormatter(key, value) : key,
    value: valueFormatter ? valueFormatter(key, value) : value,
  })))
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
      <text x="${x + barWidth / 2}" y="${height - 2}" text-anchor="middle" fill="var(--cozy-ink-soft, var(--dim))" font-size="8" font-family="'JetBrains Mono', monospace">${point.date}</text>
      <text x="${x + barWidth / 2}" y="${y - 3}" text-anchor="middle" fill="${isLast ? color : 'var(--cozy-ink-soft, var(--dim))'}" font-size="8" font-family="'JetBrains Mono', monospace">${point.val}</text>
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

function cozyModalText(value = '') {
  return String(value || '')
    .replace(/\btrunk control\b/gi, 'govde kontrolu')
    .replace(/\bbuild['’]?i\b/gi, 'rotasi')
    .replace(/\bbuild\w*\b/gi, 'rota')
    .replace(/\bPush\b/gi, 'Itis')
    .replace(/\bPull\b/gi, 'Cekis')
    .replace(/\bCore\b/gi, 'Govde')
    .replace(/\bSkill\b/gi, 'Teknik')
    .replace(/\bRecovery\b/gi, 'Toparlanma')
    .replace(/\bWorkout\b/gi, 'Antrenman')
    .replace(/\bCoach\b/gi, 'ODIE')
}

function confidenceLabel(value = '') {
  const key = String(value || 'seed').toUpperCase()
  return ({ HIGH: 'NET', MEDIUM: 'ORTA', LOW: 'AZ', SEED: 'DEFTER' })[key] || cozyModalText(key)
}

function statDetailLabel(label = '') {
  const text = cozyModalText(label)
  return ({
    'Bench Peak': 'Bench izi',
    '1RM Est.': '1RM tahmin',
    'MU Signal': 'MU izi',
    Next: 'Siradaki',
    'Avg Session': 'Ort. seans',
    'Outdoor Km': 'Disari km',
    'Endurance 14g': 'Dayaniklilik 14g',
    Recovery: 'Toparlanma',
    Need: 'Ihtiyac',
    Balance: 'Denge',
    Timing: 'Zamanlama',
    'Core Sets': 'Govde set',
  })[text] || text
}

export function openStatModal(stat) {
  const rank = stat.rank || 'F'
  const progress = Math.round(Number(stat.progressToNext) || 0)
  const confidence = confidenceLabel(stat.confidence)
  const rawScore = Math.round(Number(stat.rawVal ?? stat.val) || 0)
  openDetailModal({
    icon: stat.label || stat.key || 'ST',
    title: `${stat.name} Kaydi`,
    body: `
      <div class="modal-stat-big" style="color:${stat.color}">
        ${rank} <span style="font-size:16px;color:var(--cozy-ink-soft, var(--dim));margin-left:8px">${stat.rankLabel || 'Rank'}</span>
      </div>
      ${stat.critical ? '<div style="text-align:center;margin-bottom:8px"><span class="grade-pill grade-crit">Dikkat</span></div>' : ''}
      <div class="modal-desc">${cozyModalText(stat.desc)}</div>
      <div class="modal-coach">${cozyModalText(stat.coach)}</div>
      ${renderModalGrid([
        { label: 'Rank ici ilerleme', value: `${progress}%` },
        { label: 'Guven', value: confidence },
        { label: 'Ham skor', value: `${rawScore}/100` },
        { label: 'S Rank kapisi', value: stat.sUnlocked ? 'acik' : 'kanit bekliyor' },
      ])}
      ${renderModalGrid((stat.detail || []).map(detail => ({
        label: statDetailLabel(detail.label),
        value: cozyModalText(detail.val),
        pillClass: `grade-pill ${gradePillClass(detail.val)}`,
      })))}
      <div class="modal-tip">Oyun notu: Ana okuma ranktir; 0-100 ham skor sadece hesaplama ve radar icin tutulur.</div>
    `,
  })
}
export function openStatCalibrationModal({ calibration = {}, onSave } = {}) {
  const normalized = normalizeStatCalibration(calibration)
  const currentAnswers = normalized.answers || {}
  const grouped = STAT_CALIBRATION_QUESTIONS.reduce((acc, question) => {
    if (!acc[question.stat]) acc[question.stat] = []
    acc[question.stat].push(question)
    return acc
  }, {})
  const statLabels = { str: 'STR', agi: 'AGI', end: 'END', dex: 'DEX', con: 'CON', sta: 'STA' }

  openDetailModal({
    icon: 'RANK',
    title: 'Kurulum Kalibrasyonu',
    body: `
      <form id="stat-calibration-form" class="stat-calibration-form">
        <div class="modal-desc">Bu test bir kere yapilir. Cevaplar antrenman verisinin yerine gecmez; sadece baslangic rank guvenini yumusatir.</div>
        ${Object.entries(grouped).map(([key, questions]) => `
          <div class="stat-calibration-group">
            <div class="modal-section-label">${statLabels[key] || key.toUpperCase()}</div>
            ${questions.map(question => `
              <fieldset class="stat-calibration-question">
                <legend>${question.prompt}</legend>
                <div class="stat-calibration-options">
                  ${LIKERT_RESPONSE_LABELS.map((label, index) => {
                    const value = index + 1
                    const checked = Number(currentAnswers[question.id]) === value ? 'checked' : ''
                    return `
                      <label>
                        <input type="radio" name="${question.id}" value="${value}" ${checked} required>
                        <span>${label}</span>
                      </label>
                    `
                  }).join('')}
                </div>
              </fieldset>
            `).join('')}
          </div>
        `).join('')}
        <button class="modal-primary-action" type="submit">Kalibrasyonu kaydet</button>
      </form>
    `,
  })

  const form = document.getElementById('stat-calibration-form')
  form?.addEventListener('submit', async event => {
    event.preventDefault()
    const answers = {}
    for (const question of STAT_CALIBRATION_QUESTIONS) {
      const selected = form.querySelector(`input[name="${question.id}"]:checked`)
      answers[question.id] = Number(selected?.value) || 0
    }
    await onSave?.({ version: 1, completedAt: new Date().toISOString(), answers })
    closeModal()
  })
}

export function openPerfModal(perf) {
  openDetailModal({
    icon: perf.icon,
    title: `${perf.name} Kaydi`,
    body: `
      <div class="modal-stat-big" >${perf.val}</div>
      <div class="modal-desc">${perf.note}</div>
      ${miniBarChart(perf.history, 'var(--cozy-moss-dark, var(--accent-2))')}
      ${renderModalGrid((perf.details || []).map(detail => ({
        label: detail.label,
        value: detail.val,
      })))}
      <div class="modal-tip">Kayit notu: ${perf.tip}</div>
    `,
  })
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
        <div class="epic-tier-badge">${achieved ? 'OK' : 'BEKLE'}</div>
      </div>
    `
  }).join('')

  openDetailModal({
    icon: 'VOL',
    title: 'Yuk Gunlugu',
    body: `
      <div class="epic-total">
        <div class="epic-total-val">${currentKg.toLocaleString('tr-TR')} kg</div>
        <div class="epic-total-lbl">Toplam kaldirilan yuk</div>
      </div>
      <div class="epic-tier-list">${items}</div>
    `,
  })
}

export function openClassModal(cls) {
  const passive = cls.passive || {}
  const signals = Array.isArray(cls.signals) ? cls.signals.slice(0, 3) : []
  const statEntries = Object.entries(passive.statMult || {})
  const xpEntries = Object.entries(passive.xpMult || {})

  openDetailModal({
    icon: cls.icon,
    title: cls.name,
    iconSize: 28,
    body: `
      <div style="text-align:center;padding:8px 0 16px">
        <div style="font-size:72px;margin-bottom:8px">${cls.icon}</div>
        <div style="font-size:18px;color:${cls.color};margin-bottom:4px">${cls.name}</div>
        <div style="font-size:11px;color:var(--cozy-ink-soft, var(--dim));letter-spacing:.5px">${cls.subName || ''}</div>
      </div>
      <div class="modal-desc">${cozyModalText(cls.desc)}</div>
      <div class="modal-coach"><strong>Etki:</strong> ${cozyModalText(cls.buff)}</div>
      ${cls.reason ? `<div class="modal-coach"><strong>Neden bu yol:</strong> ${cozyModalText(cls.reason)}</div>` : ''}
      ${renderModalSection('SINIF SINYALI', renderSignalGrid(signals))}
      ${renderModalSection('STAT CARPANI', renderEntryGrid(statEntries, {
        labelFormatter: key => key.toUpperCase(),
        valueFormatter: (_, value) => `x${value.toFixed(2)}`,
      }))}
      ${renderModalSection('XP CARPANI', renderEntryGrid(xpEntries, {
        valueFormatter: (_, value) => `x${value.toFixed(2)}`,
      }))}
      <div class="modal-tip">Sinif son 10 antrenman desenine gore dinamik degisir.</div>
    `,
  })
}

export function openArchetypeModal({ classObj, profile, semantic, criticalStat }) {
  const signals = Array.isArray(classObj?.signals) ? classObj.signals.slice(0, 4) : []
  const chainEntries = Object.entries(semantic?.chains || {}).slice(0, 4)

  openDetailModal({
    icon: classObj?.icon || profile.avatar,
    title: classObj?.name || profile.class,
    body: `
      <div style="text-align:center;padding:10px 0 14px">
        <div style="font-size:60px;margin-bottom:6px">${classObj?.icon || profile.avatar}</div>
        <div style="font-size:17px;color:var(--cozy-ink);margin-bottom:4px">${classObj?.name || profile.class}</div>
        <div style="font-size:11px;color:var(--cozy-ink-soft, var(--dim));letter-spacing:.8px">${profile.subClass || ''} / ${profile.rank || ''}</div>
      </div>
      ${classObj?.desc ? `<div class="modal-desc">${cozyModalText(classObj.desc)}</div>` : ''}
      ${classObj?.buff ? `<div class="modal-coach"><strong>Etki:</strong> ${cozyModalText(classObj.buff)}</div>` : ''}
      ${classObj?.reason ? `<div class="modal-coach"><strong>Neden bu yol:</strong> ${cozyModalText(classObj.reason)}</div>` : ''}
      ${criticalStat ? `<div class="modal-coach" style="border-color:rgba(208,74,64,.45)"><strong>Kritik Nokta:</strong> ${criticalStat.label} ${criticalStat.val}/100 - ${criticalStat.name}</div>` : ''}
      ${renderModalSection('SINIF SINYALI', renderSignalGrid(signals))}
      ${renderModalSection('HAREKET IZI', renderEntryGrid(chainEntries))}
      <div class="modal-tip">Sinifin son 10 antrenman deseninden okunur; yeni blok bicimi girdikce otomatik degisir.</div>
    `,
  })
}

export function openFocusModal({ focus, classObj, criticalStats, semantic, profile }) {
  const critList = (criticalStats || []).slice(0, 3)
  const recoveryDisc = Math.round(Number(semantic?.recoveryDiscipline || 0) * 100)
  const variety = Number(semantic?.variety || 0)
  const signals = Array.isArray(classObj?.signals) ? classObj.signals.slice(0, 3) : []
  const focusGrid = renderModalGrid(critList.map(stat => ({
    label: cozyModalText(stat.label),
    value: `${stat.val}/100`,
    itemStyle: 'border-color:rgba(208,74,64,.45)',
    valueStyle: 'color:var(--cozy-rose, var(--red))',
  })))
  const stateGrid = renderModalGrid([
    { label: 'Toparlanma', value: `${recoveryDisc}%` },
    { label: 'Cesitlilik', value: variety },
    { label: 'Seri', value: profile?.streak?.current ?? 0 },
    { label: 'Seans', value: profile?.sessions ?? 0 },
  ])

  openDetailModal({
    icon: 'OD',
    title: 'Bugunku Odak',
    body: `
      <div style="text-align:center;padding:6px 0 14px">
        <div style="font-size:22px;color:var(--cozy-ink);letter-spacing:.5px">${cozyModalText(focus || 'Karma denge')}</div>
        <div style="font-size:11px;color:var(--cozy-ink-soft, var(--dim));margin-top:4px;letter-spacing:.8px">aktif odak - son 14 gun verisinden</div>
      </div>
      ${focusGrid ? `${renderModalSection('ZAYIF HALKA', focusGrid)}` : '<div class="modal-coach">Su an kritik stat yok - dengen yerinde.</div>'}
      ${classObj?.reason ? `<div class="modal-coach"><strong>Neden bu odak:</strong> ${cozyModalText(classObj.reason)}</div>` : ''}
      ${renderModalSection('AKTIF SINYAL', renderSignalGrid(signals))}
      ${renderModalSection('DURUM', stateGrid)}
      <div class="modal-tip">Odak, kritik stat + seans deseni + sinif sinyalinin bilesimidir. Bir sonraki secimin bunu nasil iter ongorusu ODIE'dedir.</div>
    `,
  })
}

export function openUnlockModal({ nextUnlock, skills }) {
  if (!nextUnlock) {
    openDetailModal({
      icon: '*',
      title: 'Siradaki Acilim',
      body: '<div class="modal-coach">Butun yakin kilitler acik - yeni skill dallari ODIE uzerinden tetiklenecek.</div>',
    })
    return
  }

  const branch = String(nextUnlock.branch || '').replace(/[^\w\s-]/g, '').trim()
  const status = nextUnlock.status || 'locked'
  const statusLabel = status === 'prog' ? 'AKTIF BASKI' : status === 'done' ? 'ACIK' : 'KILITLI'
  const statusColor = status === 'prog' ? 'var(--cozy-peach)' : status === 'done' ? 'var(--cozy-moss)' : 'var(--cozy-ink-soft)'
  const progress = Number(nextUnlock.progress)
  const linkedRegions = Array.isArray(nextUnlock.linkedRegions) ? nextUnlock.linkedRegions : []
  const siblings = (skills || [])
    .find(item => (item.items || []).some(node => node.name === nextUnlock.name))
    ?.items?.filter(item => item.name !== nextUnlock.name)
    ?.slice(0, 3) || []

  openDetailModal({
    icon: '*',
    title: nextUnlock.name,
    body: `
      <div style="text-align:center;padding:6px 0 12px">
        <div style="font-size:22px;color:var(--cozy-ink);letter-spacing:.5px">${nextUnlock.name}</div>
        ${branch ? `<div style="font-size:11px;color:var(--cozy-ink-soft, var(--dim));margin-top:4px;letter-spacing:.8px">${branch}</div>` : ''}
        <div style="margin-top:8px"><span class="grade-pill" style="color:${statusColor};border-color:${statusColor}">${statusLabel}</span></div>
      </div>
      ${nextUnlock.desc ? `<div class="modal-desc">${cozyModalText(nextUnlock.desc)}</div>` : ''}
      ${nextUnlock.req ? `<div class="modal-coach"><strong>Gereksinim:</strong> ${cozyModalText(nextUnlock.req)}</div>` : ''}
      ${Number.isFinite(progress) ? `
        <div class="modal-coach">
          <strong>Yakinlik:</strong> %${Math.round(progress)}<br>
          <strong>Eksik:</strong> ${cozyModalText(nextUnlock.missing || 'Bir temiz iz daha gerekli.')}<br>
          <strong>Bugunku mini adim:</strong> ${cozyModalText(nextUnlock.todayStep || 'Kisa teknik blok ekle.')}
        </div>
      ` : ''}
      ${linkedRegions.length ? renderModalSection('BAGLI HATLAR', renderModalGrid([
        { label: 'Vucut', value: linkedRegions.join(' / ') },
        { label: 'Hareket', value: cozyModalText(nextUnlock.linkedMovement || '-') },
      ])) : ''}
      ${renderModalSection('AYNI DAL', renderModalGrid(siblings.map(node => ({
        label: node.status === 'done' ? 'ACIK' : node.status === 'prog' ? 'AKTIF' : 'KILIT',
        value: cozyModalText(node.name),
      }))))}
      <div class="modal-tip">Siradaki acilim, acilim dallarindaki en yakin ilerleme nodu. Kosulu karsiladiginda otomatik acilir.</div>
    `,
  })
}

export function openAvatarModal(profile) {
  const criticalStat = (profile.stats || []).find(stat => stat.critical)
  const liveTip = criticalStat
    ? `${criticalStat.label} su an en zayif halka. ${profile.currentFocus || 'Siradaki seansi buna gore sec.'}`
    : (profile.currentFocus ? `Su an odak: ${cozyModalText(profile.currentFocus)}.` : 'Karma denge korunuyor.')

  openDetailModal({
    icon: avatarMark(profile),
    title: profile.nick,
    body: `
      <div style="text-align:center;padding:16px 0 12px">
        <div style="font-size:56px;margin-bottom:8px">${avatarMark(profile)}</div>
        <div style="font-size:18px;color:var(--cozy-ink);margin-bottom:4px">${profile.class}</div>
        <div style="font-size:12px;color:var(--cozy-ink-soft, var(--dim))">${profile.subClass} / ${profile.rank}</div>
      </div>
      ${renderModalGrid([
        { label: 'Toplam Seans', value: profile.sessions },
        { label: 'Toplam Yuk', value: profile.totalVolume },
        { label: 'Toplam Set', value: profile.totalSets },
        { label: 'Toplam Sure', value: profile.totalTime },
      ])}
      <div class="modal-tip">${liveTip}</div>
    `,
  })
}
