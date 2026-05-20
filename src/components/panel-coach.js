import { store } from '../data/store.js'

let _token = 0

function _cancelled(token) {
  return token !== _token
}

function _visibleSections(note) {
  return (note?.sections || []).filter(section => !section?.hidden)
}

function _sectionBucket(title = '') {
  const text = String(title || '').toUpperCase()
  if (/(SONRAKI ODAK|SONRAKI ADIM|SIRADAKI ADIM)/.test(text)) return 'next'
  if (/(RISK|UYARI|EKSIK HALKA|SKILL VE HEDEF|DENGE)/.test(text)) return 'risk'
  return 'summary'
}

function _mergeMood(current = 'calm', next = 'calm') {
  const weight = { danger: 4, warn: 3, warning: 3, fire: 2, calm: 1 }
  return (weight[next] || 0) > (weight[current] || 0) ? next : current
}

function _groupCoachSections(note) {
  const groups = {
    summary: { title: 'Bugunun Ozeti', mood: 'calm', lines: [] },
    risk: { title: 'Risk ve Denge', mood: 'calm', lines: [] },
    next: { title: 'Siradaki Adim', mood: 'calm', lines: [] },
  }

  _visibleSections(note).forEach(section => {
    const bucket = _sectionBucket(section?.title)
    const target = groups[bucket]
    target.mood = _mergeMood(target.mood, section?.mood || 'calm')
    ;(section?.lines || [])
      .map(line => String(line || '').trim())
      .filter(Boolean)
      .forEach(line => {
        if (!target.lines.includes(line)) target.lines.push(line)
      })
  })

  return ['summary', 'risk', 'next']
    .map(key => groups[key])
    .filter(group => group.lines.length)
    .map(group => ({
      ...group,
      lines: group.lines.slice(0, group.title === 'Bugunun Ozeti' ? 3 : 2),
    }))
}

