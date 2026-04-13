export function renderMuscles(p) {
  const maxSets = Math.max(...p.muscleBalance.map(m => m.sets)) || 1

  const balanceRows = p.muscleBalance.map(m => {
    const pct = Math.round((m.sets / maxSets) * 100)
    return `
      <div class="bal-row">
        <div class="bal-lbl" ${m.critical ? 'style="color:var(--red);font-weight:700"' : ''}>${m.label}</div>
        <div class="bal-track" ${m.critical ? 'style="border:1px solid var(--red)"' : ''}>
          <div class="bal-fill" style="--bc:${m.color}" data-width="${pct}%"></div>
        </div>
        <div class="bal-num" ${m.critical ? 'style="color:var(--red);font-weight:700"' : ''}>${m.sets}</div>
      </div>`
  }).join('')

  const muscleRows = p.muscles.map((m, i) => {
    const isLast = i === p.muscles.length - 1
    const exercises = m.exercises.map(e => `<span class="exbadge">${e}</span>`).join('')
    return `
      <div class="mrow ${isLast ? 'last' : ''}" style="--mc:${m.color}" data-muscle="${i}">
        <div class="mico">${m.icon}</div>
        <div class="minfo">
          <div class="mname">${m.name} <span class="tag ${m.tagClass}">${m.tag}</span></div>
          <div class="mxp">${m.sets} Set İş Hacmi</div>
        </div>
        <div class="mright">
          <span class="mrank" ${m.critical ? 'style="color:var(--red)"' : ''}>RANK ${m.rank}</span>
          <span class="mchev">▼</span>
        </div>
      </div>
      <div class="mdet" data-det="${i}">
        <div class="mdet-text">${m.detail}</div>
        <div class="mdet-tip">💡 ${m.tip}</div>
        <div class="mdet-exercises">${exercises}</div>
      </div>`
  }).join('')

  return `
    <div class="sec">Hevy Veritabanı — Hacim Dağılımı</div>
    <div class="balance-wrap">
      <div class="balance-title">SET DAĞILIMI (Tüm Zamanlar · ${p.totalSets} Set)</div>
      ${balanceRows}
    </div>

    <div class="sec">Bölgesel Güç Analizi</div>
    ${muscleRows}`
}

export function initMuscles() {
  // Animate balance bars
  requestAnimationFrame(() => {
    setTimeout(() => {
      document.querySelectorAll('.bal-fill[data-width]').forEach(el => {
        el.style.width = el.dataset.width
      })
    }, 150)
  })

  // Accordion toggle — delegated, guard against double-init
  const panel = document.getElementById('panel-muscles')
  if (!panel || panel.dataset.initialized) return
  panel.dataset.initialized = 'true'
  panel.addEventListener('click', e => {
    const row = e.target.closest('[data-muscle]')
    if (!row) return
    const idx = row.dataset.muscle
    const det = document.querySelector(`[data-det="${idx}"]`)
    if (!det) return
    const isOpen = row.classList.contains('open')
    document.querySelectorAll('.mrow.open').forEach(r => r.classList.remove('open'))
    document.querySelectorAll('.mdet.open').forEach(d => d.classList.remove('open'))
    if (!isOpen) { row.classList.add('open'); det.classList.add('open') }
  })
}
