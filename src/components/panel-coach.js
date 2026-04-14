let _coachTimer = null

// Parse **bold** markup safely
function _parseMarkup(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

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
        <button class="coach-skip-btn" id="coach-skip">⚡ ATLA — HEPSİNİ GÖSTER</button>
        <div class="coach-xp-badge">${cn.xpNote}</div>
      </div>
    </div>`
}

function _moodIcon(mood) {
  return { fire: '🔥', warning: '⚠️', danger: '🔴', calm: '💬' }[mood] || '▶'
}

export function initCoach(p) {
  if (_coachTimer) { clearTimeout(_coachTimer); _coachTimer = null }

  // Delegated skip button
  const skipBtn = document.getElementById('coach-skip')
  if (skipBtn) {
    skipBtn.onclick = () => _skipAll(p)
  }

  _coachTimer = setTimeout(() => {
    const initLine = document.getElementById('coach-init')
    if (initLine) { initLine.style.transition = 'opacity .4s'; initLine.style.opacity = '0' }
    _coachTimer = setTimeout(() => _startTransmission(p, 0), 400)
  }, 800)
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
    _coachTimer = setTimeout(() => _startTransmission(p, idx + 1), 300)
  })
}

function _typewriterSection(lines, containerEl, onDone) {
  let lineIdx = 0

  function typeLine() {
    if (lineIdx >= lines.length) { onDone(); return }

    const el = document.createElement('div')
    el.className = 'coach-line'
    containerEl.appendChild(el)

    const raw = lines[lineIdx]
    if (!raw) {
      // Empty line — just a spacer
      lineIdx++
      _coachTimer = setTimeout(typeLine, 60)
      return
    }

    const parsed = _parseMarkup(raw)
    let charIdx = 0
    // Strip tags for length counting but render with tags
    const plainText = raw.replace(/\*\*/g, '')

    function typeChar() {
      if (charIdx < plainText.length) {
        // Slice the parsed HTML proportionally — use plain text progress
        const visibleText = plainText.slice(0, charIdx + 1)
        // Rebuild with markup applied to visible portion
        el.innerHTML = _parseMarkup(_slicePlainWithMarkup(raw, charIdx + 1))
        charIdx++
        _coachTimer = setTimeout(typeChar, 14)
      } else {
        el.innerHTML = parsed
        lineIdx++
        _coachTimer = setTimeout(typeLine, 70)
      }
    }
    typeChar()
  }

  typeLine()
}

// Slice original marked-up text to show N plain chars, preserving ** markers
function _slicePlainWithMarkup(raw, n) {
  let plain = 0
  let i = 0
  const inBold = []
  while (i < raw.length && plain < n) {
    if (raw[i] === '*' && raw[i + 1] === '*') {
      inBold.push(i)
      i += 2
      continue
    }
    plain++
    i++
  }
  return raw.slice(0, i)
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
    bodyEl.innerHTML = sec.lines.map(l => `<div class="coach-line">${_parseMarkup(l)}</div>`).join('')
    if (statEl) { statEl.textContent = 'TAMAMLANDI'; statEl.classList.add('done') }
  })

  const skipBtn = document.getElementById('coach-skip')
  if (skipBtn) skipBtn.style.display = 'none'
}