function _parseMarkup(text) {
  return String(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/`([^`]+?)`/g, '<code class="coach-code">$1</code>')
    .replace(/(\b\d+(?:\.\d+)?(?:kg|sn|dk|%|m|km|x\d+|kcal|XP)\b|\b\d+x\d+\b)/gi, '<span class="coach-num">$1</span>')
    .replace(/\b(STR|AGI|END|DEX|CON|STA)\b/g, '<span class="coach-stat">$1</span>')
}

function _moodIcon(mood) {
  return { fire: 'F', warning: '!', warn: '!', danger: 'X', calm: '>' }[mood] || '>'
}

function _memoryTone(item) {
  if ((item.scope || '').includes('recovery')) return 'warn'
  if ((item.scope || '').includes('core')) return 'danger'
  if ((item.scope || '').includes('parkour')) return 'fire'
  return 'calm'
}

function _confidenceLabel(level = 'low') {
  return {
    high: 'TEMIZ',
    medium: 'YETERLI',
    low: 'KISA',
  }[level] || 'KISA'
}

function _explain(key, label, className = 'explain-link metric-explain') {
  return `<button type="button" class="${className}" data-explain="${key}" aria-haspopup="dialog" aria-label="${label} aciklamasini ac">${label}</button>`
}

function _meter(label, value, tone = 'armor', explainKey = null) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0))
  const key = explainKey || (String(label).toLowerCase() === 'kalkan' ? 'armor' : 'fatigue')
  return `
    <div class="survival-meter-card">
      <div class="survival-meter-top">
        <span>${_explain(key, label)}</span>
        <strong>${safeValue}</strong>
      </div>
      <div class="survival-meter ${tone}">
        <div class="survival-meter-fill ${tone}" style="width:${safeValue}%"></div>
      </div>
    </div>
  `
}

function _renderSurvivalConsole(p) {
  const armor = Number(p.armor ?? 100) || 0
  const fatigue = Number(p.fatigue ?? 0) || 0
  const readiness = Number(p.health?.readiness?.score)
  const warnings = Array.isArray(p.survivalWarnings) ? p.survivalWarnings : []
  const injury = p.injuryUntil ? `Risk kilidi: ${p.injuryUntil}` : 'Risk kilidi yok'
  const heavyLabel = Number(p.consecutiveHeavy) ? `${p.consecutiveHeavy} ardisik agir seans` : 'Agir yuk birikimi yok'
  const readinessText = Number.isFinite(readiness) ? `${readiness}/100` : '--'

  return `
    <section class="survival-console">
      <div class="section-top">
        <div>
          <div class="eyebrow">${_explain('survival-console', 'Durum Hatti', 'explain-link eyebrow-explain')}</div>
          <h3>${_explain('survival-console', 'Yorgunluk, toparlanma ve risk ozeti', 'explain-link explain-heading')}</h3>
        </div>
        <div class="coach-memory-pills">
          <span class="coach-pill">${p.sessions || 0} seans</span>
          <span class="coach-pill">${readinessText} ${_explain('readiness', 'hazirlik')}</span>
        </div>
      </div>

      <div class="survival-console-grid">
        <div class="survival-console-main">
          ${_meter('Kalkan', armor, armor <= 35 ? 'injury' : armor <= 60 ? 'fatigue' : 'armor', 'armor')}
          ${_meter('Yorgunluk', fatigue, fatigue >= 70 ? 'injury' : 'fatigue', 'fatigue')}
        </div>

        <div class="survival-warning-stack">
          <div class="survival-warning-card">
            <span class="mini-label">${_explain('heavy-load', 'Yuk Birikimi')}</span>
            <strong>${heavyLabel}</strong>
            <small>${injury}</small>
          </div>
          ${(warnings.length ? warnings : ['Aktif dikkat uyarisi yok.']).slice(0, 3).map(item => `
            <div class="survival-warning-card ${warnings.length ? 'warn' : ''}">
              <span class="mini-label">${_explain('field-note', 'Saha Notu')}</span>
              <strong>${item}</strong>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `
}

function _renderCoachConfidence(p) {
  const latestWorkout = (p.workouts || [])[0] || null
  const latestWorkoutId = String(latestWorkout?.id || '')
  const factRows = (p.workoutFacts || []).filter(item => String(item.workoutId || '') === latestWorkoutId)
  const storedSignalCount = Array.isArray(latestWorkout?.evidence) ? latestWorkout.evidence.length : 0
  const blockCount = Array.isArray(latestWorkout?.blocks) ? latestWorkout.blocks.length : 0
  const inferredScore = Math.min(95, 42 + (factRows.length * 7) + (blockCount * 5))
  const confidenceScore = Number(latestWorkout?.confidence?.score) || (factRows.length || blockCount ? inferredScore : 0)
  const confidenceLevel = latestWorkout?.confidence?.level || (confidenceScore >= 72 ? 'high' : confidenceScore >= 52 ? 'medium' : 'low')
  const signalCount = Math.max(storedSignalCount, factRows.length)
  const reasons = (latestWorkout?.confidence?.reasons?.length
    ? latestWorkout.confidence.reasons
    : [
      factRows.length ? `${factRows.length} seans izi` : null,
      blockCount ? `${blockCount} calisma blogu` : null,
      latestWorkout?.source === 'hevy' ? 'Hevy structured veri' : null,
    ].filter(Boolean)
  ).slice(0, 3)
  const blockMix = (latestWorkout?.blockMix || []).slice(0, 3)

  if (!latestWorkout) {
    return `
      <div class="coach-confidence-surface compact">
        <div class="coach-memory-head">
          <div>
            <div class="eyebrow">${_explain('session-reading', 'Seans Okumasi', 'explain-link eyebrow-explain')}</div>
            <h3>${_explain('session-reading', 'Yeni seans geldikce burasi dolacak', 'explain-link explain-heading')}</h3>
          </div>
        </div>
        <div class="coach-memory-empty">ODIE yeni seans geldiginde ne kadar net okudugunu ve neye dayandigini burada gosterecek.</div>
      </div>
    `
  }

  return `
    <div class="coach-confidence-surface">
      <div class="coach-memory-head">
        <div>
          <div class="eyebrow">${_explain('session-reading', 'Seans Okumasi', 'explain-link eyebrow-explain')}</div>
          <h3>${_explain('session-reading', 'ODIE bu seansi nasil okudu', 'explain-link explain-heading')}</h3>
        </div>
        <div class="coach-memory-pills">
          <span class="coach-pill">${_explain('confidence', _confidenceLabel(confidenceLevel))}</span>
          <span class="coach-pill">${confidenceScore}/100 ${_explain('confidence', 'okuma')}</span>
        </div>
      </div>

      <div class="coach-memory-grid coach-confidence-grid">
        <div class="coach-memory-card tone-${confidenceLevel === 'high' ? 'fire' : confidenceLevel === 'medium' ? 'warn' : 'danger'}">
          <div class="coach-memory-top">
            <strong>${_explain('parsed-piece', 'Seans Sinyali', 'explain-link')}</strong>
            <span>${factRows.length}</span>
          </div>
          <p>Hevy veya nottan ${signalCount} sinyal ve ${blockCount} calisma blogu okundu.</p>
        </div>
        <div class="coach-memory-card tone-calm">
          <div class="coach-memory-top">
            <strong>${_explain('main-load', 'Ana Yuk', 'explain-link')}</strong>
            <span>${latestWorkout?.type || '-'}</span>
          </div>
          <p>${blockMix.length ? blockMix.map(item => `${item.kind} ${item.percent}%`).join(' / ') : 'Yuk dagilimi okunamadi.'}</p>
        </div>
      </div>

      <div class="mini-label">${_explain('evidence', 'Odie Neye Bakti')}</div>
      <div class="coach-confidence-reasons">
        ${reasons.length ? reasons.map(reason => `<span class="signal-chip">${reason}</span>`).join('') : '<span class="coach-memory-empty">Daha iyi okuma icin set, sure, mesafe veya drill bilgisi yardimci olur.</span>'}
      </div>
    </div>
  `
}

function _renderMemoryLedger(p) {
  const memories = (p.athleteMemory || []).slice(0, 6)
  const feedback = (p.memoryFeedback || []).slice(0, 4)
  const wrongCount = (p.memoryFeedback || []).filter(item => item.feedbackType === 'wrong').length
  const feedbackLabel = value => ({
    correct: 'dogru',
    wrong: 'yorum yanlis',
    outdated: 'eskidi',
    prefer: 'tonu iyi',
  }[value] || value)

  return `
    <div class="coach-memory-surface">
      <div class="coach-memory-head">
        <div>
          <div class="eyebrow">${_explain('memory', 'Kalici Hafiza', 'explain-link eyebrow-explain')}</div>
          <h3>${_explain('memory', 'ODIE senden ne ogrenmis', 'explain-link explain-heading')}</h3>
        </div>
        <div class="coach-memory-pills">
          <span class="coach-pill">${memories.length} aktif</span>
          <span class="coach-pill">${wrongCount} yanlis isaret</span>
        </div>
      </div>

      <div class="coach-memory-grid">
        ${memories.length ? memories.map(item => `
          <div class="coach-memory-card tone-${_memoryTone(item)}">
            <div class="coach-memory-top">
              <strong>${item.scope || 'global'}</strong>
              <span>${Math.round((Number(item.confidence) || 0) * 100)}%</span>
            </div>
            <p>${item.summary || item.key}</p>
          </div>
        `).join('') : '<div class="coach-memory-empty">Henuz kalici bir not birikmedi. Yanlis veya eksik yorumlari isaretledikce burasi dolar.</div>'}
      </div>

      <div class="coach-feedback-strip">
        <div>
          <div class="mini-label">${_explain('coach-feedback', 'Geri Bildirim')}</div>
          <strong>${_explain('coach-feedback', 'Son coach yorumunu isaretle', 'explain-link')}</strong>
        </div>
        <div class="coach-feedback-actions">
          <button class="coach-feedback-btn" data-memory-feedback="correct">DOGRU</button>
          <button class="coach-feedback-btn danger" data-memory-feedback="wrong">YORUM YANLIS</button>
          <button class="coach-feedback-btn" data-memory-feedback="outdated">ESKI</button>
          <button class="coach-feedback-btn" data-memory-feedback="prefer">TONU IYI</button>
        </div>
      </div>

      <div class="coach-feedback-log ${feedback.length ? '' : 'empty'}">
        ${feedback.length ? feedback.map(item => `
          <div class="coach-feedback-row">
            <span>${feedbackLabel(item.feedbackType)}</span>
            <p>${item.note || 'Kisa geri bildirim'}</p>
          </div>
        `).join('') : '<div class="coach-memory-empty">Henuz feedback kaydi yok.</div>'}
      </div>
    </div>
  `
}

export function renderCoach(p) {
  const cn = p.coachNote || { date: '', xpNote: '', sections: [] }
  const sections = _groupCoachSections(cn)
  const support = `
    <div class="coach-support-grid">
      ${_renderCoachConfidence(p)}
      ${_renderMemoryLedger(p)}
    </div>
  `

  if (!sections.length) {
    return `
      ${_renderSurvivalConsole(p)}
      <div class="coach-terminal coach-terminal-empty" style="min-height:320px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px">
        <div style="font-size:48px;opacity:.4">OD</div>
        <div style="font-size:14px;letter-spacing:3px;opacity:.7">ODIE OFFLINE</div>
        <div style="font-size:11px;opacity:.65;max-width:280px;text-align:center;line-height:1.5">
          Henuz coach raporu yok. Telegram'a yeni bir antrenman yazdiginda burada sade ve okunur bir yorum goreceksin.
        </div>
      </div>
      ${support}`
  }

  const warningCount = Array.isArray(cn.warnings) ? cn.warnings.length : 0
  const questCount = Array.isArray(p.quests?.weekly) ? p.quests.weekly.filter(quest => !quest.done).length : 0
  const shells = sections.map((sec, index) => `
    <div class="coach-section" id="coach-sec-${index}" data-mood="${sec.mood}">
      <div class="coach-sec-head">
        <span class="coach-sec-icon">${_moodIcon(sec.mood)}</span>
        <span class="coach-sec-title">${sec.title}</span>
        <span class="coach-sec-status" id="coach-st-${index}">BEKLEMEDE</span>
      </div>
      <div class="coach-sec-body" id="coach-sb-${index}"></div>
    </div>`).join('')

  return `
    ${_renderSurvivalConsole(p)}
    <div class="coach-terminal" id="coach-terminal">
      <div class="coach-scanline"></div>
      <div class="coach-header">
        <div class="coach-avatar">OD</div>
        <div class="coach-npc-info">
          <div class="coach-npc-name">ODIE</div>
          <div class="coach-npc-sub">canli performans yorumu</div>
        </div>
        <div class="coach-meta">
          <div class="coach-date">${cn.date}</div>
          <div class="coach-session">SEANS #${p.sessions}</div>
        </div>
      </div>
      <div class="coach-strip">
        <span class="coach-pill">${_explain('live-context', 'CANLI BAGLAM')}</span>
        <span class="coach-pill">${warningCount} ${_explain('field-note', 'uyari')}</span>
        <span class="coach-pill">${questCount} ${_explain('active-quests', 'acik hedef')}</span>
      </div>
      <div class="coach-body" id="coach-body">
        <div class="coach-init-line" id="coach-init">
          <span>ODIE yukleniyor</span><span class="coach-blink">_</span>
        </div>
        ${shells}
      </div>
      <div class="coach-footer">
        <button class="coach-skip-btn" id="coach-skip">HEPSINI AC</button>
        <div class="coach-xp-badge">${cn.xpNote}</div>
      </div>
    </div>
    ${support}`
}

export function initCoach(p) {
  document.querySelectorAll('[data-memory-feedback]').forEach(button => {
    button.onclick = async () => {
      const feedbackType = button.dataset.memoryFeedback || 'correct'
      await store.addMemoryFeedback({
        feedbackType,
        note:
          feedbackType === 'wrong'
            ? 'Coach note flagged by athlete'
            : feedbackType === 'outdated'
              ? 'Coach note stale or lagging behind current build'
              : feedbackType === 'prefer'
                ? 'Coach tone and framing preferred by athlete'
                : 'Coach note confirmed by athlete',
      })
    }
  })

  const sections = _groupCoachSections(p?.coachNote)
  if (!sections.length) return

  const coachState = {
    ...p,
    coachNote: {
      ...p.coachNote,
      sections,
    },
  }

  const myToken = ++_token
  const skipBtn = document.getElementById('coach-skip')
  if (skipBtn) {
    skipBtn.onclick = () => {
      ++_token
      _skipAll(coachState)
    }
  }

  setTimeout(() => {
    if (_cancelled(myToken)) return
    const initLine = document.getElementById('coach-init')
    if (initLine) {
      initLine.style.transition = 'opacity .4s'
      initLine.style.opacity = '0'
    }
    setTimeout(() => {
      if (_cancelled(myToken)) return
      _startTransmission(coachState, 0, myToken)
    }, 400)
  }, 800)
}

function _startTransmission(p, index, token) {
  if (_cancelled(token)) return
  const cn = p.coachNote
  if (index >= cn.sections.length) {
    const skipBtn = document.getElementById('coach-skip')
    if (skipBtn) skipBtn.style.display = 'none'
    return
  }

  const secEl = document.getElementById(`coach-sec-${index}`)
  const bodyEl = document.getElementById(`coach-sb-${index}`)
  const statEl = document.getElementById(`coach-st-${index}`)
  if (!secEl || !bodyEl) return

  secEl.classList.add('active')
  if (statEl) statEl.textContent = 'YAYINDA'

  _typewriterSection(cn.sections[index].lines || [], bodyEl, token, () => {
    if (_cancelled(token)) return
    if (statEl) {
      statEl.textContent = 'TAMAMLANDI'
      statEl.classList.add('done')
    }
    setTimeout(() => _startTransmission(p, index + 1, token), 300)
  })
}

function _typewriterSection(lines, containerEl, token, onDone) {
  let lineIndex = 0

  function typeLine() {
    if (_cancelled(token)) return
    if (lineIndex >= lines.length) {
      onDone()
      return
    }

    const lineEl = document.createElement('div')
    lineEl.className = 'coach-line'
    containerEl.appendChild(lineEl)

    const raw = lines[lineIndex]
    if (!raw) {
      lineIndex += 1
      setTimeout(typeLine, 60)
      return
    }

    const parsed = _parseMarkup(raw)
    let charIndex = 0
    const plainText = raw.replace(/\*\*/g, '')

    function typeChar() {
      if (_cancelled(token)) return
      if (charIndex < plainText.length) {
        lineEl.innerHTML = _parseMarkup(_slicePlainWithMarkup(raw, charIndex + 1))
        charIndex += 1
        setTimeout(typeChar, 14)
      } else {
        lineEl.innerHTML = parsed
        lineIndex += 1
        setTimeout(typeLine, 70)
      }
    }

    typeChar()
  }

  typeLine()
}

function _skipAll(p) {
  const cn = p.coachNote
  ;(cn.sections || []).forEach((section, index) => {
    const secEl = document.getElementById(`coach-sec-${index}`)
    const bodyEl = document.getElementById(`coach-sb-${index}`)
    const statEl = document.getElementById(`coach-st-${index}`)
    if (secEl) secEl.classList.add('active')
    if (bodyEl) {
      bodyEl.innerHTML = (section.lines || []).map(line => `<div class="coach-line">${_parseMarkup(line)}</div>`).join('')
    }
    if (statEl) {
      statEl.textContent = 'TAMAMLANDI'
      statEl.classList.add('done')
    }
  })
  const initLine = document.getElementById('coach-init')
  if (initLine) initLine.style.display = 'none'
  const skipBtn = document.getElementById('coach-skip')
  if (skipBtn) skipBtn.style.display = 'none'
}

function _slicePlainWithMarkup(raw, plainLength) {
  let plainCount = 0
  let result = ''
  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    result += char
    if (char !== '*') {
      plainCount += 1
    }
    if (plainCount >= plainLength) break
  }
  return result
}
