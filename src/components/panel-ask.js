import { showToast } from './toast.js'
import { buildOdiePresence } from '../data/odie-presence.js'

const askState = {
  loaded: false,
  loadingHistory: false,
  loadingAnswer: false,
  items: [],
  latest: null,
  draft: '',
}

let historyToken = 0
let answerToken = 0

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function cozyAskText(value = '') {
  return String(value || '')
    .replace(/\btrunk control\b/gi, 'govde kontrolu')
    .replace(/\bbuild['’]?i\b/gi, 'rotasi')
    .replace(/\bbuild\w*\b/gi, 'rota')
    .replace(/\bPush\b/gi, 'Itis')
    .replace(/\bPull\b/gi, 'Cekis')
    .replace(/\bCore\b/gi, 'Govde')
    .replace(/\bRecovery\b/gi, 'toparlanma')
    .replace(/\bWorkout\b/gi, 'antrenman')
    .replace(/\bHybrid\b/gi, 'karma')
    .replace(/\bCoach\b/gi, 'ODIE')
    .replace(/\bSinyal\b/gi, 'Iz')
    .replace(/\bsinyal\b/gi, 'iz')
}

function explainButton(key, label, className = 'explain-link metric-explain') {
  return `<button type="button" class="${className}" data-explain="${escapeHtml(key)}" aria-haspopup="dialog" aria-label="${escapeHtml(label)} aciklamasini ac">${escapeHtml(label)}</button>`
}

function renderList(items = [], empty = 'Veri yok.') {
  if (!items.length) return `<div class="ask-empty">${empty}</div>`
  return items.map(item => `<li>${escapeHtml(cozyAskText(item))}</li>`).join('')
}

function summarizeLatest(item) {
  if (!item) return null
  const response = item.responseJson || {}
  return {
    id: item.id,
    question: item.question,
    title: response.title || 'ODIE yorumu',
    answer: response.answer || item.answer || '',
    evidence: Array.isArray(response.evidence) ? response.evidence.slice(0, 4) : [],
    nextSteps: Array.isArray(response.nextSteps) ? response.nextSteps.slice(0, 4) : [],
    memoryNote: response.memoryNote || '',
    routineSnapshot: response.routineSnapshot || '',
    checkIn: response.checkIn || '',
    tone: response.tone || '',
    createdAt: item.createdAt || '',
    model: item.model || '',
  }
}

function formatWhen(value = '') {
  if (!value) return 'simdi'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'simdi'
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function sampleQuestions(profile, presence = {}) {
  if (Array.isArray(presence.quickPrompts) && presence.quickPrompts.length) {
    return presence.quickPrompts
  }
  const className = cozyAskText(profile.class || 'karma rota')
  const focus = cozyAskText(profile.currentFocus || 'govde stabilitesi')
  return [
    `Bu hafta ${focus} icin en akilli 2 seans ne olsun?`,
    `${className} cizgisini korurken en cok hangi taraf geri kaliyor?`,
    'Yarin hafif ama etkili bir toparlanma gunu nasil kurulur?',
  ]
}

function requestRefresh() {
  window.__refreshActivePanel?.()
}

function renderTranscript(latest) {
  if (!latest && !askState.loadingAnswer) {
    return `
      <div class="ask-terminal-empty">
        <strong>ODIE burada.</strong>
        <p>Hevy, Apple, hafiza ve son sorulari beraber okuyup konusur gibi cevap verecek.</p>
      </div>
    `
  }

  const pending = askState.loadingAnswer
    ? `
      <article class="ask-bubble odie pending">
        <div class="ask-bubble-meta">
          <span>ODIE</span>
          <span>baglam topluyor</span>
        </div>
        <div class="ask-bubble-body">Uyku, kalp, son antrenman, hafiza ve bugunku risk ayni masada. Birazdan net konusacagim.</div>
      </article>
    `
    : ''

  if (!latest) return pending

  return `
    <article class="ask-bubble user">
        <div class="ask-bubble-meta">
          <span>SEN</span>
          <span>${formatWhen(latest.createdAt)}</span>
        </div>
      <div class="ask-bubble-body">${escapeHtml(cozyAskText(latest.question))}</div>
    </article>

    <article class="ask-bubble odie">
        <div class="ask-bubble-meta">
          <span>ODIE</span>
          <span>${escapeHtml(latest.model || 'aktif mod')}</span>
        </div>
      <div class="ask-bubble-title">${escapeHtml(cozyAskText(latest.title))}</div>
      <div class="ask-bubble-body">${escapeHtml(cozyAskText(latest.answer))}</div>
      ${latest.checkIn ? `<div class="ask-bubble-checkin">${escapeHtml(cozyAskText(latest.checkIn))}</div>` : ''}
    </article>

    ${pending}
  `
}

async function loadHistory() {
  const token = ++historyToken
  askState.loadingHistory = true
  askState.historyError = ''
  requestRefresh()

  try {
    const response = await fetch('/api/ask')
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !contentType.includes('application/json')) throw new Error(`history ${response.status}`)
    const payload = await response.json()
    if (token !== historyToken) return

    askState.items = Array.isArray(payload.items) ? payload.items : []
    askState.loaded = true
    askState.latest = askState.latest || summarizeLatest(askState.items[0] || null)
  } catch (error) {
    if (token === historyToken) {
      askState.loaded = true
      askState.historyError = 'Gecmis su an yuklenemedi.'
    }
  } finally {
    if (token === historyToken) {
      askState.loadingHistory = false
      requestRefresh()
    }
  }
}

async function submitQuestion(question) {
  const token = ++answerToken
  askState.loadingAnswer = true
  requestRefresh()

  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    const payload = await response.json()
    if (!response.ok) throw new Error(payload?.error || 'ODIE cevap veremedi')
    if (token !== answerToken) return

    const item = payload.item || null
    if (item) {
      askState.items = [item, ...askState.items.filter(existing => String(existing.id) !== String(item.id))]
      askState.latest = summarizeLatest(item)
      askState.loaded = true
    }

    showToast({
      icon: 'OD',
      title: 'ODIE yanit verdi',
      msg: askState.latest?.title || 'Yeni cevap hazir.',
      rarity: 'rare',
      duration: 2600,
    })
  } catch (error) {
    console.error('[ask] submit failed:', error)
    showToast({
      icon: '!',
      title: 'Soru gonderilemedi',
      msg: error.message || 'ODIE su an cevap veremiyor.',
      rarity: 'common',
    })
  } finally {
    if (token === answerToken) {
      askState.loadingAnswer = false
      requestRefresh()
    }
  }
}

export function renderAsk(state, profile) {
  const presence = buildOdiePresence({ state, profile })
  const latest = askState.latest || summarizeLatest(askState.items[0] || null)
  const samples = sampleQuestions(state.profile || profile, presence)
  const readiness = Number(state.health?.readiness?.score)
  const focus = state.profile?.currentFocus || 'Hybrid denge'
  const memoryCount = (state.athleteMemory || []).length
  const sourceCount = (presence.sourceLine || '').split('/').filter(Boolean).length

  return `
    <section class="surface-stack ask-page">
      <article class="glass-card ask-hero ask-hero-live">
          <div>
          <div class="eyebrow">${explainButton('ask-line', "ODIE'ye Sor", 'explain-link eyebrow-explain')}</div>
          <h3>${explainButton('ask-line', 'Sohbet et, ODIE izleri tutsun', 'explain-link explain-heading')}</h3>
          <p>${escapeHtml(presence.chatLine || 'Soruyu yaz; ODIE son rutin, hafiza ve bugunku sinyalleri beraber okuyacak.')}</p>
        </div>
        <div class="ask-hero-pills">
          <span class="ask-pill">${explainButton('class', state.profile?.classObj?.name || profile.class || 'Karakter')}</span>
          <span class="ask-pill">${Number.isFinite(readiness) ? `${readiness}/100 ${explainButton('readiness', 'hazirlik')}` : `${profile.sessions || 0} ${explainButton('session-detail', 'seans')}`}</span>
          <span class="ask-pill">${explainButton('current-focus', focus)}</span>
        </div>
      </article>

      <article class="ask-companion-card tone-${escapeHtml(presence.tone || 'calm')}">
        <div class="ask-companion-copy">
          <span>ODIE'nin defteri</span>
          <strong>${escapeHtml(presence.headline || 'Canli baglam')}</strong>
          <p>${escapeHtml(presence.routineLine || '')}</p>
        </div>
        <div class="ask-context-grid">
          <span><b>hafiza</b><strong>${memoryCount}</strong><small>aktif not</small></span>
          <span><b>kaynak</b><strong>${sourceCount}</strong><small>${escapeHtml(presence.dataConfidence ?? '--')}% net</small></span>
          <span><b>mod</b><strong>${escapeHtml(presence.moodLabel || 'canli')}</strong><small>bugunku ton</small></span>
        </div>
      </article>

      <div class="ask-layout">
        <section class="glass-card ask-console">
          <div class="ask-console-head">
            <div>
              <div class="mini-label">${explainButton('ask-line', 'ODIE Soru Defteri')}</div>
              <strong>${explainButton('ask-line', 'Sorunu yaz', 'explain-link')}</strong>
            </div>
            <span class="ask-status-chip ${askState.loadingAnswer ? 'live' : ''}">${askState.loadingAnswer ? 'OKUYOR' : 'HAZIR'}</span>
          </div>

          <div class="ask-terminal-shell">
            <div class="ask-terminal-topbar">
              <span class="ask-terminal-dot amber"></span>
              <span class="ask-terminal-dot cobalt"></span>
              <span class="ask-terminal-dot emerald"></span>
              <strong>ODIE defteri</strong>
            </div>
            <div class="ask-terminal-log">
              ${renderTranscript(latest)}
            </div>
          </div>

          <form id="odie-ask-form" class="ask-form">
            <textarea
              id="odie-ask-input"
              class="ask-input"
              rows="5"
              maxlength="600"
              placeholder="Orn: Odie, bugunku uyku + son antrenmana gore neyi abartmayalim?"
            >${escapeHtml(askState.draft)}</textarea>
            <div class="ask-form-footer">
              <div class="ask-sample-row">
                ${samples.map(sample => `<button type="button" class="ask-sample-chip" data-ask-sample="${escapeHtml(sample)}">${escapeHtml(cozyAskText(sample))}</button>`).join('')}
              </div>
              <button type="submit" class="ask-submit" ${askState.loadingAnswer ? 'disabled' : ''}>${askState.loadingAnswer ? 'ODIE okuyor...' : 'Deftere yaz'}</button>
            </div>
          </form>

          ${latest ? `
            <article class="ask-response-card">
              <div class="ask-response-top">
                <div>
                  <div class="mini-label">${explainButton('ask-answer', 'Kisa Yorum')}</div>
                  <strong>${escapeHtml(cozyAskText(latest.title))}</strong>
                </div>
                <span>${formatWhen(latest.createdAt)} / ${escapeHtml(latest.model || 'aktif mod')}</span>
              </div>
              <p class="ask-response-answer">${escapeHtml(cozyAskText(latest.answer || 'Cevap metni yok.'))}</p>
              <div class="ask-response-grid">
                <div class="ask-detail-card">
                  <div class="mini-label">${explainButton('evidence', 'Bakilan Iz')}</div>
                  <ul>${renderList(latest.evidence, 'Ek iz cikarilmadi.')}</ul>
                </div>
                <div class="ask-detail-card">
                  <div class="mini-label">${explainButton('ask-next', 'Ne Yapalim')}</div>
                  <ul>${renderList(latest.nextSteps, 'Net sonraki adim onerisi yok.')}</ul>
                </div>
              </div>
              ${latest.memoryNote ? `<div class="ask-memory-note"><span class="mini-label">${explainButton('ask-memory', 'Aklimda Tutsun')}</span><p>${escapeHtml(cozyAskText(latest.memoryNote))}</p></div>` : ''}
              ${latest.routineSnapshot ? `<div class="ask-memory-note"><span class="mini-label">Rutin Izi</span><p>${escapeHtml(cozyAskText(latest.routineSnapshot))}</p></div>` : ''}
            </article>
          ` : `
            <div class="ask-empty-state">
              <strong>Ilk soruyu sor ve ODIE'den baglama dayali cevap al.</strong>
              <p>Bu panel soru gecmisini ayri tutar; tekrar eden hedefler ve kaygilar zamanla daha okunur hale gelir.</p>
            </div>
          `}
        </section>

        <aside class="glass-card ask-history">
          <div class="ask-history-head">
            <div>
              <div class="mini-label">${explainButton('ask-history', 'Soru Gecmisi')}</div>
              <strong>${explainButton('ask-history', 'Son sorular', 'explain-link')}</strong>
            </div>
            <span class="ask-status-chip">${askState.loadingHistory ? 'ESITLENIYOR' : `${askState.items.length} kayit`}</span>
          </div>

          <div class="ask-history-list">
            ${askState.loadingHistory && !askState.items.length ? '<div class="ask-empty">Gecmis yukleniyor...</div>' : ''}
            ${askState.items.map(item => `
              <button class="ask-history-item" type="button" data-ask-history="${escapeHtml(item.id)}">
                <strong>${escapeHtml(item.question)}</strong>
                <span>${formatWhen(item.createdAt)}</span>
              </button>
            `).join('')}
            ${!askState.loadingHistory && !askState.items.length && !askState.historyError ? '<div class="ask-empty">Henuz soru gecmisi yok.</div>' : ''}
            ${askState.historyError && !askState.items.length ? `<div class="ask-empty ask-empty-error">${escapeHtml(askState.historyError)}</div>` : ''}
          </div>
        </aside>
      </div>
    </section>
  `
}

export function initAsk() {
  const form = document.getElementById('odie-ask-form')
  const input = document.getElementById('odie-ask-input')

  if (!askState.loaded && !askState.loadingHistory) {
    loadHistory()
  }

  form?.addEventListener('submit', async event => {
    event.preventDefault()
    const question = String(input?.value || '').trim()
    askState.draft = question
    if (!question || askState.loadingAnswer) return
    await submitQuestion(question)
  })

  input?.addEventListener('input', event => {
    askState.draft = event.target.value
  })

  document.querySelectorAll('[data-ask-sample]').forEach(button => {
    button.addEventListener('click', () => {
      const value = button.dataset.askSample || ''
      if (input) {
        input.value = value
        input.focus()
      }
      askState.draft = value
    })
  })

  document.querySelectorAll('[data-ask-history]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.askHistory
      const item = askState.items.find(entry => String(entry.id) === String(id))
      if (!item) return
      askState.latest = summarizeLatest(item)
      askState.draft = item.question || ''
      requestRefresh()
    })
  })
}
