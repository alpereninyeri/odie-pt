import { showToast } from './toast.js'
import { buildOdiePresence } from '../data/odie-presence.js'
import { plainCopyText } from '../data/ui-copy.js'

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
  const localized = String(value || '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
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
    .replace(/\bSinyal\b/gi, 'Not')
    .replace(/\bsinyal\b/gi, 'not')
    .replace(/\barmor\b/gi, 'akis')
    .replace(/\bkalkan\w*\s+onar/gi, 'Ritmi Yakala')
    .replace(/\bkalkan\w*/gi, 'akis')
    .replace(/\brisk\w*/gi, 'sis')
    .replace(/\btemkin\w*/gi, 'sakin rota')
    .replace(/\bconfidence\w*/gi, 'okuma')
    .replace(/\bevidence\w*/gi, 'not')
    .replace(/\bmissing\w*/gi, 'uyuyan')
    .replace(/\beksik\w*/gi, 'acik')
    .replace(/\bkanit\w*/gi, 'not')
    .replace(/kan\u0131t\w*/gi, 'not')
    .replace(/\biz netli[gğ]i\b/gi, 'okuma')
    .replace(/\bdefter\w*/gi, 'not')
  return plainCopyText(localized)
}

function compactAskText(value = '', max = 132) {
  const text = cozyAskText(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max - 3).trim()}...` : text
}

function explainButton(key, label, className = 'explain-link metric-explain') {
  return `<button type="button" class="${className}" data-explain="${escapeHtml(key)}" aria-haspopup="dialog" aria-label="${escapeHtml(label)} aciklamasini ac">${escapeHtml(label)}</button>`
}

function renderList(items = [], empty = 'Veri yok.') {
  if (!items.length) return `<div class="ask-empty">${empty}</div>`
  return items.map(item => `<li>${escapeHtml(cozyAskText(item))}</li>`).join('')
}

function renderMiniList(items = [], empty = 'temiz') {
  if (!items.length) return `<small>${escapeHtml(empty)}</small>`
  return `<small>${items.map(item => escapeHtml(compactAskText(item, 38))).join(' / ')}</small>`
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
        <p>Son kayitlara bakip kisa cevap verir.</p>
      </div>
    `
  }

  const pending = askState.loadingAnswer
    ? `
      <article class="ask-bubble odie pending">
        <div class="ask-bubble-meta">
          <span>ODIE</span>
          <span>bakiyor</span>
        </div>
        <div class="ask-bubble-body">Son kayitlara bakiyorum. Az sonra net cevap.</div>
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
  const answer = compactAskText(latest?.answer || presence.chatLine || 'Soruyu yaz; ODIE bugunku rotayi kisa okuyacak.', 66)
  const history = askState.items.slice(0, 3)

  return `
    <section class="village-ask-card tone-${escapeHtml(presence.tone || 'calm')}">
      <div class="village-ask-head">
        <span>ODIE'ye sor</span>
        <strong>${escapeHtml(latest ? compactAskText(latest.title, 36) : 'Kisa rota')}</strong>
        <em class="${askState.loadingAnswer ? 'live' : ''}">${askState.loadingAnswer ? 'okuyor' : 'hazir'}</em>
      </div>

      <div class="village-ask-signals">
        <span><b>${memoryCount}</b><small>hafiza</small></span>
        <span><b>${Number.isFinite(readiness) ? Math.round(readiness) : '--'}</b><small>hazir</small></span>
        <span><b>${sourceCount}</b><small>kayit</small></span>
      </div>

      <form id="odie-ask-form" class="village-ask-form ask-form">
        <textarea
          id="odie-ask-input"
          class="village-ask-input ask-input"
          rows="3"
          maxlength="600"
          placeholder="Bugun neyi abartmayalim?"
        >${escapeHtml(askState.draft)}</textarea>
        <div class="village-ask-tools">
          <div class="village-ask-samples">
            ${samples.slice(0, 2).map((sample, index) => `<button type="button" class="ask-sample-chip village-ask-chip" data-ask-sample="${escapeHtml(sample)}" aria-label="${escapeHtml(sample)}"><span aria-hidden="true">${index + 1}</span></button>`).join('')}
          </div>
          <button type="submit" class="ask-submit village-ask-submit" ${askState.loadingAnswer ? 'disabled' : ''}>${askState.loadingAnswer ? 'Okuyor' : 'Yaz'}</button>
        </div>
      </form>

      <article class="village-answer-card">
        <div>
          <span>${latest ? formatWhen(latest.createdAt) : compactAskText(focus, 22)}</span>
          <strong>${escapeHtml(latest ? compactAskText(latest.question, 40) : 'Rotayi okuyalim.')}</strong>
        </div>
        <p>${escapeHtml(answer)}</p>
      </article>

      ${latest ? `
        <div class="village-answer-row">
          <span><b>Not</b>${renderMiniList(latest.evidence.slice(0, 2), 'temiz')}</span>
          <span><b>Hamle</b>${renderMiniList(latest.nextSteps.slice(0, 2), 'sakin')}</span>
        </div>
      ` : ''}

      <div class="village-ask-history">
        ${askState.loadingHistory && !history.length ? '<span class="village-history-empty">Gecmis geliyor</span>' : ''}
        ${history.map(item => `
          <button class="village-history-chip" type="button" data-ask-history="${escapeHtml(item.id)}">
            ${escapeHtml(compactAskText(item.question, 42))}
          </button>
        `).join('')}
        ${!askState.loadingHistory && !history.length && !askState.historyError ? '<span class="village-history-empty">Henuz soru yok</span>' : ''}
        ${askState.historyError && !history.length ? `<span class="village-history-empty">${escapeHtml(askState.historyError)}</span>` : ''}
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
