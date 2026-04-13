let _coachTimer = null

export function renderCoach(p) {
  const cn = p.coachNote
  const shells = cn.sections.map((sec, i) => `
    <div class="coach-section" id="coach-sec-${i}" data-mood="${sec.mood}">
      <div class="coach-sec-head">
        <span class="coach-sec-icon">${_moodIcon(sec.mood)}</span>
        <span class="coach-sec-title">${sec.title}</span>
        <span class="coach-sec-status" id="coach-st-${i}">BEKLEMEDE</span>
      </div>
      <div class="coach-sec-body" id="coach-sb-${i}"></div>
    </div>`).join('')

  return `
    <div class="coach-terminal" id="coach-terminal">
      <div class="coach-scanline"></div>
      <div class="coach-header">
        <div class="coach-avatar">☠</div>
        <div class="coach-npc-info">
          <div class="coach-npc-name">AXIOM</div>
          <div class="coach-npc-sub">Personal Combat Coach // AI v2.1</div>
        </div>
        <div class="coach-meta">
          <div class="coach-date">${cn.date}</div>
          <div class="coach-session">SESSION #${p.sessions}</div>
        </div>
      </div>
      <div class="coach-body" id="coach-body">
        <div class="coach-init-line" id="coach-init">
          <span>AXIOM yükleniyor</span><span class="coach-blink">_</span>
        </div>
        ${shells}
      </div>
      <div class="coach-footer">
        <button class="coach-skip-btn" id="coach-skip" onclick="window.__coachSkip()">⚡ ATLA — HEPSİNİ GÖSTER</button>
        <div class="coach-xp-badge">${cn.xpNote}</div>
      </div>
    </div>`
}

function _moodIcon(mood) {
  return { fire: '🔥', warning: '⚠️', danger: '🔴', calm: '💬' }[mood] || '▶'
}

export function initCoach(p) {
  if (_coachTimer) { clearTimeout(_coachTimer); _coachTimer = null }

  window.__coachSkip = () => _skipAll(p)

  _coachTimer = setTimeout(() => {
    const initLine = document.getElementById('coach-init')
    if (initLine) { initLine.style.transition = 'opacity .4s'; initLine.style.opacity = '0' }
    _coachTimer = setTimeout(() => _startTransmission(p, 0), 500)
  }, 1200)
}

function _startTransmission(p, idx) {
  const cn = p.coachNote
  if (idx >= cn.sections.length) {
    const skipBtn = document.getElementById('coach-skip')
    if (skipBtn) skipBtn.style.display = 'none'
    return
  }

  const secEl   = document.getElementById(`coach-sec-${idx}`)
  const bodyEl  = document.getElementById(`coach-sb-${idx}`)
  const statEl  = document.getElementById(`coach-st-${idx}`)
  if (!secEl || !bodyEl) return

  secEl.classList.add('active')
  if (statEl) statEl.textContent = 'YAYINDA'

  _typewriterSection(cn.sections[idx].lines, bodyEl, () => {
    if (statEl) { statEl.textContent = 'TAMAMLANDI'; statEl.classList.add('done') }
    _coachTimer = setTimeout(() => _startTransmission(p, idx + 1), 450)
  })
}

function _typewriterSection(lines, containerEl, onDone) {
  let lineIdx = 0

  function typeLine() {
    if (lineIdx >= lines.length) { onDone(); return }

    const el = document.createElement('div')
    el.className = 'coach-line'
    containerEl.appendChild(el)
    containerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    const text = lines[lineIdx]
    let charIdx = 0

    function typeChar() {
      if (charIdx < text.length) {
        el.textContent = text.slice(0, charIdx + 1)
        charIdx++
        _coachTimer = setTimeout(typeChar, 28)
      } else {
        lineIdx++
        _coachTimer = setTimeout(typeLine, 115)
      }
    }
    typeChar()
  }

  typeLine()
}

function _skipAll(p) {
  if (_coachTimer) { clearTimeout(_coachTimer); _coachTimer = null }

  const initLine = document.getElementById('coach-init')
  if (initLine) initLine.style.display = 'none'

  p.coachNote.sections.forEach((sec, i) => {
    const secEl  = document.getElementById(`coach-sec-${i}`)
    const bodyEl = document.getElementById(`coach-sb-${i}`)
    const statEl = document.getElementById(`coach-st-${i}`)
    if (!secEl || !bodyEl) return
    secEl.classList.add('active')
    bodyEl.innerHTML = sec.lines.map(l => `<div class="coach-line">${l}</div>`).join('')
    if (statEl) { statEl.textContent = 'TAMAMLANDI'; statEl.classList.add('done') }
  })

  const skipBtn = document.getElementById('coach-skip')
  if (skipBtn) skipBtn.style.display = 'none'
}
