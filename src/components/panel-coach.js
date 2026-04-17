// Cancellation token: her initCoach çağrısında yeni token üretilir.
// Tüm async adımlar token'ı kontrol eder — DOM yokken hiçbir şey çalışmaz.
let _token = 0

function _cancelled(t) { return t !== _token }

function _parseMarkup(text) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

export function renderCoach(p) {
  const cn = p.coachNote || { date: '', xpNote: '', sections: [] }
  if (!Array.isArray(cn.sections) || !cn.sections.length) {
    return `
      <div class="coach-terminal" style="min-height:320px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px">
        <div style="font-size:48px;opacity:.4">☠</div>
        <div style="font-family:'Cinzel',serif;font-size:14px;letter-spacing:3px;opacity:.7">ODIE OFFLINE</div>
        <div style="font-size:11px;opacity:.5;max-width:280px;text-align:center;line-height:1.5">
          Henüz koç raporu yok. Telegram'a bir antrenman yaz → ODIE analiz eder ve burada canlı rapor sunar.
        </div>
      </div>`
  }
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
          <div class="coach-npc-name">ODIE</div>
          <div class="coach-npc-sub">Personal Combat Coach // AI v2.1</div>
        </div>
        <div class="coach-meta">
          <div class="coach-date">${cn.date}</div>
          <div class="coach-session">SESSION #${p.sessions}</div>
        </div>
      </div>
      <div class="coach-body" id="coach-body">
        <div class="coach-init-line" id="coach-init">
          <span>ODIE yükleniyor</span><span class="coach-blink">_</span>
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
  if (!p?.coachNote?.sections?.length) return
  // Her initCoach çağrısında token ilerler — önceki zincir otomatik iptal
  const myToken = ++_token

  const skipBtn = document.getElementById('coach-skip')
  if (skipBtn) {
    skipBtn.onclick = () => {
      ++_token  // skip de zinciri iptal eder
      _skipAll(p)
    }
  }

  setTimeout(() => {
    if (_cancelled(myToken)) return
    const initLine = document.getElementById('coach-init')
    if (initLine) { initLine.style.transition = 'opacity .4s'; initLine.style.opacity = '0' }
    setTimeout(() => {
      if (_cancelled(myToken)) return
      _startTransmission(p, 0, myToken)
    }, 400)
  }, 800)
}

function _startTransmission(p, idx, token) {
  if (_cancelled(token)) return
  const cn = p.coachNote
  if (idx >= cn.sections.length) {
    const skipBtn = document.getElementById('coach-skip')
    if (skipBtn) skipBtn.style.display = 'none'
    return
  }

  const secEl  = document.getElementById(`coach-sec-${idx}`)
  const bodyEl = document.getElementById(`coach-sb-${idx}`)
  const statEl = document.getElementById(`coach-st-${idx}`)
  if (!secEl || !bodyEl) return

  secEl.classList.add('active')
  if (statEl) statEl.textContent = 'YAYINDA'

  _typewriterSection(cn.sections[idx].lines, bodyEl, token, () => {
    if (_cancelled(token)) return
    if (statEl) { statEl.textContent = 'TAMAMLANDI'; statEl.classList.add('done') }
    setTimeout(() => _startTransmission(p, idx + 1, token), 300)
  })
}

function _typewriterSection(lines, containerEl, token, onDone) {
  let lineIdx = 0

  function typeLine() {
    if (_cancelled(token)) return
    if (lineIdx >= lines.length) { onDone(); return }

    const el = document.createElement('div')
    el.className = 'coach-line'
    containerEl.appendChild(el)

    const raw = lines[lineIdx]
    if (!raw) {
      lineIdx++
      setTimeout(typeLine, 60)
      return
    }

    const parsed = _parseMarkup(raw)
    let charIdx = 0
    const plainText = raw.replace(/\*\*/g, '')

    function typeChar() {
      if (_cancelled(token)) return
      if (charIdx < plainText.length) {
        el.innerHTML = _parseMarkup(_slicePlainWithMarkup(raw, charIdx + 1))
        charIdx++
        setTimeout(typeChar, 14)
      } else {
        el.innerHTML = parsed
        lineIdx++
        setTimeout(typeLine, 70)
      }
    }
    typeChar()
  }

  typeLine()
}

function _slicePlainWithMarkup(raw, n) {
  let plain = 0
  let i = 0
  while (i < raw.length && plain < n) {
    if (raw[i] === '*' && raw[i + 1] === '*') { i += 2; continue }
    plain++
    i++
  }
  return raw.slice(0, i)
}

function _skipAll(p) {
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
